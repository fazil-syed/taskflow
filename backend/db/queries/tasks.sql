-- name: ListBoardTasks :many
SELECT
    t.id,
    t.project_id,
    t.title,
    t.description,
    t.status,
    t.priority,
    t.due_date,
    t.start_date,
    t.completed_at,
    t.locked,
    t.sort_order,
    t.created_at,
    t.updated_at,
    COALESCE(w.work_days, 0) AS work_day_count
FROM tasks t
LEFT JOIN (
    SELECT task_id, COUNT(*) AS work_days FROM task_work_days GROUP BY task_id
) w ON w.task_id = t.id
CROSS JOIN (
    SELECT
        CAST(sqlc.arg('status')   AS CHAR(16))  AS f_status,
        CAST(sqlc.arg('priority') AS CHAR(16)) AS f_priority,
        CAST(sqlc.arg('due')      AS CHAR(16))  AS f_due,
        CAST(sqlc.arg('q')        AS CHAR(255)) AS f_q
) f
WHERE t.project_id = sqlc.arg('project_id')
  AND (f.f_status = '' OR t.status = f.f_status)
  AND (f.f_priority = '' OR t.priority = f.f_priority)
  AND (f.f_q = '' OR t.title LIKE CONCAT('%', f.f_q, '%'))
  AND (f.f_due = '' OR (
        (f.f_due = 'overdue' AND t.due_date IS NOT NULL AND t.due_date < CURDATE() AND t.status <> 'done')
     OR (f.f_due = 'week' AND t.due_date IS NOT NULL AND t.due_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY))
     OR (f.f_due = 'none' AND t.due_date IS NULL)
  ))
ORDER BY t.sort_order ASC, t.id ASC;

-- name: ListTasks :many
SELECT
    t.id,
    t.project_id,
    t.title,
    t.description,
    t.status,
    t.priority,
    t.due_date,
    t.start_date,
    t.completed_at,
    t.locked,
    t.sort_order,
    t.created_at,
    t.updated_at,
    p.name AS project_name,
    p.color AS project_color,
    COALESCE(w.work_days, 0) AS work_day_count
FROM tasks t
JOIN projects p ON p.id = t.project_id
LEFT JOIN (
    SELECT task_id, COUNT(*) AS work_days FROM task_work_days GROUP BY task_id
) w ON w.task_id = t.id
CROSS JOIN (
    SELECT
        CAST(sqlc.arg('project_ids') AS CHAR(64)) AS f_project_ids,
        CAST(sqlc.arg('status')      AS CHAR(16))  AS f_status,
        CAST(sqlc.arg('priority')    AS CHAR(16))  AS f_priority,
        CAST(sqlc.arg('due')         AS CHAR(16))  AS f_due,
        CAST(sqlc.arg('q')           AS CHAR(255)) AS f_q
) f
WHERE (f.f_project_ids = '' OR FIND_IN_SET(t.project_id, f.f_project_ids))
  AND (f.f_status = '' OR t.status = f.f_status)
  AND (f.f_priority = '' OR t.priority = f.f_priority)
  AND (f.f_q = '' OR t.title LIKE CONCAT('%', f.f_q, '%') OR t.description LIKE CONCAT('%', f.f_q, '%'))
  AND (f.f_due = '' OR (
        (f.f_due = 'overdue' AND t.due_date IS NOT NULL AND t.due_date < CURDATE() AND t.status <> 'done')
     OR (f.f_due = 'week' AND t.due_date IS NOT NULL AND t.due_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY))
     OR (f.f_due = 'none' AND t.due_date IS NULL)
  ))
ORDER BY t.updated_at DESC, t.id DESC;

-- name: GetTask :one
SELECT
    t.id,
    t.project_id,
    t.title,
    t.description,
    t.status,
    t.priority,
    t.due_date,
    t.start_date,
    t.completed_at,
    t.locked,
    t.sort_order,
    t.created_at,
    t.updated_at,
    p.name AS project_name,
    p.color AS project_color
