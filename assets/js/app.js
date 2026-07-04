/**
 * Tool Hub - SPA Frontend
 */

const API_BASE = 'api';

// ============================================
// Auth State
// ============================================
let user = null;
let appInited = false;

// ============================================
// State
// ============================================
const state = {
    modules: [],
    commands: [],
    categories: [],
    currentModule: null,
    currentView: 'dashboard',
    currentSubview: null,
    filterCategory: '',
    searchQuery: '',
    sidebarCollapsed: localStorage.getItem('toolhub-sidebar') === 'true',
};

// ============================================
// API Helper
// ============================================
async function api(method, path, body = null) {
    const opts = {
        method,
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
    };

    if (body && method !== 'GET') {
        opts.headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(body);
    }

    const url = `${API_BASE}/${path}`;

    const res = await fetch(url, opts);
    const data = await res.json();

    if (!data.success) {
        throw new Error(data.message || 'API Error');
    }

    return data.data;
}

// ============================================
// Auth API helper (no auth required)
// ============================================
async function authApi(method, path, body = null) {
    const opts = {
        method,
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
    };

    if (body && method !== 'GET') {
        opts.headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(body);
    }

    const url = `${API_BASE}/auth/${path}`;

    const res = await fetch(url, opts);
    const data = await res.json();

    if (!data.success) {
        throw new Error(data.message || 'API Error');
    }

    return data.data;
}

// ============================================
// Auth Functions
// ============================================
async function checkAuth() {
    try {
        user = await authApi('GET', 'me');
        return true;
    } catch {
        return false;
    }
}

async function handleLogin(username, password) {
    user = await authApi('POST', 'login', { username, password });
    return user;
}

async function handleLogout() {
    await authApi('POST', 'logout');
    user = null;
}

async function handleRegister(username, email, password) {
    user = await authApi('POST', 'register', { username, email, password });
    return user;
}

function isAdmin() {
    return user && user.is_admin === true;
}

function showLoginScreen() {
    document.getElementById('loginScreen').classList.add('active');
    document.getElementById('loginUsername').focus();
}

function hideLoginScreen() {
    document.getElementById('loginScreen').classList.remove('active');
}

// ============================================
// Toast Notifications
// ============================================
function toast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toastContainer');
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle',
    };

    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `
        <i class="fas ${icons[type] || icons.info}"></i>
        <span class="toast-text">${message}</span>
    `;

    container.appendChild(el);

    setTimeout(() => {
        el.classList.add('removing');
        setTimeout(() => el.remove(), 250);
    }, duration);
}

// ============================================
// Modal Helpers
// ============================================
function openModal(id) {
    document.getElementById(id).classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
    document.body.style.overflow = '';
}

// ============================================
// Confirm Modal
// ============================================
function showConfirmModal(message, title = 'Confirm') {
    return new Promise(resolve => {
        document.getElementById('confirmModalTitle').textContent = title;
        document.getElementById('confirmModalMessage').textContent = message;
        const confirmBtn = document.getElementById('confirmDeleteBtn');

        function cleanup() {
            closeModal('confirmModal');
            confirmBtn.removeEventListener('click', onConfirm);
            document.querySelectorAll('[data-modal="confirmModal"]').forEach(el => {
                el.removeEventListener('click', onCancel);
            });
            // Remove backdrop click handler
            const overlay = document.getElementById('confirmModal');
            overlay.removeEventListener('click', onBackdrop);
        }

        function onConfirm() {
            cleanup();
            resolve(true);
        }

        function onCancel() {
            cleanup();
            resolve(false);
        }

        function onBackdrop(e) {
            if (e.target === this) {
                onCancel();
            }
        }

        confirmBtn.addEventListener('click', onConfirm);
        document.querySelectorAll('[data-modal="confirmModal"]').forEach(el => {
            el.addEventListener('click', onCancel);
        });

        const overlay = document.getElementById('confirmModal');
        overlay.addEventListener('click', onBackdrop);

        openModal('confirmModal');
    });
}

function closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(m => {
        m.classList.remove('active');
    });
    document.body.style.overflow = '';
}

// ============================================
// Module / Navigation
// ============================================
async function loadModules() {
    state.modules = await api('GET', 'modules');
    renderNav();
}

const navState = {
    expanded: { 'command-hub': true, 'email-tools': false, 'network-tools': true },
};

function renderNav() {
    const nav = document.getElementById('moduleNav');
    nav.innerHTML = '';

    const dashItem = document.createElement('button');
    dashItem.className = `nav-item ${state.currentView === 'dashboard' ? 'active' : ''}`;
    dashItem.dataset.view = 'dashboard';
    dashItem.title = 'Dashboard';
    dashItem.innerHTML = '<i class="fas fa-th-large"></i> <span>Dashboard</span>';
    dashItem.addEventListener('click', () => navigate('dashboard'));
    nav.appendChild(dashItem);

    const sections = [
        {
            key: 'command-hub',
            label: 'Command Hub',
            icon: 'fa-terminal',
            items: [
                { view: 'commands', icon: 'fa-list', label: 'Commands' },
            ],
        },
        {
            key: 'email-tools',
            label: 'Email Tools',
            icon: 'fa-envelope',
            items: [
                { view: 'email-anonymizer', icon: 'fa-mask', label: 'Email Anonymizer' },
                { view: 'email-header-viz', icon: 'fa-code-branch', label: 'Header Visualizer' },
                { view: 'snippets', icon: 'fa-reply', label: 'Snippets' },
            ],
        },
        {
            key: 'network-tools',
            label: 'Network Tools',
            icon: 'fa-globe',
            items: [
                { view: 'ip-reputation', icon: 'fa-shield-halved', label: 'IP Reputation' },
            ],
        },
    ];

    if (isAdmin()) {
        sections.push({
            key: 'admin',
            label: 'Administration',
            icon: 'fa-shield-halved',
            items: [
                { view: 'users', icon: 'fa-users', label: 'Manage Users' },
            ],
        });
    }

    sections.forEach(section => {
        const isOpen = navState.expanded[section.key] !== false;
        const hasActive = section.items.some(i => state.currentView === i.view);

        const header = document.createElement('button');
        header.className = `nav-section-header ${hasActive ? 'has-active' : ''}`;
        header.title = section.label;
        header.innerHTML = `
            <i class="fas ${section.icon}"></i>
            <span>${section.label}</span>
            <i class="fas fa-chevron-down nav-chevron ${isOpen ? 'open' : ''}"></i>
        `;
        header.addEventListener('click', () => {
            navState.expanded[section.key] = !navState.expanded[section.key];
            renderNav();
        });
        nav.appendChild(header);

        const wrapper = document.createElement('div');
        wrapper.className = `nav-sub-wrapper ${isOpen ? 'open' : ''}`;
        wrapper.style.overflow = 'hidden';
        wrapper.style.transition = 'max-height 0.3s ease';

        const inner = document.createElement('div');
        inner.className = 'nav-sub-inner';

        section.items.forEach(item => {
            const el = document.createElement('button');
            el.className = `nav-item nav-sub-item ${state.currentView === item.view ? 'active' : ''}`;
            el.dataset.view = item.view;
            el.title = item.label;
            el.innerHTML = `<i class="fas ${item.icon}"></i> <span>${item.label}</span>`;
            el.addEventListener('click', () => navigate(item.view));
            inner.appendChild(el);
        });

        wrapper.appendChild(inner);
        nav.appendChild(wrapper);

        wrapper.style.maxHeight = '0';
        void wrapper.offsetHeight;
        if (isOpen) {
            wrapper.style.maxHeight = inner.scrollHeight + 'px';
        }
    });
}

// ============================================
// Navigation
// ============================================
function navigate(view) {
    state.currentView = view;

    document.querySelectorAll('.nav-item').forEach(n => {
        n.classList.toggle('active', n.dataset.view === view);
    });

    closeSidebar();

    if (view === 'dashboard') {
        renderDashboard();
    } else if (view === 'commands') {
        renderCommands();
    } else if (view === 'email-anonymizer') {
        renderEmailAnonymizer();
    } else if (view === 'email-header-viz') {
        renderEmailHeaderViz();
    } else if (view === 'snippets') {
        renderSnippets();
    } else if (view === 'ip-reputation') {
        renderIpReputation();
    } else if (view === 'users') {
        renderUserManagement();
    }
}

