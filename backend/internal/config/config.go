package config

import (
	"fmt"
	"os"
	"strconv"
	"time"
)

type Config struct {
	Port        int
	DSN         string
	FrontendDir string
	AutoMigrate bool
	RetryFor    time.Duration
}

func Load() Config {
	return Config{
		Port:        envInt("PORT", 8080),
		DSN:         env("DATABASE_URL", "taskflow:taskflow@tcp(mysql:3306)/taskflow?parseTime=true&multiStatements=true&loc=UTC&collation=utf8mb4_unicode_ci"),
		FrontendDir: env("FRONTEND_DIR", "/app/frontend"),
		AutoMigrate: env("AUTO_MIGRATE", "true") == "true",
		RetryFor:    time.Duration(envInt("DB_RETRY_SECONDS", 60)) * time.Second,
	}
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func envInt(key string, fallback int) int {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return fallback
	}
	return n
}

func (c Config) Address() string {
	return fmt.Sprintf(":%d", c.Port)
}
