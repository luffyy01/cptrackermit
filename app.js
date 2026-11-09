/* ============================================================
   CP Tracker — Main Application
   Auto-fetches accepted submissions from CP platform APIs
   (Codeforces, LeetCode, AtCoder, CodeChef)
   + manual entry support with multiple solutions & localStorage
   ============================================================ */

// ─── Platform Configuration ─────────────────────────────────
const PLATFORMS = {
    codeforces: {
        name: 'Codeforces', handle: 'luffyy01', color: '#1890ff', icon: '⚡',
        apiSupport: true, url: 'https://codeforces.com/profile/luffyy01',
        rating: 1227, maxRating: 1467
    },
    leetcode: {
        name: 'LeetCode', handle: 'luffyy01', color: '#ffa116', icon: '🔥',
        apiSupport: true, url: 'https://leetcode.com/u/luffyy01/',
        rating: 0, maxRating: 1720
    },
    atcoder: {
        name: 'AtCoder', handle: 'luffyy01', color: '#2196f3', icon: '🏯',
        apiSupport: true, url: 'https://atcoder.jp/users/luffyy01',
        rating: 53, maxRating: 820
    },
    codechef: {
        name: 'CodeChef', handle: 'luffyy01', color: '#5b4638', icon: '👨‍🍳',
        apiSupport: true, url: 'https://www.codechef.com/users/luffyy01',
        rating: 1120, maxRating: 1346
    },
    gfg: {
        name: 'GeeksforGeeks', handle: 'luffyy01', color: '#2f8d46', icon: '🟢',
        apiSupport: false, url: 'https://www.geeksforgeeks.org/profile/luffyy01'
    },
    cses: {
        name: 'CSES', handle: 'mit_001', color: '#607d8b', icon: '📘',
        apiSupport: false, url: 'https://cses.fi/user/mit_001'
    },
    vjudge: {
        name: 'VJudge', handle: 'luffyy01', color: '#5cb85c', icon: '⚖️',
        apiSupport: false, url: 'https://vjudge.net/user/luffyy01'
    },
    spoj: {
        name: 'SPOJ', handle: 'luffyy01', color: '#0066aa', icon: '🔵',
        apiSupport: false, url: 'https://www.spoj.com/myaccount/'
    },
    euler: {
        name: 'Project Euler', handle: 'luffyy01', color: '#666', icon: '🔢',
        apiSupport: false, url: 'https://projecteuler.net/'
    },
    usaco: {
        name: 'USACO Guide', handle: 'luffyy01', color: '#0066cc', icon: '🐄',
        apiSupport: false, url: 'https://usaco.guide/problems?status=Solved'
    },
    kattis: {
        name: 'Kattis', handle: 'mit-jain', color: '#333', icon: '🐱',
        apiSupport: false, url: 'https://open.kattis.com/users/mit-jain'
    }
};

// ─── State ──────────────────────────────────────────────────
let submissions = [];        // All submissions (auto + manual)
let filteredSubmissions = []; // After search/filter
let currentPage = 1;
const PAGE_SIZE = 50;
let editingId = null;        // For edit mode
let activePlatformFilter = null; // Platform card click filter

// ─── LocalStorage Keys ─────────────────────────────────────
const LS_SUBMISSIONS = 'cp_tracker_submissions';
const LS_LAST_SYNCED = 'cp_tracker_last_synced';

// ─── Init ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    loadFromStorage();
    renderStatsBar();
    renderPlatformCards();
    populateFilterDropdown();
    populateFormPlatform();
    applyFilters();
    bindEvents();
    updateLastSynced();
    syncWithPortfolio();
});

// ─── Storage ────────────────────────────────────────────────
function loadFromStorage() {
    try {
        const data = localStorage.getItem(LS_SUBMISSIONS);
        if (data) submissions = JSON.parse(data);
    } catch (e) { submissions = []; }
}

function saveToStorage() {
    localStorage.setItem(LS_SUBMISSIONS, JSON.stringify(submissions));
    syncStatsToServer();
}

