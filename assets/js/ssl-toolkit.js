/**
 * SSL/TLS — 3 Merged Tools
 */

const sslState = {
    activeTool: 'audit',
    auditCache: null,
};

const sslTools = [
    { id: 'audit',     label: 'SSL Audit',      icon: 'fa-magnifying-glass-chart' },
    { id: 'decoder',   label: 'CSR Decoder',     icon: 'fa-file-code' },
    { id: 'csr-gen',   label: 'CSR Generator',   icon: 'fa-file-export' },
];

function renderSslToolkit() {
    setPageTitle('Certificate Autopsy', 'Dissecting trust chains and their existential crises');
    const body = getActiveBody();
    sslState.activeTool = 'audit';

    body.innerHTML = `
        <div class="ssl-wrap">
            <div class="ssl-subnav" id="sslSubnav">
                ${sslTools.map(t => `
                    <button class="ssl-subnav-btn ${t.id === sslState.activeTool ? 'active' : ''}" data-ssl-tool="${t.id}">
                        <i class="fas ${t.icon}"></i> ${t.label}
                    </button>
                `).join('')}
            </div>
            <div class="ssl-tool-body" id="sslToolBody"></div>
        </div>
    `;

    body.querySelectorAll('.ssl-subnav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            sslState.activeTool = btn.dataset.sslTool;
            body.querySelectorAll('.ssl-subnav-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            sslRenderActiveTool();
        });
    });

    sslRenderActiveTool();
}

function sslRenderActiveTool() {
    const toolBody = document.getElementById('sslToolBody');
    if (!toolBody) return;

    switch (sslState.activeTool) {
        case 'audit':     sslRenderAudit(toolBody); break;
        case 'decoder':   sslRenderDecoder(toolBody); break;
        case 'csr-gen':   sslRenderCsrGen(toolBody); break;
    }
}