// ============================================
// Dashboard
// ============================================
async function renderDashboard() {
    setPageTitle('Dashboard', 'Your central workspace');

    const body = document.getElementById('contentBody');

    try {
        const commands = await api('GET', 'commands');
        const snippets = await api('GET', 'snippets');

        const activeTools = [
            {
                key: 'commands',
                icon: 'fa-terminal',
                name: 'Command Hub',
                desc: 'Store, organize and copy Linux commands',
                color: '#6c63ff',
            },
            {
                key: 'email-anonymizer',
                icon: 'fa-mask',
                name: 'Email Anonymizer',
                desc: 'Anonymize email addresses instantly for privacy',
                color: '#22c55e',
            },
            {
                key: 'email-header-viz',
                icon: 'fa-code-branch',
                name: 'Header Visualizer',
                desc: 'Parse and analyze email headers with color-coded insights',
                color: '#3b82f6',
            },
            {
                key: 'snippets',
                icon: 'fa-reply',
                name: 'Snippets',
                desc: 'Save and copy standard email responses',
                color: '#14b8a6',
            },
            {
                key: 'ip-reputation',
                icon: 'fa-shield-halved',
                name: 'IP Reputation',
                desc: 'Analyze IP addresses for security and abuse history',
                color: '#f59e0b',
            },
        ];

        body.innerHTML = `
            <div class="dashboard">
                <div class="dash-stats">
                    <div class="dash-stat">
                        <div class="dash-stat-icon blue"><i class="fas fa-terminal"></i></div>
                        <div class="dash-stat-info">
                            <span class="dash-stat-value">${commands.length}</span>
                            <span class="dash-stat-label">Saved Commands</span>
                        </div>
                    </div>
                    <div class="dash-stat-divider"></div>
                    <div class="dash-stat">
                        <div class="dash-stat-icon purple"><i class="fas fa-reply"></i></div>
                        <div class="dash-stat-info">
                            <span class="dash-stat-value">${snippets.length}</span>
                            <span class="dash-stat-label">Saved Snippets</span>
                        </div>
                    </div>
                    <div class="dash-stat-divider"></div>
                    <div class="dash-stat">
                        <div class="dash-stat-icon green"><i class="fas fa-tools"></i></div>
                        <div class="dash-stat-info">
                            <span class="dash-stat-value">${activeTools.length}</span>
                            <span class="dash-stat-label">Active Tools</span>
                        </div>
                    </div>
                </div>

                <div class="dash-section-label">Quick Access</div>
                <div class="dash-tools">
                    ${activeTools.map(t => `
                        <div class="dash-tool" data-nav="${t.key}">
                            <div class="dash-tool-icon" style="background:${t.color}18;color:${t.color}">
                                <i class="fas ${t.icon}"></i>
                            </div>
                            <h3>${t.name}</h3>
                            <p>${t.desc}</p>
                            <span class="dash-tool-action">
                                Open <i class="fas fa-arrow-right"></i>
                            </span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        document.querySelectorAll('.dash-tool[data-nav]').forEach(card => {
            card.addEventListener('click', () => navigate(card.dataset.nav));
        });
    } catch (err) {
        body.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><h3>Failed to load dashboard</h3><p>${err.message}</p></div>`;
    }
}

// ============================================
// Command Hub
// ============================================
let commandSearchTimeout = null;

async function renderCommands() {
    setPageTitle('Commands', 'Manage your Linux commands');

    const body = document.getElementById('contentBody');
    body.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i><span>Loading commands...</span></div>';

    try {
        const [commands, categories] = await Promise.all([
            api('GET', 'commands'),
            api('GET', 'categories?module_id=1'),
        ]);

        state.commands = commands;
        state.categories = categories;

        const admin = isAdmin();

        body.innerHTML = `
            <div class="toolbar">
                <div class="toolbar-search-row">
                    <div class="search-input-wrap">
                        <i class="fas fa-search"></i>
                        <input type="text" id="commandSearch" placeholder="Search commands..." autocomplete="off">
                    </div>
                    ${admin ? `<button class="btn btn-primary" id="addCommandBtn">
                        <i class="fas fa-plus"></i> Add Command
                    </button>` : ''}
                </div>
                <div class="toolbar-filter-row">
                    <select class="filter-select" id="categoryFilter">
                        <option value="">All Categories</option>
                        ${categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
                    </select>
                    ${admin ? `<button class="btn btn-secondary" id="manageCategoriesBtn">
                        <i class="fas fa-tags"></i> Manage
                    </button>` : ''}
                </div>
            </div>

            <div class="commands-grid" id="commandsGrid">
                ${renderCommandCards(commands)}
            </div>
        `;

        attachCommandEvents();
    } catch (err) {
        body.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><h3>Failed to load</h3><p>${err.message}</p></div>`;
    }
}

function renderCommandCards(commands) {
    if (!commands.length) {
        return `
            <div class="empty-state">
                <i class="fas fa-terminal"></i>
                <h3>No commands found</h3>
                <p>Add your first command to get started.</p>
            </div>
        `;
    }

    const admin = isAdmin();

    return commands.map(cmd => {
        const catColor = cmd.category_color || '#6c757d';
        const catName = cmd.category_name || 'Uncategorized';
        const desc = cmd.description
            ? `<p class="command-description">${escHtml(cmd.description)}</p>`
            : '';

        return `
            <div class="command-card" data-id="${cmd.id}">
                <div class="command-card-head">
                    <h3 class="command-title">${escHtml(cmd.title)}</h3>
                    <span class="category-badge" style="background:${catColor}; color:#fff">
                        ${escHtml(catName)}
                    </span>
                </div>
                <div class="command-card-body">
                    <div class="command-preview">${escHtml(cmd.command)}</div>
                    ${desc}
                </div>
                <div class="command-card-actions">
                    <button class="btn btn-copy copy-command" data-command="${escHtml(cmd.command)}">
                        <i class="fas fa-copy"></i> Copy
                    </button>
                    ${admin ? `
                    <button class="btn btn-edit edit-command" data-id="${cmd.id}">
                        <i class="fas fa-pen"></i> Edit
                    </button>
                    <button class="btn btn-delete delete-command" data-id="${cmd.id}">
                        <i class="fas fa-trash"></i> Delete
                    </button>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function escHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ============================================
// Commands Events
// ============================================
function attachCommandEvents() {
    const addBtn = document.getElementById('addCommandBtn');
    if (addBtn) {
        addBtn.addEventListener('click', () => openCommandModal());
    }

    const searchInput = document.getElementById('commandSearch');
    searchInput.addEventListener('input', () => {
        clearTimeout(commandSearchTimeout);
        commandSearchTimeout = setTimeout(() => {
            state.searchQuery = searchInput.value;
            filterCommands();
        }, 250);
    });

    document.getElementById('categoryFilter').addEventListener('change', (e) => {
        state.filterCategory = e.target.value;
        filterCommands();
    });

    const mgmtBtn = document.getElementById('manageCategoriesBtn');
    if (mgmtBtn) {
        mgmtBtn.addEventListener('click', () => openCategoryManagerModal());
    }

    attachCommandCardEvents();
}

// ============================================
// Filter Commands
// ============================================
function filterCommands() {
    let filtered = state.commands;

    if (state.filterCategory) {
        filtered = filtered.filter(c => c.category_id == state.filterCategory);
    }

    if (state.searchQuery) {
        const q = state.searchQuery.toLowerCase();
        filtered = filtered.filter(c =>
            (c.title && c.title.toLowerCase().includes(q)) ||
            (c.command && c.command.toLowerCase().includes(q)) ||
            (c.description && c.description.toLowerCase().includes(q)) ||
            (c.category_name && c.category_name.toLowerCase().includes(q))
        );
    }

    const grid = document.getElementById('commandsGrid');
    grid.innerHTML = renderCommandCards(filtered);
    attachCommandCardEvents();
}

function attachCommandCardEvents() {
    document.querySelectorAll('.copy-command').forEach(btn => {
        btn.addEventListener('click', () => copyCommand(btn, btn.dataset.command));
    });

    document.querySelectorAll('.edit-command').forEach(btn => {
        btn.addEventListener('click', () => {
            const cmd = state.commands.find(c => c.id == btn.dataset.id);
            if (cmd) openCommandModal(cmd);
        });
    });

    document.querySelectorAll('.delete-command').forEach(btn => {
        btn.addEventListener('click', () => confirmDeleteCommand(btn.dataset.id));
    });
}

// ============================================
// Categories View (Standalone)
// ============================================
async function renderCategoriesView() {
    setPageTitle('Categories', 'Manage command categories');

    const body = document.getElementById('contentBody');
    body.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i><span>Loading categories...</span></div>';

    try {
        const categories = await api('GET', 'categories?module_id=1');
        state.categories = categories;

        body.innerHTML = `
            <div class="toolbar">
                <div class="toolbar-search-row">
                    <div class="search-input-wrap">
                        <i class="fas fa-search"></i>
                        <input type="text" id="categorySearch" placeholder="Search categories..." autocomplete="off">
                    </div>
                    <button class="btn btn-primary" id="addCategoryBtn">
                        <i class="fas fa-plus"></i> Add Category
                    </button>
                </div>
            </div>

            <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
                <h2 style="font-size:1.1rem;font-weight:600;">
                    <i class="fas fa-tags"></i> ${categories.length} categor${categories.length === 1 ? 'y' : 'ies'}
                </h2>
            </div>

            <div class="categories-grid" id="categoriesGrid">
                ${categories.length
                    ? categories.map(c => `
                        <div class="category-card" data-id="${c.id}">
                            <div class="category-card-head" style="background:${c.color}">
                                <i class="fas fa-folder"></i>
                            </div>
                            <div class="category-card-body">
                                <h3>${escHtml(c.name)}</h3>
                                <p class="category-card-count">${c.command_count || 0} command${c.command_count === 1 ? '' : 's'}</p>
                            </div>
                            <div class="category-card-actions">
                                <button class="btn btn-secondary btn-sm edit-category-btn" data-id="${c.id}">
                                    <i class="fas fa-pen"></i> Edit
                                </button>
                                <button class="btn btn-secondary btn-sm delete-category-btn" data-id="${c.id}">
                                    <i class="fas fa-trash"></i> Delete
                                </button>
                            </div>
                        </div>
                    `).join('')
                    : `<div class="empty-state" style="grid-column:1/-1"><i class="fas fa-tags"></i><h3>No categories</h3><p>Create your first category to organize commands.</p></div>`
                }
            </div>
        `;

        document.getElementById('addCategoryBtn').addEventListener('click', () => {
            openCategoryModal();
        });

        let catSearchTimeout = null;
        const catSearch = document.getElementById('categorySearch');
        if (catSearch) {
            catSearch.addEventListener('input', () => {
                clearTimeout(catSearchTimeout);
                catSearchTimeout = setTimeout(() => {
                    const q = catSearch.value.trim().toLowerCase();
                    document.querySelectorAll('.category-card').forEach(card => {
                        const name = card.querySelector('h3').textContent.toLowerCase();
                        card.style.display = name.includes(q) ? '' : 'none';
                    });
                }, 200);
            });
        }

        document.querySelectorAll('.edit-category-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const cat = state.categories.find(c => c.id == btn.dataset.id);
                if (cat) openCategoryModal(cat);
            });
        });

        document.querySelectorAll('.delete-category-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                confirmDeleteCategory(btn.dataset.id);
            });
        });
    } catch (err) {
        body.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><h3>Failed to load</h3><p>${err.message}</p></div>`;
    }
}

// ============================================
// Command Modal
// ============================================
function openCommandModal(cmd = null) {
    const modalTitle = document.getElementById('commandModalTitle');
    const submitBtn = document.getElementById('commandSubmitBtn');
    const form = document.getElementById('commandForm');
    form.reset();
    document.getElementById('commandId').value = '';

    // Populate category select
    const catSelect = document.getElementById('commandCategory');
    catSelect.innerHTML = '<option value="">No category</option>';
    state.categories.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.name;
        if (cmd && cmd.category_id && cmd.category_id == c.id) {
            opt.selected = true;
        }
        catSelect.appendChild(opt);
    });

    if (cmd) {
        modalTitle.textContent = 'Edit Command';
        submitBtn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
        document.getElementById('commandId').value = cmd.id;
        document.getElementById('commandTitle').value = cmd.title;
        document.getElementById('commandContent').value = cmd.command;
        document.getElementById('commandDescription').value = cmd.description || '';
    } else {
        modalTitle.textContent = 'Add Command';
        submitBtn.innerHTML = '<i class="fas fa-plus"></i> Add Command';
    }

    openModal('commandModal');
}

function submitCommandForm(e) {
    e.preventDefault();
    const id = document.getElementById('commandId').value;
    const data = {
        title: document.getElementById('commandTitle').value.trim(),
        category_id: document.getElementById('commandCategory').value || null,
        command: document.getElementById('commandContent').value.trim(),
        description: document.getElementById('commandDescription').value.trim() || null,
    };

    const method = id ? 'PUT' : 'POST';
    const path = id ? `commands/${id}` : 'commands';
    const action = id ? 'updated' : 'created';

    api(method, path, data)
        .then(() => {
            closeModal('commandModal');
            toast(`Command ${action} successfully!`, 'success');
            renderCommands();
        })
        .catch(err => {
            toast(err.message, 'error');
        });
}

// ============================================
// Delete Command
// ============================================
async function confirmDeleteCommand(id) {
    const confirmed = await showConfirmModal('Are you sure you want to delete this command?');
    if (!confirmed) return;

    api('DELETE', `commands/${id}`)
        .then(() => {
            toast('Command deleted', 'success');
            renderCommands();
        })
        .catch(err => toast(err.message, 'error'));
}

// ============================================
// Copy Command
// ============================================
function copyCommand(btn, command) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(command).then(() => {
            showCopiedFeedback(btn);
        }).catch(() => {
            fallbackCopy(command, btn);
        });
    } else {
        fallbackCopy(command, btn);
    }
}

function fallbackCopy(text, btn) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
        document.execCommand('copy');
        showCopiedFeedback(btn);
    } catch (_) {
        toast('Failed to copy', 'error');
    }
    document.body.removeChild(ta);
}

function showCopiedFeedback(btn) {
    const orig = btn.innerHTML;
    btn.classList.add('copied');
    btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
    setTimeout(() => {
        btn.classList.remove('copied');
        btn.innerHTML = orig;
    }, 1800);
}

// ============================================
// Email Anonymizer
// ============================================
function anonymizeEmail(email) {
    const atIndex = email.indexOf('@');
    if (atIndex === -1) return email;

    const local = email.slice(0, atIndex);
    const domain = email.slice(atIndex + 1);

    const dotIndex = domain.lastIndexOf('.');
    if (dotIndex === -1) return email;

    const domainName = domain.slice(0, dotIndex);
    const tld = domain.slice(dotIndex);

    const maskedLocal = local.charAt(0) + '*'.repeat(local.length - 1);
    const maskedDomain = domainName.charAt(0) + '*'.repeat(domainName.length - 1);

    return maskedLocal + '@' + maskedDomain + tld;
}

function renderEmailAnonymizer() {
    setPageTitle('Email Anonymizer', 'Mask email addresses for privacy');

    const body = document.getElementById('contentBody');
    body.innerHTML = `
        <div class="anon-wrap">
            <div class="anon-card">
                <div class="anon-card-header">
                    <i class="fas fa-mask"></i>
                    <h2>Email Anonymizer</h2>
                </div>
                <p class="anon-desc">
                    Type or paste email addresses below — the anonymized result appears instantly.
                    The first character and TLD are preserved; the rest is replaced with <code>*</code>.
                </p>

                <div class="anon-input-area">
                    <div class="anon-input-header">
                        <label>Email addresses</label>
                        <button class="btn btn-sm btn-secondary" id="anonClearBtn">
                            <i class="fas fa-eraser"></i> Clear
                        </button>
                    </div>
                    <textarea id="anonInput" rows="4" placeholder="john.doe@example.com&#10;jane@test.org&#10;support@company.co.uk" class="font-mono"></textarea>
                </div>

                <div class="anon-result-area">
                    <div class="anon-input-header">
                        <label>Anonymized</label>
                        <button class="btn btn-sm btn-secondary" id="anonCopyBtn">
                            <i class="fas fa-copy"></i> Copy
                        </button>
                    </div>
                    <div id="anonOutput" class="anon-output font-mono" tabindex="0" role="textbox" aria-label="Anonymized result">
                        <span class="anon-placeholder">Waiting for input...</span>
                    </div>
                </div>
            </div>
        </div>
    `;

    const input = document.getElementById('anonInput');
    const output = document.getElementById('anonOutput');

    function update() {
        const lines = input.value.split('\n');
        const results = lines.map(line => {
            const trimmed = line.trim();
            if (trimmed === '' || !trimmed.includes('@')) return trimmed;
            return anonymizeEmail(trimmed);
        });
        const joined = results.join('\n');
        if (joined.trim() === '') {
            output.innerHTML = '<span class="anon-placeholder">Waiting for input...</span>';
        } else {
            output.textContent = joined;
        }
    }

    input.addEventListener('input', update);
    update();

    document.getElementById('anonCopyBtn').addEventListener('click', () => {
        const text = output.textContent;
        if (!text || text === 'Waiting for input...') {
            toast('Nothing to copy', 'warning');
            return;
        }
        navigator.clipboard.writeText(text).then(() => {
            toast('Copied!', 'success');
        }).catch(() => {
            const range = document.createRange();
            range.selectNodeContents(output);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
            document.execCommand('copy');
            sel.removeAllRanges();
            toast('Copied!', 'success');
        });
    });

    output.addEventListener('click', () => {
        const text = output.textContent;
        if (!text || text === 'Waiting for input...') return;
        navigator.clipboard.writeText(text).then(() => {
            toast('Copied!', 'success');
        });
    });

    document.getElementById('anonClearBtn').addEventListener('click', () => {
        input.value = '';
        output.innerHTML = '<span class="anon-placeholder">Waiting for input...</span>';
        input.focus();
    });
}

// ============================================
// Email Header Visualizer
// ============================================
function renderEmailHeaderViz() {
    setPageTitle('Header Visualizer', 'Parse and analyze email headers');

    const body = document.getElementById('contentBody');
    body.innerHTML = `
        <div class="hdr-wrap">
            <div class="hdr-card">
                <div class="hdr-card-header">
                    <i class="fas fa-code-branch"></i>
                    <h2>Email Header Visualizer</h2>
                </div>
                <p class="hdr-desc">
                    Paste raw email headers below to visualize and analyze delivery paths,
                    authentication results, and potential issues.
                </p>

                <div class="hdr-input-area">
                    <div class="hdr-input-header">
                        <label>Raw Headers</label>
                        <div class="hdr-input-actions">
                            <button class="btn btn-sm btn-secondary" id="hdrClearBtn">
                                <i class="fas fa-eraser"></i> Clear
                            </button>
                            <button class="btn btn-sm btn-secondary" id="hdrSampleBtn">
                                <i class="fas fa-file-lines"></i> Sample
                            </button>
                        </div>
                    </div>
                    <textarea id="hdrInput" rows="8" placeholder="Paste email headers here..." class="font-mono" spellcheck="false"></textarea>
                </div>

                <div id="hdrOutput" class="hdr-output"></div>
            </div>
        </div>
    `;

    const input = document.getElementById('hdrInput');
    const output = document.getElementById('hdrOutput');

    function parseHeaders(raw) {
        const lines = raw.split('\n');
        const headers = [];
        let currentKey = null;
        let currentValue = '';

        for (let line of lines) {
            if (/^\s+/.test(line) && currentKey) {
                currentValue += ' ' + line.trim();
            } else if (line.includes(':')) {
                if (currentKey) {
                    headers.push({ key: currentKey, value: currentValue });
                }
                const idx = line.indexOf(':');
                currentKey = line.slice(0, idx).trim();
                currentValue = line.slice(idx + 1).trim();
            }
        }
        if (currentKey) {
            headers.push({ key: currentKey, value: currentValue });
        }
        return headers;
    }

    function classifyHeader(key) {
        const k = key.toLowerCase();
        if (k === 'from' || k === 'to' || k === 'subject' || k === 'date' || k === 'message-id' || k === 'reply-to') return 'overview';
        if (k === 'received-spf' || k === 'authentication-results' || k === 'dkim-signature' || k === 'dmarc-result') return 'auth';
        if (k === 'received') return 'routing';
        if (k === 'return-path' || k === 'x-spam-status' || k === 'x-spam-score' || k === 'x-spam-flag' || k === 'x-spam-report') return 'alert';
        return 'other';
    }

    function getHeaderStatus(key, value) {
        const k = key.toLowerCase();
        const v = value.toLowerCase();

        if (k === 'received-spf') {
            if (v.includes('pass')) return 'pass';
            if (v.includes('fail') || v.includes('softfail')) return 'fail';
            if (v.includes('neutral') || v.includes('none')) return 'warn';
        }
        if (k === 'authentication-results') {
            if (v.includes('dkim=pass') || v.includes('spf=pass') || v.includes('dmarc=pass')) return 'pass';
            if (v.includes('dkim=fail') || v.includes('spf=fail') || v.includes('dmarc=fail')) return 'fail';
            if (v.includes('dkim=neutral') || v.includes('spf=neutral') || v.includes('dmarc=neutral')) return 'warn';
        }
        if (k === 'x-spam-flag' || k === 'x-spam-status') {
            if (v.includes('yes') || v.includes('spam')) return 'fail';
        }
        if (k === 'x-spam-score') {
            const num = parseFloat(value);
            if (num > 5) return 'fail';
            if (num > 2) return 'warn';
        }
        return null;
    }

    function getStatusIcon(status) {
        if (status === 'pass') return '<i class="fas fa-check-circle"></i>';
        if (status === 'fail') return '<i class="fas fa-times-circle"></i>';
        if (status === 'warn') return '<i class="fas fa-exclamation-triangle"></i>';
        return '';
    }

    function render() {
        const raw = input.value.trim();
        if (!raw) {
            output.innerHTML = '<div class="hdr-empty">Paste email headers above to see analysis.</div>';
            return;
        }

        const headers = parseHeaders(raw);
        if (!headers.length) {
            output.innerHTML = '<div class="hdr-empty">No valid headers found. Make sure each line follows <code>Header: value</code> format.</div>';
            return;
        }

        const overview = [];
        const routing = [];
        const auth = [];
        const alerts = [];
        const other = [];

        headers.forEach(h => {
            const cls = classifyHeader(h.key);
            const status = getHeaderStatus(h.key, h.value);
            if (cls === 'overview') overview.push(h);
            else if (cls === 'routing') routing.push(h);
            else if (cls === 'auth') auth.push(h);
            else if (cls === 'alert') alerts.push(h);
            else other.push(h);
        });

        let html = '';

        // Overview
        if (overview.length) {
            html += `
                <div class="hdr-section">
                    <div class="hdr-section-title"><i class="fas fa-envelope"></i> Overview</div>
                    <div class="hdr-table">
                        ${overview.map(h => `
                            <div class="hdr-row">
                                <span class="hdr-key">${escHtml(h.key)}</span>
                                <span class="hdr-val">${escHtml(h.value)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>`;
        }

        // Authentication
        if (auth.length) {
            html += `
                <div class="hdr-section">
                    <div class="hdr-section-title"><i class="fas fa-shield-halved"></i> Authentication</div>
                    <div class="hdr-table">
                        ${auth.map(h => {
                            const status = getHeaderStatus(h.key, h.value);
                            const icon = getStatusIcon(status);
                            const statusClass = status ? `hdr-status-${status}` : '';
                            return `
                                <div class="hdr-row ${statusClass}">
                                    <span class="hdr-key">${escHtml(h.key)}</span>
                                    <span class="hdr-val">${icon} ${escHtml(h.value)}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>`;
        }

        // Alerts / Spam
        if (alerts.length) {
            html += `
                <div class="hdr-section">
                    <div class="hdr-section-title"><i class="fas fa-bell"></i> Flags &amp; Alerts</div>
                    <div class="hdr-table">
                        ${alerts.map(h => {
                            const status = getHeaderStatus(h.key, h.value);
                            const icon = getStatusIcon(status);
                            const statusClass = status ? `hdr-status-${status}` : 'hdr-status-warn';
                            return `
                                <div class="hdr-row ${statusClass}">
                                    <span class="hdr-key">${escHtml(h.key)}</span>
                                    <span class="hdr-val">${icon} ${escHtml(h.value)}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>`;
        }

        // Routing (Received)
        if (routing.length) {
            html += `
                <div class="hdr-section">
                    <div class="hdr-section-title"><i class="fas fa-route"></i> Delivery Path</div>
                    <div class="hdr-timeline">
                        ${routing.map((h, i) => {
                            const isFirst = i === 0;
                            const isLast = i === routing.length - 1;
                            let label = 'Intermediate hop';
                            if (isFirst) label = 'Final delivery';
                            if (isLast) label = 'Originating';
                            return `
                                <div class="hdr-timeline-item ${isFirst ? 'hdr-hop-last' : isLast ? 'hdr-hop-first' : ''}">
                                    <div class="hdr-timeline-dot"></div>
                                    <div class="hdr-timeline-body">
                                        <div class="hdr-timeline-label">${label}</div>
                                        <div class="hdr-timeline-content">${escHtml(h.value)}</div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>`;
        }

        // Other headers
        if (other.length) {
            html += `
                <div class="hdr-section">
                    <div class="hdr-section-title"><i class="fas fa-list"></i> Other Headers</div>
                    <div class="hdr-table">
                        ${other.map(h => `
                            <div class="hdr-row">
                                <span class="hdr-key">${escHtml(h.key)}</span>
                                <span class="hdr-val hdr-val-mono">${escHtml(h.value)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>`;
        }

        // Summary bar
        const passCount = [...auth, ...alerts].filter(h => getHeaderStatus(h.key, h.value) === 'pass').length;
        const failCount = [...auth, ...alerts].filter(h => getHeaderStatus(h.key, h.value) === 'fail').length;
        const warnCount = [...auth, ...alerts].filter(h => getHeaderStatus(h.key, h.value) === 'warn').length;

        html = `
            <div class="hdr-summary">
                <span class="hdr-summary-item hdr-summary-ok"><i class="fas fa-check-circle"></i> ${passCount} passed</span>
                <span class="hdr-summary-item hdr-summary-warn"><i class="fas fa-exclamation-triangle"></i> ${warnCount} warnings</span>
                <span class="hdr-summary-item hdr-summary-err"><i class="fas fa-times-circle"></i> ${failCount} failures</span>
                <span class="hdr-summary-item hdr-summary-total"><i class="fas fa-hashtag"></i> ${headers.length} headers</span>
            </div>
        ` + html;

        output.innerHTML = html;
    }

    input.addEventListener('input', render);

    document.getElementById('hdrClearBtn').addEventListener('click', () => {
        input.value = '';
        render();
        input.focus();
    });

    document.getElementById('hdrSampleBtn').addEventListener('click', () => {
        input.value = `Return-Path: <bounce@example.com>
Received: from mail-smtp-1.example.com (mail-smtp-1.example.com [203.0.113.5])
 by mx.example.org (Postfix) with ESMTPS id ABC123
 for <user@example.org>; Tue, 15 Jul 2025 10:30:45 +0000 (UTC)
Received: from smtp.internal.example.com (smtp.internal.example.com [10.0.0.45])
 by mail-smtp-1.example.com (Postfix) with ESMTP id XYZ789
 for <user@example.org>; Tue, 15 Jul 2025 10:30:44 +0000 (UTC)
DKIM-Signature: v=1; a=rsa-sha256; c=relaxed/relaxed; d=example.com;
 s=selector2025; t=1756789045;
 bh=abc123def456ghi789jkl==; h=From:To:Subject:Date;
 b=signaturedatahere
From: "John Doe" <john@example.com>
To: user@example.org
Subject: Important meeting tomorrow
Date: Tue, 15 Jul 2025 10:30:30 +0000
Message-ID: <msgid12345@example.com>
MIME-Version: 1.0
Content-Type: text/plain; charset="UTF-8"
Received-SPF: pass (example.com: domain of john@example.com designates 203.0.113.5 as permitted sender)
Authentication-Results: mx.example.org;
 dkim=pass (1024-bit key) header.d=example.com header.i=@example.com header.b=signaturedata;
 spf=pass (mx.example.org: domain of example.com designates 203.0.113.5 as permitted sender) smtp.mailfrom=example.com;
 dmarc=pass (p=REJECT) header.from=example.com
X-Spam-Score: 1.2
X-Spam-Status: No`;
        render();
    });

    render();
}

// ============================================
// IP Reputation Checker
// ============================================
function renderIpReputation() {
    setPageTitle('IP Reputation', 'Analyze IP addresses for security and reputation');

    const body = document.getElementById('contentBody');
    const searchHistory = JSON.parse(localStorage.getItem('ip-history') || '[]');

    body.innerHTML = `
        <div class="ipr-wrap">
            <div class="ipr-card">
                <div class="ipr-card-top">
                    <div class="ipr-card-badge">
                        <i class="fas fa-shield-halved"></i>
                        <span>Network Security Tool</span>
                    </div>
                    <button class="btn btn-icon btn-icon-danger" id="iprClearBtn" title="Clear">
                        <i class="fas fa-eraser"></i>
                    </button>
                </div>
                <h2 class="ipr-card-title">IP Reputation Checker</h2>
                <p class="ipr-desc">Check any IPv4 or IPv6 address against multiple security sources to determine its reputation, abuse history, and risk level.</p>

                <div class="ipr-search-section">
                    <div class="ipr-search-box">
                        <i class="fas fa-search ipr-search-icon"></i>
                        <input type="text" id="iprInput" placeholder="Enter an IP address..." class="ipr-search-input" autocomplete="off" spellcheck="false">
                        <button class="ipr-search-btn" id="iprAnalyzeBtn">
                            <i class="fas fa-shield-halved"></i>
                            Analyze
                        </button>
                    </div>
                </div>

                ${searchHistory.length > 0 ? `
                <div class="ipr-history">
                    <div class="ipr-history-header">
                        <i class="fas fa-clock-rotate"></i>
                        <span>Recent Checks</span>
                        <button class="ipr-history-clear" id="iprHistoryClear" title="Clear history">&times;</button>
                    </div>
                    <div class="ipr-history-items" id="iprHistoryItems">
                        ${searchHistory.slice(0, 10).map(entry => `
                            <span class="ipr-history-chip" data-ip="${entry.ip}">
                                <span class="ipr-history-dot" style="background:${entry.reputation === 'malicious' ? 'var(--danger)' : entry.reputation === 'suspicious' ? 'var(--warning)' : 'var(--success)'}"></span>
                                ${entry.ip}
                            </span>
                        `).join('')}
                    </div>
                </div>
                ` : ''}

                <div id="iprResult">
                    <div class="ipr-empty">
                        <i class="fas fa-shield-halved"></i>
                        <h3>Ready to analyze</h3>
                        <p>Enter an IP address above to check its reputation.</p>
                    </div>
                </div>
            </div>
        </div>
    `;

    const input = document.getElementById('iprInput');
    const resultDiv = document.getElementById('iprResult');
    const analyzeBtn = document.getElementById('iprAnalyzeBtn');
    const clearBtn = document.getElementById('iprClearBtn');

    async function analyze(ip) {
        ip = ip.trim();
        if (!ip) { toast('Please enter an IP address.', 'warning'); return; }
        if (!/^[0-9a-fA-F:.]+$/.test(ip) || !(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip) || /^[0-9a-fA-F:]+$/.test(ip))) {
            toast('Invalid IP address format.', 'error');
            return;
        }

        resultDiv.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i><span>Analyzing IP...</span></div>';
        analyzeBtn.disabled = true;
        analyzeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analyzing...';

        try {
            const data = await api('GET', `ip-reputation?ip=${encodeURIComponent(ip)}`);
            resultDiv.innerHTML = renderIpResult(data);

            const history = JSON.parse(localStorage.getItem('ip-history') || '[]');
            history.unshift({ ip: data.ip, reputation: data.summary.reputation, time: new Date().toISOString() });
            if (history.length > 50) history.length = 50;
            localStorage.setItem('ip-history', JSON.stringify(history));

            attachIpResultEvents(data);
        } catch (err) {
            resultDiv.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><h3>Analysis Failed</h3><p>${escHtml(err.message)}</p></div>`;
        } finally {
            analyzeBtn.disabled = false;
            analyzeBtn.innerHTML = '<i class="fas fa-shield-halved"></i> Analyze';
        }
    }

    function renderIpResult(data) {
        const s = data.summary;
        const level = s.reputation === 'malicious' ? 'high' : s.reputation === 'suspicious' ? 'med' : 'low';
        const barColor = level === 'high' ? 'var(--danger)' : level === 'med' ? 'var(--warning)' : 'var(--success)';
        const barBg = level === 'high' ? 'var(--danger-bg)' : level === 'med' ? 'rgba(245,158,11,0.12)' : 'var(--success-bg)';
        const riskIcon = s.reputation === 'malicious' ? 'fa-circle-exclamation' : s.reputation === 'suspicious' ? 'fa-triangle-exclamation' : 'fa-circle-check';

        return `
            <div class="ipr-result">
                <div class="ipr-banner" style="background:${barBg};border-color:${barColor}">
                    <div class="ipr-banner-left">
                        <div class="ipr-banner-icon" style="background:${barColor};color:#fff">
                            <i class="fas ${riskIcon}"></i>
                        </div>
                        <div class="ipr-banner-info">
                            <div class="ipr-banner-ip">
                                <span class="font-mono">${data.ip}</span>
                                <button class="ipr-banner-copy" id="iprCopyBtn" title="Copy IP">
                                    <i class="fas fa-copy"></i>
                                </button>
                            </div>
                            <div class="ipr-banner-tags">
                                <span class="ipr-banner-tag" style="background:${barColor}20;color:${barColor}">
                                    <i class="fas ${riskIcon}"></i> ${s.reputation}
                                </span>
                                <span class="ipr-banner-tag" style="background:var(--info-bg);color:var(--info)">
                                    <i class="fas fa-flag"></i> ${s.country_code || s.country}
                                </span>
                                <span class="ipr-banner-tag" style="background:var(--accent-light);color:var(--accent)">
                                    <i class="fas fa-sitemap"></i> ${escHtml(s.asn)}
                                </span>
                                <span class="ipr-banner-tag" style="background:var(--success-bg);color:var(--success)">
                                    <i class="fas fa-building"></i> ${escHtml(s.provider_type)}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div class="ipr-banner-score">
                        <div class="ipr-banner-score-value" style="color:${barColor}">${s.risk_score}</div>
                        <div class="ipr-banner-score-label">/ 100 risk</div>
                        <div class="ipr-banner-score-track">
                            <div class="ipr-banner-score-fill" style="width:${s.risk_score}%;background:${barColor}"></div>
                        </div>
                    </div>
                </div>

                <div class="ipr-stats-row">
                    <div class="ipr-stat-card" style="background:${barBg}">
                        <span class="ipr-stat-card-value" style="color:${barColor}">${s.risk_score}</span>
                        <span class="ipr-stat-card-label">Risk Score</span>
                    </div>
                    <div class="ipr-stat-card" style="background:var(--info-bg)">
                        <span class="ipr-stat-card-value" style="color:var(--info)">${escHtml(s.country_code || s.country)}</span>
                        <span class="ipr-stat-card-label">Country</span>
                    </div>
                    <div class="ipr-stat-card" style="background:var(--accent-light)">
                        <span class="ipr-stat-card-value" style="color:var(--accent);font-size:0.85rem">${escHtml(s.asn)}</span>
                        <span class="ipr-stat-card-label">${escHtml(s.asname)}</span>
                    </div>
                    <div class="ipr-stat-card" style="background:var(--success-bg)">
                        <span class="ipr-stat-card-value" style="color:var(--success);font-size:0.85rem">${escHtml(s.org)}</span>
                        <span class="ipr-stat-card-label">${s.city ? escHtml(s.city) : 'Organization'}</span>
                    </div>
                </div>

                <div class="ipr-toolbar">
                    <button class="btn btn-sm btn-secondary" id="iprExportJson"><i class="fas fa-download"></i> Export JSON</button>
                    <button class="btn btn-sm btn-secondary" id="iprExportPdf"><i class="fas fa-file-pdf"></i> Export PDF</button>
                </div>

                <div class="ipr-sections">
                    ${renderSection('AbuseIPDB', getLevel(data.abuseipdb?.confidence_score), renderAbuseIpDbBody(data.abuseipdb))}
                    ${renderSection('Spamhaus', data.spamhaus?.listed ? 'high' : 'low', renderSpamhausBody(data.spamhaus))}
                    ${renderSection('VirusTotal', getLevel(data.virustotal?.malicious), renderVirusTotalBody(data.virustotal))}
                    ${renderSection('TOR Exit Node', data.tor?.is_tor ? 'high' : 'low', renderTorBody(data.tor))}
                    ${renderSection('Proxy / VPN', getProxyLevel(data.proxy_vpn), renderProxyVpnBody(data.proxy_vpn))}
                    ${renderSection('ASN Information', 'low', renderAsnBody(data.asn))}
                </div>

                <div class="ipr-quick-actions">
                    <div class="ipr-qa-title"><i class="fas fa-bolt"></i> Quick Actions</div>
                    <div class="ipr-qa-grid">
                        <a href="https://whois.domaintools.com/${data.ip}" target="_blank" rel="noopener" class="ipr-qa-btn">
                            <i class="fas fa-circle-info"></i> Whois Lookup
                        </a>
                        <a href="https://dns.google/resolve?name=${data.ip}" target="_blank" rel="noopener" class="ipr-qa-btn">
                            <i class="fas fa-arrows-spin"></i> Reverse DNS
                        </a>
                        <a href="https://www.ip2location.com/demo/${data.ip}" target="_blank" rel="noopener" class="ipr-qa-btn">
                            <i class="fas fa-location-dot"></i> GeoIP Lookup
                        </a>
                        <a href="https://www.abuseipdb.com/check/${data.ip}" target="_blank" rel="noopener" class="ipr-qa-btn">
                            <i class="fas fa-flag"></i> Abuse Report
                        </a>
                    </div>
                </div>
            </div>
        `;
    }

    function getLevel(val) {
        if (val == null) return 'warn';
        if (val >= 80) return 'high';
        if (val >= 30) return 'med';
        if (val > 0) return 'med';
        return 'low';
    }

    function getProxyLevel(pv) {
        if (!pv) return 'warn';
        if (pv.is_tor || pv.is_proxy || pv.is_vpn) return 'high';
        if (pv.is_hosting) return 'med';
        return 'low';
    }

    function badge(text, level) {
        const lvl = level === 'high' ? 'high' : level === 'med' ? 'med' : 'low';
        return `<span class="ipr-badge ipr-badge-${lvl}">${escHtml(text)}</span>`;
    }

    function hr(cls, label, value) {
        return `<div class="hdr-row ${cls}"><span class="hdr-key">${label}</span><span class="hdr-val">${value}</span></div>`;
    }

    function renderSection(title, level, body) {
        const lvl = level === 'high' ? 'high' : level === 'med' ? 'med' : 'low';
        const icon = lvl === 'high' ? 'fa-circle-exclamation' : lvl === 'med' ? 'fa-triangle-exclamation' : 'fa-circle-check';
        if (body.startsWith('{error}')) {
            return `<div class="hdr-section"><div class="hdr-section-title"><i class="fas fa-triangle-exclamation"></i> ${title}</div><div class="hdr-table"><div class="hdr-row"><span class="hdr-key">Status</span><span class="hdr-val" style="color:var(--text-muted)">${escHtml(body.replace('{error}',''))}</span></div></div></div>`;
        }
        if (body.startsWith('{disabled}')) {
            return `<div class="hdr-section"><div class="hdr-section-title"><i class="fas fa-key"></i> ${title}</div><div class="hdr-table"><div class="hdr-row"><span class="hdr-key">Status</span><span class="hdr-val" style="color:var(--warning)">${escHtml(body.replace('{disabled}',''))}</span></div></div></div>`;
        }
        return `
            <div class="hdr-section">
                <div class="hdr-section-title"><i class="fas ${icon}"></i> ${title}</div>
                <div class="hdr-table">${body}</div>
            </div>
        `;
    }

    function renderAbuseIpDbBody(abuse) {
        if (!abuse) return '{error}No data available.';
        if (!abuse.enabled) return '{disabled}API key not configured. Add ABUSEIPDB_KEY to config.php.';
        if (abuse.error) return '{error}' + abuse.error;
        const lvl = abuse.confidence_score >= 80 ? 'high' : abuse.confidence_score >= 30 ? 'med' : 'low';
        const cls = lvl === 'high' ? 'hdr-status-fail' : lvl === 'med' ? 'hdr-status-warn' : 'hdr-status-pass';
        let h = hr(cls, 'Confidence Score', badge(abuse.confidence_score + '%', lvl));
        h += hr('', 'Total Reports', String(abuse.total_reports));
        h += hr('', 'Last Reported', abuse.last_reported_at ? new Date(abuse.last_reported_at).toLocaleString() : 'Never');
        h += hr(cls, 'Status', badge(abuse.reputation_status, lvl));
        if (abuse.is_whitelisted) h += hr('hdr-status-pass', 'Whitelisted', '<i class="fas fa-check-circle" style="color:var(--success)"></i> Yes');
        return h;
    }

    function renderSpamhausBody(bl) {
        if (!bl) return '{error}Check failed.';
        if (bl.note) return '{error}' + bl.note;
        if (!bl.listed) {
            return hr('hdr-status-pass', 'Listed', '<span style="color:var(--success)"><i class="fas fa-check-circle"></i> <strong>Not Listed</strong></span>');
        }
        let h = hr('hdr-status-fail', 'Listed', '<span style="color:var(--danger)"><i class="fas fa-times-circle"></i> <strong>BLACKLISTED</strong></span>');
        if (bl.lists) bl.lists.forEach(l => { h += hr('', l.list, escHtml(l.description)); });
        return h;
    }

    function renderVirusTotalBody(vt) {
        if (!vt) return '{error}No data available.';
        if (!vt.enabled) return '{disabled}API key not configured. Add VIRUSTOTAL_KEY to config.php.';
        if (vt.error) return '{error}' + vt.error;
        const lvl = vt.malicious > 0 ? 'high' : vt.suspicious > 0 ? 'med' : 'low';
        const cls = lvl === 'high' ? 'hdr-status-fail' : lvl === 'med' ? 'hdr-status-warn' : 'hdr-status-pass';
        let h = hr('', 'Reputation Score', String(vt.reputation_score));
        h += hr(cls, 'Detection Ratio', badge(vt.detection_ratio, lvl));
        h += hr('', 'Malicious', `<span style="color:${vt.malicious > 0 ? 'var(--danger)' : 'var(--text-muted)'};font-weight:700">${vt.malicious}</span> / ${vt.total_engines} engines`);
        h += hr('', 'Suspicious', `<span style="color:${vt.suspicious > 0 ? 'var(--warning)' : 'var(--text-muted)'};font-weight:700">${vt.suspicious}</span>`);
        h += hr('', 'Harmless', `<span style="color:var(--success);font-weight:700">${vt.harmless}</span>`);
        if (vt.tags && vt.tags.length) {
            h += hr('', 'Tags', vt.tags.map(t => `<span class="ipr-tag">${escHtml(t)}</span>`).join(' '));
        }
        return h;
    }

    function renderTorBody(tor) {
        if (!tor) return '{error}Check failed.';
        const isTor = tor.is_tor;
        const cls = isTor ? 'hdr-status-fail' : 'hdr-status-pass';
        const val = isTor
            ? '<span style="color:var(--danger)"><i class="fas fa-times-circle"></i> <strong>Yes — TOR Exit Node</strong></span>'
            : '<span style="color:var(--success)"><i class="fas fa-check-circle"></i> <strong>No</strong></span>';
        let h = hr(cls, 'TOR Exit Node', val);
        h += hr('', 'Data Source', escHtml(tor.source || 'dan.me.uk'));
        return h;
    }

    function renderProxyVpnBody(pv) {
        if (!pv) return '{error}No data.';
        const indicators = [];
        if (pv.is_tor) indicators.push({ label: 'TOR Exit Node', level: 'high' });
        if (pv.is_proxy) indicators.push({ label: 'Proxy', level: 'high' });
        if (pv.is_vpn) indicators.push({ label: 'VPN', level: 'high' });
        if (pv.is_hosting) indicators.push({ label: 'Hosting', level: 'med' });
        if (pv.is_mobile) indicators.push({ label: 'Mobile', level: 'low' });
        if (!indicators.length) indicators.push({ label: 'Residential ISP', level: 'low' });
        const badges = indicators.map(i => badge(i.label, i.level)).join(' ');
        const anyHigh = indicators.some(i => i.level === 'high');
        const cls = anyHigh ? 'hdr-status-fail' : indicators.some(i => i.level === 'med') ? 'hdr-status-warn' : 'hdr-status-pass';
        let h = hr(cls, 'Connection Type', badges);
        h += hr('', 'Provider', escHtml(pv.provider));
        h += hr('', 'Confidence', badge(pv.confidence, pv.confidence === 'high' ? 'high' : 'med'));
        return h;
    }

    function renderAsnBody(asn) {
        if (!asn || asn.error) return '{error}Could not resolve ASN information.';
        let h = hr('', 'ASN', `<span class="font-mono" style="font-weight:700">${escHtml(asn.asn)}</span>`);
        h += hr('', 'Organization', escHtml(asn.org));
        h += hr('', 'ISP', escHtml(asn.isp));
        h += hr('', 'Country', escHtml(asn.country));
        h += hr('', 'City', escHtml(asn.city));
        h += hr('', 'Provider Type', escHtml(asn.provider_type || 'N/A'));
        if (asn.lat && asn.lon) h += hr('', 'Coordinates', escHtml(asn.lat + ', ' + asn.lon));
        return h;
    }

    function attachIpResultEvents(data) {
        document.getElementById('iprCopyBtn')?.addEventListener('click', () => {
            navigator.clipboard.writeText(data.ip).then(() => {
                toast('IP copied to clipboard!', 'success');
            }).catch(() => toast('Failed to copy.', 'error'));
        });

        document.getElementById('iprExportJson')?.addEventListener('click', () => {
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'ip-reputation-' + data.ip + '.json';
            a.click();
            URL.revokeObjectURL(url);
            toast('JSON exported!', 'success');
        });

        document.getElementById('iprExportPdf')?.addEventListener('click', () => {
            window.print();
        });
    }

    analyzeBtn.addEventListener('click', () => analyze(input.value));
    input.addEventListener('keydown', e => { if (e.key === 'Enter') analyze(input.value); });
    clearBtn.addEventListener('click', () => { input.value = ''; resultDiv.innerHTML = ''; input.focus(); });

    document.querySelectorAll('.ipr-history-chip').forEach(chip => {
        chip.addEventListener('click', () => { input.value = chip.dataset.ip; analyze(input.value); });
    });
    document.getElementById('iprHistoryClear')?.addEventListener('click', () => {
        localStorage.removeItem('ip-history');
        document.querySelector('.ipr-history')?.remove();
        toast('History cleared.', 'info');
    });
}

// ============================================
// User Management (Admin only)
// ============================================
async function renderUserManagement() {
    setPageTitle('Manage Users', 'Create and manage user accounts');

    const body = document.getElementById('contentBody');
    body.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i><span>Loading users...</span></div>';

    try {
        const users = await api('GET', 'auth/users');

        body.innerHTML = `
            <div class="toolbar">
                <div class="toolbar-search-row">
                    <div class="search-input-wrap" style="max-width:320px">
                        <i class="fas fa-search"></i>
                        <input type="text" id="userSearch" placeholder="Search users..." autocomplete="off">
                    </div>
                    <button class="btn btn-primary" id="addUserBtn">
                        <i class="fas fa-plus"></i> Add User
                    </button>
                </div>
            </div>

            <div class="users-grid" id="usersGrid">
                ${renderUserCards(users)}
            </div>

            <!-- User Modal -->
            <div class="modal-overlay" id="userModal">
                <div class="modal modal-sm">
                    <div class="modal-header">
                        <h2 id="userModalTitle">Add User</h2>
                        <button class="modal-close" data-modal="userModal">&times;</button>
                    </div>
                    <form id="userForm">
                        <input type="hidden" name="id" id="userId">
                        <div class="modal-body">
                            <div class="form-group">
                                <label for="userUsername">Username</label>
                                <input type="text" id="userUsername" name="username" required placeholder="Choose a username">
                            </div>
                            <div class="form-group">
                                <label for="userEmail">Email</label>
                                <input type="email" id="userEmail" name="email" required placeholder="user@example.com">
                            </div>
                            <div class="form-group">
                                <label for="userPassword">Password <span class="text-muted">(leave blank to keep current)</span></label>
                                <input type="password" id="userPassword" name="password" placeholder="At least 6 characters" autocomplete="new-password">
                            </div>
                            <div class="form-group">
                                <label class="checkbox-label">
                                    <input type="checkbox" id="userIsAdmin" name="is_admin">
                                    <span>Administrator</span>
                                </label>
                            </div>
                            <div class="form-group">
                                <label class="checkbox-label">
                                    <input type="checkbox" id="userIsActive" name="is_active" checked>
                                    <span>Active</span>
                                </label>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-modal="userModal">Cancel</button>
                            <button type="submit" class="btn btn-primary" id="userSubmitBtn">
                                <i class="fas fa-plus"></i> Add User
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        const searchInput = document.getElementById('userSearch');
        searchInput.addEventListener('input', () => {
            const q = searchInput.value.toLowerCase();
            document.querySelectorAll('.user-card').forEach(card => {
                const match = card.dataset.search && card.dataset.search.includes(q);
                card.style.display = match ? '' : 'none';
            });
        });

        document.getElementById('addUserBtn').addEventListener('click', () => openUserModal());

        document.querySelectorAll('.edit-user-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const u = users.find(u => u.id == btn.dataset.id);
                if (u) openUserModal(u);
            });
        });

        document.querySelectorAll('.delete-user-btn').forEach(btn => {
            btn.addEventListener('click', () => confirmDeleteUser(btn.dataset.id, btn.dataset.username));
        });

        document.getElementById('userForm').addEventListener('submit', submitUserForm);

        // Close modal events
        initUserModalEvents();
    } catch (err) {
        body.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><h3>Failed to load users</h3><p>${err.message}</p></div>`;
    }
}

function renderUserCards(users) {
    if (!users.length) {
        return `<div class="empty-state"><i class="fas fa-users"></i><h3>No users found</h3></div>`;
    }

    return users.map(u => `
        <div class="user-card" data-id="${u.id}" data-search="${(u.username + ' ' + u.email).toLowerCase()}">
            <div class="user-card-avatar">
                <i class="fas fa-user"></i>
            </div>
            <div class="user-card-body">
                <h3 class="user-card-name">${escHtml(u.display_name || u.username)}</h3>
                <span class="user-card-username">@${escHtml(u.username)}</span>
                <span class="user-card-email">${escHtml(u.email)}</span>
            </div>
            <div class="user-card-badges">
                ${u.is_admin ? '<span class="user-badge admin-badge"><i class="fas fa-shield-halved"></i> Admin</span>' : '<span class="user-badge user-badge-user">User</span>'}
                ${u.is_active ? '<span class="user-badge active-badge"><i class="fas fa-check-circle"></i> Active</span>' : '<span class="user-badge inactive-badge"><i class="fas fa-times-circle"></i> Inactive</span>'}
            </div>
            <div class="user-card-meta">
                Joined ${new Date(u.created_at).toLocaleDateString()}
            </div>
            <div class="user-card-actions">
                <button class="btn btn-edit edit-user-btn" data-id="${u.id}">
                    <i class="fas fa-pen"></i> Edit
                </button>
                ${u.id !== user.id ? `<button class="btn btn-delete delete-user-btn" data-id="${u.id}" data-username="${escHtml(u.username)}">
                    <i class="fas fa-trash"></i> Delete
                </button>` : ''}
            </div>
        </div>
    `).join('');
}

function openUserModal(u = null) {
    const modalTitle = document.getElementById('userModalTitle');
    const submitBtn = document.getElementById('userSubmitBtn');
    const form = document.getElementById('userForm');
    form.reset();

    document.getElementById('userId').value = '';
    document.getElementById('userIsActive').checked = true;
    document.getElementById('userIsAdmin').checked = false;
    document.getElementById('userPassword').required = true;
    document.getElementById('userPassword').placeholder = 'At least 6 characters';

    document.querySelectorAll('[data-modal="userModal"]').forEach(el => {
        el.removeEventListener('click', onUserModalClose);
        el.addEventListener('click', onUserModalClose);
    });

    if (u) {
        modalTitle.textContent = 'Edit User';
        submitBtn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
        document.getElementById('userId').value = u.id;
        document.getElementById('userUsername').value = u.username;
        document.getElementById('userEmail').value = u.email;
        document.getElementById('userIsAdmin').checked = u.is_admin;
        document.getElementById('userIsActive').checked = u.is_active;
        document.getElementById('userPassword').required = false;
        document.getElementById('userPassword').placeholder = 'Leave blank to keep current';
    } else {
        modalTitle.textContent = 'Add User';
        submitBtn.innerHTML = '<i class="fas fa-plus"></i> Add User';
    }

    openModal('userModal');
}

function onUserModalClose() {
    closeModal('userModal');
}

function initUserModalEvents() {
    const overlay = document.getElementById('userModal');
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal('userModal');
    });
}

async function submitUserForm(e) {
    e.preventDefault();
    const id = document.getElementById('userId').value;
    const data = {
        username: document.getElementById('userUsername').value.trim(),
        email: document.getElementById('userEmail').value.trim(),
        is_admin: document.getElementById('userIsAdmin').checked,
        is_active: document.getElementById('userIsActive').checked,
    };

    const password = document.getElementById('userPassword').value;
    if (password) data.password = password;

    const method = id ? 'PUT' : 'POST';
    const path = id ? `auth/users/${id}` : 'auth/users';
    const action = id ? 'updated' : 'created';

    try {
        await api(method, path, data);
        closeModal('userModal');
        toast(`User ${action} successfully!`, 'success');
        renderUserManagement();
    } catch (err) {
        toast(err.message, 'error');
    }
}

async function confirmDeleteUser(id, username) {
    const confirmed = await showConfirmModal(
        `Delete user "${username}"? This action cannot be undone.`,
        'Delete User'
    );
    if (!confirmed) return;

    try {
        await api('DELETE', `auth/users/${id}`);
        toast('User deleted', 'success');
        renderUserManagement();
    } catch (err) {
        toast(err.message, 'error');
    }
}

// ============================================
// Snippets
// ============================================
async function renderSnippets() {
    setPageTitle('Snippets', 'Save and copy standard email responses');

    const body = document.getElementById('contentBody');

    try {
        const snippets = await api('GET', 'snippets');
        const admin = isAdmin();

        body.innerHTML = `
            <div class="toolbar">
                <div class="toolbar-search-row">
                    <div class="search-input-wrap">
                        <i class="fas fa-search"></i>
                        <input type="text" id="snippetSearch" placeholder="Search snippets..." autocomplete="off">
                    </div>
                    ${admin ? `<button class="btn btn-primary" id="addSnippetBtn">
                        <i class="fas fa-plus"></i> Add Snippet
                    </button>` : ''}
                </div>
            </div>

            <div class="snippets-grid" id="snippetsGrid">
                ${renderSnippetCards(snippets)}
            </div>
        `;

        document.getElementById('snippetSearch').addEventListener('input', (e) => {
            const q = e.target.value.toLowerCase();
            const cards = document.querySelectorAll('.snippet-card');
            cards.forEach(card => {
                const match = card.dataset.title.toLowerCase().includes(q) || card.dataset.content.toLowerCase().includes(q);
                card.style.display = match ? '' : 'none';
            });
        });

        const addBtn = document.getElementById('addSnippetBtn');
        if (addBtn) addBtn.addEventListener('click', () => openSnippetModal());

        document.querySelectorAll('.edit-snippet').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                const snippet = snippets.find(s => s.id == id);
                if (snippet) openSnippetModal(snippet);
            });
        });

        document.querySelectorAll('.delete-snippet').forEach(btn => {
            btn.addEventListener('click', () => {
                confirmDeleteSnippet(btn.dataset.id);
            });
        });

        document.querySelectorAll('.copy-snippet').forEach(btn => {
            btn.addEventListener('click', () => copySnippet(btn));
        });
    } catch (err) {
        body.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Error loading snippets</h3>
                <p>${err.message}</p>
            </div>
        `;
    }
}

function renderSnippetCards(snippets) {
    if (!snippets.length) {
        return `
            <div class="empty-state">
                <i class="fas fa-reply"></i>
                <h3>No snippets yet</h3>
                <p>Add your first email response snippet to get started.</p>
            </div>
        `;
    }

    const admin = isAdmin();

    return snippets.map(s => `
        <div class="snippet-card" data-id="${s.id}" data-title="${escHtml(s.title).toLowerCase()}" data-content="${escHtml(s.content).toLowerCase()}">
            <div class="snippet-card-head">
                <h3 class="snippet-title">${escHtml(s.title)}</h3>
                <span class="snippet-date">${new Date(s.updated_at).toLocaleDateString()}</span>
            </div>
            <div class="snippet-preview">${escHtml(s.content)}</div>
            <div class="snippet-card-actions">
                <button class="btn btn-copy copy-snippet" data-id="${s.id}">
                    <i class="fas fa-copy"></i> Copy
                </button>
                ${admin ? `
                <button class="btn btn-edit edit-snippet" data-id="${s.id}">
                    <i class="fas fa-pen"></i> Edit
                </button>
                <button class="btn btn-delete delete-snippet" data-id="${s.id}">
                    <i class="fas fa-trash"></i> Delete
                </button>` : ''}
            </div>
        </div>
    `).join('');
}

function copySnippet(btn) {
    const card = btn.closest('.snippet-card');
    const preview = card.querySelector('.snippet-preview');
    let text = preview.textContent;

    // Normalize line endings and trim trailing blank lines
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    text = text.replace(/\n{3,}/g, '\n\n').trim();

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            showCopiedFeedback(btn);
            toast('Copied!', 'success');
        }).catch(() => {
            fallbackCopy(text, btn);
        });
    } else {
        fallbackCopy(text, btn);
    }
}