async function syncWithPortfolio() {
    try {
        const res = await fetch('https://mitjain.vercel.app/site-config.json?v=' + Date.now());
        if (res.ok) {
            const data = await res.json();
            if (data && data.cp && data.cp.platforms) {
                let added = false;
                for (const [key, p] of Object.entries(data.cp.platforms)) {
                    if (key === 'cptracker') continue;
                    if (!PLATFORMS[key]) {
                        PLATFORMS[key] = {
                            name: p.name || key,
                            handle: p.handle || '',
                            color: '#8b5cf6',
                            icon: '🌐',
                            apiSupport: false,
                            url: p.url || '',
                            rating: p.rating || 0,
                            maxRating: p.maxRating || 0
                        };
                        added = true;
                    }
                }
                if (added) {
                    renderPlatformCards();
                    populateFilterDropdown();
                    populateFormPlatform();
                }
            }
        }
    } catch (e) {
        console.log('Portfolio config sync note:', e);
    }
}

async function syncStatsToServer() {
    try {
        const counts = {};
        for (const [key, p] of Object.entries(PLATFORMS)) {
            const count = submissions.filter(s => s.platform === key).length;
            counts[key] = {
                name: p.name,
                solved: count,
                url: (typeof p.profileUrl === 'function' ? p.profileUrl(p.handle) : p.url) || '',
                handle: p.handle || ''
            };
        }
        await fetch('/api/stats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ platforms: counts, lastSynced: new Date().toISOString() })
        });
    } catch (e) {}
}

function saveLastSynced() {
    const now = new Date().toISOString();
    localStorage.setItem(LS_LAST_SYNCED, now);
    updateLastSynced();
}