// ─── Shared Helpers ──────────────────────────────────────────────────────────
function sslFormatDate(iso) {
    if (!iso) return 'N/A';
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${dd}-${mm}-${yyyy} ${hh}:${mi}`;
}

function sslDomainInput(opts = {}) {
    const port = opts.port !== false;
    return `
        <div class="ssl-input-row">
            <div class="ssl-input-field ssl-input-domain">
                <label>${opts.domainLabel || 'Domain'}</label>
                <input type="text" class="ssl-input" id="sslDomain" placeholder="${opts.placeholder || 'example.com'}" autocomplete="off" spellcheck="false">
            </div>
            ${port ? `
            <div class="ssl-input-field ssl-input-port">
                <label>Port</label>
                <input type="number" class="ssl-input" id="sslPort" value="443" min="1" max="65535">
            </div>` : ''}
            <div class="ssl-input-field ssl-input-btn-wrap">
                <label>&nbsp;</label>
                <button class="btn btn-primary ssl-check-btn" id="sslCheckBtn">
                    <i class="fas ${opts.btnIcon || 'fa-search'}"></i> ${opts.btnLabel || 'Check'}
                </button>
            </div>
        </div>
    `;
}

function sslLoading(msg = 'Checking...') {
    return `<div class="ssl-loading"><i class="fas fa-spinner fa-spin"></i> ${msg}</div>`;
}

function sslEmptyState(icon, title, desc) {
    return `
        <div class="ssl-empty-state">
            <i class="fas ${icon}"></i>
            <h3>${title}</h3>
            <p>${desc}</p>
        </div>
    `;
}

function sslInfoRow(label, value, opts = {}) {
    return `
        <div class="ssl-info-row${opts.class ? ' ' + opts.class : ''}">
            <span class="ssl-info-label">${label}</span>
            <span class="ssl-info-value${opts.mono ? ' font-mono' : ''}">${opts.html ? value : escHtml(String(value ?? 'N/A'))}</span>
        </div>
    `;
}

function sslAttachCopyHandlers(container) {
    container.querySelectorAll('.ssl-copy-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = document.getElementById(btn.dataset.copyTarget);
            if (!target) return;
            const text = target.textContent || target.value || '';
            if (!text.trim()) return toast('Nothing to copy', 'warning');
            navigator.clipboard.writeText(text).then(() => toast('Copied!', 'success')).catch(() => {
                const range = document.createRange();
                range.selectNodeContents(target);
                const sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(range);
                const ok = document.execCommand('copy');
                sel.removeAllRanges();
                if (ok) {
                    toast('Copied!', 'success');
                } else {
                    toast('Copy failed — try selecting and copying manually.', 'error');
                }
            });
        });
    });
}

// ─── Tool 1: SSL Audit (Cert + Chain + TLS + HSTS) ──────────────────────────
function sslBuildAuditHtml(data) {
    const cert = data.cert || {};
    const chain = data.chain || {};
    const tls = data.tls || {};
    const hsts = data.hsts || {};

    let html = '<div class="ssl-result">';

    // ── Overall status
    let overallType = 'success', overallText = 'All Checks Passed';
    if (cert.error) { overallType = 'danger'; overallText = 'Connection Failed'; }
    else if (!cert.valid) { overallType = 'danger'; overallText = 'Certificate Invalid'; }
    else if (chain.chain_valid === false) { overallType = 'danger'; overallText = 'Chain Invalid — Server Misconfigured'; }
    else if (chain.verified_with_cas === false) { overallType = 'danger'; overallText = 'Incomplete Chain — Missing Root CA'; }
    else if (chain.root_self_signed === false && chain.verified_with_cas === false && chain.chain && chain.chain.length > 0) { overallType = 'warning'; overallText = 'Chain Does Not Reach Trusted Root'; }
    else if ((tls.security_notes || []).some(n => n && !n.startsWith('Excellent'))) { overallType = 'warning'; overallText = 'Security Warnings Found'; }
    else if (hsts && hsts.hsts && !hsts.hsts.header_present) { overallType = 'warning'; overallText = 'HSTS Not Configured'; }
    else if (hsts && hsts.grade && hsts.grade !== 'A') { overallType = 'warning'; overallText = 'HSTS Needs Improvement'; }

    html += `
        <div class="ssl-result-header">
            <div class="ssl-result-status ssl-status-${overallType}">
                <i class="fas ${overallType === 'success' ? 'fa-check-circle' : overallType === 'warning' ? 'fa-exclamation-triangle' : 'fa-times-circle'}"></i>
                <span>${overallText}</span>
            </div>
        </div>
    `;

    // ── Certificate Section
    if (cert.error) {
        html += `
            <div class="ssl-audit-section">
                <div class="ssl-audit-section-head ssl-audit-danger">
                    <i class="fas fa-certificate"></i> Certificate
                    <span class="ssl-badge ssl-badge-danger">Error</span>
                </div>
                <div class="ssl-audit-section-body">
                    <div class="ssl-error-state"><p>${escHtml(cert.error)}</p></div>
                </div>
            </div>`;
    } else {
        let certStatusType, certStatusText;
        if (cert.valid && !cert.self_signed && cert.covers_domain) { certStatusType = 'success'; certStatusText = 'Valid & Trusted'; }
        else if (cert.valid && cert.self_signed) { certStatusType = 'warning'; certStatusText = 'Self-Signed'; }
        else if (!cert.valid) { certStatusType = 'danger'; certStatusText = cert.days_left < 0 ? 'Expired' : 'Not Yet Valid'; }
        else { certStatusType = 'warning'; certStatusText = 'Valid (Domain Mismatch)'; }

        html += `
            <div class="ssl-audit-section">
                <div class="ssl-audit-section-head ssl-audit-${certStatusType}">
                    <i class="fas fa-certificate"></i> Certificate
                    <span class="ssl-badge ssl-badge-${certStatusType}">${certStatusText}</span>
                </div>
                <div class="ssl-audit-section-body">
                    <div class="ssl-info-section ssl-info-full">
                        ${sslInfoRow('Domain', data.domain, { mono: true })}
                        ${sslInfoRow('CN', cert.subject?.common_name, { mono: true })}
                        ${sslInfoRow('Issuer', (cert.issuer?.organization || '') + (cert.issuer?.common_name ? ' (' + cert.issuer.common_name + ')' : '') || 'N/A')}
                        ${sslInfoRow('Valid From', sslFormatDate(cert.valid_from))}
                        ${sslInfoRow('Valid To', sslFormatDate(cert.valid_to), { class: (cert.days_left ?? 999) < 30 ? 'ssl-warn-text' : '' })}
                        ${sslInfoRow('Days Left', (cert.days_left ?? 'N/A') + ((cert.days_left ?? 999) < 30 ? ' ⚠️' : ''), { class: (cert.days_left ?? 999) < 30 ? 'ssl-warn-text' : '' })}
                        ${sslInfoRow('Covers Domain', cert.covers_domain ? 'Yes' : 'No', { class: !cert.covers_domain ? 'ssl-warn-text' : '' })}
                    </div>
                    ${(cert.sans || []).length ? `
                    <div class="ssl-info-section ssl-info-full">
                        <h4><i class="fas fa-globe"></i> Subject Alternative Names (${cert.sans.length})</h4>
                        <div class="ssl-san-list">
                            ${cert.sans.map(s => `<span class="ssl-san-chip">${escHtml(s)}</span>`).join('')}
                        </div>
                    </div>` : ''}
                </div>
            </div>`;
    }

    // ── Chain Section
    if (chain && chain.chain) {
        const lastCert = chain.chain[chain.chain.length - 1];
        const missingRoot = !chain.root_self_signed && chain.verified_with_cas === false;

        let chainType, chainText;
        if (chain.chain_valid === false) { chainType = 'danger'; chainText = 'Broken'; }
        else if (missingRoot) { chainType = 'danger'; chainText = 'Incomplete'; }
        else if (chain.verified_with_cas === false) { chainType = 'warning'; chainText = 'Not Verified'; }
        else { chainType = 'success'; chainText = 'Valid'; }

        html += `
            <div class="ssl-audit-section">
                <div class="ssl-audit-section-head ssl-audit-${chainType}">
                    <i class="fas fa-link"></i> Certificate Chain
                    <span class="ssl-badge ssl-badge-${chainType}">${chainText}</span>
                </div>
                <div class="ssl-audit-section-body">
                    ${missingRoot ? `
                    <div class="ssl-chain-alert">
                        <div class="ssl-chain-alert-icon">
                            <i class="fas fa-link-slash"></i>
                        </div>
                        <div class="ssl-chain-alert-body">
                            <h4>Incomplete Certificate Chain</h4>
                            <p>The server sends <strong>${escHtml(String(chain.chain_length))} certificates</strong> but the chain does not reach a trusted root. The last certificate (<strong>${escHtml(lastCert.common_name || 'unknown')}</strong>) is issued by <strong>${escHtml(lastCert.issuer_cn || 'unknown')}</strong>, which is missing from the chain.</p>
                            <div class="ssl-chain-alert-detail">
                                <div class="ssl-chain-alert-detail-item">
                                    <span class="ssl-chain-alert-label">Impact</span>
                                    <span class="ssl-chain-alert-value">Clients without this root CA pre-installed will reject the connection.</span>
                                </div>
                                <div class="ssl-chain-alert-detail-item">
                                    <span class="ssl-chain-alert-label">How to Fix</span>
                                    <span class="ssl-chain-alert-value">Configure your web server to send the full chain: leaf + all intermediates (but not the root itself).</span>
                                </div>
                            </div>
                        </div>
                    </div>` : ''}
                    ${(chain.chain_errors || []).length ? `
                    <div class="ssl-errors-box">
                        <h4><i class="fas fa-exclamation-triangle"></i> Chain Errors</h4>
                        ${chain.chain_errors.map(e => `<div class="ssl-error-item"><i class="fas fa-times-circle"></i> ${escHtml(e)}</div>`).join('')}
                    </div>` : ''}
                    <div class="ssl-chain-visual">
                        <div class="ssl-chain-list">
                            ${chain.chain.map((c, i) => `
                                <div class="ssl-chain-cert ssl-chain-${i === 0 ? 'leaf' : i === chain.chain.length - 1 ? 'intermediate' : 'intermediate'}${c.is_valid ? '' : ' ssl-chain-invalid'}">
                                    <div class="ssl-chain-connector">${i > 0 ? '<i class="fas fa-arrow-down"></i>' : ''}</div>
                                    <div class="ssl-chain-card">
                                        <div class="ssl-chain-badge">
                                            ${i === 0 ? 'Leaf (Server)' : c.is_self_signed ? 'Root CA' : 'Intermediate CA'}
                                        </div>
                                        <div class="ssl-chain-card-body">
                                            ${sslInfoRow('CN', c.common_name)}
                                            ${sslInfoRow('Issuer', c.issuer_cn)}
                                            ${sslInfoRow('Valid', sslFormatDate(c.valid_from) + ' → ' + sslFormatDate(c.valid_to), { class: !c.is_valid ? 'ssl-warn-text' : '' })}
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                            ${missingRoot ? `
                            <div class="ssl-chain-cert ssl-chain-missing">
                                <div class="ssl-chain-connector"><i class="fas fa-arrow-down"></i></div>
                                <div class="ssl-chain-card ssl-chain-card-missing">
                                    <div class="ssl-chain-badge ssl-chain-badge-missing">
                                        <i class="fas fa-triangle-exclamation"></i> Missing
                                    </div>
                                    <div class="ssl-chain-card-body">
                                        ${sslInfoRow('Expected Root', lastCert.issuer_cn + (lastCert.issuer_org ? ' (' + lastCert.issuer_org + ')' : '') || 'Unknown')}
                                        <div class="ssl-missing-note">Not sent by server and not in the system trust store</div>
                                    </div>
                                </div>
                            </div>` : ''}
                        </div>
                    </div>
                    <div class="ssl-info-section ssl-info-full" style="margin-top:12px">
                        ${sslInfoRow('Chain Length', (chain.chain_length ?? 'N/A') + ' certificates' + (missingRoot ? ' (incomplete)' : ''))}
                        ${sslInfoRow('Reaches Root', chain.root_self_signed ? 'Yes (last cert is self-signed)' : 'No — chain ends at an intermediate CA', { class: !chain.root_self_signed && chain.verified_with_cas === false ? 'ssl-warn-text' : '' })}
                        ${sslInfoRow('Verified Against CAs', chain.verified_with_cas === null ? 'Unavailable (verification skipped)' : chain.verified_with_cas ? 'Yes' : 'No — root CA could not be verified against the system trust store', { class: chain.verified_with_cas === false ? 'ssl-warn-text' : '' })}
                    </div>
                </div>
            </div>`;
    }

    // ── TLS Section
    if (tls && tls.versions) {
        const tlsOk = (tls.security_notes || []).every(n => !n || n.startsWith('Excellent'));
        html += `
            <div class="ssl-audit-section">
                <div class="ssl-audit-section-head ssl-audit-${tlsOk ? 'success' : 'warning'}">
                    <i class="fas fa-shield-halved"></i> TLS Versions
                    <span class="ssl-badge ssl-badge-${tlsOk ? 'success' : 'warning'}">Tested</span>
                </div>
                <div class="ssl-audit-section-body">
                    <div class="ssl-tls-grid">
                        ${tls.versions.map(v => `
                            <div class="ssl-tls-card ${v.supported ? 'ssl-tls-supported' : 'ssl-tls-unsupported'}">
                                <div class="ssl-tls-header">
                                    <span class="ssl-tls-version">${escHtml(v.label)}</span>
                                    ${v.supported
                                        ? '<span class="ssl-badge ssl-badge-success"><i class="fas fa-check"></i> Supported</span>'
                                        : '<span class="ssl-badge ssl-badge-danger"><i class="fas fa-times"></i> Not Supported</span>'
                                    }
                                </div>
                                ${v.supported ? `
                                <div class="ssl-tls-details">
                                    ${sslInfoRow('Cipher', v.cipher)}
                                    ${sslInfoRow('Bits', v.bits)}
                                </div>` : ''}
                            </div>
                        `).join('')}
                    </div>
                    ${(tls.security_notes || []).length ? `
                    <div class="ssl-notes-box">
                        <h4><i class="fas fa-clipboard-list"></i> Security Notes</h4>
                        ${tls.security_notes.map(n => `<div class="ssl-note-item"><i class="fas fa-info-circle"></i> ${escHtml(n)}</div>`).join('')}
                    </div>` : ''}
                </div>
            </div>`;
    }

    // ── HSTS Section
    if (hsts && hsts.hsts) {
        const gradeColors = { A: '#22c55e', B: '#3b82f6', C: '#f59e0b', D: '#f97316', F: '#ef4444' };
        const gradeColor = gradeColors[hsts.grade] || '#6b6f8a';

        html += `
            <div class="ssl-audit-section">
                <div class="ssl-audit-section-head ssl-audit-${hsts.hsts.header_present ? 'success' : 'danger'}">
                    <i class="fas fa-lock"></i> HSTS
                    <span class="ssl-badge ssl-badge-${hsts.hsts.header_present ? 'success' : 'danger'}">${hsts.hsts.header_present ? 'Enabled' : 'Not Configured'}</span>
                </div>
                <div class="ssl-audit-section-body">
                    <div class="ssl-hsts-grade">
                        <div class="ssl-grade-circle" style="border-color: ${gradeColor}; color: ${gradeColor};">
                            <span class="ssl-grade-letter">${escHtml(String(hsts.grade))}</span>
                        </div>
                        <div class="ssl-grade-info">
                            <span class="ssl-grade-score">Score: ${escHtml(String(hsts.score))}/80</span>
                            <span class="ssl-grade-label">${hsts.grade === 'A' ? 'Excellent' : hsts.grade === 'B' ? 'Good' : hsts.grade === 'C' ? 'Needs Improvement' : 'Poor'}</span>
                        </div>
                    </div>
                    <div class="ssl-info-section ssl-info-full">
                        <h4><i class="fas fa-lock"></i> HSTS Configuration</h4>
                        ${sslInfoRow('Header Present', hsts.hsts.header_present ? 'Yes' : 'No', { class: !hsts.hsts.header_present ? 'ssl-warn-text' : '' })}
                        ${sslInfoRow('Max-Age', hsts.hsts.max_age ? hsts.hsts.max_age.toLocaleString() + ' seconds (' + Math.round(hsts.hsts.max_age / 86400) + ' days)' : 'N/A')}
                        ${sslInfoRow('Include SubDomains', hsts.hsts.include_subdomains ? 'Yes' : 'No')}
                        ${sslInfoRow('Preload', hsts.hsts.preload ? 'Yes' : 'No')}
                    </div>
                    ${(hsts.recommendations || []).length ? `
                    <div class="ssl-notes-box">
                        <h4><i class="fas fa-lightbulb"></i> Recommendations</h4>
                        ${hsts.recommendations.map(r => `<div class="ssl-note-item"><i class="fas fa-arrow-right"></i> ${escHtml(r)}</div>`).join('')}
                    </div>` : `
                    <div class="ssl-success-box"><i class="fas fa-check-circle"></i> HSTS is properly configured with optimal settings.</div>`}
                </div>
            </div>`;
    }

    html += '</div>';
    return html;
}

function sslRenderAudit(container) {
    container.innerHTML = `
        <div class="ssl-card">
            <div class="ssl-card-header">
                <i class="fas fa-magnifying-glass-chart"></i>
                <h3>SSL Audit</h3>
            </div>
            <p class="ssl-card-desc">Check certificate, chain, TLS versions & HSTS in one go.</p>
            ${sslDomainInput({ btnLabel: 'Run Audit', btnIcon: 'fa-play' })}
            <div id="sslAuditResult">${sslState.auditCache || sslEmptyState('fa-magnifying-glass-chart', 'Ready to Audit', 'Enter a domain to run a full SSL/TLS audit.')}</div>
        </div>
    `;

    const domainEl = document.getElementById('sslDomain');
    const portEl = document.getElementById('sslPort');
    const checkBtn = document.getElementById('sslCheckBtn');
    const resultDiv = document.getElementById('sslAuditResult');

    if (sslState.auditCache) sslAttachCopyHandlers(resultDiv);

    async function doAudit() {
        const domain = domainEl.value.trim();
        const port = parseInt(portEl.value) || 443;
        if (!domain) return toast('Enter a domain.', 'warning');
        if (!/^[a-z0-9]([a-z0-9\-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9\-]*[a-z0-9])?)*\.[a-z]{2,}$/i.test(domain))
            return toast('Invalid domain.', 'error');

        checkBtn.disabled = true;
        checkBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Auditing...';
        resultDiv.innerHTML = sslLoading('Running full SSL audit...');
        sslState.auditCache = null;

        try {
            const data = await api('GET', `ssl?action=audit&domain=${encodeURIComponent(domain)}&port=${port}`);
            const html = sslBuildAuditHtml(data);
            resultDiv.innerHTML = html;
            sslState.auditCache = html;
            sslAttachCopyHandlers(resultDiv);
        } catch (err) {
            const errHtml = `<div class="ssl-error-state"><i class="fas fa-exclamation-triangle"></i><h3>Audit Failed</h3><p>${escHtml(err.message)}</p></div>`;
            resultDiv.innerHTML = errHtml;
            sslState.auditCache = null;
        } finally {
            checkBtn.disabled = false;
            checkBtn.innerHTML = '<i class="fas fa-play"></i> Run Audit';
        }
    }

    checkBtn.addEventListener('click', doAudit);
    domainEl.addEventListener('keydown', e => { if (e.key === 'Enter') doAudit(); });
}

