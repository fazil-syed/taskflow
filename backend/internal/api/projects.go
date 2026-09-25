package api

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/taskflow/taskflow/backend/internal/db"
)

type Server struct {
	conn *sql.DB
	q    *db.Queries
}

func NewServer(conn *sql.DB) *Server {
	return &Server{conn: conn, q: db.New(conn)}
}

type projectInput struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Color       string `json:"color"`
}

func (in *projectInput) normalize() error {
	in.Name = strings.TrimSpace(in.Name)
	if in.Name == "" {
		return errors.New("name is required")
	}
	if len(in.Name) > 160 {
		return errors.New("name must be 160 characters or fewer")
	}
	if in.Color == "" {
		in.Color = "#6366f1"
	}
	return nil
}

func (s *Server) ListProjects(w http.ResponseWriter, r *http.Request) {
	includeArchived := queryInt(r, "include_archived", 0)
	rows, err := s.q.ListProjects(r.Context(), int64(includeArchived))
	if err != nil {
		serverError(w, err)
		return
	}
	out := make([]projectDTO, 0, len(rows))
	for _, row := range rows {
		out = append(out, projectSummaryFromRow(row))
	}
	writeJSON(w, http.StatusOK, out)
}

func nullableRFC3339(t sql.NullTime) *string {
	if !t.Valid {
		return nil
	}
	s := t.Time.UTC().Format("2006-01-02T15:04:05Z07:00")
	return &s
}

func (s *Server) CreateProject(w http.ResponseWriter, r *http.Request) {
	var in projectInput
	if err := decodeJSON(r, &in); err != nil {
		badRequest(w, err)
		return
	}
	if err := in.normalize(); err != nil {
		badRequest(w, err)
		return
	}
	sortOrder, err := s.nextProjectSort(r.Context())
	if err != nil {
		serverError(w, err)
		return
	}
	id, err := s.insertProject(r.Context(), db.CreateProjectParams{
		Name:        in.Name,
		Description: in.Description,
		Color:       in.Color,
		SortOrder:   sortOrder,
	})
	if err != nil {
		serverError(w, err)
		return
	}
	row, err := s.q.GetProject(r.Context(), id)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, projectDetailFromRow(row))
}

// insertProject runs the insert and the LAST_INSERT_ID lookup on one connection
// so the generated id is reliable.
func (s *Server) insertProject(ctx context.Context, params db.CreateProjectParams) (uint64, error) {
	tx, err := s.conn.BeginTx(ctx, nil)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()
	if _, err := db.New(tx).CreateProject(ctx, params); err != nil {
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

func (s *Server) nextProjectSort(ctx context.Context) (float64, error) {
	rows, err := s.q.ListProjects(ctx, int64(0))
	if err != nil {
		return 0, err
	}
	if len(rows) == 0 {
		return 0, nil
	}
	return rows[len(rows)-1].SortOrder + 1, nil
}

func (s *Server) UpdateProject(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		badRequest(w, errors.New("invalid project id"))
		return
	}
	var in projectInput
	if err := decodeJSON(r, &in); err != nil {
		badRequest(w, err)
		return
	}
	if err := in.normalize(); err != nil {
		badRequest(w, err)
		return
	}
	if _, err := s.q.UpdateProject(r.Context(), db.UpdateProjectParams{
		ID:          id,
		Name:        in.Name,
		Description: in.Description,
		Color:       in.Color,
	}); err != nil {
		serverError(w, err)
		return
	}
	row, err := s.q.GetProject(r.Context(), id)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, projectDetailFromRow(row))
}

func (s *Server) DeleteProject(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		badRequest(w, errors.New("invalid project id"))
		return
	}
	if err := s.q.DeleteProject(r.Context(), id); err != nil {
		serverError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) SetProjectArchived(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		badRequest(w, errors.New("invalid project id"))
		return
	}
	var in struct {
		Archived bool `json:"archived"`
	}
	if err := decodeJSON(r, &in); err != nil {
		badRequest(w, err)
		return
	}
	var ts sql.NullTime
	if in.Archived {
		ts = sql.NullTime{Time: time.Now().UTC(), Valid: true}
	}
	if _, err := s.q.SetProjectArchived(r.Context(), db.SetProjectArchivedParams{
		ID:         id,
		ArchivedAt: ts,
	}); err != nil {
		serverError(w, err)
		return
	}
	row, err := s.q.GetProject(r.Context(), id)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, projectDetailFromRow(row))
}

type reorderItem struct {
	ID        uint64  `json:"id"`
	SortOrder float64 `json:"sort_order"`
}

func (s *Server) ReorderProjects(w http.ResponseWriter, r *http.Request) {
	var items []reorderItem
	if err := decodeJSON(r, &items); err != nil {
		badRequest(w, err)
		return
	}
	if len(items) == 0 {
		badRequest(w, errors.New("no projects supplied"))
		return
	}
	tx, err := s.conn.BeginTx(r.Context(), nil)
	if err != nil {
		serverError(w, err)
		return
	}
	defer tx.Rollback()
	txq := s.q.WithTx(tx)
	for _, it := range items {
		if err := txq.SetProjectSort(r.Context(), db.SetProjectSortParams{
			ID:        it.ID,
			SortOrder: it.SortOrder,
		}); err != nil {
			serverError(w, err)
			return
		}
	}
	if err := tx.Commit(); err != nil {
		serverError(w, err)
		return
	}
	rows, err := s.q.ListProjects(r.Context(), 0)
	if err != nil {
		serverError(w, err)
		return
	}
	out := make([]projectDTO, 0, len(rows))
	for _, row := range rows {
		out = append(out, projectSummaryFromRow(row))
	}
	writeJSON(w, http.StatusOK, out)
}
