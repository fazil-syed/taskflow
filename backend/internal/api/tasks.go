package api

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/taskflow/taskflow/backend/internal/db"
)

type filters struct {
	ProjectIDs []string
	Status     string
	Priority   string
	Due        string
	Query      string
}

func (f filters) active() bool {
	return len(f.ProjectIDs) > 0 || f.Status != "" || f.Priority != "" || f.Due != "" || f.Query != ""
}

func parseFilters(r *http.Request, allowPriority bool) (filters, error) {
	f := filters{
		ProjectIDs: queryList(r, "project_id"),
		Status:     r.URL.Query().Get("status"),
		Priority:   r.URL.Query().Get("priority"),
		Due:        r.URL.Query().Get("due"),
		Query:      strings.TrimSpace(r.URL.Query().Get("q")),
	}
	if f.Status != "" && !validStatuses[f.Status] {
		return f, fmt.Errorf("status must be one of todo, ongoing, done")
	}
	if f.Priority != "" {
		if !allowPriority {
			f.Priority = ""
		} else if !validPriorities[f.Priority] {
			return f, fmt.Errorf("priority must be one of low, normal, high, urgent")
		}
	}
	if f.Due != "" && f.Due != "overdue" && f.Due != "week" && f.Due != "none" {
		return f, fmt.Errorf("due must be one of overdue, week, none")
	}
	if len(f.ProjectIDs) > 200 {
		return f, errors.New("too many project filters")
	}
	return f, nil
}

func (f filters) projectCSV() string {
	return strings.Join(f.ProjectIDs, ",")
}

// GetBoard returns a project plus its three queues.
func (s *Server) GetBoard(w http.ResponseWriter, r *http.Request) {
	projectID, err := pathUint(r, "id")
	if err != nil {
		badRequest(w, errors.New("invalid project id"))
		return
	}
	f, err := parseFilters(r, true)
	if err != nil {
		badRequest(w, err)
		return
	}

	project, err := s.q.GetProject(r.Context(), projectID)
	if err != nil {
		notFound(w, "project")
		return
	}
	unfiltered, err := s.boardRows(r.Context(), projectID, filters{})
	if err != nil {
		serverError(w, err)
		return
	}
	filtered, err := s.boardRows(r.Context(), projectID, f)
	if err != nil {
		serverError(w, err)
		return
	}

	counts := map[string]int{}
	for status, list := range unfiltered {
		counts[status] = len(list)
	}

	columns := make([]boardColumnDTO, 0, 3)
	for _, status := range []string{"todo", "ongoing", "done"} {
		col := boardColumnDTO{Status: status, Total: counts[status], Tasks: []taskDTO{}, IsLocked: status == "done"}
		for _, t := range filtered[status] {
			col.Tasks = append(col.Tasks, t)
		}
		col.Hidden = counts[status] - len(col.Tasks)
		if col.Hidden < 0 {
			col.Hidden = 0
		}
		columns = append(columns, col)
	}

	writeJSON(w, http.StatusOK, boardDTO{
		Project:  projectDetailFromRow(project),
		Columns:  columns,
		Filtered: f.active(),
	})
}

func (s *Server) boardRows(ctx context.Context, projectID uint64, f filters) (map[string][]taskDTO, error) {
	rows, err := s.q.ListBoardTasks(ctx, db.ListBoardTasksParams{
		ProjectID: projectID,
		Status:    f.Status,
		Priority:  f.Priority,
		Q:         f.Query,
		Due:       f.Due,
	})
	if err != nil {
		return nil, err
	}
	ids := make([]uint64, 0, len(rows))
	byID := make(map[uint64]db.ListBoardTasksRow, len(rows))
	for _, row := range rows {
		ids = append(ids, row.ID)
		byID[row.ID] = row
	}
	workDays, err := s.workDaysByTask(ctx, ids)
	if err != nil {
		return nil, err
	}

	out := map[string][]taskDTO{"todo": {}, "ongoing": {}, "done": {}}
	for _, id := range ids {
		row := byID[id]
		dto := boardTaskToDTO(row, workDays[id])
		out[row.Status] = append(out[row.Status], dto)
	}
	return out, nil
}

