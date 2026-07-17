/* ─── Password Generator ─────────────────────────────────────────────── */
const pgState = {
    password: '',
    history: [],
    multiPasswords: [],
    showPassword: false,
    showAdvanced: false,
    showHistory: false,
    showMulti: false,
    multiCount: 10,
};

const pgCharSets = {
    uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    lowercase: 'abcdefghijklmnopqrstuvwxyz',
    numbers: '0123456789',
    symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?',
    similar: 'il1Lo0O',
    ambiguous: 'Il1Oo0',
};

function pgCryptoRandom(max) {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return arr[0] % max;
}

function pgShuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = pgCryptoRandom(i + 1);
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function pgBuildCharset(opts) {
    let chars = '';
    if (opts.uppercase) chars += pgCharSets.uppercase;
    if (opts.lowercase) chars += pgCharSets.lowercase;
    if (opts.numbers) chars += pgCharSets.numbers;
    if (opts.symbols) chars += pgCharSets.symbols;

    if (opts.excludeSimilar) {
        chars = chars.split('').filter(c => !pgCharSets.similar.includes(c)).join('');
    }
    if (opts.excludeAmbiguous) {
        chars = chars.split('').filter(c => !pgCharSets.ambiguous.includes(c)).join('');
    }
    if (opts.excludeCustom) {
        const custom = document.getElementById('pgExcludeCustom');
        if (custom && custom.value) {
            chars = chars.split('').filter(c => !custom.value.includes(c)).join('');
        }
    }
    return chars;
}

function pgGenerate(opts) {
    const len = opts.length || 16;
    const charset = pgBuildCharset(opts);
    if (!charset) return '';

    const minNums = opts.minNumbers || 0;
    const minSyms = opts.minSymbols || 0;
    const avoidRepeated = opts.avoidRepeated || false;
    const startLetter = opts.startLetter || false;

    let required = [];
    if (minNums > 0 && opts.numbers) {
        const nums = pgCharSets.numbers.split('').filter(c => charset.includes(c));
        for (let i = 0; i < minNums && i < nums.length; i++) required.push(nums[pgCryptoRandom(nums.length)]);
    }
    if (minSyms > 0 && opts.symbols) {
        const syms = pgCharSets.symbols.split('').filter(c => charset.includes(c));
        for (let i = 0; i < minSyms && i < syms.length; i++) required.push(syms[pgCryptoRandom(syms.length)]);
    }
    if (startLetter) {
        const letters = charset.split('').filter(c => /[a-zA-Z]/.test(c));
        if (letters.length) required.unshift(letters[pgCryptoRandom(letters.length)]);
    }

    const remaining = len - required.length;
    if (remaining < 0) return required.slice(0, len).join('');

    let password = [...required];
    if (avoidRepeated) {
        for (let i = 0; i < remaining; i++) {
            const avail = charset.split('').filter(c => password.length === 0 || c !== password[password.length - 1]);
            if (!avail.length) password.push(charset[pgCryptoRandom(charset.length)]);
            else password.push(avail[pgCryptoRandom(avail.length)]);
        }
    } else {
        for (let i = 0; i < remaining; i++) {
            password.push(charset[pgCryptoRandom(charset.length)]);
        }
    }

    return pgShuffle(password).join('');
}

function pgEntropy(opts) {
    const charset = pgBuildCharset(opts);
    if (!charset.length || !opts.length) return 0;
    return Math.floor(opts.length * Math.log2(charset.length));
}

function pgStrength(pw) {
    if (!pw) return { score: 0, label: 'None', color: '#555' };
    let score = 0;
    const len = pw.length;
    if (len >= 8) score += 1;
    if (len >= 12) score += 1;
    if (len >= 16) score += 1;
    if (len >= 24) score += 1;
    if (/[a-z]/.test(pw)) score += 1;
    if (/[A-Z]/.test(pw)) score += 1;
    if (/[0-9]/.test(pw)) score += 1;
    if (/[^a-zA-Z0-9]/.test(pw)) score += 1;
    const unique = new Set(pw).size;
    if (unique >= len * 0.7) score += 1;
    if (/(.)\1{2,}/.test(pw)) score -= 1;
    if (/^[a-zA-Z]+$/.test(pw)) score -= 1;
    if (/^[0-9]+$/.test(pw)) score -= 1;

    if (score <= 2) return { score: 20, label: 'Very Weak', color: '#ef4444', level: 1 };
    if (score <= 4) return { score: 40, label: 'Weak', color: '#f97316', level: 2 };
    if (score <= 6) return { score: 60, label: 'Fair', color: '#eab308', level: 3 };
    if (score <= 8) return { score: 80, label: 'Strong', color: '#22c55e', level: 4 };
    return { score: 100, label: 'Very Strong', color: '#06b6d4', level: 5 };
}

