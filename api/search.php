<?php
/**
 * Global Search API
 * GET /api/search?q=term - Search across all content
 */

$q = trim($_GET['q'] ?? '');

if ($q === '') {
    Response::success(['commands' => [], 'categories' => []]);
}

$term = '%' . $q . '%';

$commands = Database::fetchAll(
    'SELECT cmd.*, cat.name as category_name, cat.color as category_color
     FROM commands cmd
     LEFT JOIN categories cat ON cmd.category_id = cat.id
     WHERE cmd.title LIKE ? OR cmd.command LIKE ? OR cmd.description LIKE ? OR cat.name LIKE ?
     ORDER BY cmd.updated_at DESC
     LIMIT 50',
    [$term, $term, $term, $term]
);

$categories = Database::fetchAll(
    'SELECT * FROM categories WHERE name LIKE ? ORDER BY name ASC LIMIT 10',
    [$term]
);

Response::success([
    'commands' => $commands,
    'categories' => $categories,
]);
