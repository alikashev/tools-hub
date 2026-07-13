# ficksie

A modular web application for managing developer tools — store Linux commands, save email response snippets, anonymize email addresses, and more. Built with PHP + MySQL and a vanilla JavaScript SPA frontend.

No build tools, no Node.js, no framework dependencies. Just upload and go.

## Features

- **Command Hub** — Store, organize, and copy Linux commands. Group them by category with color-coded badges.
- **Email Anonymizer** — Instantly mask email addresses (preserves first character and TLD).
- **Snippets** — Save standard email responses and copy them as plain text with whitespace preserved.
- **Dashboard** — Quick overview of all tools with stats.
- **Dark/Light theme** — Persistent toggle.
- **Responsive** — Works on desktop and mobile.

## Requirements

- PHP 8.0+
- MySQL 5.7+ / MariaDB 10.3+
- Apache with mod_rewrite (or any server that supports URL rewriting)

## Quick Start

### 1. Upload

Copy the `tools-hub/` folder into your web root (e.g. `public_html/` or `htdocs/`).

### 2. Create the database

Using phpMyAdmin or the MySQL CLI, run the schema and seed scripts in order:

```sql
source database/schema.sql;
source database/seed.sql;
```

### 3. Configure

Edit `config.php` with your database credentials:

```php
define('DB_NAME', 'your_database');
define('DB_USER', 'your_user');
define('DB_PASS', 'your_password');
define('APP_URL', 'https://yourdomain.com/tools-hub');
define('APP_ENV', 'production');
define('DEBUG', false);
```

### 4. Visit

Open `https://yourdomain.com/tools-hub/` in your browser.

## Development

Use the built-in PHP server for local development:

```bash
php -S localhost:8080 router.php
```

Then open `http://localhost:8080/tools-hub/`.

## Project Structure

```
tools-hub/
├── api/                    # REST API endpoints
│   ├── index.php           # Router
│   ├── commands.php
│   ├── categories.php
│   ├── modules.php
│   ├── snippets.php
│   └── search.php
├── assets/
│   ├── css/style.css       # Complete stylesheet
│   └── js/app.js           # SPA frontend
├── database/
│   ├── schema.sql          # Database tables
│   └── seed.sql            # Sample data
├── includes/
│   ├── database.php        # PDO singleton
│   ├── functions.php       # Route parser, CORS, sanitization
│   └── response.php        # JSON response helpers
├── config.php              # Application configuration
├── index.php               # SPA entry point
├── router.php              # Dev server router
└── .htaccess               # Apache rewrite rules
```

## Adding a Tool

1. Add a database table in `database/schema.sql`
2. Add an API endpoint in `api/`
3. Register the route in `api/index.php`
4. Add the tool config in the sidebar sections array in `assets/js/app.js`
5. Add the render function in `assets/js/app.js`
6. Add the tool card to the dashboard tools grid
7. Add the sidebar section to the nav sections array
8. Add CSS styles in `assets/css/style.css`
