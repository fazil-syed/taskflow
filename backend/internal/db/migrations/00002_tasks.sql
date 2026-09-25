-- +goose Up
CREATE TABLE tasks (
    id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    project_id   BIGINT UNSIGNED NOT NULL,
    title        VARCHAR(255) NOT NULL,
    description  TEXT NOT NULL,
    status       VARCHAR(16) NOT NULL DEFAULT 'todo',
    priority     VARCHAR(16) NOT NULL DEFAULT 'normal',
    due_date     DATE NULL,
    start_date   DATE NULL,
    completed_at DATETIME NULL,
    locked       BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order   DOUBLE NOT NULL DEFAULT 0,
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_tasks_board (project_id, status, sort_order),
    KEY idx_tasks_status (status),
    KEY idx_tasks_due (due_date),
    CONSTRAINT fk_tasks_project FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
    CONSTRAINT chk_tasks_status CHECK (status IN ('todo', 'ongoing', 'done')),
    CONSTRAINT chk_tasks_priority CHECK (priority IN ('low', 'normal', 'high', 'urgent'))
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- +goose Down
DROP TABLE tasks;
