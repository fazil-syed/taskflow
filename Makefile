.PHONY: help up down logs build rebuild migrate dev-api dev-web sqlc fmt test clean

help:
	@echo "make up        start everything (docker compose)"
	@echo "make down      stop everything"
	@echo "make logs      tail app + mysql logs"
	@echo "make rebuild   rebuild the app image and restart"
	@echo "make sqlc      regenerate the database package from SQL"
	@echo "make dev-api   run the API against a local MySQL"
	@echo "make dev-web   run the Vite dev server against the API"

up:
	docker compose up -d --build
	@echo "TaskFlow is starting on http://localhost:$${APP_PORT:-8080}"

down:
	docker compose down

logs:
	docker compose logs -f app mysql

build:
	docker compose build

rebuild:
	docker compose up -d --build --force-recreate app

sqlc:
	cd backend && go run github.com/sqlc-dev/sqlc/cmd/sqlc@latest generate

fmt:
	cd backend && gofmt -w ./cmd ./internal

test:
	cd backend && go test ./...

dev-api:
	cd backend && FRONTEND_DIR= AUTO_MIGRATE=true \
		DATABASE_URL="taskflow:taskflow@tcp(127.0.0.1:3306)/taskflow?parseTime=true&multiStatements=true&loc=UTC&collation=utf8mb4_unicode_ci" \
		go run ./cmd/server

dev-web:
	cd frontend && npm run dev

clean:
	docker compose down -v
	rm -rf frontend/dist
