package api

import (
	"database/sql"
	"encoding/csv"
	"errors"
	"fmt"
	"log"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/taskflow/taskflow/backend/internal/db"
)

type exportTask struct {
	Project       string   `json:"project"`
	Title         string   `json:"title"`
	Description   string   `json:"description"`
	Status        string   `json:"status"`
	Priority      string   `json:"priority"`
	DueDate       *string  `json:"due_date"`
	StartDate     *string  `json:"start_date"`
	CompletedAt   *string  `json:"completed_at"`
	Locked        bool     `json:"locked"`
	DaysInRange   int      `json:"days_in_range"`
	TotalWorkDays int      `json:"total_work_days"`
	WorkDays      []string `json:"work_days"`
}

type exportResponse struct {
	From   string       `json:"from"`
	To     string       `json:"to"`
	Format string       `json:"format"`
	Count  int          `json:"count"`
	Tasks  []exportTask `json:"tasks"`
}

// ExportTasks returns the tasks with any activity in the requested window, as
// CSV (the default) or JSON. The range can be scoped to one project or to all of
// them, which covers both a single-project export and a monthly one.
func (s *Server) ExportTasks(w http.ResponseWriter, r *http.Request) {
	f, err := parseFilters(r, true)
	if err != nil {
		badRequest(w, err)
		return
	}
	now := time.Now().UTC()
	firstOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)

	from, err := requiredDate(r, "from", firstOfMonth)
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

	rows, err := s.q.ListExportTasks(r.Context(), db.ListExportTasksParams{
		ProjectIds: f.projectCSV(),
		Status:     nullableString(f.Status),
		Priority:   nullableString(f.Priority),
	})
	if err != nil {
		serverError(w, err)
		return
	}

	fromKey := from.Format(dateLayout)
	toKey := to.Format(dateLayout)
	tasks := make([]exportTask, 0, len(rows))
	for _, row := range rows {
		days := splitWorkDays(row.WorkDayList)
		inRange := 0
		for _, d := range days {
			if d >= fromKey && d <= toKey {
				inRange++
			}
		}

		// Keep a task when anything about it falls inside the window.
		active := inRange > 0 ||
			within(row.DueDate, fromKey, toKey) ||
			within(row.StartDate, fromKey, toKey) ||
			within(row.CompletedAt, fromKey, toKey)
		if !active {
			continue
		}

		tasks = append(tasks, exportTask{
			Project:       row.ProjectName,
			Title:         row.Title,
			Description:   row.Description,
			Status:        row.Status,
			Priority:      row.Priority,
			DueDate:       datePtr(row.DueDate),
			StartDate:     datePtr(row.StartDate),
			CompletedAt:   nullableRFC3339(row.CompletedAt),
			Locked:        row.Locked,
			DaysInRange:   inRange,
			TotalWorkDays: int(row.TotalWorkDays),
			WorkDays:      days,
		})
	}

	format := r.URL.Query().Get("format")
	if format == "" {
		format = "csv"
	}
	filename := fmt.Sprintf("taskflow-%s-to-%s", fromKey, toKey)

	switch format {
	case "json":
		w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q.json", filename))
		writeJSON(w, http.StatusOK, exportResponse{
			From:   fromKey,
			To:     toKey,
			Format: format,
			Count:  len(tasks),
			Tasks:  tasks,
		})
	case "csv":
		w.Header().Set("Content-Type", "text/csv; charset=utf-8")
		w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q.csv", filename))
		if err := writeCSV(w, tasks); err != nil {
			log.Printf("export csv: %v", err)
		}
	default:
		badRequest(w, errors.New("format must be csv or json"))
	}
}

var csvHeader = []string{
	"project", "title", "status", "priority", "due_date", "start_date",
	"completed_at", "locked", "days_in_range", "total_work_days", "work_days", "description",
}

func writeCSV(w http.ResponseWriter, tasks []exportTask) error {
	cw := csv.NewWriter(w)
	if err := cw.Write(csvHeader); err != nil {
		return err
	}
	for _, t := range tasks {
		record := []string{
			t.Project,
			t.Title,
			t.Status,
			t.Priority,
			deref(t.DueDate),
			deref(t.StartDate),
			deref(t.CompletedAt),
			strconv.FormatBool(t.Locked),
			strconv.Itoa(t.DaysInRange),
			strconv.Itoa(t.TotalWorkDays),
			strings.Join(t.WorkDays, " "),
			// Newlines inside a description would break the row shape for some
			// readers, so they are flattened.
			strings.Join(strings.Fields(strings.ReplaceAll(t.Description, "\n", " ")), " "),
		}
		if err := cw.Write(record); err != nil {
			return err
		}
	}
	cw.Flush()
	return cw.Error()
}

func splitWorkDays(list sql.NullString) []string {
	if !list.Valid || list.String == "" {
		return []string{}
	}
	parts := strings.Fields(list.String)
	sort.Strings(parts)
	return parts
}

func within(value sql.NullTime, from, to string) bool {
	if !value.Valid {
		return false
	}
	key := value.Time.Format(dateLayout)
	return key >= from && key <= to
}

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