function fallbackCopy(text, btn) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showCopiedFeedback(btn);
    toast('Copied!', 'success');
}

// ============================================
// Snippet Modal
// ============================================
function openSnippetModal(snippet = null) {
    const form = document.getElementById('snippetForm');
    form.reset();

    if (snippet) {
        document.getElementById('snippetModalTitle').textContent = 'Edit Snippet';
        document.getElementById('snippetSubmitBtn').innerHTML = '<i class="fas fa-save"></i> Save Changes';
        document.getElementById('snippetId').value = snippet.id;
        document.getElementById('snippetTitle').value = snippet.title;
        document.getElementById('snippetContent').value = snippet.content;
    } else {
        document.getElementById('snippetModalTitle').textContent = 'Add Snippet';
        document.getElementById('snippetSubmitBtn').innerHTML = '<i class="fas fa-plus"></i> Add Snippet';
    }

    openModal('snippetModal');
}

async function saveSnippet(data) {
    const id = document.getElementById('snippetId').value;
    const method = id ? 'PUT' : 'POST';
    const path = id ? `snippets/${id}` : 'snippets';

    await api(method, path, data);
}

document.getElementById('snippetForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('snippetSubmitBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
        const data = {
            title: document.getElementById('snippetTitle').value.trim(),
            content: document.getElementById('snippetContent').value.trim(),
        };

        await saveSnippet(data);
        closeModal('snippetModal');
        toast('Snippet saved!', 'success');
        renderSnippets();
    } catch (err) {
        toast(err.message, 'error');
    } finally {
        submitBtn.disabled = false;
        const isEdit = document.getElementById('snippetId').value;
        submitBtn.innerHTML = isEdit
            ? '<i class="fas fa-save"></i> Save Changes'
            : '<i class="fas fa-plus"></i> Add Snippet';
    }
});

