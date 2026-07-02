# Tool Hub — Project Context

## Overview
Vanilla PHP + JS SPA. No framework, no build tools, no npm. Just upload PHP files to any web server with MySQL/MariaDB.

## Tech Stack
- **Backend**: PHP 8.0+, MySQL/MariaDB, PDO, Apache (`mod_rewrite`) or PHP built-in server
- **Frontend**: Vanilla JavaScript ES2020+, CSS Custom Properties (dark-first theming), Font Awesome 6.5.1
- **No frameworks, no build tools, no npm**

## File Structure
```
/
├── index.php              # SPA HTML shell (modals, layout)
├── config.php             # DB credentials, APP_NAME, etc.
├── router.php             # Dev server: php -S localhost:8080 router.php
├── .htaccess              # Apache rewrite rules
├── api/
│   ├── index.php          # API router (routes to endpoints by resource name)
│   ├── modules.php        # GET /api/modules
│   ├── categories.php     # CRUD /api/categories
│   ├── commands.php       # CRUD /api/commands
│   ├── snippets.php       # CRUD /api/snippets
│   └── search.php         # GET /api/search?q=
├── assets/
│   ├── css/style.css      # All styles (single file, ~1700 lines)
│   └── js/app.js          # All JS (SPA logic, ~1450 lines)
├── includes/
│   ├── database.php       # PDO singleton
│   ├── response.php       # JSON response helpers
│   └── functions.php      # Utility functions
├── database/
│   ├── schema.sql         # Full schema (users, modules, categories, commands, snippets)
│   └── seed.sql           # Sample data
```

## XAMPP Setup
- Local path: `/Users/alikashev/Desktop/tools-hub/`
- XAMPP htdocs: `/Applications/XAMPP/htdocs/tools-hub/`
- After editing, run: `cp index.php /Applications/XAMPP/htdocs/tools-hub/ && cp assets/css/style.css /Applications/XAMPP/htdocs/tools-hub/assets/css/ && cp assets/js/app.js /Applications/XAMPP/htdocs/tools-hub/assets/js/ && cp api/index.php /Applications/XAMPP/htdocs/tools-hub/api/`
- URL: `http://localhost/tools-hub/`

## Dev Server (no XAMPP)
```bash
php -S localhost:8080 router.php
```

## Database
- Name: `toolhub` (MySQL/MariaDB)
- Tables: `users`, `modules`, `categories`, `commands`, `snippets`
- Run `database/schema.sql` to initialize

## Key Design Decisions
- **No frontend framework** — vanilla JS SPA with manual DOM manipulation
- **Dark-first** with CSS custom properties for theme switching (light/dark via `data-theme` attr)
- **Single-file CSS and JS** — all styles in `style.css`, all logic in `app.js`
- **REST API** — JSON endpoints, no HTML rendering from backend

## UI Patterns (for consistency)
- **Dashboard**: `renderDashboard()` — stats bar + active tool cards with icons
- **Sidebar**: `renderNav()` — collapsible sections, collapsible to icon-only (68px) mode
- **Tool pages**: page title set via `setPageTitle()`, content rendered into `#contentBody`
- **Modals**: static HTML in `index.php`, opened via `openModal(id)`, forms submit to API
- **Toasts**: `toast(message, type)` — types: success, error, warning, info
- **Confirm dialog**: `showConfirmModal(message)` returns Promise<bool>

## Sidebar Navigation
Nav sections are defined in `sections` array in `renderNav()` in `app.js`. Add new tools by:
1. Adding a section entry with `key`, `label`, `icon`, and `items` array
2. Adding `else if` branch in `navigate()`
3. Adding a dashboard card in `renderDashboard()`

## Recent Changes
- **Dashboard & Sidebar Redesign**: Collapsible sidebar (icon-only mode), minimalist dashboard (removed welcome text, coming-soon tools, 3rd stat), subtle background glow
- **Email Header Visualizer** (`renderEmailHeaderViz()`): Client-side parser for raw email headers. Color-coded sections: Overview, Authentication (SPF/DKIM/DMARC with pass/fail/warn), Delivery Path (timeline view), Alerts, Other headers. Sample data button. Under Email Tools in sidebar.
- **Script Library**: Was added then removed (user decided Command Hub was sufficient)
