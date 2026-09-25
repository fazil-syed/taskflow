package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
)

type apiError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if v == nil {
		return
	}
	if err := json.NewEncoder(w).Encode(v); err != nil {
		log.Printf("encode response: %v", err)
	}
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, map[string]apiError{"error": {Code: code, Message: message}})
}

func badRequest(w http.ResponseWriter, err error) {
	writeError(w, http.StatusBadRequest, "bad_request", err.Error())
}

func notFound(w http.ResponseWriter, what string) {
	writeError(w, http.StatusNotFound, "not_found", what+" not found")
}

// locked is returned for every mutation attempted on a locked (completed) task.
func lockedError(w http.ResponseWriter) {
	writeError(w, http.StatusLocked, "locked", "This task is finished and locked. Unlock it to make changes.")
}

func serverError(w http.ResponseWriter, err error) {
	log.Printf("internal error: %v", err)
	writeError(w, http.StatusInternalServerError, "internal", "Something went wrong. Check the server logs.")
}

func decodeJSON(r *http.Request, v any) error {
	dec := json.NewDecoder(http.MaxBytesReader(nil, r.Body, 1<<20))
	dec.DisallowUnknownFields()
	if err := dec.Decode(v); err != nil {
		return errors.New("invalid request body: " + err.Error())
	}
	return nil
}

func pathUint(r *http.Request, key string) (uint64, error) {
	return strconv.ParseUint(chi.URLParam(r, key), 10, 64)
}

func queryInt(r *http.Request, key string, fallback int) int {
	if v := r.URL.Query().Get(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return fallback
}

func queryUint(r *http.Request, key string, fallback uint64) uint64 {
	if v := r.URL.Query().Get(key); v != "" {
		if n, err := strconv.ParseUint(v, 10, 64); err == nil {
			return n
		}
	}
	return fallback
}

// requiredDate is queryDate but rejects an unparseable value instead of
// silently falling back, so a typo in ?from= is visible to the caller.
func requiredDate(r *http.Request, key string, fallback time.Time) (time.Time, error) {
	if v := r.URL.Query().Get(key); v != "" {
		t, err := time.Parse("2006-01-02", v)
		if err != nil {
			return time.Time{}, fmt.Errorf("%s must be formatted YYYY-MM-DD", key)
		}
		return t, nil
	}
	return fallback, nil
}

// queryList reads a repeated or comma-separated query param into a string slice.
func queryList(r *http.Request, key string) []string {
	var out []string
	for _, raw := range r.URL.Query()[key] {
		for _, part := range strings.Split(raw, ",") {
			if p := strings.TrimSpace(part); p != "" {
				out = append(out, p)
			}
		}
	}
	return out
}

var validStatuses = map[string]bool{"todo": true, "ongoing": true, "done": true}
var validPriorities = map[string]bool{"low": true, "normal": true, "high": true, "urgent": true}