func boardTaskToDTO(row db.ListBoardTasksRow, days []workDay) taskDTO {
	daysList := make([]string, 0, len(days))
	notes := make(map[string]string, len(days))
	for _, d := range days {
		daysList = append(daysList, d.date)
		if d.note != "" {
			notes[d.date] = d.note
		}
	}
	return taskDTO{
		ID:           row.ID,
		ProjectID:    row.ProjectID,
		Title:        row.Title,
		Description:  row.Description,
		Status:       row.Status,
		Priority:     row.Priority,
		DueDate:      datePtr(row.DueDate),
		StartDate:    datePtr(row.StartDate),
		CompletedAt:  nullableRFC3339(row.CompletedAt),
		Locked:       row.Locked,
		SortOrder:    row.SortOrder,
		WorkDayCount: row.WorkDayCount,
		WorkDays:     daysList,
		WorkDayNotes: notes,
		CreatedAt:    row.CreatedAt.UTC().Format(time.RFC3339),
		UpdatedAt:    row.UpdatedAt.UTC().Format(time.RFC3339),
	}
}

type workDay struct {
	date string
	note string
}

func (s *Server) workDaysByTask(ctx context.Context, taskIDs []uint64) (map[uint64][]workDay, error) {
	out := map[uint64][]workDay{}
	if len(taskIDs) == 0 {
		return out, nil
	}
	rows, err := s.q.ListWorkDaysForTasks(ctx, taskIDs)
	if err != nil {
		return nil, err
	}
	for _, row := range rows {
		out[row.TaskID] = append(out[row.TaskID], workDay{
			date: row.WorkDate.Format(dateLayout),
		})
	}
	return out, nil
}

// ListTasks powers the global task list across all projects.
func (s *Server) ListTasks(w http.ResponseWriter, r *http.Request) {
	f, err := parseFilters(r, true)
	if err != nil {
		badRequest(w, err)
		return
	}
	rows, err := s.q.ListTasks(r.Context(), db.ListTasksParams{
		ProjectIds: f.projectCSV(),
		Status:     f.Status,
		Priority:   f.Priority,
		Q:          f.Query,
		Due:        f.Due,
	})
	if err != nil {
		serverError(w, err)
		return
	}
	ids := make([]uint64, 0, len(rows))
	byID := make(map[uint64]db.ListTasksRow, len(rows))
	for _, row := range rows {
		ids = append(ids, row.ID)
		byID[row.ID] = row
	}
	workDays, err := s.workDaysByTask(r.Context(), ids)
	if err != nil {
		serverError(w, err)
		return
	}
	out := make([]taskDTO, 0, len(rows))
	for _, id := range ids {
		row := byID[id]
		dto := boardTaskToDTO(db.ListBoardTasksRow{
			ID: row.ID, ProjectID: row.ProjectID, Title: row.Title, Description: row.Description,
			Status: row.Status, Priority: row.Priority, DueDate: row.DueDate, StartDate: row.StartDate,
			CompletedAt: row.CompletedAt, Locked: row.Locked, SortOrder: row.SortOrder,
			CreatedAt: row.CreatedAt, UpdatedAt: row.UpdatedAt, WorkDayCount: row.WorkDayCount,
		}, workDays[id])
		dto.ProjectName = row.ProjectName
		dto.ProjectColor = row.ProjectColor
		out = append(out, dto)
	}
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) GetTask(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		badRequest(w, errors.New("invalid task id"))
		return
	}
	row, err := s.q.GetTask(r.Context(), id)
	if err != nil {
		notFound(w, "task")
		return
	}
	days, err := s.q.ListWorkDays(r.Context(), id)
	if err != nil {
		serverError(w, err)
		return
	}
	wd := make([]workDay, 0, len(days))
	for _, d := range days {
		wd = append(wd, workDay{date: d.WorkDate.Format(dateLayout), note: d.Note})
	}
	dto := taskDTO{
		ID:           row.ID,
		ProjectID:    row.ProjectID,
		ProjectName:  row.ProjectName,
		ProjectColor: row.ProjectColor,
		Title:        row.Title,
		Description:  row.Description,
		Status:       row.Status,
		Priority:     row.Priority,
		DueDate:      datePtr(row.DueDate),
		StartDate:    datePtr(row.StartDate),
		CompletedAt:  nullableRFC3339(row.CompletedAt),
		Locked:       row.Locked,
		SortOrder:    row.SortOrder,
		CreatedAt:    row.CreatedAt.UTC().Format(time.RFC3339),
		UpdatedAt:    row.UpdatedAt.UTC().Format(time.RFC3339),
	}
	dayList := make([]string, 0, len(wd))
	notes := make(map[string]string)
	for _, d := range wd {
		dayList = append(dayList, d.date)
		if d.note != "" {
			notes[d.date] = d.note
		}
	}
	dto.WorkDays = dayList
	dto.WorkDayNotes = notes
	dto.WorkDayCount = int64(len(dayList))
	writeJSON(w, http.StatusOK, dto)
}