async function confirmDeleteSnippet(id) {
    const snippet = await api('GET', `snippets/${id}`);
    const confirmed = await showConfirmModal(`Delete snippet "${snippet.title}"?`);
    if (!confirmed) return;

    try {
        await api('DELETE', `snippets/${id}`);
        toast('Snippet deleted', 'success');
        renderSnippets();
    } catch (err) {
        toast(err.message, 'error');
    }
}

// ============================================
// Category Modal
// ============================================
function openCategoryModal(cat = null) {
    const form = document.getElementById('categoryForm');
    form.reset();

    // Close manager modal first so it doesn't overlap
    closeModal('categoryManagerModal');

    if (cat) {
        document.getElementById('categoryModalTitle').textContent = 'Edit Category';
        document.getElementById('categorySubmitBtn').innerHTML = '<i class="fas fa-save"></i> Save Changes';
        document.getElementById('categoryId').value = cat.id;
        document.getElementById('categoryName').value = cat.name;
        document.getElementById('categoryColor').value = cat.color;
        document.getElementById('categoryColorHex').value = cat.color;
    } else {
        document.getElementById('categoryModalTitle').textContent = 'Add Category';
        document.getElementById('categorySubmitBtn').innerHTML = '<i class="fas fa-plus"></i> Add Category';
        document.getElementById('categoryId').value = '';
        document.getElementById('categoryColor').value = '#6c63ff';
        document.getElementById('categoryColorHex').value = '#6c63ff';
    }

    openModal('categoryModal');
}