// ─── ASN.1 DER Parser ───────────────────────────────────────────────────────
const sslOidMap = {
    '2.5.4.3': 'CN', '2.5.4.5': 'serialNumber', '2.5.4.6': 'C', '2.5.4.7': 'L',
    '2.5.4.8': 'ST', '2.5.4.9': 'street', '2.5.4.10': 'O', '2.5.4.11': 'OU',
    '2.5.4.97': 'orgIdentifier', '2.5.29.17': 'subjectAltName',
    '1.2.840.113549.1.1.1': 'RSA', '1.2.840.113549.1.1.11': 'SHA-256+RSA',
    '1.2.840.113549.1.1.12': 'SHA-384+RSA', '1.2.840.113549.1.1.13': 'SHA-512+RSA',
    '1.2.840.10045.2.1': 'EC', '1.2.840.10045.4.3.2': 'SHA-256+ECDSA',
    '1.2.840.10045.4.3.3': 'SHA-384+ECDSA', '1.2.840.10045.4.3.4': 'SHA-512+ECDSA',
    '2.5.29.15': 'keyUsage', '2.5.29.19': 'basicConstraints',
    '1.3.6.1.5.5.7.1.1': 'authorityInfoAccess', '1.2.840.113549.1.9.14': 'extensionRequest',
};

