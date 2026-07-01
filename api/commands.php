<?php
/**
 * Commands API
 * GET     /api/commands          - List commands (optional ?category_id=&search=)
 * POST    /api/commands          - Create a command
 * GET     /api/commands/{id}     - Get a single command
 * PUT     /api/commands/{id}     - Update a command
 * DELETE  /api/commands/{id}     - Delete a command
 */

$method = $_SERVER['REQUEST_METHOD'];
$commandId = $parts[1] ?? null;

switch ($method) {
    case 'GET':
        if ($commandId) {
            $command = Database::fetchOne(
                'SELECT cmd.*, cat.name as category_name, cat.color as category_color
                 FROM commands cmd
                 LEFT JOIN categories cat ON cmd.category_id = cat.id
                 WHERE cmd.id = ?',
                [$commandId]
            );
            if (!$command) {
                Response::notFound('Command not found');
            }
            Response::success($command);
        } else {
            $categoryId = $_GET['category_id'] ?? null;
            $search = $_GET['search'] ?? null;
            $sql = 'SELECT cmd.*, cat.name as category_name, cat.color as category_color
                    FROM commands cmd
                    LEFT JOIN categories cat ON cmd.category_id = cat.id';
            $params = [];
            $conditions = [];

            if ($categoryId) {
                $conditions[] = 'cmd.category_id = ?';
                $params[] = $categoryId;
            }

            if ($search) {
                $conditions[] = '(cmd.title LIKE ? OR cmd.command LIKE ? OR cmd.description LIKE ? OR cat.name LIKE ?)';
                $term = '%' . $search . '%';
                $params[] = $term;
                $params[] = $term;
                $params[] = $term;
                $params[] = $term;
            }

            if (!empty($conditions)) {
                $sql .= ' WHERE ' . implode(' AND ', $conditions);
            }

            $sql .= ' ORDER BY cmd.updated_at DESC';

            $commands = Database::fetchAll($sql, $params);
            Response::success($commands);
        }
        break;

    case 'POST':
        $body = get_json_body();
        $title = trim($body['title'] ?? '');
        $command = trim($body['command'] ?? '');
        $description = trim($body['description'] ?? '');
        $categoryId = $body['category_id'] ?? null;
        $userId = $body['user_id'] ?? null;

        $errors = [];
        if ($title === '') $errors[] = 'Title is required';
        if ($command === '') $errors[] = 'Command is required';
        if (!empty($errors)) {
            Response::validationError($errors);
        }

        $id = Database::insert(
            'INSERT INTO commands (user_id, category_id, title, command, description) VALUES (?, ?, ?, ?, ?)',
            [$userId, $categoryId ?: null, $title, $command, $description ?: null]
        );

        $created = Database::fetchOne(
            'SELECT cmd.*, cat.name as category_name, cat.color as category_color
             FROM commands cmd LEFT JOIN categories cat ON cmd.category_id = cat.id WHERE cmd.id = ?',
            [$id]
        );
        Response::created($created, 'Command created');
        break;

    case 'PUT':
        if (!$commandId) {
            Response::error('Command ID required', 400);
        }

        $existing = Database::fetchOne('SELECT * FROM commands WHERE id = ?', [$commandId]);
        if (!$existing) {
            Response::notFound('Command not found');
        }

        $body = get_json_body();
        $title = trim($body['title'] ?? $existing['title']);
        $command = trim($body['command'] ?? $existing['command']);
        $description = $body['description'] ?? $existing['description'];
        $categoryId = $body['category_id'] ?? $existing['category_id'];

        if ($description !== null) {
            $description = trim($description);
        }

        $errors = [];
        if ($title === '') $errors[] = 'Title is required';
        if ($command === '') $errors[] = 'Command is required';
        if (!empty($errors)) {
            Response::validationError($errors);
        }

        Database::execute(
            'UPDATE commands SET title = ?, command = ?, description = ?, category_id = ? WHERE id = ?',
            [$title, $command, $description ?: null, $categoryId ?: null, $commandId]
        );

        $updated = Database::fetchOne(
            'SELECT cmd.*, cat.name as category_name, cat.color as category_color
             FROM commands cmd LEFT JOIN categories cat ON cmd.category_id = cat.id WHERE cmd.id = ?',
            [$commandId]
        );
        Response::success($updated, 'Command updated');
        break;

    case 'DELETE':
        if (!$commandId) {
            Response::error('Command ID required', 400);
        }

        $existing = Database::fetchOne('SELECT * FROM commands WHERE id = ?', [$commandId]);
        if (!$existing) {
            Response::notFound('Command not found');
        }

        Database::execute('DELETE FROM commands WHERE id = ?', [$commandId]);
        Response::success(null, 'Command deleted');
        break;

    default:
        Response::error('Method not allowed', 405);
}