function submitCategoryForm(e) {
    e.preventDefault();
    const id = document.getElementById('categoryId').value;
    const data = {
        name: document.getElementById('categoryName').value.trim(),
        color: document.getElementById('categoryColor').value,
        module_id: 1,
        sort_order: 0,
    };

    const method = id ? 'PUT' : 'POST';
    const path = id ? `categories/${id}` : 'categories';
    const action = id ? 'updated' : 'created';

    api(method, path, data)
        .then(() => {
            closeModal('categoryModal');
            toast(`Category ${action} successfully!`, 'success');
            refreshCategoryManager();
            openModal('categoryManagerModal');
        })
        .catch(err => toast(err.message, 'error'));
}

// ============================================
// Delete Category
// ============================================
async function confirmDeleteCategory(id) {
    const cat = state.categories.find(c => c.id == id);
    const name = cat ? cat.name : 'this category';
    const confirmed = await showConfirmModal(`Delete category "${name}"? Commands in this category will be uncategorized.`);
    if (!confirmed) return;

    api('DELETE', `categories/${id}`)
        .then(() => {
            toast('Category deleted', 'success');
            refreshCategoryManager();
        })
        .catch(err => toast(err.message, 'error'));
}

// ============================================
// Category Manager Modal
// ============================================
async function openCategoryManagerModal() {
    openModal('categoryManagerModal');

    try {
        const categories = await api('GET', 'categories?module_id=1');
        state.categories = categories;
        renderCatManagerGrid(categories);

        document.getElementById('catManagerAddBtn').addEventListener('click', () => {
            openCategoryModal();
        });

        const searchInput = document.getElementById('catManagerSearch');
        searchInput.addEventListener('input', () => {
            const q = searchInput.value.trim().toLowerCase();
            const filtered = state.categories.filter(c =>
                c.name.toLowerCase().includes(q)
            );
            renderCatManagerGrid(filtered);
        });

        attachCatManagerEvents();
    } catch (err) {
        document.getElementById('catManagerGrid').innerHTML = `
            <div class="empty-state" style="grid-column:1/-1">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Failed to load categories</h3>
                <p>${err.message}</p>
            </div>
        `;
    }
}

