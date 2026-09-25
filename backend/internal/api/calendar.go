package api

import (
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
	Date   string             `json:"date"`
	Total  int                `json:"total"`
	Tasks  []calendarEntryDTO `json:"tasks"`
	Counts map[string]int     `json:"counts"`
}

// GetCalendar returns, for every day in the range, the tasks that have work
// logged on it. The day drawer is served from this same payload, so opening a
// day needs no second request. Priority is deliberately not a filter here.
func (s *Server) GetCalendar(w http.ResponseWriter, r *http.Request) {
	f, err := parseFilters(r, false)
	if err != nil {
		badRequest(w, err)
		return
	}
	now := time.Now().UTC()
	from, err := requiredDate(r, "from", time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC))
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

	rows, err := s.q.ListCalendarEntries(r.Context(), db.ListCalendarEntriesParams{
		FromDate:   from,
		ToDate:     to,
		ProjectIds: f.projectCSV(),
		Status:     f.Status,
		Q:          f.Query,
	})
	if err != nil {
		serverError(w, err)
		return
	}

	byDay := map[string][]calendarEntryDTO{}
	for _, row := range rows {
		key := row.WorkDate.Format(dateLayout)
		byDay[key] = append(byDay[key], calendarEntryDTO{
			TaskID:       row.TaskID,
			Title:        row.Title,
			Status:       row.Status,
			Priority:     row.Priority,
			Locked:       row.Locked,
			ProjectID:    row.ProjectID,
			ProjectName:  row.ProjectName,
			ProjectColor: row.ProjectColor,
		})
	}

	days := make([]calendarDayDTO, 0, len(byDay))
	for day, tasks := range byDay {
		counts := map[string]int{"todo": 0, "ongoing": 0, "done": 0}
		for _, t := range tasks {
			counts[t.Status]++
		}
		days = append(days, calendarDayDTO{
			Date:   day,
			Total:  len(tasks),
			Tasks:  tasks,
			Counts: counts,
		})
	}
	sort.Slice(days, func(i, j int) bool { return days[i].Date < days[j].Date })
	writeJSON(w, http.StatusOK, map[string]any{
		"from": from.Format(dateLayout),
		"to":   to.Format(dateLayout),
		"days": days,
	})
}
