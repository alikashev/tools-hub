<?php
/**
 * Tool Hub - Entry Point
 *
 * Serves the main SPA HTML shell.
 * All API routes are handled by api/index.php via .htaccess rewriting.
 */

require_once __DIR__ . '/config.php';

$appName = APP_NAME;
?>
<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="dark">
    <title><?= $appName ?></title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
    <link rel="stylesheet" href="assets/css/style.css">
</head>
<body>
    <div id="app">
        <aside class="sidebar" id="sidebar">
            <div class="sidebar-header">
                <div class="logo">
                    <i class="fas fa-cubes"></i>
                    <span><?= $appName ?></span>
                </div>
                <button class="sidebar-toggle" id="sidebarToggle" aria-label="Toggle sidebar" title="Toggle sidebar">
                    <i class="fas fa-chevron-left"></i>
                </button>
            </div>

            <nav class="sidebar-nav" id="moduleNav">
                <!-- Modules loaded dynamically -->
                <div class="nav-loading">
                    <i class="fas fa-spinner fa-spin"></i>
                    <span>Loading...</span>
                </div>
            </nav>

            <div class="sidebar-footer">
                <div class="version-badge">v1.0.0</div>
            </div>
        </aside>

        <main class="main-content" id="mainContent">
            <header class="content-header">
                <div class="header-left">
                    <h1 id="pageTitle">Dashboard</h1>
                    <p id="pageSubtitle" class="text-muted">Welcome to <?= $appName ?></p>
                </div>
                <div class="header-actions">
                    <button class="btn btn-icon" id="themeToggle" title="Toggle theme">
                        <i class="fas fa-moon"></i>
                    </button>
                </div>
            </header>

            <div class="content-body" id="contentBody">
                <!-- Dashboard loaded by default -->
            </div>
        </main>
    </div>

    <!-- Command Modal -->
    <div class="modal-overlay" id="commandModal">
        <div class="modal">
            <div class="modal-header">
                <h2 id="commandModalTitle">Add Command</h2>
                <button class="modal-close" data-modal="commandModal">&times;</button>
            </div>
            <form id="commandForm">
                <input type="hidden" name="id" id="commandId">
                <div class="modal-body">
                    <div class="form-group">
                        <label for="commandTitle">Title</label>
                        <input type="text" id="commandTitle" name="title" required placeholder="e.g. List files with details">
                    </div>
                    <div class="form-group">
                        <label for="commandCategory">Category</label>
                        <select id="commandCategory" name="category_id">
                            <option value="">No category</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="commandContent">Command</label>
                        <textarea id="commandContent" name="command" rows="3" required placeholder="e.g. ls -lah" class="font-mono"></textarea>
                    </div>
                    <div class="form-group">
                        <label for="commandDescription">Description <span class="text-muted">(optional)</span></label>
                        <textarea id="commandDescription" name="description" rows="2" placeholder="What does this command do?"></textarea>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-modal="commandModal">Cancel</button>
                    <button type="submit" class="btn btn-primary" id="commandSubmitBtn">
                        <i class="fas fa-plus"></i> Add Command
                    </button>
                </div>
            </form>
        </div>
    </div>

    <!-- Category Modal -->
    <div class="modal-overlay" id="categoryModal">
        <div class="modal modal-sm">
            <div class="modal-header">
                <h2 id="categoryModalTitle">Add Category</h2>
                <button class="modal-close" data-modal="categoryModal">&times;</button>
            </div>
            <form id="categoryForm">
                <input type="hidden" name="id" id="categoryId">
                <div class="modal-body">
                    <div class="form-group">
                        <label for="categoryName">Category Name</label>
                        <input type="text" id="categoryName" name="name" required placeholder="e.g. File Operations">
                    </div>
                    <div class="form-group">
                        <label for="categoryColor">Color</label>
                        <div class="color-picker-row">
                            <input type="color" id="categoryColor" name="color" value="#0d6efd">
                            <input type="text" id="categoryColorHex" maxlength="7" value="#0d6efd">
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-modal="categoryModal">Cancel</button>
                    <button type="submit" class="btn btn-primary" id="categorySubmitBtn">
                        <i class="fas fa-plus"></i> Add Category
                    </button>
                </div>
            </form>
        </div>
    </div>

    <!-- Category Manager Modal -->
    <div class="modal-overlay" id="categoryManagerModal">
        <div class="modal modal-lg">
            <div class="modal-header">
                <h2><i class="fas fa-tags"></i> Manage Categories</h2>
                <button class="modal-close" data-modal="categoryManagerModal">&times;</button>
            </div>
            <div class="modal-body">
                <div class="cat-manager-toolbar">
                    <div class="search-input-wrap" style="flex:1;max-width:320px">
                        <i class="fas fa-search"></i>
                        <input type="text" id="catManagerSearch" placeholder="Search categories..." autocomplete="off">
                    </div>
                    <button class="btn btn-primary" id="catManagerAddBtn">
                        <i class="fas fa-plus"></i> Add Category
                    </button>
                </div>
                <div class="categories-grid" id="catManagerGrid">
                    <div class="loading-spinner" style="grid-column:1/-1">
                        <i class="fas fa-spinner fa-spin"></i>
                        <span>Loading...</span>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Confirm Modal -->
    <div class="modal-overlay" id="confirmModal">
        <div class="modal modal-sm">
            <div class="modal-header">
                <h2 id="confirmModalTitle">Confirm</h2>
                <button class="modal-close" data-modal="confirmModal">&times;</button>
            </div>
            <div class="modal-body">
                <div class="confirm-icon"><i class="fas fa-exclamation-triangle"></i></div>
                <p id="confirmModalMessage" class="confirm-message">Are you sure?</p>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-modal="confirmModal">Cancel</button>
                <button type="button" class="btn btn-danger" id="confirmDeleteBtn">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        </div>
    </div>

    <!-- Snippet Modal -->
    <div class="modal-overlay" id="snippetModal">
        <div class="modal">
            <div class="modal-header">
                <h2 id="snippetModalTitle">Add Snippet</h2>
                <button class="modal-close" data-modal="snippetModal">&times;</button>
            </div>
            <form id="snippetForm">
                <input type="hidden" name="id" id="snippetId">
                <div class="modal-body">
                    <div class="form-group">
                        <label for="snippetTitle">Title</label>
                        <input type="text" id="snippetTitle" name="title" required placeholder="e.g. Thank you for your inquiry">
                    </div>
                    <div class="form-group">
                        <label for="snippetContent">Content</label>
                        <textarea id="snippetContent" name="content" rows="8" required placeholder="Write your email response here..." class="font-mono" style="white-space:pre-wrap"></textarea>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-modal="snippetModal">Cancel</button>
                    <button type="submit" class="btn btn-primary" id="snippetSubmitBtn">
                        <i class="fas fa-plus"></i> Add Snippet
                    </button>
                </div>
            </form>
        </div>
    </div>

    <!-- Toast container -->
    <div class="toast-container" id="toastContainer"></div>

    <script src="assets/js/app.js"></script>
</body>
</html>
