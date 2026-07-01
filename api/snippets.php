<?php

$method = $_SERVER['REQUEST_METHOD'];
$snippetId = $parts[1] ?? null;

switch ($method) {
    case 'GET':
        if ($snippetId) {
            $snippet = Database::fetchOne(
                'SELECT * FROM snippets WHERE id = ?',
                [$snippetId]
            );
            if (!$snippet) {
                Response::notFound('Snippet not found');
            }
            Response::success($snippet);
        } else {
            $search = $_GET['search'] ?? null;
            $sql = 'SELECT * FROM snippets';
            $params = [];

            if ($search) {
                $sql .= ' WHERE title LIKE ? OR content LIKE ?';
                $term = '%' . $search . '%';
                $params[] = $term;
                $params[] = $term;
            }

            $sql .= ' ORDER BY updated_at DESC';
            $snippets = Database::fetchAll($sql, $params);
            Response::success($snippets);
        }
        break;

    case 'POST':
        $body = get_json_body();
        $title = trim($body['title'] ?? '');
        $content = trim($body['content'] ?? '');
        $userId = $body['user_id'] ?? null;

        $errors = [];
        if ($title === '') $errors[] = 'Title is required';
        if ($content === '') $errors[] = 'Content is required';
        if (!empty($errors)) {
            Response::validationError($errors);
        }

        $id = Database::insert(
            'INSERT INTO snippets (user_id, title, content) VALUES (?, ?, ?)',
            [$userId, $title, $content]
        );

        $created = Database::fetchOne(
            'SELECT * FROM snippets WHERE id = ?',
            [$id]
        );
        Response::created($created, 'Snippet created');
        break;

    case 'PUT':
        if (!$snippetId) {
            Response::error('Snippet ID required', 400);
        }

        $existing = Database::fetchOne('SELECT * FROM snippets WHERE id = ?', [$snippetId]);
        if (!$existing) {
            Response::notFound('Snippet not found');
        }

        $body = get_json_body();
        $title = trim($body['title'] ?? $existing['title']);
        $content = trim($body['content'] ?? $existing['content']);

        $errors = [];
        if ($title === '') $errors[] = 'Title is required';
        if ($content === '') $errors[] = 'Content is required';
        if (!empty($errors)) {
            Response::validationError($errors);
        }

        Database::execute(
            'UPDATE snippets SET title = ?, content = ? WHERE id = ?',
            [$title, $content, $snippetId]
        );

        $updated = Database::fetchOne(
            'SELECT * FROM snippets WHERE id = ?',
            [$snippetId]
        );
        Response::success($updated, 'Snippet updated');
        break;

    case 'DELETE':
        if (!$snippetId) {
            Response::error('Snippet ID required', 400);
        }

        $existing = Database::fetchOne('SELECT * FROM snippets WHERE id = ?', [$snippetId]);
        if (!$existing) {
            Response::notFound('Snippet not found');
        }

        Database::execute('DELETE FROM snippets WHERE id = ?', [$snippetId]);
        Response::success(null, 'Snippet deleted');
        break;

    default:
        Response::error('Method not allowed', 405);
}
