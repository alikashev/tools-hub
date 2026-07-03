<?php
/**
 * Tool Hub Configuration
 *
 * Copy this file to config.php and update the values.
 */

define('DB_HOST', 'localhost');
define('DB_PORT', '3306');
define('DB_NAME', 'toolhub');
define('DB_USER', 'toolhub_user');
define('DB_PASS', 'your_secure_password');
define('DB_CHARSET', 'utf8mb4');

define('APP_NAME', 'Tool Hub');
define('APP_URL', 'http://your-domain.com');
define('APP_ENV', 'production'); // development | production
define('DEBUG', false);

// Timezone
date_default_timezone_set('UTC');

// IP Reputation API Keys (optional — leave empty to skip those sources)
// Get AbuseIPDB key: https://www.abuseipdb.com/register
define('ABUSEIPDB_KEY', '');
// Get VirusTotal key: https://www.virustotal.com/gui/join-us
define('VIRUSTOTAL_KEY', '');
