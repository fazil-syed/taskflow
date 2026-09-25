package api

import (
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

func (s *Server) Router(frontendDir string) http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(30 * time.Second))
	r.Use(logRequests)

	r.Get("/api/healthz", func(w http.ResponseWriter, r *http.Request) {
		if err := s.conn.PingContext(r.Context()); err != nil {
			writeError(w, http.StatusServiceUnavailable, "db_unreachable", "database is not reachable")
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	r.Route("/api/projects", func(pr chi.Router) {
		pr.Get("/", s.ListProjects)
		pr.Post("/", s.CreateProject)
		pr.Post("/reorder", s.ReorderProjects)
		pr.Get("/{id}/board", s.GetBoard)
		pr.Post("/{id}/tasks", s.CreateTask)
		pr.Patch("/{id}", s.UpdateProject)
		pr.Delete("/{id}", s.DeleteProject)
		pr.Post("/{id}/archive", s.SetProjectArchived)
	})

	r.Route("/api/tasks", func(tr chi.Router) {
		tr.Get("/", s.ListTasks)
		tr.Get("/{id}", s.GetTask)
		tr.Patch("/{id}", s.UpdateTask)
		tr.Delete("/{id}", s.DeleteTask)
		tr.Post("/{id}/move", s.MoveTask)
		tr.Post("/{id}/start", s.StartTask)
		tr.Post("/{id}/status", s.SetTaskStatus)
		tr.Post("/{id}/complete", s.CompleteTask)
		tr.Post("/{id}/unlock", s.UnlockTask)
		tr.Post("/{id}/lock", s.LockTask)
		tr.Post("/{id}/work-days", s.AddWorkDay)
		tr.Delete("/{id}/work-days/{date}", s.RemoveWorkDay)
	})

	r.Get("/api/calendar", s.GetCalendar)
	r.Get("/api/export", s.ExportTasks)

	if frontendDir != "" {
		fileServer := spaHandler(frontendDir)
		r.Handle("/*", fileServer)
	} else {
		r.NotFound(func(w http.ResponseWriter, r *http.Request) {
			writeError(w, http.StatusNotFound, "not_found", "route not found")
		})
	}
	return r
}

func logRequests(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)
		next.ServeHTTP(ww, r)
		if strings.HasPrefix(r.URL.Path, "/api") {
			log.Printf("%s %s %d %s", r.Method, r.URL.Path, ww.Status(), time.Since(start).Round(time.Millisecond))
		}
	})
}

// spaHandler serves the built frontend and falls back to index.html so client
// side routes work on a hard refresh.
func spaHandler(dir string) http.Handler {
	fs := http.FileServer(http.Dir(dir))
	index := filepath.Join(dir, "index.html")
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// An unmatched /api path is a real 404, not a client-side route. Without
		// this the SPA fallback would answer every API typo with index.html.
		if strings.HasPrefix(r.URL.Path, "/api/") {
			writeError(w, http.StatusNotFound, "not_found", "unknown API route")
			return
		}

		clean := filepath.Clean(r.URL.Path)
		path := filepath.Join(dir, clean)

		if info, err := os.Stat(path); err == nil && !info.IsDir() {
			// Hashed assets are safe to cache aggressively, everything else is not.
			if strings.HasPrefix(clean, "/assets/") {
				w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
			}
			fs.ServeHTTP(w, r)
			return
		}
		w.Header().Set("Cache-Control", "no-cache")
		http.ServeFile(w, r, index)
	})
}