function updateLastSynced() {
    const el = document.getElementById('last-synced');
    const last = localStorage.getItem(LS_LAST_SYNCED);
    if (last) {
        const d = new Date(last);
        el.textContent = `Last synced: ${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
    } else {
        el.textContent = 'Never synced';
    }
}

// ─── Event Bindings ─────────────────────────────────────────
function bindEvents() {
    document.getElementById('btn-sync').addEventListener('click', syncAll);
    document.getElementById('btn-export').addEventListener('click', exportData);
    document.getElementById('btn-import').addEventListener('click', () => document.getElementById('import-file').click());
    document.getElementById('import-file').addEventListener('change', importData);
    document.getElementById('btn-add').addEventListener('click', () => openModal());
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('btn-cancel').addEventListener('click', closeModal);
    document.getElementById('modal-overlay').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeModal();
    });
    document.getElementById('submission-form').addEventListener('submit', handleFormSubmit);

    // Multiple Solutions
    document.getElementById('btn-add-solution').addEventListener('click', () => addSolutionField());
    document.getElementById('solutions-modal-close').addEventListener('click', closeSolutionsModal);
    document.getElementById('solutions-modal-overlay').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeSolutionsModal();
    });

    document.getElementById('search-input').addEventListener('input', debounce(() => {
        currentPage = 1;
        applyFilters();
    }, 300));
    document.getElementById('filter-platform').addEventListener('change', () => {
        activePlatformFilter = null;
        highlightPlatformCards();
        currentPage = 1;
        applyFilters();
    });
    document.getElementById('filter-source').addEventListener('change', () => { currentPage = 1; applyFilters(); });
    document.getElementById('filter-sort').addEventListener('change', () => { currentPage = 1; applyFilters(); });

    // Keyboard shortcut
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal();
            closeSolutionsModal();
        }
        if (e.key === 'n' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); openModal(); }
    });
}

// ─── Stats Bar ──────────────────────────────────────────────
function renderStatsBar() {
    const bar = document.getElementById('stats-bar');
    const totalSolved = submissions.length;
    const autoCount = submissions.filter(s => s.source === 'auto').length;
    const manualCount = submissions.filter(s => s.source === 'manual').length;
    const platformCount = new Set(submissions.map(s => s.platform)).size;
    const uniqueTags = new Set(submissions.flatMap(s => s.tags || []));

    bar.innerHTML = `
        <div class="stat-card">
            <div class="stat-value">${totalSolved}</div>
            <div class="stat-label">Total Solved</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${platformCount}</div>
            <div class="stat-label">Platforms</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${autoCount}</div>
            <div class="stat-label">Auto-fetched</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${manualCount}</div>
            <div class="stat-label">Manual</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${uniqueTags.size}</div>
            <div class="stat-label">Unique Tags</div>
        </div>
    `;
}

// ─── Platform Cards ─────────────────────────────────────────
function renderPlatformCards() {
    const grid = document.getElementById('platforms-grid');
    grid.innerHTML = '';

    for (const [key, p] of Object.entries(PLATFORMS)) {
        const count = submissions.filter(s => s.platform === key).length;
        const card = document.createElement('div');
        card.className = `platform-card${activePlatformFilter === key ? ' active' : ''}`;
        card.style.setProperty('--platform-color', p.color);
        card.dataset.platform = key;

        let ratingHtml = '';
        if (p.rating || p.maxRating) {
            ratingHtml = `<div class="platform-meta">Rating: ${p.rating || '–'} (max: ${p.maxRating || '–'})</div>`;
        }

        card.innerHTML = `
            <div class="platform-header">
                <span class="platform-name">
                    <span class="platform-icon">${p.icon}</span>
                    ${p.name}
                </span>
                <span class="platform-badge ${p.apiSupport ? '' : 'manual'}">${p.apiSupport ? 'API' : 'Manual'}</span>
            </div>
            <div class="platform-solved">${count}</div>
            <div class="platform-meta">problems solved</div>
            ${ratingHtml}
            <div class="platform-quick-actions">
                <a class="platform-link" href="${p.url}" target="_blank" onclick="event.stopPropagation()">
                    @${p.handle}
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                </a>
                <button class="platform-add-btn" title="Add question for ${p.name}" onclick="event.stopPropagation(); openModal(null, '${key}')">
                    + Add Q
                </button>
            </div>
        `;

        card.addEventListener('click', () => {
            if (activePlatformFilter === key) {
                activePlatformFilter = null;
                document.getElementById('filter-platform').value = 'all';
            } else {
                activePlatformFilter = key;
                document.getElementById('filter-platform').value = key;
            }
            highlightPlatformCards();
            currentPage = 1;
            applyFilters();
        });

        grid.appendChild(card);
    }
}

function highlightPlatformCards() {
    document.querySelectorAll('.platform-card').forEach(card => {
        card.classList.toggle('active', card.dataset.platform === activePlatformFilter);
    });
}

// ─── Filter Dropdown ────────────────────────────────────────
function populateFilterDropdown() {
    const sel = document.getElementById('filter-platform');
    sel.innerHTML = '<option value="all">All Platforms</option>';
    for (const [key, p] of Object.entries(PLATFORMS)) {
        sel.innerHTML += `<option value="${key}">${p.icon} ${p.name}</option>`;
    }
}

function populateFormPlatform() {
    const sel = document.getElementById('form-platform');
    sel.innerHTML = '';
    for (const [key, p] of Object.entries(PLATFORMS)) {
        sel.innerHTML += `<option value="${key}">${p.icon} ${p.name}</option>`;
    }
}

// ─── Filtering & Rendering ──────────────────────────────────
function applyFilters() {
    const search = document.getElementById('search-input').value.toLowerCase().trim();
    const platformFilter = activePlatformFilter || document.getElementById('filter-platform').value;
    const sourceFilter = document.getElementById('filter-source').value;
    const sort = document.getElementById('filter-sort').value;

    filteredSubmissions = submissions.filter(s => {
        if (platformFilter !== 'all' && s.platform !== platformFilter) return false;
        if (sourceFilter !== 'all' && s.source !== sourceFilter) return false;
        if (search) {
            const haystack = [
                s.problemName,
                PLATFORMS[s.platform]?.name || s.platform,
                s.difficulty,
                s.language,
                ...(s.tags || []),
                ...(s.solutions || []).map(sol => sol.title + ' ' + sol.code)
            ].join(' ').toLowerCase();
            if (!haystack.includes(search)) return false;
        }
        return true;
    });

    // Sort
    filteredSubmissions.sort((a, b) => {
        switch (sort) {
            case 'date-desc': return (new Date(b.date || 0)) - (new Date(a.date || 0));
            case 'date-asc': return (new Date(a.date || 0)) - (new Date(b.date || 0));
            case 'name-asc': return (a.problemName || '').localeCompare(b.problemName || '');
            case 'name-desc': return (b.problemName || '').localeCompare(a.problemName || '');
            case 'difficulty-desc': return (parseDifficulty(b.difficulty)) - (parseDifficulty(a.difficulty));
            case 'difficulty-asc': return (parseDifficulty(a.difficulty)) - (parseDifficulty(b.difficulty));
            default: return 0;
        }
    });

    renderTable();
    renderPagination();
    renderStatsBar();

    document.getElementById('result-count').textContent =
        `${filteredSubmissions.length} submission${filteredSubmissions.length !== 1 ? 's' : ''}` +
        (search || platformFilter !== 'all' || sourceFilter !== 'all' ? ' (filtered)' : '');
}

function parseDifficulty(d) {
    if (!d) return 0;
    const n = parseInt(d);
    if (!isNaN(n)) return n;
    const map = { easy: 1, medium: 2, hard: 3, basic: 0, school: 0 };
    return map[d.toLowerCase()] || 0;
}

function renderTable() {
    const tbody = document.getElementById('submissions-body');
    const empty = document.getElementById('empty-state');
    const wrapper = document.querySelector('.table-wrapper');

    const start = (currentPage - 1) * PAGE_SIZE;
    const pageItems = filteredSubmissions.slice(start, start + PAGE_SIZE);

    if (filteredSubmissions.length === 0) {
        wrapper.style.display = 'none';
        empty.style.display = 'block';
        return;
    }
    wrapper.style.display = 'block';
    empty.style.display = 'none';

    tbody.innerHTML = pageItems.map((s, i) => {
        const p = PLATFORMS[s.platform] || { name: s.platform, color: '#888', icon: '❓' };
        const diffClass = getDifficultyClass(s.difficulty);
        const tagsHtml = (s.tags || []).slice(0, 3).map(t => `<span class="tag">${escHtml(t)}</span>`).join('');
        const dateStr = s.date ? new Date(s.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—';

        // Solutions / Submissions links cell
        let solutionsHtml = '—';
        const hasSubLink = Boolean(s.submissionLink);
        const hasSolutions = Boolean(s.solutions && s.solutions.length > 0);

        if (hasSubLink || hasSolutions) {
            const parts = [];
            if (hasSubLink) {
                parts.push(`<a href="${escHtml(s.submissionLink)}" target="_blank" rel="noopener" class="solution-pill" title="View Submission Link">Sub ↗</a>`);
            }
            if (hasSolutions) {
                parts.push(`<button class="solution-pill" onclick="openSolutionsViewer('${s.id}')" title="View all answers & solutions">Ans (${s.solutions.length}) ▾</button>`);
            }
            solutionsHtml = `<div style="display:flex; gap:6px; flex-wrap:wrap;">${parts.join('')}</div>`;
        }

        return `<tr>
            <td style="color:var(--text-muted);font-family:var(--font-code);font-size:0.78rem;">${start + i + 1}</td>
            <td><div class="cell-platform" style="--platform-color:${p.color}"><span class="cell-platform-dot"></span>${p.name}</div></td>
            <td class="cell-problem">
                <a href="${escHtml(s.problemLink || '#')}" target="_blank" rel="noopener">${escHtml(s.problemName)}</a>
            </td>
            <td>${solutionsHtml}</td>
            <td><span class="cell-difficulty ${diffClass}">${escHtml(s.difficulty || '—')}</span></td>
            <td><div class="cell-tags">${tagsHtml}${(s.tags || []).length > 3 ? `<span class="tag">+${s.tags.length - 3}</span>` : ''}</div></td>
            <td class="cell-lang">${escHtml(s.language || '—')}</td>
            <td class="cell-date">${dateStr}</td>
            <td class="cell-source"><span class="source-badge ${s.source}">${s.source}</span></td>
            <td class="cell-actions">
                <button class="btn btn-danger btn-sm" onclick="editSubmission('${s.id}')" title="Edit">✏️</button>
                <button class="btn btn-danger btn-sm" onclick="deleteSubmission('${s.id}')" title="Delete">🗑️</button>
            </td>
        </tr>`;
    }).join('');
}

function getDifficultyClass(d) {
    if (!d) return '';
    const n = parseInt(d);
    if (!isNaN(n)) {
        if (n <= 1200) return 'diff-easy';
        if (n <= 1800) return 'diff-medium';
        return 'diff-hard';
    }
    const dl = d.toLowerCase();
    if (['easy', 'basic', 'school'].includes(dl)) return 'diff-easy';
    if (dl === 'medium') return 'diff-medium';
    if (dl === 'hard') return 'diff-hard';
    return '';
}

function renderPagination() {
    const container = document.getElementById('pagination');
    const totalPages = Math.ceil(filteredSubmissions.length / PAGE_SIZE);
    if (totalPages <= 1) { container.innerHTML = ''; return; }

    let html = `<button ${currentPage === 1 ? 'disabled' : ''} onclick="goToPage(${currentPage - 1})">‹ Prev</button>`;
    const maxButtons = 7;
    let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
    let endPage = Math.min(totalPages, startPage + maxButtons - 1);
    if (endPage - startPage < maxButtons - 1) startPage = Math.max(1, endPage - maxButtons + 1);

    if (startPage > 1) html += `<button onclick="goToPage(1)">1</button>`;
    if (startPage > 2) html += `<button disabled>…</button>`;

    for (let i = startPage; i <= endPage; i++) {
        html += `<button class="${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
    }

    if (endPage < totalPages - 1) html += `<button disabled>…</button>`;
    if (endPage < totalPages) html += `<button onclick="goToPage(${totalPages})">${totalPages}</button>`;

    html += `<button ${currentPage === totalPages ? 'disabled' : ''} onclick="goToPage(${currentPage + 1})">Next ›</button>`;
    container.innerHTML = html;
}

