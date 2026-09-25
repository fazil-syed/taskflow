package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/taskflow/taskflow/backend/internal/api"
	"github.com/taskflow/taskflow/backend/internal/config"
	appdb "github.com/taskflow/taskflow/backend/internal/db"
)

func main() {
	log.SetFlags(log.LstdFlags | log.Lmsgprefix)
	log.SetPrefix("taskflow ")

	cfg := config.Load()

	conn, err := appdb.Open(cfg)
	if err != nil {
		log.Fatalf("startup failed: %v", err)
	}
	defer conn.Close()

	frontendDir := cfg.FrontendDir
	if _, err := os.Stat(frontendDir); err != nil {
		log.Printf("no frontend build at %s, serving API only", frontendDir)
		frontendDir = ""
	}

	srv := &http.Server{
		Addr:              cfg.Address(),
		Handler:           api.NewServer(conn).Router(frontendDir),
		ReadHeaderTimeout: 10 * time.Second,
		WriteTimeout:      60 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	go func() {
		log.Printf("listening on %s", cfg.Address())
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("server error: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop

	log.Println("shutting down")
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("forced shutdown: %v", err)
	}
}
