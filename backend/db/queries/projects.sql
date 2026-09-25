-- name: ListProjects :many
SELECT
    p.id,
    p.name,
    p.description,
    p.color,
    p.sort_order,
    p.archived_at,
    p.created_at,
    COALESCE(t.task_count, 0) AS task_count,
    CAST(COALESCE(t.open_count, 0) AS SIGNED) AS open_count
FROM projects p
LEFT JOIN (
    SELECT
        project_id,
        COUNT(*) AS task_count,
        CAST(COALESCE(SUM(CASE WHEN status <> 'done' THEN 1 ELSE 0 END), 0) AS SIGNED) AS open_count
    FROM tasks
    GROUP BY project_id
) t ON t.project_id = p.id
CROSS JOIN (SELECT CAST(sqlc.arg('include_archived') AS UNSIGNED) AS f_archived) f
WHERE (f.f_archived = 1 OR p.archived_at IS NULL)
ORDER BY p.sort_order ASC, p.id ASC;

-- name: GetProject :one
SELECT
    p.id,
    p.name,
    p.description,
    p.color,
    p.sort_order,
    p.archived_at,
    p.created_at
FROM projects p
WHERE p.id = sqlc.arg('id');

-- name: CreateProject :execrows
INSERT INTO projects (name, description, color, sort_order)
VALUES (sqlc.arg('name'), sqlc.arg('description'), sqlc.arg('color'), sqlc.arg('sort_order'));

-- name: UpdateProject :execrows
UPDATE projects
SET name        = sqlc.arg('name'),
    description = sqlc.arg('description'),
    color       = sqlc.arg('color')
WHERE id = sqlc.arg('id');

-- name: DeleteProject :exec
DELETE FROM projects WHERE id = sqlc.arg('id');

-- name: SetProjectArchived :execrows
UPDATE projects SET archived_at = sqlc.arg('archived_at') WHERE id = sqlc.arg('id');

-- name: SetProjectSort :exec
UPDATE projects SET sort_order = sqlc.arg('sort_order') WHERE id = sqlc.arg('id');

-- name: LastInsertID :one
SELECT LAST_INSERT_ID() AS id;
