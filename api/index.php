<?php
/**
 * API Router
 *
 * Routes: /api/modules, /api/categories, /api/commands
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../includes/database.php';
require_once __DIR__ . '/../includes/response.php';
require_once __DIR__ . '/../includes/functions.php';

cors();

$parts = get_route_parts();
$resource = $parts[0] ?? null;

try {
    switch ($resource) {
        case 'modules':
            require __DIR__ . '/modules.php';
            break;
        case 'categories':
            require __DIR__ . '/categories.php';
            break;
        case 'commands':
            require __DIR__ . '/commands.php';
            break;
        case 'search':
            require __DIR__ . '/search.php';
            break;
        case 'snippets':
            require __DIR__ . '/snippets.php';
            break;
        default:
            Response::notFound('API endpoint not found');
    }
} catch (PDOException $e) {
    if (DEBUG) {
        Response::error('Database error: ' . $e->getMessage(), 500);
    } else {
        Response::error('Internal server error', 500);
    }
} catch (Throwable $e) {
    if (DEBUG) {
        Response::error($e->getMessage(), 500);
    } else {
        Response::error('Internal server error', 500);
    }
}