type taskInput struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	Priority    string `json:"priority"`
	DueDate     string `json:"due_date"`
}

func (in *taskInput) normalize() error {
	in.Title = strings.TrimSpace(in.Title)
	if in.Title == "" {
		return errors.New("title is required")
	}
	if len(in.Title) > 255 {
		return errors.New("title must be 255 characters or fewer")
	}
	if in.Priority == "" {
		in.Priority = "normal"
	}
	if !validPriorities[in.Priority] {
		return errors.New("priority must be one of low, normal, high, urgent")
	}
	return nil
}

func (in *taskInput) due() (sql.NullTime, error) {
	if in.DueDate == "" {
		return sql.NullTime{}, nil
	}
	t, err := time.Parse(dateLayout, in.DueDate)
	if err != nil {
		return sql.NullTime{}, errors.New("due_date must be formatted YYYY-MM-DD")
	}
	return sql.NullTime{Time: t, Valid: true}, nil
}

func (s *Server) CreateTask(w http.ResponseWriter, r *http.Request) {
	projectID, err := pathUint(r, "id")
	if err != nil {
		badRequest(w, errors.New("invalid project id"))
		return
	}
	if _, err := s.q.GetProject(r.Context(), projectID); err != nil {
		notFound(w, "project")
		return
	}
	var in taskInput
	if err := decodeJSON(r, &in); err != nil {
		badRequest(w, err)
		return
	}
	if err := in.normalize(); err != nil {
		badRequest(w, err)
		return
	}
	due, err := in.due()
	if err != nil {
		badRequest(w, err)
		return
	}
	sortOrder, err := s.nextTaskSort(r.Context(), projectID, "todo")
	if err != nil {
		serverError(w, err)
		return
	}
	id, err := s.insertTask(r.Context(), db.CreateTaskParams{
		ProjectID:   projectID,
		Title:       in.Title,
		Description: in.Description,
		Status:      "todo",
		Priority:    in.Priority,
		DueDate:     due,
		SortOrder:   sortOrder,
	})
	if err != nil {
		serverError(w, err)
		return
	}
	s.writeTask(w, r, id, http.StatusCreated)
}

// fetchTaskLocked loads a task and reports whether mutations are currently refused.
func (s *Server) fetchTask(r *http.Request, id uint64) (db.GetTaskRow, bool, error) {
	row, err := s.q.GetTask(r.Context(), id)
	if err != nil {
		return db.GetTaskRow{}, false, err
	}
	return row, row.Locked, nil
}