FROM tasks t
JOIN projects p ON p.id = t.project_id
WHERE t.id = sqlc.arg('id');

-- name: CreateTask :execrows
INSERT INTO tasks (project_id, title, description, status, priority, due_date, sort_order)
VALUES (
    sqlc.arg('project_id'),
    sqlc.arg('title'),
    sqlc.arg('description'),
    CAST(sqlc.arg('status')   AS CHAR(16)),
    CAST(sqlc.arg('priority') AS CHAR(16)),
    sqlc.arg('due_date'),
    sqlc.arg('sort_order')
);

-- name: UpdateTask :execrows
UPDATE tasks
SET title       = sqlc.arg('title'),
    description = sqlc.arg('description'),
    priority    = CAST(sqlc.arg('priority') AS CHAR(16)),
    due_date    = sqlc.arg('due_date')
WHERE id = sqlc.arg('id');

-- name: SetTaskStart :execrows
UPDATE tasks
SET status     = 'ongoing',
    start_date = sqlc.arg('start_date'),
    locked     = FALSE
WHERE id = sqlc.arg('id');

-- name: SetTaskStatus :execrows
UPDATE tasks t
JOIN (SELECT CAST(sqlc.arg('status') AS CHAR(16)) AS s) f ON TRUE
SET t.status       = f.s,
    t.start_date   = CASE WHEN f.s = 'todo'  THEN NULL ELSE t.start_date END,
    t.completed_at = CASE WHEN f.s = 'done'  THEN CURRENT_TIMESTAMP ELSE NULL END,
    t.locked       = CASE WHEN f.s = 'done'  THEN TRUE ELSE FALSE END
WHERE t.id = sqlc.arg('id');

-- name: SetTaskSort :exec
UPDATE tasks SET sort_order = sqlc.arg('sort_order') WHERE id = sqlc.arg('id');

-- name: SetTaskLocked :execrows
UPDATE tasks SET locked = sqlc.arg('locked') WHERE id = sqlc.arg('id');

-- name: DeleteTask :exec
DELETE FROM tasks WHERE id = sqlc.arg('id');

-- name: AddWorkDay :execrows
INSERT INTO task_work_days (task_id, work_date, note)
VALUES (sqlc.arg('task_id'), sqlc.arg('work_date'), sqlc.arg('note'))
ON DUPLICATE KEY UPDATE note = VALUES(note);

-- name: RemoveWorkDay :exec
DELETE FROM task_work_days WHERE task_id = sqlc.arg('task_id') AND work_date = sqlc.arg('work_date');

-- name: ListWorkDays :many
SELECT work_date, note FROM task_work_days
WHERE task_id = sqlc.arg('task_id')
ORDER BY work_date ASC;

-- name: ListWorkDaysForTasks :many
SELECT task_id, work_date FROM task_work_days
WHERE task_id IN (sqlc.slice('task_ids'))
ORDER BY work_date ASC;

-- name: ListCalendarEntries :many
SELECT
    w.work_date,
    t.id AS task_id,
    t.title,
    t.status,
    t.priority,
    t.locked,
    t.project_id,
    p.name AS project_name,
    p.color AS project_color
FROM task_work_days w
JOIN tasks t ON t.id = w.task_id
JOIN projects p ON p.id = t.project_id
CROSS JOIN (
    SELECT
        CAST(sqlc.arg('project_ids') AS CHAR(64)) AS f_project_ids,
        CAST(sqlc.arg('status')      AS CHAR(16))  AS f_status,
        CAST(sqlc.arg('q')           AS CHAR(255)) AS f_q
) f
WHERE w.work_date BETWEEN sqlc.arg('from_date') AND sqlc.arg('to_date')
  AND (f.f_project_ids = '' OR FIND_IN_SET(t.project_id, f.f_project_ids))
  AND (f.f_status = '' OR t.status = f.f_status)
  AND (f.f_q = '' OR t.title LIKE CONCAT('%', f.f_q, '%'))
ORDER BY w.work_date ASC, t.id ASC;
