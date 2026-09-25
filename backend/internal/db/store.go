package db

import (
	"context"
	"database/sql"
	"embed"
	"fmt"
	"log"
	"time"

	_ "github.com/go-sql-driver/mysql"
	"github.com/pressly/goose/v3"

	"github.com/taskflow/taskflow/backend/internal/config"
)

//go:embed migrations/*.sql
var migrationFS embed.FS

func Open(cfg config.Config) (*sql.DB, error) {
	conn, err := sql.Open("mysql", cfg.DSN)
	if err != nil {
		return nil, fmt.Errorf("open mysql: %w", err)
	}

	conn.SetMaxOpenConns(25)
	conn.SetMaxIdleConns(10)
	conn.SetConnMaxLifetime(5 * time.Minute)

	if err := waitForDB(context.Background(), conn, cfg.RetryFor); err != nil {
		return nil, err
	}
	if cfg.AutoMigrate {
		if err := Migrate(conn); err != nil {
			return nil, err
		}
	}
	return conn, nil
}

func waitForDB(ctx context.Context, conn *sql.DB, within time.Duration) error {
	deadline := time.Now().Add(within)
	for {
		pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
		err := conn.PingContext(pingCtx)
		cancel()
		if err == nil {
			return nil
		}
		if time.Now().After(deadline) {
			return fmt.Errorf("database unreachable after %s: %w", within, err)
		}
		log.Printf("waiting for database: %v", err)
		time.Sleep(2 * time.Second)
	}
}

func Migrate(conn *sql.DB) error {
	goose.SetBaseFS(migrationFS)
	if err := goose.SetDialect("mysql"); err != nil {
		return err
	}
	if err := goose.UpContext(context.Background(), conn, "migrations"); err != nil {
		return fmt.Errorf("migrate: %w", err)
	}
	log.Println("migrations up to date")
	return nil
}