function pgGetOpts() {
    return {
        length: parseInt(document.getElementById('pgLength')?.value || 24),
        uppercase: document.getElementById('pgUpper')?.checked ?? true,
        lowercase: document.getElementById('pgLower')?.checked ?? true,
        numbers: document.getElementById('pgNumbers')?.checked ?? true,
        symbols: document.getElementById('pgSymbols')?.checked ?? true,
        excludeSimilar: document.getElementById('pgExcludeSimilar')?.checked ?? false,
        excludeAmbiguous: document.getElementById('pgExcludeAmbiguous')?.checked ?? false,
        excludeCustom: document.getElementById('pgExcludeCustomToggle')?.checked ?? false,
        minNumbers: parseInt(document.getElementById('pgMinNums')?.value || 0),
        minSymbols: parseInt(document.getElementById('pgMinSyms')?.value || 0),
        avoidRepeated: document.getElementById('pgAvoidRepeated')?.checked ?? false,
        startLetter: document.getElementById('pgStartLetter')?.checked ?? false,
    };
}

function pgUpdateDisplay() {
    const pw = pgState.password;
    const display = document.getElementById('pgDisplay');
    const strength = pgStrength(pw);
    const entropy = pgEntropy(pgGetOpts());

    if (display) {
        if (pgState.showPassword) {
            display.textContent = pw;
        } else {
            display.textContent = pw.replace(/./g, '\u2022');
        }
    }

    const bar = document.getElementById('pgStrengthBar');
    const label = document.getElementById('pgStrengthLabel');
    const entropyEl = document.getElementById('pgEntropy');
    if (bar) {
        bar.style.width = strength.score + '%';
        bar.style.background = strength.color;
    }
    if (label) {
        label.textContent = strength.label;
        label.style.color = strength.color;
    }
    if (entropyEl) {
        entropyEl.textContent = entropy + ' bits of entropy';
    }
}

function pgGenerateNew() {
    const opts = pgGetOpts();
    if (!opts.uppercase && !opts.lowercase && !opts.numbers && !opts.symbols) {
        toast('Enable at least one character type', 'warning');
        return;
    }
    pgState.password = pgGenerate(opts);
    pgState.history.unshift({ password: pgState.password, time: new Date().toLocaleTimeString() });
    if (pgState.history.length > 10) pgState.history.pop();
    pgUpdateDisplay();
    pgRenderHistory();
    pgRenderMulti();
}

function pgCopyPassword() {
    if (!pgState.password) return;
    navigator.clipboard.writeText(pgState.password).then(() => {
        const btn = document.getElementById('pgCopyBtn');
        if (btn) {
            const orig = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-check"></i>';
            btn.classList.add('pg-btn-copied');
            setTimeout(() => { btn.innerHTML = orig; btn.classList.remove('pg-btn-copied'); }, 1500);
        }
        toast('Password copied to clipboard', 'success');
    }).catch(() => toast('Failed to copy', 'error'));
}

function pgToggleShow() {
    pgState.showPassword = !pgState.showPassword;
    const btn = document.getElementById('pgShowBtn');
    if (btn) btn.innerHTML = pgState.showPassword ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>';
    pgUpdateDisplay();
}

function pgCopyMulti(pw) {
    navigator.clipboard.writeText(pw).then(() => toast('Password copied', 'success'));
}

