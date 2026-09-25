-- +goose Up
CREATE TABLE task_work_days (
    task_id    BIGINT UNSIGNED NOT NULL,
    work_date  DATE NOT NULL,
    note       VARCHAR(255) NOT NULL DEFAULT '',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (task_id, work_date),
    KEY idx_work_days_date (work_date),
    CONSTRAINT fk_work_days_task FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- +goose Down
DROP TABLE task_work_days;
