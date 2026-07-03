<?php
/**
 * Tool Hub Configuration
 *
 * Copy this file to config.php and update the values.
 */

define('DB_HOST', 'localhost');
define('DB_PORT', '3306');
define('DB_NAME', 'toolhub');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_CHARSET', 'utf8mb4');

define('APP_NAME', 'Tool Hub');
define('APP_URL', 'http://your-domain.com');
define('APP_ENV', 'development'); // development | production
define('DEBUG', false);

// Timezone
date_default_timezone_set('UTC');

// IP Reputation API Keys (optional — leave empty to skip those sources)
define('ABUSEIPDB_KEY', '');
define('VIRUSTOTAL_KEY', '');