window.goToPage = function(page) {
    currentPage = page;
    applyFilters();
    document.querySelector('.table-container').scrollIntoView({ behavior: 'smooth', block: 'start' });
};

// ─── Modal & Dynamic Solutions ──────────────────────────────
function openModal(id = null, defaultPlatform = null) {
    const overlay = document.getElementById('modal-overlay');
    const title = document.getElementById('modal-title');
    const form = document.getElementById('submission-form');
    clearSolutionFields();

    if (id) {
        editingId = id;
        title.textContent = 'Edit Submission';
        const s = submissions.find(x => x.id === id);
        if (s) {
            document.getElementById('form-platform').value = s.platform;
            document.getElementById('form-name').value = s.problemName;
            document.getElementById('form-link').value = s.problemLink || '';
            document.getElementById('form-sub-link').value = s.submissionLink || '';
            document.getElementById('form-difficulty').value = s.difficulty || '';
            document.getElementById('form-tags').value = (s.tags || []).join(', ');
            document.getElementById('form-language').value = s.language || '';
            document.getElementById('form-date').value = s.date ? s.date.split('T')[0] : '';

            // Populate multiple solutions
            if (s.solutions && s.solutions.length > 0) {
                s.solutions.forEach(sol => addSolutionField(sol.title, sol.link, sol.code));
            }
        }
    } else {
        editingId = null;
        title.textContent = 'Add Submission';
        form.reset();

        // Default platform from argument, or active filter, or filter dropdown
        const plat = defaultPlatform || (activePlatformFilter && activePlatformFilter !== 'all' ? activePlatformFilter : document.getElementById('filter-platform').value);
        if (plat && plat !== 'all' && PLATFORMS[plat]) {
            document.getElementById('form-platform').value = plat;
        }

        document.getElementById('form-date').value = new Date().toISOString().split('T')[0];
    }

    overlay.classList.add('open');
    setTimeout(() => document.getElementById('form-name').focus(), 200);
}