function renderCatManagerGrid(categories) {
    const grid = document.getElementById('catManagerGrid');

    if (!categories.length) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column:1/-1">
                <i class="fas fa-tags"></i>
                <h3>No categories yet</h3>
                <p>Create your first category to organize commands.</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = categories.map(c => `
        <div class="category-card" data-id="${c.id}">
            <div class="category-card-head" style="background:${c.color}">
                <i class="fas fa-folder"></i>
            </div>
            <div class="category-card-body">
                <h3>${escHtml(c.name)}</h3>
                <p class="category-card-count">${c.command_count || 0} command${c.command_count === 1 ? '' : 's'}</p>
            </div>
            <div class="category-card-actions">
                <button class="btn btn-secondary btn-sm edit-cat-mgr-btn" data-id="${c.id}">
                    <i class="fas fa-pen"></i> Edit
                </button>
                <button class="btn btn-secondary btn-sm delete-cat-mgr-btn" data-id="${c.id}">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        </div>
    `).join('');

    attachCatManagerEvents();
}

function attachCatManagerEvents() {
    document.querySelectorAll('#catManagerGrid .edit-cat-mgr-btn').forEach(btn => {
        btn.removeEventListener('click', btn._clickHandler);
        btn._clickHandler = () => {
            const cat = state.categories.find(c => c.id == btn.dataset.id);
            if (cat) openCategoryModal(cat);
        };
        btn.addEventListener('click', btn._clickHandler);
    });

    document.querySelectorAll('#catManagerGrid .delete-cat-mgr-btn').forEach(btn => {
        btn.removeEventListener('click', btn._clickHandler);
        btn._clickHandler = () => {
            confirmDeleteCategory(btn.dataset.id);
        };
        btn.addEventListener('click', btn._clickHandler);
    });
}