function sslDerRead(data, offset) {
    if (offset >= data.length) return null;
    const tag = data[offset]; let off = offset + 1;
    let len = data[off++];
    if (len & 0x80) {
        const numLen = len & 0x7f;
        len = 0;
        for (let i = 0; i < numLen; i++) len = (len << 8) | data[off++];
    }
    const value = data.slice(off, off + len);
    return { tag, len, value, end: off + len };
}

function sslDerChildren(data) {
    const kids = []; let off = 0;
    while (off < data.length) {
        const n = sslDerRead(data, off);
        if (!n) break;
        kids.push(n);
        off = n.end;
    }
    return kids;
}

function sslDerDecode(bytes) { return sslDerChildren(bytes); }

function sslReadOid(val) {
    const parts = [Math.floor(val[0] / 40), val[0] % 40];
    let v = 0;
    for (let i = 1; i < val.length; i++) {
        v = (v << 7) | (val[i] & 0x7f);
        if (!(val[i] & 0x80)) { parts.push(v); v = 0; }
    }
    return parts.join('.');
}

function sslReadName(rdnSet) {
    const name = {};
    for (const rdn of sslDerChildren(rdnSet.value)) {
        const attrs = sslDerChildren(rdn.value);
        for (const atv of attrs) {
            const kids = sslDerChildren(atv.value);
            if (kids.length < 2) continue;
            const oid = sslReadOid(kids[0].value);
            let val = '';
            const vt = kids[1].tag;
            if (vt === 0x0c || vt === 0x13 || vt === 0x14 || vt === 0x16 || vt === 0x1e) {
                val = new TextDecoder().decode(kids[1].value);
            }
            const key = sslOidMap[oid] || oid;
            name[key] = (name[key] ? name[key] + ', ' : '') + val;
        }
    }
    return name;
}