function pgRenderHistory() {
    const el = document.getElementById('pgHistoryList');
    if (!el) return;
    if (!pgState.history.length) {
        el.innerHTML = '<div class="pg-history-empty">No passwords generated yet</div>';
        return;
    }
    el.innerHTML = pgState.history.map((h, i) => `
        <div class="pg-history-item">
            <span class="pg-history-pw font-mono">${pgState.showPassword ? pgEscHtml(h.password) : h.password.replace(/./g, '\u2022')}</span>
            <span class="pg-history-time">${h.time}</span>
            <button class="pg-icon-btn pg-history-copy" title="Copy" data-pw="${pgEscHtml(h.password)}"><i class="fas fa-copy"></i></button>
        </div>
    `).join('');

    el.querySelectorAll('.pg-history-copy').forEach(btn => {
        btn.addEventListener('click', () => pgCopyMulti(btn.dataset.pw));
    });
}

function pgRenderMulti() {
    const el = document.getElementById('pgMultiList');
    if (!el) return;
    if (!pgState.multiPasswords.length) {
        el.innerHTML = '<div class="pg-history-empty">Click "Generate Multiple" to create passwords</div>';
        return;
    }
    el.innerHTML = pgState.multiPasswords.map(pw => `
        <div class="pg-history-item">
            <span class="pg-history-pw font-mono">${pgEscHtml(pw)}</span>
            <button class="pg-icon-btn pg-history-copy" title="Copy" data-pw="${pgEscHtml(pw)}"><i class="fas fa-copy"></i></button>
        </div>
    `).join('');

    el.querySelectorAll('.pg-history-copy').forEach(btn => {
        btn.addEventListener('click', () => pgCopyMulti(btn.dataset.pw));
    });
}

function pgGenerateMultiple() {
    const count = pgState.multiCount;
    const opts = pgGetOpts();
    if (!opts.uppercase && !opts.lowercase && !opts.numbers && !opts.symbols) {
        toast('Enable at least one character type', 'warning');
        return;
    }
    pgState.multiPasswords = [];
    for (let i = 0; i < count; i++) {
        pgState.multiPasswords.push(pgGenerate(opts));
    }
    pgRenderMulti();
}

function pgDownloadTxt() {
    const pw = pgState.password;
    if (!pw) { toast('Generate a password first', 'warning'); return; }
    pgDownloadFile(pw + '\n', 'password.txt', 'text/plain');
    toast('Downloaded as TXT', 'success');
}

function pgDownloadCsv() {
    const passwords = pgState.multiPasswords.length ? pgState.multiPasswords : [pgState.password];
    if (!passwords[0]) { toast('Generate passwords first', 'warning'); return; }
    const csv = 'Password,Strength,Length\n' + passwords.map(pw => {
        const s = pgStrength(pw);
        return `"${pw.replace(/"/g, '""')}",${s.label},${pw.length}`;
    }).join('\n');
    pgDownloadFile(csv, 'passwords.csv', 'text/csv');
    toast('Downloaded as CSV', 'success');
}