async function refreshCategoryManager() {
    try {
        const categories = await api('GET', 'categories?module_id=1');
        state.categories = categories;
        renderCatManagerGrid(categories);

        const filter = document.getElementById('categoryFilter');
        if (filter) {
            const currentVal = filter.value;
            filter.innerHTML = `<option value="">All Categories</option>
                ${categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}`;
            filter.value = currentVal;
        }

        const searchInput = document.getElementById('catManagerSearch');
        if (searchInput && searchInput.value.trim()) {
            const q = searchInput.value.trim().toLowerCase();
            const filtered = state.categories.filter(c =>
                c.name.toLowerCase().includes(q)
            );
            renderCatManagerGrid(filtered);
        }
    } catch (err) {
        toast('Failed to refresh categories', 'error');
    }
}

// ============================================
// Page Title Helper
// ============================================
function setPageTitle(title, subtitle) {
    document.getElementById('pageTitle').textContent = title;
    document.getElementById('pageSubtitle').textContent = subtitle;
}

// ============================================
// Theme
// ============================================
function initTheme() {
    const saved = localStorage.getItem('toolhub-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);

    const btn = document.getElementById('themeToggle');
    const icon = btn.querySelector('i');
    icon.className = saved === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
}

function toggleTheme() {
    const html = document.documentElement;
    const current = html.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    localStorage.setItem('toolhub-theme', next);

    const icon = document.querySelector('#themeToggle i');
    icon.className = next === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
}

// ============================================
// Sidebar (Collapse & Mobile)
// ============================================
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const isMobile = window.innerWidth <= 768;

    if (isMobile) {
        sidebar.classList.toggle('open');
        let overlay = document.querySelector('.mobile-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'mobile-overlay';
            overlay.addEventListener('click', closeSidebar);
            document.body.appendChild(overlay);
        }
        overlay.classList.toggle('active', sidebar.classList.contains('open'));
    } else {
        sidebar.classList.toggle('collapsed');
        state.sidebarCollapsed = sidebar.classList.contains('collapsed');
        localStorage.setItem('toolhub-sidebar', state.sidebarCollapsed);
        updateSidebarToggleIcon();
    }
}

function closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.remove('open');
    const overlay = document.querySelector('.mobile-overlay');
    if (overlay) overlay.classList.remove('active');
}

function updateSidebarToggleIcon() {
    const sidebar = document.getElementById('sidebar');
    const toggle = document.getElementById('sidebarToggle');
    if (!toggle) return;
    const icon = toggle.querySelector('i');
    if (window.innerWidth <= 768) {
        icon.className = 'fas fa-bars';
    } else {
        icon.className = sidebar.classList.contains('collapsed')
            ? 'fas fa-chevron-right'
            : 'fas fa-chevron-left';
    }
}

function initSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (state.sidebarCollapsed && window.innerWidth > 768) {
        sidebar.classList.add('collapsed');
    }
    updateSidebarToggleIcon();

    document.getElementById('sidebarToggle').addEventListener('click', toggleSidebar);

    window.addEventListener('resize', () => {
        if (window.innerWidth <= 768) {
            sidebar.classList.remove('collapsed');
        } else {
            sidebar.classList.remove('open');
            const overlay = document.querySelector('.mobile-overlay');
            if (overlay) overlay.classList.remove('active');
            if (state.sidebarCollapsed) {
                sidebar.classList.add('collapsed');
            }
        }
        updateSidebarToggleIcon();
    });
}

// ============================================
// Modal Event Setup
// ============================================
function initModals() {
    // Close on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay && overlay.id !== 'confirmModal') {
                overlay.classList.remove('active');
                document.body.style.overflow = '';
            }
        });
    });

    // Close buttons
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = btn.closest('.modal-overlay');
            if (modal) {
                modal.classList.remove('active');
                document.body.style.overflow = '';
            }
        });
    });

    // Cancel buttons
    document.querySelectorAll('[data-modal]').forEach(btn => {
        btn.addEventListener('click', () => {
            closeModal(btn.dataset.modal);
        });
    });

    // Command form submit
    document.getElementById('commandForm').addEventListener('submit', submitCommandForm);

    // Category form submit
    document.getElementById('categoryForm').addEventListener('submit', submitCategoryForm);

    // Color sync
    const colorInput = document.getElementById('categoryColor');
    const colorHex = document.getElementById('categoryColorHex');
    if (colorInput && colorHex) {
        colorInput.addEventListener('input', () => { colorHex.value = colorInput.value; });
        colorHex.addEventListener('input', () => {
            if (/^#[0-9a-f]{6}$/i.test(colorHex.value)) {
                colorInput.value = colorHex.value;
            }
        });
    }
}

// ============================================
// Keyboard Shortcuts
// ============================================
function initKeyboard() {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeAllModals();
            closeSidebar();
        }
        if (e.ctrlKey && e.key === 'k') {
            e.preventDefault();
            const search = document.getElementById('commandSearch');
            if (search) search.focus();
        }
    });
}

// ============================================
// Login Form
// ============================================
function initLoginForm() {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const loginError = document.getElementById('loginError');
    const registerError = document.getElementById('registerError');
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        loginError.textContent = '';
        loginBtn.disabled = true;
        loginBtn.classList.add('loading');

        try {
            const username = document.getElementById('loginUsername').value.trim();
            const password = document.getElementById('loginPassword').value;
            await handleLogin(username, password);
            hideLoginScreen();
            initApp();
        } catch (err) {
            loginError.textContent = err.message;
            loginBtn.disabled = false;
            loginBtn.classList.remove('loading');
        }
    });

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        registerError.textContent = '';
        registerBtn.disabled = true;
        registerBtn.classList.add('loading');

        try {
            const username = document.getElementById('regUsername').value.trim();
            const email = document.getElementById('regEmail').value.trim();
            const password = document.getElementById('regPassword').value;
            await handleRegister(username, email, password);
            hideLoginScreen();
            initApp();
        } catch (err) {
            registerError.textContent = err.message;
            registerBtn.disabled = false;
            registerBtn.classList.remove('loading');
        }
    });

    document.getElementById('showRegisterLink').addEventListener('click', (e) => {
        e.preventDefault();
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
        document.getElementById('registerLinkWrap').style.display = 'none';
        loginError.textContent = '';
    });

    document.getElementById('backToLoginBtn').addEventListener('click', () => {
        registerForm.style.display = 'none';
        loginForm.style.display = 'block';
        document.getElementById('registerLinkWrap').style.display = '';
        registerError.textContent = '';
    });

    // Enter key on password field submits login
    document.getElementById('loginPassword').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') loginForm.dispatchEvent(new Event('submit'));
    });
}

async function initApp() {
    if (appInited) return;
    appInited = true;

    initModals();
    initKeyboard();
    initSidebar();
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await handleLogout();
        appInited = false;
        document.getElementById('contentBody').innerHTML = '';
        showLoginScreen();
    });

    try {
        await loadModules();
        navigate('dashboard');
    } catch (err) {
        document.getElementById('contentBody').innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Connection Error</h3>
                <p>Could not connect to the API. Please check your database connection and try again.</p>
                <p style="font-size:0.8rem;color:var(--text-muted);margin-top:8px;">${err.message}</p>
            </div>
        `;
    }
}

// ============================================
// Init
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    initLoginForm();

    const authenticated = await checkAuth();
    if (authenticated) {
        hideLoginScreen();
        initApp();
    } else {
        showLoginScreen();
        // Check if registration is available (no users exist)
        try {
            // Try to hit me to see if we get a specific error about registration
            // If we get 401, just show login
        } catch {}
    }
});
