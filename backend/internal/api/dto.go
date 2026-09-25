package api

import (
	"database/sql"
	"time"

	"github.com/taskflow/taskflow/backend/internal/db"
)

const dateLayout = "2006-01-02"

func datePtr(t sql.NullTime) *string {
	if !t.Valid {
		return nil
	}
	s := t.Time.Format(dateLayout)
	return &s
}

func timePtr(t sql.NullTime) *time.Time {
	if !t.Valid {
		return nil
	}
	v := t.Time
	return &v
}

type projectDTO struct {
	ID          uint64  `json:"id"`
	Name        string  `json:"name"`
	Description string  `json:"description"`
	Color       string  `json:"color"`
	SortOrder   float64 `json:"sort_order"`
	ArchivedAt  *string `json:"archived_at"`
	TaskCount   int64   `json:"task_count"`
	OpenCount   int64   `json:"open_count"`
}

type projectDetailDTO struct {
	ID          uint64  `json:"id"`
	Name        string  `json:"name"`
	Description string  `json:"description"`
	Color       string  `json:"color"`
	SortOrder   float64 `json:"sort_order"`
	ArchivedAt  *string `json:"archived_at"`
	CreatedAt   string  `json:"created_at"`
}

type taskDTO struct {
	ID           uint64            `json:"id"`
	ProjectID    uint64            `json:"project_id"`
	ProjectName  string            `json:"project_name,omitempty"`
	ProjectColor string            `json:"project_color,omitempty"`
	Title        string            `json:"title"`
	Description  string            `json:"description"`
	Status       string            `json:"status"`
	Priority     string            `json:"priority"`
	DueDate      *string           `json:"due_date"`
	StartDate    *string           `json:"start_date"`
	CompletedAt  *string           `json:"completed_at"`
	Locked       bool              `json:"locked"`
	SortOrder    float64           `json:"sort_order"`
	WorkDayCount int64             `json:"work_day_count"`
	WorkDays     []string          `json:"work_days,omitempty"`
	CreatedAt    string            `json:"created_at"`
	UpdatedAt    string            `json:"updated_at"`
	WorkDayNotes map[string]string `json:"work_day_notes,omitempty"`
}

func projectDetailFromRow(r db.GetProjectRow) projectDetailDTO {
	return projectDetailDTO{
		ID:          r.ID,
		Name:        r.Name,
		Description: r.Description,
		Color:       r.Color,
		SortOrder:   r.SortOrder,
		ArchivedAt:  nullableRFC3339(r.ArchivedAt),
		CreatedAt:   r.CreatedAt.UTC().Format(time.RFC3339),
	}
}

func projectSummaryFromRow(r db.ListProjectsRow) projectDTO {
	return projectDTO{
		ID:          r.ID,
		Name:        r.Name,
		Description: r.Description,
		Color:       r.Color,
		SortOrder:   r.SortOrder,
		ArchivedAt:  nullableRFC3339(r.ArchivedAt),
		TaskCount:   r.TaskCount,
		OpenCount:   r.OpenCount,
	}
}

type boardColumnDTO struct {
	Status   string    `json:"status"`
	Total    int       `json:"total"`
	Hidden   int       `json:"hidden"`
	Tasks    []taskDTO `json:"tasks"`
	IsLocked bool      `json:"is_locked"`
}

type boardDTO struct {
	Project  projectDetailDTO `json:"project"`
	Columns  []boardColumnDTO `json:"columns"`
	Filtered bool             `json:"filtered"`
}