function sslReadTime(data) {
    const s = new TextDecoder().decode(data);
    if (data.length === 13 && data[12] === 0x5a) {
        // UTCTime: YYMMDDHHMMSSZ
        const y = 2000 + parseInt(s.substring(0, 2));
        return new Date(y, parseInt(s.substring(2, 4)) - 1, parseInt(s.substring(4, 6)),
            parseInt(s.substring(6, 8)), parseInt(s.substring(8, 10)), parseInt(s.substring(10, 12)));
    }
    if (data.length === 15 && data[14] === 0x5a) {
        // GeneralizedTime: YYYYMMDDHHMMSSZ
        return new Date(parseInt(s.substring(0, 4)), parseInt(s.substring(4, 6)) - 1,
            parseInt(s.substring(6, 8)), parseInt(s.substring(8, 10)), parseInt(s.substring(10, 12)),
            parseInt(s.substring(12, 14)));
    }
    return new Date(s);
}

function sslParseSanExtension(extValue) {
    const sans = [];
    for (const seq of sslDerChildren(extValue)) {
        const tag = seq.tag & 0x1f;
        if (tag === 2) { // [2] dNSName
            sans.push(new TextDecoder().decode(seq.value));
        }
    }
    return sans;
}

function sslParseCert(bytes) {
    const certOuter = sslDerChildren(bytes);
    if (certOuter.length < 1) throw new Error('Invalid certificate');
    const certBody = sslDerChildren(certOuter[0].value);
    const tbs = sslDerChildren(certBody[0].value);
    const result = { subject: {}, issuer: {}, sans: [], sigAlg: '', serial: '' };

    let off = 0;
    // version [0] EXPLICIT INTEGER
    if (tbs[off] && (tbs[off].tag & 0xe0) === 0xa0) { off++; }
    // serialNumber
    if (tbs[off]) { result.serial = Array.from(tbs[off].value).map(b => b.toString(16).padStart(2, '0')).join(':').toUpperCase(); off++; }
    // signatureAlgorithm — unwrap SEQUENCE to get OID content bytes
    if (tbs[off]) { const algKids = sslDerChildren(tbs[off].value); if (algKids[0]) { const oid = sslReadOid(algKids[0].value); result.sigAlg = sslOidMap[oid] || oid; } off++; }
    // issuer
    if (tbs[off]) { result.issuer = sslReadName(tbs[off]); off++; }
    // validity
    if (tbs[off]) {
        const validity = sslDerChildren(tbs[off].value);
        if (validity[0]) result.validFrom = sslReadTime(validity[0].value);
        if (validity[1]) result.validTo = sslReadTime(validity[1].value);
        off++;
    }
    // subject
    if (tbs[off]) { result.subject = sslReadName(tbs[off]); off++; }
    // subjectPublicKeyInfo — extract algorithm
    if (tbs[off]) {
        const spki = sslDerChildren(tbs[off].value);
        if (spki[0]) {
            const algSeq = sslDerChildren(spki[0].value);
            if (algSeq[0]) {
                const oid = sslReadOid(algSeq[0].value);
                result.keyAlg = sslOidMap[oid] || oid;
            }
            if (algSeq[1] && algSeq[1].tag === 0x06) {
                const namedCurve = sslReadOid(algSeq[1].value);
                if (namedCurve === '1.2.840.10045.3.1.7') result.curve = 'P-256';
                else if (namedCurve === '1.3.132.0.34') result.curve = 'P-384';
                else if (namedCurve === '1.3.132.0.35') result.curve = 'P-521';
                else result.curve = namedCurve;
            }
            if (spki[1] && spki[1].tag === 0x03) {
                const modSeq = sslDerChildren(spki[1].value.slice(1));
                if (modSeq.length && modSeq[0].tag === 0x02) {
                    result.keySize = modSeq[0].value.length * 8;
                }
            }
        }
        off++;
    }
    // optional: issuerUniqueID [1], subjectUniqueID [2], extensions [3]
    while (off < tbs.length && (tbs[off].tag & 0xe0) === 0xa0) {
        if ((tbs[off].tag & 0x1f) === 3) {
            const exts = sslDerChildren(tbs[off].value);
            for (const ext of exts) {
                const extSeq = sslDerChildren(ext.value);
                const oid = sslReadOid(extSeq[0].value);
                if (oid === '2.5.29.17') {
                    const oct = extSeq.find(k => k.tag === 0x04);
                    if (oct) { const sanSeq = sslDerChildren(oct.value); if (sanSeq[0]) result.sans = sslParseSanExtension(sanSeq[0].value); }
                }
            }
        }
        off++;
    }
    return result;
}

