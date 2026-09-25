# TaskFlow

A small, self-hosted task manager. Projects hold three queues — **To do**, **Ongoing**
and **Done** — and you record the calendar days you actually worked on each task.
Finished tasks are locked, so a task you closed stays closed until you say otherwise.

No accounts, no sign-in, no external services. One `docker compose up` and it runs.

```
┌─────────────┐        ┌──────────────────────┐        ┌──────────────┐
│  React SPA  │  HTTP  │  Go + chi + sqlc     │  SQL   │  MySQL 8.4   │
│  (built)    │ ─────► │  also serves the SPA │ ─────► │  (volume)    │
└─────────────┘        └──────────────────────┘        └──────────────┘
```

## Quick start

```bash
cp .env.example .env      # optional: change the port and passwords
docker compose up -d --build
```

Then open <http://localhost:8080>.

The schema is created automatically on first boot. Your data lives in the
`mysql-data` Docker volume; `docker compose down` keeps it, `docker compose down -v`
deletes it.

To look around with realistic data first:

```bash
./scripts/seed.sh http://localhost:8080
```

## How it works

### The three queues

| Queue | What you do here |
| --- | --- |
| **To do** | Reorder, edit, delete. Set a **start date**, which moves the task to Ongoing. |
| **Ongoing** | Everything from To do, plus marking **the days you worked on it**. |
| **Done** | Read-only. Every mutation returns `423 Locked` until you press **Unlock to edit**. |

A task carries a title, a longer description, a priority
(`low / normal / high / urgent`), an optional due date, and its list of work days.
Work days can be logged on Ongoing and on Done-while-unlocked.

### The board

Drag a card within a column to reorder it, or across columns to change queue.
Dropping a card into **Done** asks whether to finish *and lock* it. The client only
sends the two neighbours a card should land between, and the server derives a new
`sort_order` as the midpoint, so a drag rewrites one row instead of renumbering a
whole column.

### The task list

`/tasks` is every task across every project in one dense, sortable table, with
inline status and priority changes and bulk move/delete. Bulk actions skip locked
tasks and tell you how many were skipped.

### The calendar

`/calendar` is a month heat map. Background intensity is how much work you logged
that day, and each cell stacks up to five dots coloured by task status — **done**
green, **ongoing** amber, **to do** hollow — with urgent work drawn opaque and low
priority faded, so the dots read in priority order. Click a day to open a drawer
listing every task logged on it. One request serves both the heat map and the
drawer, so opening a day is instant.

### Filtering

Project (multi-select), status, priority, due date (overdue / this week / none) and
free-text search over titles and descriptions. Filter state lives in the URL, so any
view can be bookmarked and the back button steps through filter changes.

The calendar **ignores the priority filter** on purpose: a heat map answers "where
did the work happen", not "how urgent was it". Priority still shows on the rows in
the day drawer.

### Keyboard

| Key | Action |
| --- | --- |
| `/` | Focus the search box |
| `Esc` | Close the open panel or dialog |

## Development

Run the app with Docker and the frontend hot-reload against it:

```bash
docker compose up -d mysql      # just the database, on 127.0.0.1:3306
make dev-api                    # Go API on :8080
make dev-web                    # Vite on :5173, proxying /api to :8080
```

### Layout

```
backend/
  cmd/server/            entrypoint
  internal/api/          chi handlers, DTOs, router
  internal/db/           sqlc-generated queries + connection and migrations
  internal/db/migrations goose migrations (embedded in the binary)
  db/queries/            the SQL that sqlc turns into Go
  db/schema.sql          schema used for code generation
frontend/
  src/lib/               API client, query hooks, URL-synced filters, date helpers
  src/components/        UI primitives, task card, task panel, filter bar, project rail
  src/features/          board, tasks and calendar pages
scripts/                 smoke.sh, seed.sh, shoot.mjs
```

### Changing the database

Edit the SQL in `backend/db/queries/`, then:

```bash
make sqlc     # regenerate backend/internal/db from the SQL
```

Migrations live in `backend/internal/db/migrations/` and run automatically at
startup. Add a new numbered file rather than editing one that has shipped.

### Tests

```bash
./scripts/smoke.sh http://localhost:8080   # 75 API assertions against a running app
cd backend && go test ./... && go vet ./...
cd frontend && npx tsc -b --noEmit
```

`./scripts/shoot.mjs` drives the real UI in Chrome and writes screenshots to
`.screenshots/`, failing on any console error or failed request.

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `APP_PORT` | `8080` | Host port the app is published on |
| `MYSQL_PORT` | `3306` | Loopback-only port for a local MySQL client |
| `MYSQL_DATABASE` | `taskflow` | Database name |
| `MYSQL_USER` / `MYSQL_PASSWORD` | `taskflow` | App credentials |
| `MYSQL_ROOT_PASSWORD` | `taskflow-root` | Root password — change this |
| `PORT` | `8080` | Port the Go process listens on |
| `DATABASE_URL` | built from the above | Full DSN |
| `AUTO_MIGRATE` | `true` | Run migrations at startup |
| `FRONTEND_DIR` | `/app/frontend` | Built SPA to serve; empty means API only |

## API

```
GET    /api/healthz
GET    /api/projects ?include_archived=
POST   /api/projects
PATCH  /api/projects/:id
DELETE /api/projects/:id
POST   /api/projects/:id/archive
POST   /api/projects/reorder
GET    /api/projects/:id/board        ?project_id=&status=&priority=&due=&q=
POST   /api/projects/:id/tasks
GET    /api/tasks                     ?project_id=&status=&priority=&due=&q=
GET    /api/tasks/:id
PATCH  /api/tasks/:id
DELETE /api/tasks/:id ?force=
POST   /api/tasks/:id/move            {status, before_id, after_id}
POST   /api/tasks/:id/start           {start_date}
POST   /api/tasks/:id/status          {status}
POST   /api/tasks/:id/complete        finish and lock
POST   /api/tasks/:id/unlock
POST   /api/tasks/:id/lock
POST   /api/tasks/:id/work-days       {work_date, note}
DELETE /api/tasks/:id/work-days/:date
GET    /api/calendar ?from=&to=&project_id=&status=&q=
```

Errors are JSON: `{"error": {"code": "...", "message": "..."}}`. A mutation on a
locked task returns `423` with code `locked`.

## Security

There is no authentication, so anyone who can reach the published port can read and
change everything. That is the intended trade-off for a personal tool on a trusted
network. If you expose it, put a reverse proxy with auth in front of it. MySQL is
bound to `127.0.0.1` only, and the app container runs as a non-root user.