func (s *Server) writeTask(w http.ResponseWriter, r *http.Request, id uint64, status int) {
	row, err := s.q.GetTask(r.Context(), id)
	if err != nil {
		serverError(w, err)
		return
	}
	days, err := s.q.ListWorkDays(r.Context(), id)
	if err != nil {
		serverError(w, err)
		return
	}
	dto := taskDTO{
		ID: row.ID, ProjectID: row.ProjectID, ProjectName: row.ProjectName, ProjectColor: row.ProjectColor,
		Title: row.Title, Description: row.Description, Status: row.Status, Priority: row.Priority,
		DueDate: datePtr(row.DueDate), StartDate: datePtr(row.StartDate),
		CompletedAt: nullableRFC3339(row.CompletedAt), Locked: row.Locked, SortOrder: row.SortOrder,
		CreatedAt: row.CreatedAt.UTC().Format(time.RFC3339), UpdatedAt: row.UpdatedAt.UTC().Format(time.RFC3339),
	}
	list := make([]string, 0, len(days))
	notes := make(map[string]string)
	for _, d := range days {
		list = append(list, d.WorkDate.Format(dateLayout))
		if d.Note != "" {
			notes[d.WorkDate.Format(dateLayout)] = d.Note
		}
	}
	dto.WorkDays = list
	dto.WorkDayNotes = notes
	dto.WorkDayCount = int64(len(list))
	writeJSON(w, status, dto)
}

// insertTask mirrors insertProject: the insert and the LAST_INSERT_ID lookup
// must share a connection.
func (s *Server) insertTask(ctx context.Context, params db.CreateTaskParams) (uint64, error) {
	tx, err := s.conn.BeginTx(ctx, nil)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()
	if _, err := db.New(tx).CreateTask(ctx, params); err != nil {
		return 0, err
	}
	row, err := db.New(tx).LastInsertID(ctx)
	if err != nil {
		return 0, err
	}
	if err := tx.Commit(); err != nil {
		return 0, err
	}
	return uint64(row), nil
}

func (s *Server) UpdateTask(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		badRequest(w, errors.New("invalid task id"))
		return
	}
	_, isLocked, err := s.fetchTask(r, id)
	if err != nil {
		notFound(w, "task")
		return
	}
	if isLocked {
		lockedError(w)
		return
	}
	var in taskInput
	if err := decodeJSON(r, &in); err != nil {
		badRequest(w, err)
		return
	}
	if err := in.normalize(); err != nil {
		badRequest(w, err)
		return
	}
	due, err := in.due()
	if err != nil {
		badRequest(w, err)
		return
	}
	if _, err := s.q.UpdateTask(r.Context(), db.UpdateTaskParams{
		ID:          id,
		Title:       in.Title,
		Description: in.Description,
		Priority:    in.Priority,
		DueDate:     due,
	}); err != nil {
		serverError(w, err)
		return
	}
	s.writeTask(w, r, id, http.StatusOK)
}

func (s *Server) DeleteTask(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		badRequest(w, errors.New("invalid task id"))
		return
	}
	_, isLocked, err := s.fetchTask(r, id)
	if err != nil {
		notFound(w, "task")
		return
	}
	if isLocked && r.URL.Query().Get("force") != "1" {
		lockedError(w)
		return
	}
	if err := s.q.DeleteTask(r.Context(), id); err != nil {
		serverError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) nextTaskSort(ctx context.Context, projectID uint64, status string) (float64, error) {
	rows, err := s.q.ListBoardTasks(ctx, db.ListBoardTasksParams{
		ProjectID: projectID, Status: status, Priority: "", Q: "", Due: "",
	})
	if err != nil {
		return 0, err
	}
	if len(rows) == 0 {
		return 0, nil
	}
	last := rows[len(rows)-1].SortOrder
	return last + 1, nil
}

type moveInput struct {
	Status string `json:"status"`
	// PrevID is the task that should end up directly before the moved task, and
	// NextID the one directly after it. Either may be nil at a queue boundary.
	PrevID *uint64 `json:"prev_id"`
	NextID *uint64 `json:"next_id"`
}

