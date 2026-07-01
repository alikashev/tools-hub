<?php
/**
 * Modules API
 * GET    /api/modules         - List all enabled modules
 * GET    /api/modules/{id}    - Get a single module
 */

$method = $_SERVER['REQUEST_METHOD'];
$moduleId = $parts[1] ?? null;

switch ($method) {
    case 'GET':
        if ($moduleId) {
            $module = Database::fetchOne(
                'SELECT * FROM modules WHERE id = ? AND is_enabled = 1',
                [$moduleId]
            );
            if (!$module) {
                Response::notFound('Module not found');
            }
            Response::success($module);
        } else {
            $modules = Database::fetchAll(
                'SELECT * FROM modules WHERE is_enabled = 1 ORDER BY sort_order ASC'
            );
            Response::success($modules);
        }
        break;

    default:
        Response::error('Method not allowed', 405);
}
