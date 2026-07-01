<?php
/**
 * Categories API
 * GET     /api/categories               - List all categories (optional ?module_id=)
 * POST    /api/categories               - Create a category
 * PUT     /api/categories/{id}          - Update a category
 * DELETE  /api/categories/{id}          - Delete a category
 * GET     /api/categories/{id}/count    - Get command count for a category
 */

$method = $_SERVER['REQUEST_METHOD'];
$categoryId = $parts[1] ?? null;
$subAction = $parts[2] ?? null;

switch ($method) {
    case 'GET':
        if ($categoryId && $subAction === 'count') {
            $count = Database::fetchOne(
                'SELECT COUNT(*) as count FROM commands WHERE category_id = ?',
                [$categoryId]
            );
            Response::success($count);
        } elseif ($categoryId) {
            $category = Database::fetchOne('SELECT * FROM categories WHERE id = ?', [$categoryId]);
            if (!$category) {
                Response::notFound('Category not found');
            }
            Response::success($category);
        } else {
            $moduleId = $_GET['module_id'] ?? null;
            if ($moduleId) {
                $categories = Database::fetchAll(
                    'SELECT c.*, (SELECT COUNT(*) FROM commands WHERE category_id = c.id) as command_count
                     FROM categories c WHERE c.module_id = ? ORDER BY c.sort_order ASC',
                    [$moduleId]
                );
            } else {
                $categories = Database::fetchAll(
                    'SELECT c.*, (SELECT COUNT(*) FROM commands WHERE category_id = c.id) as command_count
                     FROM categories c ORDER BY c.module_id, c.sort_order ASC'
                );
            }
            Response::success($categories);
        }
        break;

    case 'POST':
        $body = get_json_body();
        $name = trim($body['name'] ?? '');
        $moduleId = $body['module_id'] ?? null;
        $color = $body['color'] ?? '#6c757d';
        $sortOrder = (int) ($body['sort_order'] ?? 0);

        $errors = [];
        if ($name === '') $errors[] = 'Name is required';
        if (!$moduleId) $errors[] = 'Module ID is required';
        if (!empty($errors)) {
            Response::validationError($errors);
        }

        $id = Database::insert(
            'INSERT INTO categories (module_id, name, color, sort_order) VALUES (?, ?, ?, ?)',
            [$moduleId, $name, $color, $sortOrder]
        );

        $category = Database::fetchOne('SELECT * FROM categories WHERE id = ?', [$id]);
        Response::created($category, 'Category created');
        break;

    case 'PUT':
        if (!$categoryId) {
            Response::error('Category ID required', 400);
        }

        $body = get_json_body();
        $name = trim($body['name'] ?? '');
        $color = $body['color'] ?? null;
        $sortOrder = $body['sort_order'] ?? null;

        $errors = [];
        if ($name === '') $errors[] = 'Name is required';
        if (!empty($errors)) {
            Response::validationError($errors);
        }

        $existing = Database::fetchOne('SELECT * FROM categories WHERE id = ?', [$categoryId]);
        if (!$existing) {
            Response::notFound('Category not found');
        }

        $color = $color ?? $existing['color'];
        $sortOrder = $sortOrder ?? $existing['sort_order'];

        Database::execute(
            'UPDATE categories SET name = ?, color = ?, sort_order = ? WHERE id = ?',
            [$name, $color, (int)$sortOrder, $categoryId]
        );

        $category = Database::fetchOne('SELECT * FROM categories WHERE id = ?', [$categoryId]);
        Response::success($category, 'Category updated');
        break;

    case 'DELETE':
        if (!$categoryId) {
            Response::error('Category ID required', 400);
        }

        $existing = Database::fetchOne('SELECT * FROM categories WHERE id = ?', [$categoryId]);
        if (!$existing) {
            Response::notFound('Category not found');
        }

        Database::execute('DELETE FROM categories WHERE id = ?', [$categoryId]);
        Response::success(null, 'Category deleted');
        break;

    default:
        Response::error('Method not allowed', 405);
}