// MoveTask reorders a task inside a queue or moves it to another queue. The
// neighbouring ids it should land between are given explicitly so the client
// never has to renumber a whole column.
func (s *Server) MoveTask(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		badRequest(w, errors.New("invalid task id"))
		return
	}
	row, isLocked, err := s.fetchTask(r, id)
	if err != nil {
		notFound(w, "task")
		return
	}

	var in moveInput
	if err := decodeJSON(r, &in); err != nil {
		badRequest(w, err)
		return
	}
	if in.Status == "" {
		in.Status = row.Status
	}
	if !validStatuses[in.Status] {
		badRequest(w, errors.New("status must be one of todo, ongoing, done"))
		return
	}

	// A locked task can only be moved as part of an explicit unlock.
	if isLocked && in.Status != "done" {
		lockedError(w)
		return
	}

	sortOrder, err := s.computeSortOrder(r.Context(), row.ProjectID, in.Status, id, in.PrevID, in.NextID)
	if err != nil {
		serverError(w, err)
		return
	}
	if err := s.q.SetTaskSort(r.Context(), db.SetTaskSortParams{ID: id, SortOrder: sortOrder}); err != nil {
		serverError(w, err)
		return
	}
	if in.Status != row.Status {
		if _, err := s.q.SetTaskStatus(r.Context(), db.SetTaskStatusParams{
			ID:     id,
			Status: in.Status,
		}); err != nil {
			serverError(w, err)
			return
		}
	}
	s.writeTask(w, r, id, http.StatusOK)
}

// computeSortOrder derives the new sort_order from the two neighbours the task
// should land between. Only the moved row is written, so a drag never renumbers
// the whole queue.
func (s *Server) computeSortOrder(
	ctx context.Context,
	projectID uint64,
	status string,
	selfID uint64,
	prevID, nextID *uint64,
) (float64, error) {
	// A neighbour that has since been deleted, or that lives in another queue,
	// simply does not constrain the position.
	lookup := func(candidate *uint64) (*float64, error) {
		if candidate == nil || *candidate == selfID {
			return nil, nil
		}
		row, err := s.q.GetTask(ctx, *candidate)
		if err != nil {
			return nil, nil
		}
		if row.ProjectID != projectID || row.Status != status {
			return nil, nil
		}
		order := row.SortOrder
		return &order, nil
	}

	prev, err := lookup(prevID)
	if err != nil {
		return 0, err
	}
	next, err := lookup(nextID)
	if err != nil {
		return 0, err
	}

	switch {
	case prev != nil && next != nil:
		if *next <= *prev {
			// The neighbours are coincident or inverted; step past the previous one.
			return *prev + 1, nil
		}
		return (*prev + *next) / 2, nil
	case prev != nil:
		return *prev + 1, nil
	case next != nil:
		return *next - 1, nil
	default:
		return 0, nil
	}
}

type startInput struct {
	StartDate string `json:"start_date"`
}

func (s *Server) StartTask(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		badRequest(w, errors.New("invalid task id"))
		return
	}
	row, isLocked, err := s.fetchTask(r, id)
	if err != nil {
		notFound(w, "task")
		return
	}
	if isLocked {
		lockedError(w)
		return
	}
	var in startInput
	if err := decodeJSON(r, &in); err != nil {
		badRequest(w, err)
		return
	}
	date := in.StartDate
	if date == "" {
		date = time.Now().Format(dateLayout)
	}
	t, err := time.Parse(dateLayout, date)
	if err != nil {
		badRequest(w, errors.New("start_date must be formatted YYYY-MM-DD"))
		return
	}
	if _, err := s.q.SetTaskStart(r.Context(), db.SetTaskStartParams{ID: id, StartDate: sql.NullTime{Time: t, Valid: true}}); err != nil {
		serverError(w, err)
		return
	}
	sortOrder, err := s.nextTaskSort(r.Context(), row.ProjectID, "ongoing")
	if err != nil {
		serverError(w, err)
		return
	}
	if err := s.q.SetTaskSort(r.Context(), db.SetTaskSortParams{ID: id, SortOrder: sortOrder}); err != nil {
		serverError(w, err)
		return
	}
	s.writeTask(w, r, id, http.StatusOK)
}

type statusInput struct {
	Status string `json:"status"`
}

