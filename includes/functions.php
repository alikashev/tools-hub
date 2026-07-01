<?php

function sanitize(string $input): string
{
    return htmlspecialchars(strip_tags(trim($input)), ENT_QUOTES, 'UTF-8');
}

function is_ajax(): bool
{
    return !empty($_SERVER['HTTP_X_REQUESTED_WITH'])
        && strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) === 'xmlhttprequest';
}

function cors(): void
{
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');

    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

function get_json_body(): array
{
    $body = file_get_contents('php://input');
    $data = json_decode($body, true);
    return is_array($data) ? $data : [];
}

function get_route_parts(): array
{
    $uri = $_SERVER['REQUEST_URI'];
    $path = parse_url($uri, PHP_URL_PATH);
    $path = rtrim($path, '/');

    // Strip the script's base directory so subdirectory installs work
    $scriptDir = dirname($_SERVER['SCRIPT_NAME']);
    if ($scriptDir !== '/' && $scriptDir !== '.') {
        $path = substr($path, strlen($scriptDir));
        $path = rtrim($path, '/');
    }

    // Strip leading /api if present
    if (str_starts_with($path, '/api')) {
        $path = substr($path, 4);
    }

    $path = trim($path, '/');
    if ($path === '') {
        return [];
    }

    return explode('/', $path);
}