function closeModal() {
    document.getElementById('modal-overlay').classList.remove('open');
    editingId = null;
}

function addSolutionField(title = '', link = '', code = '') {
    const container = document.getElementById('solutions-container');
    const count = container.children.length + 1;

    const div = document.createElement('div');
    div.className = 'sol-block';

    div.innerHTML = `
        <div class="sol-block-header">
            <span style="font-size:0.75rem; font-weight:700; color:var(--accent);">Approach / Answer #${count}</span>
            <button type="button" class="sol-remove-btn" onclick="this.closest('.sol-block').remove()" title="Remove this solution">&times;</button>
        </div>
        <div class="form-row" style="margin-bottom:6px;">
            <input type="text" class="sol-title" placeholder="Approach Title (e.g. O(N) Hash Map, DP, Two Pointers)" value="${escHtml(title)}" style="font-size:0.8rem; padding:6px 10px;">
            <input type="url" class="sol-link" placeholder="Submission / Solution URL" value="${escHtml(link)}" style="font-size:0.8rem; padding:6px 10px;">
        </div>
        <textarea class="sol-code" rows="3" placeholder="Solution Code / Explanation notes (optional)..." style="width:100%; background:var(--bg); border:1px solid var(--border); border-radius:var(--radius-sm); color:var(--text); font-family:var(--font-code); font-size:0.75rem; padding:6px 10px; outline:none; resize:vertical;">${escHtml(code)}</textarea>
    `;

    container.appendChild(div);
}

