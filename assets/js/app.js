/**
 * Tool Hub - SPA Frontend
 */

const API_BASE = 'api';

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
    expanded: { 'command-hub': true, 'email-tools': false },
};

function renderNav() {
    const nav = document.getElementById('moduleNav');
    nav.innerHTML = '';

    const dashItem = document.createElement('button');
    dashItem.className = `nav-item ${state.currentView === 'dashboard' ? 'active' : ''}`;
    dashItem.dataset.view = 'dashboard';
    dashItem.innerHTML = '<i class="fas fa-th-large"></i> Dashboard';
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
                { view: 'snippets', icon: 'fa-reply', label: 'Snippets' },
            ],
        },
    ];

    sections.forEach(section => {
        const isOpen = navState.expanded[section.key] !== false;
        const hasActive = section.items.some(i => state.currentView === i.view);

        const header = document.createElement('button');
        header.className = `nav-section-header ${hasActive ? 'has-active' : ''}`;
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
            el.innerHTML = `<i class="fas ${item.icon}"></i> ${item.label}`;
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

    closeMobileSidebar();

    if (view === 'dashboard') {
        renderDashboard();
    } else if (view === 'commands') {
        renderCommands();
    } else if (view === 'email-anonymizer') {
        renderEmailAnonymizer();
    } else if (view === 'snippets') {
        renderSnippets();
    }
}

// ============================================
// Dashboard
// ============================================
async function renderDashboard() {
    setPageTitle('Dashboard', 'Tool Hub overview');

    const body = document.getElementById('contentBody');

    try {
        const commands = await api('GET', 'commands');

        const tools = [
            {
                key: 'commands',
                icon: 'fa-terminal',
                name: 'Command Hub',
                desc: 'Store, organize and copy Linux commands',
                color: '#6c63ff',
                status: 'active',
                stats: `${commands.length} commands`,
            },
            {
                key: 'email-anonymizer',
                icon: 'fa-mask',
                name: 'Email Anonymizer',
                desc: 'Anonymize email addresses for privacy',
                color: '#22c55e',
                status: 'active',
                stats: 'New',
            },
            {
                key: 'snippets',
                icon: 'fa-reply',
                name: 'Snippets',
                desc: 'Save and copy standard email responses',
                color: '#14b8a6',
                status: 'active',
                stats: 'New',
            },
            {
                key: null,
                icon: 'fa-key',
                name: 'Password Manager',
                desc: 'Securely store and manage passwords',
                color: '#f59e0b',
                status: 'soon',
                stats: 'Coming soon',
            },
            {
                key: null,
                icon: 'fa-plug',
                name: 'API Tester',
                desc: 'Test and debug API endpoints',
                color: '#3b82f6',
                status: 'soon',
                stats: 'Coming soon',
            },
            {
                key: null,
                icon: 'fa-server',
                name: 'Server Monitor',
                desc: 'Monitor server health and performance',
                color: '#f59e0b',
                status: 'soon',
                stats: 'Coming soon',
            },
            {
                key: null,
                icon: 'fa-database',
                name: 'Database Query Tool',
                desc: 'Run and save database queries',
                color: '#ef4444',
                status: 'soon',
                stats: 'Coming soon',
            },
            {
                key: null,
                icon: 'fa-network-wired',
                name: 'SSH Manager',
                desc: 'Manage SSH connections and keys',
                color: '#8b5cf6',
                status: 'soon',
                stats: 'Coming soon',
            },
            {
                key: null,
                icon: 'fa-code',
                name: 'Script Library',
                desc: 'Store and organize scripts',
                color: '#ec4899',
                status: 'soon',
                stats: 'Coming soon',
            },
            {
                key: null,
                icon: 'fa-sticky-note',
                name: 'Notes',
                desc: 'Take and organize quick notes',
                color: '#14b8a6',
                status: 'soon',
                stats: 'Coming soon',
            },
        ];

        body.innerHTML = `
            <div class="dashboard-grid">
                <div class="dashboard-welcome">
                    <h2>Welcome to Tool Hub</h2>
                    <p>Your central workspace for developer tools. Select a tool below or use the sidebar to get started.</p>
                </div>

                <div class="quick-stats">
                    <div class="stat-card">
                        <div class="stat-icon blue"><i class="fas fa-terminal"></i></div>
                        <div class="stat-info">
                            <h3>${commands.length}</h3>
                            <p>Saved Commands</p>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon green"><i class="fas fa-tools"></i></div>
                        <div class="stat-info">
                            <h3>${tools.length}</h3>
                            <p>Available Tools</p>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon purple"><i class="fas fa-rocket"></i></div>
                        <div class="stat-info">
                            <h3>${tools.filter(t => t.status === 'soon').length}</h3>
                            <p>Coming Soon</p>
                        </div>
                    </div>
                </div>

                <h2 style="font-size:1.1rem;font-weight:600;margin-bottom:16px;">
                    <i class="fas fa-th-large" style="color:var(--accent);margin-right:8px;"></i>
                    All Tools
                </h2>
                <div class="module-grid">
                    ${tools.map(t => `
                        <div class="module-card ${t.status === 'active' ? 'module-card-active' : ''}"
                             ${t.key ? `data-nav="${t.key}"` : ''}>
                            <div class="module-card-icon" style="background:${t.color}18;color:${t.color}">
                                <i class="fas ${t.icon}"></i>
                            </div>
                            <h3>${t.name}</h3>
                            <p>${t.desc}</p>
                            <span class="module-badge ${t.status}">
                                ${t.status === 'active' ? 'Active' : 'Coming soon'}
                            </span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        document.querySelectorAll('.module-card[data-nav]').forEach(card => {
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

        body.innerHTML = `
            <div class="toolbar">
                <div class="toolbar-search-row">
                    <div class="search-input-wrap">
                        <i class="fas fa-search"></i>
                        <input type="text" id="commandSearch" placeholder="Search commands..." autocomplete="off">
                    </div>
                    <button class="btn btn-primary" id="addCommandBtn">
                        <i class="fas fa-plus"></i> Add Command
                    </button>
                </div>
                <div class="toolbar-filter-row">
                    <select class="filter-select" id="categoryFilter">
                        <option value="">All Categories</option>
                        ${categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
                    </select>
                    <button class="btn btn-secondary" id="manageCategoriesBtn">
                        <i class="fas fa-tags"></i> Manage
                    </button>
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
                    <button class="btn btn-edit edit-command" data-id="${cmd.id}">
                        <i class="fas fa-pen"></i> Edit
                    </button>
                    <button class="btn btn-delete delete-command" data-id="${cmd.id}">
                        <i class="fas fa-trash"></i> Delete
                    </button>
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
    document.getElementById('addCommandBtn').addEventListener('click', () => {
        openCommandModal();
    });

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

    document.getElementById('manageCategoriesBtn').addEventListener('click', () => {
        openCategoryManagerModal();
    });

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
// Snippets
// ============================================
async function renderSnippets() {
    setPageTitle('Snippets', 'Save and copy standard email responses');

    const body = document.getElementById('contentBody');

    try {
        const snippets = await api('GET', 'snippets');

        body.innerHTML = `
            <div class="toolbar">
                <div class="toolbar-search-row">
                    <div class="search-input-wrap">
                        <i class="fas fa-search"></i>
                        <input type="text" id="snippetSearch" placeholder="Search snippets..." autocomplete="off">
                    </div>
                    <button class="btn btn-primary" id="addSnippetBtn">
                        <i class="fas fa-plus"></i> Add Snippet
                    </button>
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

        document.getElementById('addSnippetBtn').addEventListener('click', () => openSnippetModal());

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
                <button class="btn btn-edit edit-snippet" data-id="${s.id}">
                    <i class="fas fa-pen"></i> Edit
                </button>
                <button class="btn btn-delete delete-snippet" data-id="${s.id}">
                    <i class="fas fa-trash"></i> Delete
                </button>
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
// Sidebar (Mobile)
// ============================================
function toggleMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('open');

    let overlay = document.querySelector('.mobile-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'mobile-overlay';
        overlay.addEventListener('click', closeMobileSidebar);
        document.body.appendChild(overlay);
    }
    overlay.classList.toggle('active', sidebar.classList.contains('open'));
}

function closeMobileSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    const overlay = document.querySelector('.mobile-overlay');
    if (overlay) overlay.classList.remove('active');
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
            closeMobileSidebar();
        }
        if (e.ctrlKey && e.key === 'k') {
            e.preventDefault();
            const search = document.getElementById('commandSearch');
            if (search) search.focus();
        }
    });
}

// ============================================
// Init
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    initModals();
    initKeyboard();

    // Sidebar toggle
    const sidebarToggle = document.getElementById('sidebarToggle');
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', toggleMobileSidebar);
    }

    // Theme toggle
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);

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
});