function sslParseCsr(bytes) {
    const outer = sslDerChildren(bytes);
    if (outer.length < 1) throw new Error('Invalid CSR');
    const certInfo = sslDerChildren(sslDerChildren(outer[0].value)[0].value);
    const result = { subject: {}, sans: [], sigAlg: '' };

    let off = 0;
    // version
    if (certInfo[off]) off++;
    // subject
    if (certInfo[off]) { result.subject = sslReadName(certInfo[off]); off++; }
    // subjectPublicKeyInfo — extract algorithm
    if (certInfo[off]) {
        const spki = sslDerChildren(certInfo[off].value);
        if (spki[0]) {
            const algSeq = sslDerChildren(spki[0].value);
            if (algSeq[0]) {
                const oid = sslReadOid(algSeq[0].value);
                result.keyAlg = sslOidMap[oid] || oid;
            }
            if (algSeq[1] && algSeq[1].tag === 0x06) {
                const namedCurve = sslReadOid(algSeq[1].value);
                if (namedCurve === '1.2.840.10045.3.1.7') result.curve = 'P-256';
                else if (namedCurve === '1.3.132.0.34') result.curve = 'P-384';
                else if (namedCurve === '1.3.132.0.35') result.curve = 'P-521';
                else result.curve = namedCurve;
            }
            // For RSA, read modulus bit length
            if (spki[1] && spki[1].tag === 0x03) {
                const modSeq = sslDerChildren(spki[1].value.slice(1)); // skip unused bits byte
                if (modSeq.length && modSeq[0].tag === 0x02) {
                    result.keySize = (modSeq[0].value.length * 8);
                }
            }
        }
        off++;
    }
    // attributes [0]
    if (certInfo[off] && (certInfo[off].tag & 0xe0) === 0xa0) {
        for (const attr of sslDerChildren(certInfo[off].value)) {
            const attrSeq = sslDerChildren(attr.value);
            const oid = sslReadOid(attrSeq[0].value);
            if (oid === '1.2.840.113549.1.9.14' && attrSeq[1]) {
                const exts = sslDerChildren(attrSeq[1].value);
                for (const ext of exts) {
                    const extSeq = sslDerChildren(ext.value);
                    const extOid = sslReadOid(extSeq[0].value);
                    if (extOid === '2.5.29.17') {
                        const oct = extSeq.find(k => k.tag === 0x04);
                        if (oct) { const sanSeq = sslDerChildren(oct.value); if (sanSeq[0]) result.sans = sslParseSanExtension(sanSeq[0].value); }
                    }
                }
            }
        }
    }
    // signatureAlgorithm
    if (outer[1]) { const algKids = sslDerChildren(outer[1].value); if (algKids[0]) { const oid = sslReadOid(algKids[0].value); result.sigAlg = sslOidMap[oid] || oid; } }
    return result;
}

// ─── Tool 2: CSR Decoder ───────────────────────────────────────────────────
function sslRenderDecoder(container) {
    container.innerHTML = `
        <div class="ssl-card">
            <div class="ssl-card-header">
                <i class="fas fa-file-code"></i>
                <h3>CSR Decoder</h3>
            </div>
            <p class="ssl-card-desc">Paste a PEM Certificate Signing Request (CSR) to decode its contents.</p>
            <div class="ssl-form-field ssl-form-full">
                <label>PEM Content</label>
                <textarea class="ssl-input ssl-textarea ssl-code-textarea" id="pemDecodeInput" rows="10" placeholder="-----BEGIN CERTIFICATE REQUEST-----&#10;MIICvDCCAaQCAQAwdzELMAkGA1UEBhMCVVMxETAPBgNVBAgMCENhbGlmb3JuaWEx&#10;...&#10;-----END CERTIFICATE REQUEST-----" spellcheck="false"></textarea>
            </div>
            <div class="ssl-form-actions">
                <button class="btn btn-primary" id="pemDecodeBtn"><i class="fas fa-file-code"></i> Decode</button>
            </div>
            <div id="pemDecodeResult"></div>
        </div>
    `;

    const decodeBtn = document.getElementById('pemDecodeBtn');
    const resultDiv = document.getElementById('pemDecodeResult');

    async function doDecode() {
        const pem = document.getElementById('pemDecodeInput').value.trim();
        if (!pem) return toast('Paste a CSR first.', 'warning');

        if (!pem.includes('BEGIN CERTIFICATE REQUEST')) return toast('Not a valid PEM CSR.', 'error');

        decodeBtn.disabled = true;
        decodeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Decoding...';

        try {
            const clean = pem.replace(/-----[^-]+-----/g, '').replace(/[^A-Za-z0-9+/=]/g, '');
            const raw = atob(clean);
            const bytes = new Uint8Array(raw.length);
            for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);

            const c = sslParseCsr(bytes);
            const keyInfo = c.keyAlg + (c.keySize ? ' ' + c.keySize + '-bit' : '') + (c.curve ? ' ' + c.curve : '');

            let html = '<div class="ssl-result">';
            html += `<div class="ssl-result-header">
                <div class="ssl-result-status ssl-status-success">
                    <i class="fas fa-check-circle"></i> CSR Decoded
                </div>
            </div>`;

            html += `
                <div class="ssl-info-section ssl-info-full">
                    <h4><i class="fas fa-user"></i> Subject</h4>
                    ${sslInfoRow('CN', c.subject.CN || 'N/A', { mono: true })}
                    ${sslInfoRow('O', c.subject.O || 'N/A')}
                    ${sslInfoRow('OU', c.subject.OU || 'N/A')}
                    ${sslInfoRow('L', c.subject.L || 'N/A')}
                    ${sslInfoRow('ST', c.subject.ST || 'N/A')}
                    ${sslInfoRow('C', c.subject.C || 'N/A')}
                </div>
                <div class="ssl-info-section ssl-info-full">
                    <h4><i class="fas fa-key"></i> Public Key</h4>
                    ${sslInfoRow('Type', c.keyAlg || 'N/A')}
                    ${c.keySize ? sslInfoRow('Size', c.keySize + '-bit') : ''}
                    ${c.curve ? sslInfoRow('Curve', c.curve) : ''}
                </div>
            `;
            if (c.sans.length) {
                html += `
                    <div class="ssl-info-section ssl-info-full">
                        <h4><i class="fas fa-globe"></i> SANs (${c.sans.length})</h4>
                        <div class="ssl-san-list">
                            ${c.sans.map(s => `<span class="ssl-san-chip">${escHtml(s)}</span>`).join('')}
                        </div>
                    </div>`;
            }

            html += `</div>`;

            resultDiv.innerHTML = html;
            sslAttachCopyHandlers(resultDiv);
        } catch (err) {
            resultDiv.innerHTML = `<div class="ssl-error-state"><i class="fas fa-exclamation-triangle"></i><h3>Decode Failed</h3><p>${escHtml(err.message)}</p></div>`;
        } finally {
            decodeBtn.disabled = false;
            decodeBtn.innerHTML = '<i class="fas fa-file-code"></i> Decode';
        }
    }

    decodeBtn.addEventListener('click', doDecode);
}