function clearSolutionFields() {
    const container = document.getElementById('solutions-container');
    if (container) container.innerHTML = '';
}

function collectSolutions() {
    const container = document.getElementById('solutions-container');
    if (!container) return [];
    const blocks = container.querySelectorAll('.sol-block');
    const sols = [];
    blocks.forEach((b, idx) => {
        const title = b.querySelector('.sol-title').value.trim() || `Approach #${idx + 1}`;
        const link = b.querySelector('.sol-link').value.trim();
        const code = b.querySelector('.sol-code').value.trim();
        if (title || link || code) {
            sols.push({ title, link, code });
        }
    });
    return sols;
}

function handleFormSubmit(e) {
    e.preventDefault();
    const solutions = collectSolutions();
    const mainSubLink = document.getElementById('form-sub-link').value.trim();

    const data = {
        platform: document.getElementById('form-platform').value,
        problemName: document.getElementById('form-name').value.trim(),
        problemLink: document.getElementById('form-link').value.trim(),
        submissionLink: mainSubLink,
        solutions: solutions,
        difficulty: document.getElementById('form-difficulty').value.trim(),
        tags: document.getElementById('form-tags').value.split(',').map(t => t.trim()).filter(Boolean),
        language: document.getElementById('form-language').value.trim(),
        date: document.getElementById('form-date').value || new Date().toISOString().split('T')[0],
        source: 'manual'
    };

    if (editingId) {
        const idx = submissions.findIndex(s => s.id === editingId);
        if (idx >= 0) {
            submissions[idx] = { ...submissions[idx], ...data };
            toast('Submission updated', 'success');
        }
    } else {
        data.id = generateId();
        submissions.unshift(data);
        toast('Submission added', 'success');
    }

    saveToStorage();
    closeModal();
    renderPlatformCards();
    applyFilters();
}

