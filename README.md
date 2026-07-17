# ficksie

A modular web application for managing developer tools — store Linux commands, save email response snippets, anonymize email addresses, analyze DNS, check SSL certificates, generate CSRs, decode certificates, investigate IP reputation, and more. Built with PHP + MySQL and a vanilla JavaScript SPA frontend.

No build tools, no Node.js, no framework dependencies. Just upload and go.

## Features

- **Authentication** — Secure login/register system with bcrypt passwords, session management, and admin user management.
- **Command Hub** — Store, organize, and copy Linux commands. Group them by category with color-coded badges.
- **Snippets** — Save standard email responses and copy them as plain text with whitespace preserved.
- **Email Anonymizer** — Instantly mask email addresses (preserves first character and TLD).
- **Email Header Visualizer** — Parse and analyze email headers for forensic traces.
- **Text Editor** — Rich text editor with templates and variables.
- **Password Generator** — Generate strong random passwords with customizable length and character sets.
- **DNS Lookup Suite** — Comprehensive DNS analysis: A, AAAA, CNAME, MX, TXT, CAA, SRV, SOA records, SPF/DKIM/DMARC validation, nameserver checks, delegation analysis, reverse DNS (PTR), subdomain discovery, DNSSEC status, EDNS support, and a dig-like query tool.
- **SSL/TLS Toolkit** — Certificate checker, chain validator, TLS version tester, HSTS checker, combined security audit, CSR decoder, and CSR generator with SAN support.
- **IP Reputation Checker** — Aggregate data from ip-api.com (ASN/GeoIP), Spamhaus DNSBL, TOR exit node detection, AbuseIPDB, and VirusTotal. Computes a risk score and reputation rating.
- **Dashboard** — Quick overview of all tools with stats, CRM & provider links, and external tool shortcuts with branded icons.
- **Multi-tab SPA** — Open multiple tools simultaneously in tabs. Each tab preserves its own state.
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
│   ├── ssl.php                 # SSL/TLS (check, chain, tls, hsts, audit, csr-decode, csr-generate)
│   └── ip-reputation.php       # IP Reputation Checker
├── assets/
│   ├── css/style.css           # Complete stylesheet
│   └── js/
│       ├── app.js              # SPA core, tab system, dashboard, nav
│       ├── dns.js              # DNS tool frontend logic
│       ├── ssl-toolkit.js      # SSL/TLS tool frontend logic (audit, CSR decoder, CSR generator)
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
├── index.php                   # SPA entry point (loads all JS/CSS)
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

Three tools merged into one, plus a combined audit mode:

#### Certificate Audit (combined)
- Runs cert check, chain validation, TLS version scan, and HSTS analysis in a single request
- Overall status banner reflects the worst finding across all checks
- Chain analysis includes CA bundle verification with fallback for `open_basedir`-restricted environments
- HSTS grade (A–F) and missing-HSTS detection surfaced in overall status

#### Certificate Check
- Expiry dates, days remaining, subject/issuer info, SANs, wildcard coverage detection
- Self-signed detection, serial number, fingerprint (SHA-256), signature algorithm

#### Chain Validator
- Full certificate chain reconstruction from server
- Signature verification between each link using `openssl_x509_verify`
- Root detection (self-signed vs intermediate CA)
- CA bundle verification — checks if the last cert's issuer exists in the system trust store
- Visual chain display with missing root card and fix instructions

#### TLS Version Tester
- Probes TLS 1.0–1.3 support with cipher, bit strength, and connection timing
- Security notes for deprecated versions (1.0/1.1) and missing modern versions (1.3)

#### HSTS Checker
- Header detection, max-age/subdomains/preload evaluation
- Scored 0–80, graded A–F
- Recommendations for missing or weak configuration

#### CSR Decoder
- Paste a CSR to decode subject, organization, SANs, key size, signature algorithm, and challenge password

#### CSR Generator
- Generate CSRs with customizable subject fields and SANs (domains + IPs)
- Supports ECDSA (P-256/P-384) and RSA (2048/4096) key types
- Outputs PEM-encoded CSR and private key, copy/download ready

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

## Dashboard

The dashboard includes:

- **Tool cards** — Quick access to all tools with descriptions and icons
- **Stats** — Command count, snippet count, registered users
- **CRM & Provider Links** — Direct links to hosting provider panels (Versio, Flexwebhosting, Neostrada, Yourhosting, etc.) with expandable sub-links, sorted alphabetically with branded icon initials
- **External Tools** — Quick access to third-party services (ScoreBuddy, Realtime Register, Jira, Openprovider, email, etc.) sorted alphabetically with branded icon initials

## Architecture Notes

### SPA Tab System
- Multi-tab interface — open multiple tools in parallel, each with independent state
- Tabs persist across navigation; switching tabs is instant (CSS toggle only)
- Each tool's render function manages its own DOM within a tab panel

### SSL/TLS Backend Details
- Chain validation uses `openssl_x509_verify` with PEM strings (pure PHP, no exec)
- CA bundle lookup has a three-tier fallback: `/etc/ssl/certs/ca-certificates.crt` → `/etc/pki/tls/certs/ca-bundle.crt` → `/home/admin/tmp/ca-bundle.crt` (copy inside `open_basedir`)
- The fallback copy is kept in sync via a monthly cron job
- TLS version probing uses `stream_socket_client` with per-version `crypto_method` flags

### Frontend Caching
- Static assets use `?v=N` cache busters in `index.php` — bump the version number when modifying JS or CSS
- When behind Cloudflare, query-string cache busters are essential for busting the CDN cache

## Adding a Tool

1. Add a database table in `database/schema.sql` (if needed)
2. Add an API endpoint in `api/`
3. Register the route in `api/index.php`
4. Add the tool config in the `tools` array in `assets/js/app.js`
5. Add the render function in `assets/js/app.js`
6. Add the tool card to the dashboard tools grid
7. Add the sidebar section to the nav sections array
8. Add a `viewMeta` entry in `assets/js/app.js` with title, tabLabel, subtitle, and icon
9. Add CSS styles in `assets/css/style.css`
10. Bump the `?v=N` cache buster for the modified JS/CSS files in `index.php`
