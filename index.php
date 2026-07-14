<?php
/**
 * ficksie - Entry Point
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
    <link rel="icon" type="image/png" href="ficksie_logo_nt.png">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
    <link rel="stylesheet" href="assets/css/style.css?v=67">
</head>
<body>
    <div id="app">
        <aside class="sidebar" id="sidebar">
            <div class="sidebar-header">
                <div class="logo">
                    <div class="logo-images">
                        <img src="ficksie_logo_nt.png" alt="<?= $appName ?>" class="logo-img">
                        <img src="ficksie_logo_t.png" alt="<?= $appName ?>" class="logo-text-img">
                    </div>
                    <div class="slogan">Niet moeilijk doen, ficksie het ff</div>
                </div>
                <button class="sidebar-toggle" id="sidebarToggle" aria-label="Toggle sidebar" title="Toggle sidebar">
                    <i class="fas fa-chevron-left"></i>
                </button>
            </div>

            <div class="tw-sidebar-wrap">
                <button class="tw-trigger" id="twTrigger">
                    <i class="fas fa-compass"></i>
                    <span>Tool Wheel</span>
                </button>
            </div>

            <div class="sidebar-footer">
                <div class="version-badge">v1.0.0</div>
                <button class="btn btn-ghost btn-sm" id="logoutBtn" title="Sign out">
                    <i class="fas fa-sign-out-alt"></i>
                    <span>Sign out</span>
                </button>
            </div>
        </aside>

        <main class="main-content" id="mainContent">
            <header class="content-header">
                <div class="header-left">
                    <h1 id="pageTitle">Dashboard</h1>
                    <p id="pageSubtitle" class="text-muted">Niet moeilijk doen. <?= $appName ?> het ff</p>
                </div>
                <div class="header-actions">
                    <button class="btn btn-icon" id="themeToggle" title="Toggle theme">
                        <i class="fas fa-moon"></i>
                    </button>
                </div>
            </header>

            <div class="tab-bar" id="tabBar" style="display:none"></div>

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

    <!-- Login Screen -->
    <div class="login-overlay" id="loginScreen">
        <div class="login-bg"></div>
        <div class="login-card">
            <div class="login-card-inner">
                <div class="login-icon">
                    <img src="ficksie_logo_t.png" alt="<?= $appName ?>" class="login-logo-img">
                </div>
                <h1 class="login-title" style="display:none"><?= $appName ?></h1>
                <p class="login-subtitle">Niet moeilijk doen, ficksie het ff</p>

                <!-- Login Form -->
                <form id="loginForm">
                    <div class="login-field">
                        <label for="loginUsername">Username or Email</label>
                        <input type="text" id="loginUsername" name="username" placeholder="Enter your username" required autocomplete="username" spellcheck="false">
                    </div>
                    <div class="login-field">
                        <label for="loginPassword">Password</label>
                        <input type="password" id="loginPassword" name="password" placeholder="Enter your password" required autocomplete="current-password">
                    </div>
                    <div class="login-error" id="loginError"></div>
                    <button type="submit" class="login-btn login-btn-primary" id="loginBtn">
                        <span class="login-btn-text">Sign In</span>
                        <span class="login-btn-loading"><i class="fas fa-spinner fa-spin"></i></span>
                    </button>
                </form>

                <p class="login-alt-link" id="registerLinkWrap">
                    <a href="#" id="showRegisterLink">Create an admin account</a>
                </p>

                <!-- Register Form -->
                <form id="registerForm" style="display:none">
                    <div class="login-field">
                        <label for="regUsername">Username</label>
                        <input type="text" id="regUsername" name="username" placeholder="Choose a username" required autocomplete="off" spellcheck="false">
                    </div>
                    <div class="login-field">
                        <label for="regEmail">Email</label>
                        <input type="email" id="regEmail" name="email" placeholder="your@email.com" required autocomplete="off">
                    </div>
                    <div class="login-field">
                        <label for="regPassword">Password</label>
                        <input type="password" id="regPassword" name="password" placeholder="At least 6 characters" required autocomplete="new-password">
                    </div>
                    <div class="login-error" id="registerError"></div>
                    <button type="submit" class="login-btn login-btn-primary" id="registerBtn">
                        <span class="login-btn-text">Create Account</span>
                        <span class="login-btn-loading"><i class="fas fa-spinner fa-spin"></i></span>
                    </button>
                    <button type="button" class="login-btn login-btn-secondary" id="backToLoginBtn">
                        <i class="fas fa-arrow-left"></i> Back to Sign In
                    </button>
                </form>
            </div>
        </div>
    </div>

    <!-- Tool Wheel Overlay -->
    <div class="tw-overlay" id="twOverlay">
        <div class="tw-overlay-inner" id="twOverlayInner"></div>
    </div>

    <!-- Toast container -->
    <div class="toast-container" id="toastContainer"></div>
<script src="assets/js/dns.js?v=23"></script>
<script src="assets/js/password-generator.js?v=21"></script>
<script src="assets/js/ssl-tools.js?v=8"></script>

    <script src="assets/js/app.js?v=44"></script>
</body>
</html>