// ─── Tool 3: CSR Generator ──────────────────────────────────────────────────
function sslRenderCsrGen(container) {
    container.innerHTML = `
        <div class="ssl-card">
            <div class="ssl-card-header">
                <i class="fas fa-file-export"></i>
                <h3>CSR Generator</h3>
            </div>
            <p class="ssl-card-desc">Generate a Certificate Signing Request and private key. Runs entirely in your browser.</p>
            <div class="ssl-csr-form">
                <div class="ssl-form-grid">
                    <div class="ssl-form-field ssl-form-full">
                        <label>Common Name (CN) *</label>
                        <input type="text" class="ssl-input" id="csrCN" placeholder="example.com" autocomplete="off" spellcheck="false">
                    </div>
                    <div class="ssl-form-field">
                        <label>Organization (O)</label>
                        <input type="text" class="ssl-input" id="csrO" placeholder="Acme Inc." autocomplete="off">
                    </div>
                    <div class="ssl-form-field">
                        <label>Organizational Unit (OU)</label>
                        <input type="text" class="ssl-input" id="csrOU" placeholder="IT Department" autocomplete="off">
                    </div>
                    <div class="ssl-form-field">
                        <label>City (L)</label>
                        <input type="text" class="ssl-input" id="csrL" placeholder="Amsterdam" autocomplete="off">
                    </div>
                    <div class="ssl-form-field">
                        <label>State (ST)</label>
                        <input type="text" class="ssl-input" id="csrST" placeholder="Noord-Holland" autocomplete="off">
                    </div>
                    <div class="ssl-form-field">
                        <label>Country (C)</label>
                        <input type="text" class="ssl-input" id="csrC" placeholder="NL" maxlength="2" autocomplete="off">
                    </div>
                    <div class="ssl-form-field">
                        <label>SANs (one per line)</label>
                        <textarea class="ssl-input ssl-textarea" id="csrSANs" rows="3" placeholder="example.com&#10;www.example.com&#10;*.example.com"></textarea>
                    </div>
                    <div class="ssl-form-field">
                        <label>Key Size</label>
                        <select class="ssl-input" id="csrKeySize">
                            <option value="2048">2048 bit</option>
                            <option value="4096" selected>4096 bit</option>
                        </select>
                    </div>
                </div>
                <div class="ssl-form-actions">
                    <button class="btn btn-primary" id="csrGenBtn"><i class="fas fa-key"></i> Generate CSR & Key</button>
                </div>
            </div>
            <div id="csrResult"></div>
        </div>
    `;

    const genBtn = document.getElementById('csrGenBtn');
    const resultDiv = document.getElementById('csrResult');

    async function doGenerate() {
        const cn = document.getElementById('csrCN').value.trim();
        if (!cn) return toast('Common Name is required.', 'warning');

        genBtn.disabled = true;
        genBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
        resultDiv.innerHTML = sslLoading('Generating key pair & CSR...');

        try {
            const keySize = parseInt(document.getElementById('csrKeySize').value) || 4096;
            const keyPair = await crypto.subtle.generateKey(
                { name: 'RSASSA-PKCS1-v1_5', modulusLength: keySize, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
                true, ['sign', 'verify']
            );

            const privKey = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
            const pubKeySpki = new Uint8Array(await crypto.subtle.exportKey('spki', keyPair.publicKey));
            const pubKeyHex = Array.from(pubKeySpki).map(b => b.toString(16).padStart(2, '0')).join('');

            const privPem = '-----BEGIN PRIVATE KEY-----\n' +
                sslPemEncode(new Uint8Array(privKey)).match(/.{1,64}/g).join('\n') +
                '\n-----END PRIVATE KEY-----';

            const o  = document.getElementById('csrO').value.trim();
            const ou = document.getElementById('csrOU').value.trim();
            const l  = document.getElementById('csrL').value.trim();
            const st = document.getElementById('csrST').value.trim();
            const c  = document.getElementById('csrC').value.trim().toUpperCase();
            const sansText = document.getElementById('csrSANs').value.trim();
            const sans = sansText ? sansText.split('\n').map(s => s.trim()).filter(Boolean) : [];

            const rdnAttrs = [];
            rdnAttrs.push(sslAsn1Attr('2.5.4.3', cn));
            if (o)  rdnAttrs.push(sslAsn1Attr('2.5.4.10', o));
            if (ou) rdnAttrs.push(sslAsn1Attr('2.5.4.11', ou));
            if (l)  rdnAttrs.push(sslAsn1Attr('2.5.4.7', l));
            if (st) rdnAttrs.push(sslAsn1Attr('2.5.4.8', st));
            if (c)  rdnAttrs.push(sslAsn1Attr('2.5.4.6', c));

            const nameHex = sslAsn1Sequence(rdnAttrs.map(a => sslAsn1Set(a)).join(''));

            let attrSet;
            if (sans.length) {
                const sanEntries = sans.map(s => { const sb = new TextEncoder().encode(s); return '82' + sslAsn1Length(sb.length) + Array.from(sb).map(b => b.toString(16).padStart(2, '0')).join(''); }).join('');
                const sanSeq = sslAsn1Sequence(sanEntries);
                const sanOid = sslOidToDer('2.5.29.17');
                const extValue = '04' + sslAsn1Length(sanSeq.length / 2) + sanSeq;
                const extension = sslAsn1Sequence(sanOid + extValue);
                const extReqOid = sslOidToDer('1.2.840.113549.1.9.14');
                const extAttr = sslAsn1Sequence(extReqOid + sslAsn1Set(sslAsn1Sequence(extension)));
                attrSet = 'a0' + sslAsn1Length(extAttr.length / 2) + extAttr;
            } else {
                attrSet = 'a000';
            }

            const version = '020100';
            const certInfoHex = sslAsn1Sequence(version + nameHex + pubKeyHex + attrSet);
            const certInfoBytes = sslHexToBytes(certInfoHex);

            const importedPriv = await crypto.subtle.importKey('pkcs8', privKey, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
            const signed = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', importedPriv, certInfoBytes);

            const sigHex = Array.from(new Uint8Array(signed)).map(b => b.toString(16).padStart(2, '0')).join('');
            const sigAlgHex = sslOidToDer('1.2.840.113549.1.1.11') + '0500';
            const outerHex = sslAsn1Sequence(certInfoHex + sslAsn1Sequence(sigAlgHex) + sslAsn1BitString(sigHex));
            const csrDer = sslHexToBytes(outerHex);
            const csrPem = '-----BEGIN CERTIFICATE REQUEST-----\n' +
                sslPemEncode(csrDer).match(/.{1,64}/g).join('\n') +
                '\n-----END CERTIFICATE REQUEST-----';

            resultDiv.innerHTML = `
                <div class="ssl-result ssl-csr-result">
                    <div class="ssl-result-header">
                        <div class="ssl-result-status ssl-status-success">
                            <i class="fas fa-check-circle"></i> CSR Generated
                        </div>
                    </div>
                    <div class="ssl-output-group">
                        <div class="ssl-output-header">
                            <h4><i class="fas fa-file-export"></i> Certificate Signing Request (CSR)</h4>
                            <button class="btn btn-sm btn-secondary ssl-copy-btn" data-copy-target="csrOutputPem"><i class="fas fa-copy"></i> Copy</button>
                        </div>
                        <pre class="ssl-code-block" id="csrOutputPem">${escHtml(csrPem)}</pre>
                    </div>
                    <div class="ssl-output-group">
                        <div class="ssl-output-header">
                            <h4><i class="fas fa-key"></i> Private Key</h4>
                            <button class="btn btn-sm btn-secondary ssl-copy-btn" data-copy-target="csrOutputKey"><i class="fas fa-copy"></i> Copy</button>
                        </div>
                        <div class="ssl-warning-box"><i class="fas fa-exclamation-triangle"></i> Keep this key secret. Never share it or commit it to version control.</div>
                        <pre class="ssl-code-block" id="csrOutputKey">${escHtml(privPem)}</pre>
                    </div>
                </div>
            `;
            sslAttachCopyHandlers(resultDiv);
        } catch (err) {
            resultDiv.innerHTML = `<div class="ssl-error-state"><i class="fas fa-exclamation-triangle"></i><h3>Generation Failed</h3><p>${escHtml(err.message)}</p></div>`;
        } finally {
            genBtn.disabled = false;
            genBtn.innerHTML = '<i class="fas fa-key"></i> Generate CSR & Key';
        }
    }

    genBtn.addEventListener('click', doGenerate);
}

// ─── ASN.1 / CSR Utilities ──────────────────────────────────────────────────
function sslAsn1Attr(oid, value) {
    const oidBytes = sslOidToDer(oid);
    const valBytes = sslAsn1Utf8String(value);
    return sslAsn1Sequence(oidBytes + valBytes);
}

function sslAsn1Sequence(content) {
    const len = content.length / 2;
    return '30' + sslAsn1Length(len) + content;
}

function sslAsn1Set(content) {
    const len = content.length / 2;
    return '31' + sslAsn1Length(len) + content;
}

function sslAsn1Utf8String(str) {
    const bytes = new TextEncoder().encode(str);
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    return '0c' + sslAsn1Length(bytes.length) + hex;
}

function sslAsn1BitString(hex) {
    const byteLen = hex.length / 2;
    return '03' + sslAsn1Length(byteLen + 1) + '00' + hex;
}

function sslOidToDer(oid) {
    const parts = oid.split('.').map(Number);
    const bytes = [parts[0] * 40 + parts[1]];
    for (let i = 2; i < parts.length; i++) {
        let val = parts[i];
        if (val < 128) { bytes.push(val); continue; }
        const temp = [];
        while (val > 0) { temp.unshift(val & 0x7f); val >>= 7; }
        for (let j = 0; j < temp.length - 1; j++) temp[j] |= 0x80;
        bytes.push(...temp);
    }
    const hex = bytes.map(b => b.toString(16).padStart(2, '0')).join('');
    return '06' + sslAsn1Length(bytes.length) + hex;
}

function sslAsn1Length(len) {
    if (len < 128) return len.toString(16).padStart(2, '0');
    if (len < 256) return '81' + len.toString(16).padStart(2, '0');
    return '82' + len.toString(16).padStart(4, '0');
}

function sslPemEncode(bytes) {
    return btoa(String.fromCharCode(...bytes));
}

function sslHexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    return bytes;
}

function sslHexToDer(hex) { return hex; }

function sslDerToHex(der) { return der; }
