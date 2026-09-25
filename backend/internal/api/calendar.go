package api

import (
	"database/sql"
	"errors"
	"net/http"
	"sort"
	"time"

	"github.com/taskflow/taskflow/backend/internal/db"
)

type calendarEntryDTO struct {
	TaskID       uint64 `json:"task_id"`
	Title        string `json:"title"`
	Status       string `json:"status"`
	Priority     string `json:"priority"`
	Locked       bool   `json:"locked"`
	ProjectID    uint64 `json:"project_id"`
	ProjectName  string `json:"project_name"`
	ProjectColor string `json:"project_color"`
}

type calendarDayDTO struct {
	Date string `json:"date"`
	// Logged counts the tasks with work recorded on this day.
	Logged int `json:"logged"`
	// Due counts the tasks whose due date falls on this day.
	Due int `json:"due"`
	// Both is the union, used when a caller does not pick a view.
	Both  int                `json:"both"`
	Tasks []calendarEntryDTO `json:"tasks"`
	// DueTasks is the set of tasks due on this day.
	DueTasks []calendarEntryDTO `json:"due_tasks"`
	Counts   map[string]int     `json:"counts"`
}

// GetCalendar returns, for every day in the range, both the tasks that have work
// logged on it and the tasks that are due on it. Serving both from one request is
// what lets the UI switch between the logged and due views instantly.
func (s *Server) GetCalendar(w http.ResponseWriter, r *http.Request) {
	f, err := parseFilters(r, true)
	if err != nil {
		badRequest(w, err)
		return
	}
	now := time.Now().UTC()
	firstOfThisMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)

	from, err := requiredDate(r, "from", firstOfThisMonth)
	if err != nil {
		badRequest(w, err)
		return
	}
	to, err := requiredDate(r, "to", from.AddDate(0, 1, -1))
	if err != nil {
		badRequest(w, err)
		return
	}
	if to.Before(from) {
		from, to = to, from
	}
	if to.Sub(from) > 400*24*time.Hour {
		badRequest(w, errors.New("date range must be 400 days or fewer"))
		return
	}

	logged, err := s.q.ListCalendarEntries(r.Context(), db.ListCalendarEntriesParams{
		FromDate:   from,
		ToDate:     to,
		ProjectIds: f.projectCSV(),
		Status:     nullableString(f.Status),
		Priority:   nullableString(f.Priority),
		Q:          f.Query,
	})
	if err != nil {
		serverError(w, err)
		return
	}
	due, err := s.q.ListCalendarDueEntries(r.Context(), db.ListCalendarDueEntriesParams{
		FromDate:   sql.NullTime{Time: from, Valid: true},
		ToDate:     sql.NullTime{Time: to, Valid: true},
		ProjectIds: f.projectCSV(),
		Status:     nullableString(f.Status),
		Priority:   nullableString(f.Priority),
		Q:          f.Query,
	})
	if err != nil {
		serverError(w, err)
		return
	}

	days := map[string]*calendarDayDTO{}
	day := func(date string) *calendarDayDTO {
		if existing, ok := days[date]; ok {
			return existing
		}
		created := &calendarDayDTO{
			Date:     date,
			Tasks:    []calendarEntryDTO{},
			DueTasks: []calendarEntryDTO{},
			Counts:   map[string]int{"todo": 0, "ongoing": 0, "done": 0},
		}
		days[date] = created
		return created
	}

	for _, row := range logged {
		key := row.WorkDate.Format(dateLayout)
		d := day(key)
		entry := entryFromRow(row.TaskID, row.Title, row.Status, row.Priority, row.Locked, row.ProjectID, row.ProjectName, row.ProjectColor)
		d.Tasks = append(d.Tasks, entry)
		d.Counts[row.Status]++
	}
	for _, row := range due {
		key := row.DueDate.Time.Format(dateLayout)
		d := day(key)
		d.DueTasks = append(d.DueTasks, entryFromRow(row.TaskID, row.Title, row.Status, row.Priority, row.Locked, row.ProjectID, row.ProjectName, row.ProjectColor))
	}

	out := make([]calendarDayDTO, 0, len(days))
	for _, d := range days {
		d.Logged = len(d.Tasks)
		d.Due = len(d.DueTasks)
		d.Both = d.Logged
		for _, t := range d.DueTasks {
			if !containsTask(d.Tasks, t.TaskID) {
				d.Both++
			}
		}
		out = append(out, *d)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Date < out[j].Date })

	writeJSON(w, http.StatusOK, map[string]any{
		"from": from.Format(dateLayout),
		"to":   to.Format(dateLayout),
		"days": out,
	})
}

func entryFromRow(id uint64, title, status, priority string, locked bool, projectID uint64, projectName, projectColor string) calendarEntryDTO {
	return calendarEntryDTO{
		TaskID:       id,
		Title:        title,
		Status:       status,
		Priority:     priority,
		Locked:       locked,
		ProjectID:    projectID,
		ProjectName:  projectName,
		ProjectColor: projectColor,
	}
}

func containsTask(list []calendarEntryDTO, id uint64) bool {
	for _, t := range list {
		if t.TaskID == id {
			return true
		}
	}
	return false
}

func nullableString(v string) sql.NullString {
	if v == "" {
		return sql.NullString{}
	}
	return sql.NullString{String: v, Valid: true}
}