function pgDownloadFile(content, filename, mime) {
    const blob = new Blob([content], { type: mime + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
}

function pgEscHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

/* ─── Render ─────────────────────────────────────────────────────────── */
function renderPasswordGenerator() {
    setPageTitle('Entropy Fabricator', 'Concocting unhackable gibberish so you don\'t have to');

    const body = getActiveBody();
    pgState.showPassword = false;
    pgState.showAdvanced = false;
    pgState.showHistory = false;
    pgState.showMulti = false;
    pgState.multiPasswords = [];
    pgState.history = [];

    body.innerHTML = `
        <div class="pg-wrap">
            <div class="pg-hero">
                <div class="pg-display-box" id="pgDisplayBox" title="Click to select">
                    <span class="pg-display font-mono" id="pgDisplay">Click generate to start</span>
                </div>
                <div class="pg-strength-track"><div class="pg-strength-bar" id="pgStrengthBar"></div></div>
                <div class="pg-strength-info">
                    <span class="pg-strength-label" id="pgStrengthLabel">&mdash;</span>
                    <span class="pg-entropy" id="pgEntropy">0 bits of entropy</span>
                </div>
                <div class="pg-hero-actions">
                    <button class="pg-hero-btn" id="pgShowBtn" title="Show/Hide"><i class="fas fa-eye"></i></button>
                    <button class="pg-hero-btn pg-hero-primary" id="pgCopyBtn" title="Copy"><i class="fas fa-copy"></i></button>
                    <button class="pg-hero-btn pg-hero-generate" id="pgRegenBtn" title="Regenerate"><i class="fas fa-rotate"></i></button>
                </div>
            </div>

            <div class="pg-opts">
                <div class="pg-length-row">
                    <label class="pg-label" for="pgLength">Length</label>
                    <div class="pg-length-controls">
                        <button class="pg-length-btn" id="pgLengthDown"><i class="fas fa-minus"></i></button>
                        <input type="range" id="pgLength" class="pg-slider" min="4" max="128" value="24">
                        <button class="pg-length-btn" id="pgLengthUp"><i class="fas fa-plus"></i></button>
                        <span class="pg-length-val font-mono" id="pgLengthVal">24</span>
                    </div>
                </div>

                <div class="pg-chars">
                    <label class="pg-char-pill"><input type="checkbox" id="pgUpper" checked><span>A-Z</span></label>
                    <label class="pg-char-pill"><input type="checkbox" id="pgLower" checked><span>a-z</span></label>
                    <label class="pg-char-pill"><input type="checkbox" id="pgNumbers" checked><span>0-9</span></label>
                    <label class="pg-char-pill"><input type="checkbox" id="pgSymbols" checked><span>!@#</span></label>
                </div>

                <div class="pg-extras">
                    <button class="pg-extras-toggle" id="pgAdvancedToggle"><i class="fas fa-sliders"></i> Options <i class="fas fa-chevron-down pg-chevron"></i></button>
                    <div class="pg-advanced" id="pgAdvancedPanel" style="display:none">
                        <div class="pg-toggles">
                            <label class="pg-toggle-row"><span class="pg-toggle-label"><i class="fas fa-eye-slash"></i> Exclude similar (i,l,1,L,o,0,O)</span><input type="checkbox" id="pgExcludeSimilar" class="pg-toggle"></label>
                            <label class="pg-toggle-row"><span class="pg-toggle-label"><i class="fas fa-ban"></i> Exclude ambiguous (I,l,1,O,o,0)</span><input type="checkbox" id="pgExcludeAmbiguous" class="pg-toggle"></label>
                            <label class="pg-toggle-row"><span class="pg-toggle-label"><i class="fas fa-xmark"></i> Custom exclude</span><input type="checkbox" id="pgExcludeCustomToggle" class="pg-toggle"></label>
                            <input type="text" id="pgExcludeCustom" class="pg-input pg-custom-exclude" placeholder="Characters to exclude..." style="display:none">
                            <label class="pg-toggle-row"><span class="pg-toggle-label">Min. numbers</span><input type="number" id="pgMinNums" class="pg-mini-input" min="0" max="128" value="0"></label>
                            <label class="pg-toggle-row"><span class="pg-toggle-label">Min. symbols</span><input type="number" id="pgMinSyms" class="pg-mini-input" min="0" max="128" value="0"></label>
                            <label class="pg-toggle-row"><span class="pg-toggle-label"><i class="fas fa-font"></i> No repeated chars</span><input type="checkbox" id="pgAvoidRepeated" class="pg-toggle"></label>
                            <label class="pg-toggle-row"><span class="pg-toggle-label"><i class="fas fa-arrow-right"></i> Start with letter</span><input type="checkbox" id="pgStartLetter" class="pg-toggle"></label>
                        </div>
                    </div>
                </div>

                <div class="pg-bottom-row">
                    <button class="pg-secondary-btn" id="pgMultiToggle"><i class="fas fa-layer-group"></i> Multi</button>
                    <button class="pg-secondary-btn" id="pgHistoryToggle"><i class="fas fa-clock-rotate-left"></i> History</button>
                    <button class="pg-secondary-btn" id="pgDownloadTxt"><i class="fas fa-download"></i> TXT</button>
                    <button class="pg-secondary-btn" id="pgDownloadCsv"><i class="fas fa-file-csv"></i> CSV</button>
                </div>
            </div>

            <div class="pg-extra-panel" id="pgMultiPanel" style="display:none">
                <div class="pg-multi-header">
                    <span class="pg-section-title">Multiple Passwords</span>
                    <div class="pg-multi-count-row">
                        <label class="pg-label" style="margin:0">Count:</label>
                        <input type="number" id="pgMultiCount" class="pg-mini-input" min="5" max="20" value="10">
                        <button class="pg-mini-btn" id="pgMultiGenerate"><i class="fas fa-wand-magic-sparkles"></i> Generate</button>
                    </div>
                </div>
                <div class="pg-history-list" id="pgMultiList">
                    <div class="pg-history-empty">Click "Generate" to create multiple passwords</div>
                </div>
            </div>

            <div class="pg-extra-panel" id="pgHistoryPanel" style="display:none">
                <div class="pg-history-header">
                    <span class="pg-section-title">History <span class="pg-muted">(this session)</span></span>
                    <button class="pg-mini-btn pg-danger-btn" id="pgClearHistory"><i class="fas fa-trash"></i> Clear</button>
                </div>
                <div class="pg-history-list" id="pgHistoryList">
                    <div class="pg-history-empty">No passwords generated yet</div>
                </div>
            </div>
        </div>
    `;

    pgAttachEvents();
    pgGenerateNew();
}

function pgAttachEvents() {
    const $ = id => document.getElementById(id);

    $('pgCopyBtn').addEventListener('click', pgCopyPassword);
    $('pgShowBtn').addEventListener('click', pgToggleShow);
    $('pgRegenBtn').addEventListener('click', pgGenerateNew);

    $('pgDisplayBox').addEventListener('click', () => {
        const sel = window.getSelection();
        sel.removeAllRanges();
        const range = document.createRange();
        range.selectNodeContents($('pgDisplay'));
        sel.addRange(range);
    });

    $('pgDownloadTxt').addEventListener('click', pgDownloadTxt);
    $('pgDownloadCsv').addEventListener('click', pgDownloadCsv);

    $('pgLength').addEventListener('input', e => {
        $('pgLengthVal').textContent = e.target.value;
    });
    $('pgLengthDown').addEventListener('click', () => {
        const sl = $('pgLength');
        sl.value = Math.max(4, parseInt(sl.value) - 1);
        $('pgLengthVal').textContent = sl.value;
    });
    $('pgLengthUp').addEventListener('click', () => {
        const sl = $('pgLength');
        sl.value = Math.min(128, parseInt(sl.value) + 1);
        $('pgLengthVal').textContent = sl.value;
    });

    $('pgExcludeCustomToggle').addEventListener('change', e => {
        $('pgExcludeCustom').style.display = e.target.checked ? 'block' : 'none';
    });

    $('pgAdvancedToggle').addEventListener('click', () => {
        pgState.showAdvanced = !pgState.showAdvanced;
        $('pgAdvancedPanel').style.display = pgState.showAdvanced ? 'block' : 'none';
        $('pgAdvancedToggle').setAttribute('aria-expanded', pgState.showAdvanced);
        $('pgAdvancedToggle').querySelector('.pg-chevron').style.transform = pgState.showAdvanced ? 'rotate(180deg)' : '';
    });

    $('pgMultiToggle').addEventListener('click', () => {
        pgState.showMulti = !pgState.showMulti;
        $('pgMultiPanel').style.display = pgState.showMulti ? 'block' : 'none';
        if (pgState.showMulti) pgRenderMulti();
    });
    $('pgMultiCount').addEventListener('change', e => {
        pgState.multiCount = Math.max(5, Math.min(20, parseInt(e.target.value) || 10));
        e.target.value = pgState.multiCount;
    });
    $('pgMultiGenerate').addEventListener('click', pgGenerateMultiple);

    $('pgHistoryToggle').addEventListener('click', () => {
        pgState.showHistory = !pgState.showHistory;
        $('pgHistoryPanel').style.display = pgState.showHistory ? 'block' : 'none';
        if (pgState.showHistory) pgRenderHistory();
    });
    $('pgClearHistory').addEventListener('click', () => {
        pgState.history = [];
        pgRenderHistory();
        toast('History cleared', 'info');
    });

    ['pgUpper', 'pgLower', 'pgNumbers', 'pgSymbols', 'pgExcludeSimilar', 'pgExcludeAmbiguous', 'pgExcludeCustomToggle', 'pgAvoidRepeated', 'pgStartLetter'].forEach(id => {
        const el = $(id);
        if (el) el.addEventListener('change', pgUpdateDisplay);
    });
    ['pgMinNums', 'pgMinSyms'].forEach(id => {
        const el = $(id);
        if (el) el.addEventListener('change', pgUpdateDisplay);
    });
    $('pgExcludeCustom').addEventListener('input', pgUpdateDisplay);
}