func (s *Server) SetTaskStatus(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		badRequest(w, errors.New("invalid task id"))
		return
	}
	row, isLocked, err := s.fetchTask(r, id)
	if err != nil {
		notFound(w, "task")
		return
	}
	var in statusInput
	if err := decodeJSON(r, &in); err != nil {
		badRequest(w, err)
		return
	}
	if !validStatuses[in.Status] {
		badRequest(w, errors.New("status must be one of todo, ongoing, done"))
		return
	}
	if isLocked && in.Status != "done" {
		lockedError(w)
		return
	}
	if row.Status == "todo" && in.Status == "ongoing" {
		s.StartTask(w, r)
		return
	}
	if _, err := s.q.SetTaskStatus(r.Context(), db.SetTaskStatusParams{ID: id, Status: in.Status}); err != nil {
		serverError(w, err)
		return
	}
	s.writeTask(w, r, id, http.StatusOK)
}

// CompleteTask moves a task into the finished queue and locks it. Locked tasks
// reject every other mutation until UnlockTask is called.
func (s *Server) CompleteTask(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		badRequest(w, errors.New("invalid task id"))
		return
	}
	if _, err := s.q.GetTask(r.Context(), id); err != nil {
		notFound(w, "task")
		return
	}
	if _, err := s.q.SetTaskStatus(r.Context(), db.SetTaskStatusParams{ID: id, Status: "done"}); err != nil {
		serverError(w, err)
		return
	}
	s.writeTask(w, r, id, http.StatusOK)
}

func (s *Server) UnlockTask(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		badRequest(w, errors.New("invalid task id"))
		return
	}
	if _, err := s.q.GetTask(r.Context(), id); err != nil {
		notFound(w, "task")
		return
	}
	if _, err := s.q.SetTaskLocked(r.Context(), db.SetTaskLockedParams{ID: id, Locked: false}); err != nil {
		serverError(w, err)
		return
	}
	s.writeTask(w, r, id, http.StatusOK)
}

func (s *Server) LockTask(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		badRequest(w, errors.New("invalid task id"))
		return
	}
	if _, err := s.q.GetTask(r.Context(), id); err != nil {
		notFound(w, "task")
		return
	}
	if _, err := s.q.SetTaskLocked(r.Context(), db.SetTaskLockedParams{ID: id, Locked: true}); err != nil {
		serverError(w, err)
		return
	}
	s.writeTask(w, r, id, http.StatusOK)
}

type workDayInput struct {
	WorkDate string `json:"work_date"`
	Note     string `json:"note"`
}

func (s *Server) AddWorkDay(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		badRequest(w, errors.New("invalid task id"))
		return
	}
	row, isLocked, err := s.fetchTask(r, id)
	if err != nil {
		notFound(w, "task")
		return
	}
	if isLocked {
		lockedError(w)
		return
	}
	if row.Status == "todo" {
		badRequest(w, errors.New("start this task before logging work on it"))
		return
	}
	var in workDayInput
	if err := decodeJSON(r, &in); err != nil {
		badRequest(w, err)
		return
	}
	t, err := time.Parse(dateLayout, in.WorkDate)
	if err != nil {
		badRequest(w, errors.New("work_date must be formatted YYYY-MM-DD"))
		return
	}
	if len(in.Note) > 255 {
		badRequest(w, errors.New("note must be 255 characters or fewer"))
		return
	}
	if _, err := s.q.AddWorkDay(r.Context(), db.AddWorkDayParams{
		TaskID:   id,
		WorkDate: t,
		Note:     in.Note,
	}); err != nil {
		serverError(w, err)
		return
	}
	s.writeTask(w, r, id, http.StatusCreated)
}

func (s *Server) RemoveWorkDay(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		badRequest(w, errors.New("invalid task id"))
		return
	}
	_, isLocked, err := s.fetchTask(r, id)
	if err != nil {
		notFound(w, "task")
		return
	}
	if isLocked {
		lockedError(w)
		return
	}
	t, err := time.Parse(dateLayout, chi.URLParam(r, "date"))
	if err != nil {
		badRequest(w, errors.New("date must be formatted YYYY-MM-DD"))
		return
	}
	if err := s.q.RemoveWorkDay(r.Context(), db.RemoveWorkDayParams{TaskID: id, WorkDate: t}); err != nil {
		serverError(w, err)
		return
	}
	s.writeTask(w, r, id, http.StatusOK)
}
