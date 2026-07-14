# ficksie

A modular web application for managing developer tools — store Linux commands, save email response snippets, anonymize email addresses, analyze DNS, check SSL certificates, investigate IP reputation, and more. Built with PHP + MySQL and a vanilla JavaScript SPA frontend.

No build tools, no Node.js, no framework dependencies. Just upload and go.

## Features

- **Authentication** — Secure login/register system with bcrypt passwords, session management, and admin user management.
- **Command Hub** — Store, organize, and copy Linux commands. Group them by category with color-coded badges.
- **Snippets** — Save standard email responses and copy them as plain text with whitespace preserved.
- **Email Anonymizer** — Instantly mask email addresses (preserves first character and TLD).
- **Password Generator** — Generate strong random passwords with customizable length and character sets.
- **DNS Lookup Suite** — Comprehensive DNS analysis: A, AAAA, CNAME, MX, TXT, CAA, SRV, SOA records, SPF/DKIM/DMARC validation, nameserver checks, delegation analysis, reverse DNS (PTR), subdomain discovery, DNSSEC status, EDNS support, and a dig-like query tool.
- **SSL/TLS Toolkit** — Certificate checker, chain validator, TLS version tester, HSTS checker, and combined security audit.
- **IP Reputation Checker** — Aggregate data from ip-api.com (ASN/GeoIP), Spamhaus DNSBL, TOR exit node detection, AbuseIPDB, and VirusTotal. Computes a risk score and reputation rating.
- **Dashboard** — Quick overview of all tools with stats.
- **Dark/Light theme** — Persistent toggle.
- **Responsive** — Works on desktop and mobile.

## Requirements

- PHP 8.0+
- MySQL 5.7+ / MariaDB 10.3+
- Apache with mod_rewrite (or any server that supports URL rewriting)
- PHP extensions: `openssl`, `curl` (optional, for DNSSEC DS lookups)

## Quick Start

### 1. Upload

Copy the project files into your web root (e.g. `public_html/` or `htdocs/`).

### 2. Create the database

Using phpMyAdmin or the MySQL CLI, run the schema and seed scripts in order:

```sql
source database/schema.sql;
source database/seed.sql;
```

### 3. Configure

Copy `config.example.php` to `config.php` and edit it with your database credentials and optional API keys:

```php
define('DB_HOST', 'localhost');
define('DB_PORT', '3306');
define('DB_NAME', 'your_database');
define('DB_USER', 'your_user');
define('DB_PASS', 'your_password');
define('DB_CHARSET', 'utf8mb4');

define('APP_NAME', 'ficksie');
define('APP_URL', 'https://yourdomain.com');
define('APP_ENV', 'production'); // development | production
define('DEBUG', false);

// Timezone
date_default_timezone_set('UTC');

// IP Reputation API Keys (optional — leave empty to skip those sources)
define('ABUSEIPDB_KEY', '');    // https://www.abuseipdb.com/register
define('VIRUSTOTAL_KEY', '');   // https://www.virustotal.com/gui/join-us
```

### 4. Visit

Open `https://yourdomain.com/` in your browser. The first user to register becomes the admin.

## Configuration Reference

| Config | Description | Default |
|---|---|---|
| `DB_HOST` | MySQL host | `localhost` |
| `DB_PORT` | MySQL port | `3306` |
| `DB_NAME` | Database name | — |
| `DB_USER` | Database user | — |
| `DB_PASS` | Database password | — |
| `DB_CHARSET` | Connection charset | `utf8mb4` |
| `APP_NAME` | Application name | `ficksie` |
| `APP_URL` | Base URL (no trailing slash) | — |
| `APP_ENV` | `development` or `production` | `production` |
| `DEBUG` | Show detailed errors | `false` |
| `ABUSEIPDB_KEY` | AbuseIPDB API key (optional) | `''` |
| `VIRUSTOTAL_KEY` | VirusTotal API key (optional) | `''` |

## Development

Use the built-in PHP server for local development:

```bash
php -S localhost:8080 router.php
```

Then open `http://localhost:8080/`.

## Project Structure