// ─── Solutions Viewer Modal ─────────────────────────────────
window.openSolutionsViewer = function(id) {
    const s = submissions.find(x => x.id === id);
    if (!s) return;

    document.getElementById('solutions-modal-title').textContent = s.problemName;
    document.getElementById('solutions-modal-subtitle').textContent = PLATFORMS[s.platform]?.name || s.platform;

    const body = document.getElementById('solutions-modal-body');
    body.innerHTML = '';

    if (s.submissionLink) {
        const primaryCard = document.createElement('div');
        primaryCard.className = 'sol-card-viewer';
        primaryCard.innerHTML = `
            <div class="sol-card-title">
                <span>Primary Submission Link</span>
                <a href="${escHtml(s.submissionLink)}" target="_blank" rel="noopener" style="color:var(--accent); font-size:0.8rem; text-decoration:none;">Open Submission ↗</a>
            </div>
        `;
        body.appendChild(primaryCard);
    }

    if (s.solutions && s.solutions.length > 0) {
        s.solutions.forEach((sol, idx) => {
            const card = document.createElement('div');
            card.className = 'sol-card-viewer';
            card.innerHTML = `
                <div class="sol-card-title">
                    <span>${escHtml(sol.title || `Approach #${idx + 1}`)}</span>
                    ${sol.link ? `<a href="${escHtml(sol.link)}" target="_blank" rel="noopener" style="color:var(--accent); font-size:0.8rem; text-decoration:none;">Open Link ↗</a>` : ''}
                </div>
                ${sol.code ? `<pre class="sol-card-code">${escHtml(sol.code)}</pre>` : ''}
            `;
            body.appendChild(card);
        });
    }

    document.getElementById('solutions-modal-overlay').classList.add('open');
};

function closeSolutionsModal() {
    document.getElementById('solutions-modal-overlay').classList.remove('open');
}

// ─── Edit / Delete ──────────────────────────────────────────
window.editSubmission = function(id) { openModal(id); };

window.deleteSubmission = function(id) {
    if (!confirm('Delete this submission?')) return;
    submissions = submissions.filter(s => s.id !== id);
    saveToStorage();
    renderPlatformCards();
    applyFilters();
    toast('Submission deleted', 'info');
};

// ─── Import & Export ────────────────────────────────────────
function importData(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            const data = JSON.parse(ev.target.result);
            const imported = data.submissions || data;
            if (!Array.isArray(imported)) throw new Error('Invalid format');

            let addedCount = 0;
            for (const s of imported) {
                if (!s.platform || !s.problemName) continue;
                if (!s.id) s.id = generateId();
                const exists = submissions.some(x =>
                    x.platform === s.platform &&
                    ((x.problemLink && x.problemLink === s.problemLink) ||
                     (!x.problemLink && x.problemName === s.problemName))
                );
                if (!exists) {
                    submissions.push(s);
                    addedCount++;
                }
            }
            saveToStorage();
            renderPlatformCards();
            applyFilters();
            toast(`Imported ${addedCount} new submissions (${imported.length - addedCount} duplicates skipped)`, 'success');
        } catch (err) {
            toast('Invalid JSON file: ' + err.message, 'error');
        }
        e.target.value = '';
    };
    reader.readAsText(file);
}

function exportData() {
    const data = {
        exportedAt: new Date().toISOString(),
        totalSubmissions: submissions.length,
        submissions: submissions
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cp-tracker-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Exported to JSON', 'success');
}

// ─── API Sync All ───────────────────────────────────────────
async function syncAll() {
    showLoading('Syncing submissions from all platforms...');

    const results = { success: [], failed: [] };

    const fetchers = [
        { name: 'Codeforces', fn: fetchCodeforces },
        { name: 'LeetCode', fn: fetchLeetcode },
        { name: 'AtCoder', fn: fetchAtcoder },
        { name: 'CodeChef', fn: fetchCodechef }
    ];

    for (const { name, fn } of fetchers) {
        try {
            updateLoading(`Fetching from ${name}...`);
            const newSubs = await fn();
            mergeSubmissions(newSubs);
            results.success.push(`${name}: ${newSubs.length} problems`);
        } catch (err) {
            console.error(`${name} fetch error:`, err);
            results.failed.push(`${name}: ${err.message}`);
        }
    }

    saveToStorage();
    saveLastSynced();
    hideLoading();
    renderPlatformCards();
    applyFilters();

    if (results.success.length) {
        toast(`Synced: ${results.success.join(', ')}`, 'success');
    }
    if (results.failed.length) {
        toast(`Failed: ${results.failed.join(', ')}`, 'error');
    }
}

function mergeSubmissions(newSubs) {
    for (const ns of newSubs) {
        const exists = submissions.some(s =>
            s.platform === ns.platform && (
                (s.problemLink && s.problemLink === ns.problemLink) ||
                (!s.problemLink && s.problemName === ns.problemName)
            )
        );
        if (!exists) {
            submissions.push(ns);
        }
    }
}

// ─── Codeforces API ─────────────────────────────────────────
async function fetchCodeforces() {
    const handle = PLATFORMS.codeforces.handle;
    const url = `https://codeforces.com/api/user.status?handle=${handle}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.status !== 'OK') throw new Error(data.comment || 'API Error');

    const seen = new Set();
    const subs = [];

    for (const sub of data.result) {
        if (sub.verdict !== 'OK') continue;
        const prob = sub.problem;
        const key = `${prob.contestId}-${prob.index}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const probLink = prob.contestId >= 100000
            ? `https://codeforces.com/problemset/problem/${prob.contestId}/${prob.index}`
            : `https://codeforces.com/contest/${prob.contestId}/problem/${prob.index}`;

        subs.push({
            id: generateId(),
            platform: 'codeforces',
            problemName: `${prob.index}. ${prob.name}`,
            problemLink: probLink,
            submissionLink: `https://codeforces.com/contest/${prob.contestId}/submission/${sub.id}`,
            difficulty: prob.rating ? String(prob.rating) : '',
            tags: prob.tags || [],
            language: sub.programmingLanguage || '',
            date: new Date(sub.creationTimeSeconds * 1000).toISOString(),
            source: 'auto'
        });
    }

    return subs;
}

// ─── LeetCode API ───────────────────────────────────────────
async function fetchLeetcode() {
    const handle = PLATFORMS.leetcode.handle;
    const proxyUrl = `/api/leetcode?handle=${encodeURIComponent(handle)}`;
    const res = await fetch(proxyUrl);
    const data = await res.json();

    if (data.error) throw new Error(data.error);

    const submissionsList = data.submissions || [];
    return submissionsList.map(s => ({
        id: generateId(),
        platform: 'leetcode',
        problemName: s.title,
        problemLink: `https://leetcode.com/problems/${s.titleSlug}/`,
        submissionLink: `https://leetcode.com/problems/${s.titleSlug}/`,
        difficulty: '',
        tags: [],
        language: '',
        date: s.timestamp ? new Date(parseInt(s.timestamp) * 1000).toISOString() : new Date().toISOString(),
        source: 'auto'
    }));
}

// ─── AtCoder API (kenkoooo) ─────────────────────────────────
async function fetchAtcoder() {
    const handle = PLATFORMS.atcoder.handle;
    const url = `https://kenkoooo.com/atcoder/atcoder-api/v3/user/submissions?user=${encodeURIComponent(handle)}&from_second=0`;
    const res = await fetch(url);
    const data = await res.json();

    const seen = new Set();
    const subs = [];

    for (const sub of data) {
        if (sub.result !== 'AC') continue;
        if (seen.has(sub.problem_id)) continue;
        seen.add(sub.problem_id);

        subs.push({
            id: generateId(),
            platform: 'atcoder',
            problemName: sub.problem_id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
            problemLink: `https://atcoder.jp/contests/${sub.contest_id}/tasks/${sub.problem_id}`,
            submissionLink: `https://atcoder.jp/contests/${sub.contest_id}/submissions/${sub.id}`,
            difficulty: sub.point ? String(sub.point) : '',
            tags: [],
            language: sub.language || '',
            date: new Date(sub.epoch_second * 1000).toISOString(),
            source: 'auto'
        });
    }

    return subs;
}

// ─── CodeChef API ───────────────────────────────────────────
async function fetchCodechef() {
    const handle = PLATFORMS.codechef.handle;
    const res = await fetch(`/api/codechef?handle=${encodeURIComponent(handle)}`);
    const data = await res.json();

    if (!data.problems) throw new Error(data.error || 'Failed to fetch CodeChef data');

    return data.problems.map(p => ({
        id: generateId(),
        platform: 'codechef',
        problemName: p.problemName,
        problemLink: p.problemLink,
        submissionLink: p.searchLink,
        difficulty: p.contest || '',
        tags: [p.contest].filter(Boolean),
        language: 'C++',
        date: new Date().toISOString(),
        source: 'auto'
    }));
}

// ─── UI Helpers ─────────────────────────────────────────────
function showLoading(text) {
    document.getElementById('loading-text').textContent = text;
    document.getElementById('loading-overlay').style.display = 'flex';
}
function updateLoading(text) {
    document.getElementById('loading-text').textContent = text;
}
function hideLoading() {
    document.getElementById('loading-overlay').style.display = 'none';
}

function toast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    el.innerHTML = `<span>${icons[type] || ''}</span><span>${escHtml(message)}</span>`;
    container.appendChild(el);
    setTimeout(() => {
        el.style.opacity = '0';
        el.style.transform = 'translateX(100%)';
        el.style.transition = 'all 0.3s';
        setTimeout(() => el.remove(), 300);
    }, 4000);
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

function escHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function debounce(fn, ms) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), ms);
    };
}
