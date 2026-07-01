<?php
/**
 * Dev server router (php -S)
 * Mimics the .htaccess rewrite rules.
 */

$uri = $_SERVER['REQUEST_URI'];
$path = parse_url($uri, PHP_URL_PATH);

if ($path !== '/' && file_exists(__DIR__ . $path)) {
    return false;
}

if (str_starts_with($path, '/api/')) {
    $_SERVER['REQUEST_URI'] = str_replace('/api/', '/', $path);
    require __DIR__ . '/api/index.php';
    return true;
}

require __DIR__ . '/index.php';