```
├── api/                        # REST API endpoints
│   ├── index.php               # Router (dispatches to handlers)
│   ├── auth.php                # Login, register, logout, user management
│   ├── commands.php            # Command CRUD
│   ├── categories.php          # Category CRUD
│   ├── modules.php             # Tool module registry
│   ├── snippets.php            # Snippet CRUD
│   ├── search.php              # Global search
│   ├── dns.php                 # DNS Lookup Suite
│   ├── ssl.php                 # SSL/TLS Toolkit
│   └── ip-reputation.php       # IP Reputation Checker
├── assets/
│   ├── css/style.css           # Complete stylesheet
│   └── js/
│       ├── app.js              # SPA frontend
│       ├── dns.js              # DNS tool frontend logic
│       ├── ssl-tools.js        # SSL/TLS tool frontend logic
│       └── password-generator.js # Password generator frontend logic
├── database/
│   ├── schema.sql              # Database tables
│   └── seed.sql                # Sample data
├── includes/
│   ├── database.php            # PDO singleton
│   ├── functions.php           # Route parser, CORS, sanitization, auth helpers
│   └── response.php            # JSON response helpers
├── config.php                  # Application configuration (gitignored)
├── config.example.php          # Configuration template
├── index.php                   # SPA entry point
├── router.php                  # Dev server router
└── .htaccess                   # Apache rewrite rules
```

## Tools

### Authentication

Session-based auth with bcrypt password hashing. Registration is only available when no users exist (first user becomes admin). Admins can create, update, and delete users through the API.

- `POST /api/auth/login` — Sign in
- `POST /api/auth/logout` — Sign out
- `GET /api/auth/me` — Current user info
- `POST /api/auth/register` — Create first admin account
- `GET /api/auth/users` — List users (admin)
- `POST /api/auth/users` — Create user (admin)
- `PUT /api/auth/users/{id}` — Update user (admin)
- `DELETE /api/auth/users/{id}` — Delete user (admin)

### DNS Lookup Suite

Full DNS analysis for any domain. Results are cached in the database for 30 minutes. Includes:

- **Record lookups** — A, AAAA, CNAME (with chain tracing), MX, TXT, CAA, SRV, SOA
- **Email security** — SPF validation (mechanism parsing, lookup count, deprecation warnings), DKIM selector scanning, DMARC policy analysis
- **Nameserver checks** — Reachability, consistency, delegation validation, glue record verification
- **Reverse DNS** — PTR lookups for IPv4/IPv6, FCrDNS validation, custom PTR overrides
- **Subdomains** — Common subdomain discovery (www, mail)
- **DNSSEC** — DS/DNSKEY/RRSIG record detection, trust chain validation
- **EDNS** — Support detection
- **Dig tool** — Query any record type against any nameserver

### SSL/TLS Toolkit

- **Certificate check** — Expiry, subject/issuer info, SANs, self-signed detection, signature algorithm
- **Chain validator** — Full certificate chain analysis, issuer matching, CA verification
- **TLS version test** — Probes TLS 1.0–1.3 support with cipher and timing info
- **HSTS checker** — Header detection, max-age/subdomains/preload scoring (A–F grade)
- **Combined audit** — All four checks in a single request

### IP Reputation Checker

Aggregates multiple threat intelligence sources:

- **ip-api.com** — ASN, GeoIP, ISP, hosting/proxy/mobile detection
- **Spamhaus ZEN** — DNS-based blacklist lookup
- **TOR exit nodes** — Exit node detection
- **AbuseIPDB** — Abuse confidence score and reports (requires API key)
- **VirusTotal** — Multi-engine detection ratio (requires API key)

Returns a composite risk score (0–100) and reputation rating (safe/suspicious/malicious).

### Password Generator

Client-side password generator with customizable length and character classes (uppercase, lowercase, digits, symbols).

## Adding a Tool

1. Add a database table in `database/schema.sql`
2. Add an API endpoint in `api/`
3. Register the route in `api/index.php`
4. Add the tool config in the sidebar sections array in `assets/js/app.js`
5. Add the render function in `assets/js/app.js`
6. Add the tool card to the dashboard tools grid
7. Add the sidebar section to the nav sections array
8. Add CSS styles in `assets/css/style.css`
