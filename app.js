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
        rating: 1478, maxRating: 1478, solved: 1490
    },
    leetcode: {
        name: 'LeetCode', handle: 'luffyy01', color: '#ffa116', icon: '🔥',
        apiSupport: true, url: 'https://leetcode.com/u/luffyy01/',
        rating: 0, maxRating: 1720, solved: 84
    },
    atcoder: {
        name: 'AtCoder', handle: 'luffyy01', color: '#2196f3', icon: '🏯',
        apiSupport: true, url: 'https://atcoder.jp/users/luffyy01',
        rating: 53, maxRating: 820, solved: 14
    },
    codechef: {
        name: 'CodeChef', handle: 'luffyy01', color: '#5b4638', icon: '👨‍🍳',
        apiSupport: true, url: 'https://www.codechef.com/users/luffyy01',
        rating: 1120, maxRating: 1346, solved: 31
    },
    gfg: {
        name: 'GeeksforGeeks', handle: 'luffyy01', color: '#2f8d46', icon: '🟢',
        apiSupport: false, url: 'https://www.geeksforgeeks.org/profile/luffyy01', solved: 3
    },
    cses: {
        name: 'CSES', handle: 'mit_001', color: '#607d8b', icon: '📘',
        apiSupport: false, url: 'https://cses.fi/problemset/list/', solved: 35
    },
    vjudge: {
        name: 'VJudge', handle: 'luffyy01', color: '#5cb85c', icon: '⚖️',
        apiSupport: false, url: 'https://vjudge.net/user/luffyy01', solved: 32
    },
    spoj: {
        name: 'SPOJ', handle: 'luffyy01', color: '#0066aa', icon: '🔵',
        apiSupport: false, url: 'https://www.spoj.com/myaccount/', solved: 2
    },
    euler: {
        name: 'Project Euler', handle: 'luffyy01', color: '#666', icon: '🔢',
        apiSupport: false, url: 'https://projecteuler.net/', solved: 3
    },
    usaco: {
        name: 'USACO Guide', handle: 'luffyy01', color: '#0066cc', icon: '🐄',
        apiSupport: false, url: 'https://usaco.guide/problems?status=Solved', solved: 6
    },
    kattis: {
        name: 'Kattis', handle: 'mit-jain', color: '#333', icon: '🐱',
        apiSupport: false, url: 'https://open.kattis.com/users/mit-jain', solved: 0
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
const LS_CUSTOM_PLATFORMS = 'cp_tracker_custom_platforms';
const LS_PLATFORM_OVERRIDES = 'cp_tracker_platform_overrides';
const CURRENT_DATA_VERSION = 'v2_cf_1490';
const LS_DATA_VERSION = 'cp_tracker_data_version';

const DEFAULT_PLATFORM_KEYS = [
    'codeforces', 'leetcode', 'atcoder', 'codechef', 'gfg',
    'cses', 'vjudge', 'spoj', 'euler', 'usaco', 'kattis'
];

let editingPlatformKey = null;

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
    syncWithPortfolio(false);
    autoInitialSync();
});

// ─── Storage ────────────────────────────────────────────────
function loadFromStorage() {
    try {
        const v = localStorage.getItem(LS_DATA_VERSION);
        if (v !== CURRENT_DATA_VERSION) {
            const data = localStorage.getItem(LS_SUBMISSIONS);
            if (data) {
                const oldSubs = JSON.parse(data);
                // Keep manual and non-codeforces, clean old incomplete CF submissions
                submissions = oldSubs.filter(s => s.source === 'manual' || s.platform !== 'codeforces');
            }
            localStorage.setItem(LS_DATA_VERSION, CURRENT_DATA_VERSION);
        } else {
            const data = localStorage.getItem(LS_SUBMISSIONS);
            if (data) submissions = JSON.parse(data);
        }
    } catch (e) { submissions = []; }

    // Load any custom or portfolio platforms
    try {
        const customData = localStorage.getItem(LS_CUSTOM_PLATFORMS);
        if (customData) {
            const custom = JSON.parse(customData);
            for (const [key, p] of Object.entries(custom)) {
                PLATFORMS[key] = {
                    ...(PLATFORMS[key] || {}),
                    ...p
                };
            }
        }
    } catch (e) {}

    // Load platform count overrides (e.g. solved increments on default platforms)
    try {
        const overridesData = localStorage.getItem(LS_PLATFORM_OVERRIDES);
        if (overridesData) {
            const overrides = JSON.parse(overridesData);
            for (const [key, ov] of Object.entries(overrides)) {
                if (PLATFORMS[key]) {
                    if (typeof ov.solved === 'number') {
                        PLATFORMS[key].solved = Math.max(PLATFORMS[key].solved || 0, ov.solved);
                    }
                    if (ov.rating) PLATFORMS[key].rating = ov.rating;
                    if (ov.maxRating) PLATFORMS[key].maxRating = ov.maxRating;
                }
            }
        }
    } catch (e) {}
}

function saveToStorage() {
    localStorage.setItem(LS_SUBMISSIONS, JSON.stringify(submissions));
    savePlatformCounts();
    syncStatsToServer();
}

function savePlatformCounts() {
    try {
        const overrides = {};
        for (const [key, p] of Object.entries(PLATFORMS)) {
            overrides[key] = {
                solved: p.solved,
                rating: p.rating,
                maxRating: p.maxRating
            };
        }
        localStorage.setItem(LS_PLATFORM_OVERRIDES, JSON.stringify(overrides));
    } catch (e) {}
}

function saveCustomPlatforms() {
    try {
        const custom = {};
        for (const [key, p] of Object.entries(PLATFORMS)) {
            if (p.isCustom || p.fromPortfolio || !DEFAULT_PLATFORM_KEYS.includes(key)) {
                custom[key] = p;
            }
        }
        localStorage.setItem(LS_CUSTOM_PLATFORMS, JSON.stringify(custom));
        savePlatformCounts();
        syncStatsToServer();
    } catch (e) {}
}

async function syncWithPortfolio(interactive = false) {
    const dot = document.querySelector('.portfolio-dot');
    if (dot) dot.classList.add('syncing');

    if (interactive) {
        toast('Connecting to mitjain.vercel.app...', 'info');
    }

    try {
        const res = await fetch('https://mitjain.vercel.app/site-config.json?v=' + Date.now());
        if (res.ok) {
            const data = await res.json();
            if (data && data.cp && data.cp.platforms) {
                let syncedCount = 0;
                for (const [key, p] of Object.entries(data.cp.platforms)) {
                    if (key === 'cptracker') continue;
                    const exists = !!PLATFORMS[key];
                    if (!exists) {
                        PLATFORMS[key] = {
                            name: p.name || key,
                            handle: p.handle || 'luffyy01',
                            color: p.color || (key.startsWith('platform_') ? '#8b5cf6' : '#00d4aa'),
                            icon: p.icon || '🌐',
                            apiSupport: false,
                            url: p.url || '',
                            rating: p.rating || 0,
                            maxRating: p.maxRating || 0,
                            solved: p.solved || 0,
                            isCustom: true,
                            fromPortfolio: true
                        };
                        syncedCount++;
                    } else {
                        if (typeof p.solved === 'number' && p.solved > (PLATFORMS[key].solved || 0)) {
                            PLATFORMS[key].solved = p.solved;
                        }
                        if (p.rating && !PLATFORMS[key].rating) PLATFORMS[key].rating = p.rating;
                        if (p.maxRating && !PLATFORMS[key].maxRating) PLATFORMS[key].maxRating = p.maxRating;
                        if (p.url && !PLATFORMS[key].url) PLATFORMS[key].url = p.url;
                        if (p.handle && !PLATFORMS[key].handle) PLATFORMS[key].handle = p.handle;
                        syncedCount++;
                    }
                }

                saveCustomPlatforms();
                renderStatsBar();
                renderPlatformCards();
                populateFilterDropdown();
                populateFormPlatform();

                if (interactive) {
                    toast(`Connected to mitjain.vercel.app! ${syncedCount} platforms synchronized.`, 'success');
                }
            }
        } else if (interactive) {
            toast('Failed to reach mitjain.vercel.app', 'error');
        }
    } catch (e) {
        console.warn('Portfolio config sync note:', e);
        if (interactive) {
            toast('Connection error: ' + e.message, 'error');
        }
    } finally {
        if (dot) dot.classList.remove('syncing');
    }
}

async function syncStatsToServer() {
    try {
        const counts = {};
        for (const [key, p] of Object.entries(PLATFORMS)) {
            const subCount = submissions.filter(s => s.platform === key).length;
            const count = Math.max(subCount, p.solved || 0);
            counts[key] = {
                name: p.name,
                solved: key === 'cptracker' ? 0 : count,
                url: (typeof p.profileUrl === 'function' ? p.profileUrl(p.handle) : p.url) || '',
                handle: p.handle || '',
                rating: p.rating || 0,
                maxRating: p.maxRating || 0,
                color: p.color || '',
                icon: p.icon || '🌐',
                isCustom: !!p.isCustom
            };
        }
        if (counts.cptracker) {
            counts.cptracker.solved = 0;
        }

        const payload = JSON.stringify({ platforms: counts, lastSynced: new Date().toISOString() });
        const endpoints = ['/api/stats', 'https://cptrackermit.vercel.app/api/stats'];
        for (const ep of endpoints) {
            try {
                await fetch(ep, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: payload
                });
            } catch (e) {}
        }
    } catch (e) {}
}

async function autoInitialSync() {
    const cfSubs = submissions.filter(s => s.platform === 'codeforces');
    if (cfSubs.length >= 1400) return;
    try {
        const cfRes = await fetch(`/api/codeforces?handle=${encodeURIComponent(PLATFORMS.codeforces.handle)}`);
        if (cfRes.ok) {
            const cfData = await cfRes.json();
            if (cfData && Array.isArray(cfData.submissions) && cfData.submissions.length > 0) {
                mergeSubmissions(cfData.submissions);
                PLATFORMS.codeforces.solved = cfData.acceptedSubmissions || cfData.uniqueSolved || cfData.submissions.length;
                if (cfData.rating) PLATFORMS.codeforces.rating = cfData.rating;
                if (cfData.maxRating) PLATFORMS.codeforces.maxRating = cfData.maxRating;
                saveToStorage();
                renderPlatformCards();
                renderStatsBar();
                applyFilters();
            }
        }
    } catch (e) {
        console.warn('Initial auto-sync error:', e);
    }
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

// ─── Problem Link Autofetch ─────────────────────────────────
let autofetchAbortCtrl = null;

async function handleLinkAutofetch() {
    const linkInput = document.getElementById('form-link');
    const nameInput = document.getElementById('form-name');
    const platSelect = document.getElementById('form-platform');
    const diffInput = document.getElementById('form-difficulty');
    const tagsInput = document.getElementById('form-tags');
    const statusEl = document.getElementById('link-autofetch-status');

    if (!linkInput) return;
    const url = linkInput.value.trim();
    if (!url || !url.startsWith('http')) {
        if (statusEl) statusEl.style.display = 'none';
        return;
    }

    // Fast client-side regex parsing for instant UX
    try {
        const u = new URL(url);
        const host = u.hostname.toLowerCase();
        const path = u.pathname;

        if (host.includes('leetcode.com')) {
            if (platSelect && PLATFORMS.leetcode) platSelect.value = 'leetcode';
            const m = path.match(/\/problems\/([^\/]+)/);
            if (m && m[1] && (!nameInput.value || nameInput.dataset.autofilled === 'true')) {
                const words = m[1].replace(/[-_]+/g, ' ').split(' ').filter(Boolean)
                    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
                nameInput.value = words;
                nameInput.dataset.autofilled = 'true';
            }
        } else if (host.includes('codeforces.com')) {
            if (platSelect && PLATFORMS.codeforces) platSelect.value = 'codeforces';
            const m = path.match(/\/(?:contest|gym|problemset\/problem)\/(\d+)\/(?:problem\/)?([A-Za-z0-9]+)/);
            if (m && (!nameInput.value || nameInput.dataset.autofilled === 'true')) {
                nameInput.value = `${m[2].toUpperCase()}. Problem ${m[1]}${m[2].toUpperCase()}`;
                nameInput.dataset.autofilled = 'true';
            }
        } else if (host.includes('codechef.com')) {
            if (platSelect && PLATFORMS.codechef) platSelect.value = 'codechef';
            const m = path.match(/\/problems\/([^\/\?#]+)/);
            if (m && (!nameInput.value || nameInput.dataset.autofilled === 'true')) {
                nameInput.value = m[1];
                nameInput.dataset.autofilled = 'true';
            }
        } else if (host.includes('atcoder.jp')) {
            if (platSelect && PLATFORMS.atcoder) platSelect.value = 'atcoder';
        } else if (host.includes('cses.fi')) {
            if (platSelect && PLATFORMS.cses) platSelect.value = 'cses';
        } else if (host.includes('geeksforgeeks.org')) {
            if (platSelect && PLATFORMS.gfg) platSelect.value = 'gfg';
        }
    } catch (e) {}

    // Show fetching indicator
    if (statusEl) {
        statusEl.style.display = 'block';
        statusEl.style.color = 'var(--accent)';
        statusEl.innerHTML = '⚡ Autofetching problem details...';
    }

    if (autofetchAbortCtrl) {
        try { autofetchAbortCtrl.abort(); } catch (e) {}
    }
    autofetchAbortCtrl = new AbortController();

    try {
        const res = await fetch(`/api/problem-info?url=${encodeURIComponent(url)}`, {
            signal: autofetchAbortCtrl.signal
        });
        if (res.ok) {
            const data = await res.json();
            if (data && data.success) {
                if (data.problemName && nameInput) {
                    nameInput.value = data.problemName;
                    nameInput.dataset.autofilled = 'true';
                }
                if (data.platform && platSelect && PLATFORMS[data.platform]) {
                    platSelect.value = data.platform;
                }
                if (data.difficulty && diffInput && (!diffInput.value || diffInput.dataset.autofilled === 'true')) {
                    diffInput.value = data.difficulty;
                    diffInput.dataset.autofilled = 'true';
                }
                if (data.tags && data.tags.length > 0 && tagsInput && (!tagsInput.value || tagsInput.dataset.autofilled === 'true')) {
                    tagsInput.value = data.tags.join(', ');
                    tagsInput.dataset.autofilled = 'true';
                }
                if (statusEl) {
                    statusEl.style.color = 'var(--green)';
                    statusEl.innerHTML = `✓ Autofetched: ${escapeHtml(data.problemName)}`;
                    setTimeout(() => {
                        if (statusEl && statusEl.innerHTML.includes('Autofetched')) {
                            statusEl.style.display = 'none';
                        }
                    }, 4000);
                }
            }
        } else {
            if (statusEl) statusEl.style.display = 'none';
        }
    } catch (err) {
        if (err.name !== 'AbortError' && statusEl) {
            statusEl.style.display = 'none';
        }
    }
}

// ─── One-Click Quick Mark as Solved ─────────────────────────
let newlyAddedSubId = null;

function slugToTitle(slug) {
    if (!slug) return '';
    return slug
        .replace(/[-_]+/g, ' ')
        .split(' ')
        .filter(Boolean)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
}

function normalizeProblemUrl(raw) {
    if (!raw) return '';
    let str = raw.trim();
    if (!str.startsWith('http://') && !str.startsWith('https://')) {
        str = 'https://' + str;
    }
    try {
        const u = new URL(str);
        return `${u.origin}${u.pathname.replace(/\/+$/, '')}`;
    } catch (e) {
        return str.replace(/\/+$/, '');
    }
}

function detectPlatformAndNameFromUrl(rawUrl) {
    let url = (rawUrl || '').trim();
    if (!url) return null;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
    }

    let platform = 'other';
    let problemName = '';
    let difficulty = '';
    let tags = [];

    try {
        const u = new URL(url);
        const host = u.hostname.toLowerCase();
        const path = u.pathname;

        if (host.includes('leetcode.com')) {
            platform = 'leetcode';
            const m = path.match(/\/problems\/([^\/]+)/);
            if (m && m[1]) {
                problemName = slugToTitle(m[1]);
            }
        } else if (host.includes('codeforces.com')) {
            platform = 'codeforces';
            const m = path.match(/(?:group\/([^\/]+)\/contest|contest|gym|problemset\/problem)\/(\d+)\/(?:problem\/)?([A-Za-z0-9]+)/);
            if (m) {
                const grp = m[1];
                const cid = m[2];
                const idx = m[3].toUpperCase();
                problemName = `${idx}. Problem ${cid}${idx}`;
                if (grp) tags.push('Private Group');
            }
        } else if (host.includes('codechef.com')) {
            platform = 'codechef';
            const m = path.match(/\/problems\/([^\/\?#]+)/);
            if (m && m[1]) {
                problemName = m[1].toUpperCase();
            }
        } else if (host.includes('atcoder.jp')) {
            platform = 'atcoder';
            const m = path.match(/\/tasks\/([^\/\?#]+)/);
            if (m && m[1]) {
                problemName = m[1].toUpperCase().replace('_', ' ');
            }
        } else if (host.includes('cses.fi')) {
            platform = 'cses';
            const m = path.match(/\/task\/(\d+)/);
            if (m && m[1]) {
                problemName = `CSES ${m[1]}`;
            }
        } else if (host.includes('geeksforgeeks.org')) {
            platform = 'gfg';
            const m = path.match(/\/problems\/([^\/\?#]+)/);
            if (m && m[1]) {
                problemName = slugToTitle(m[1].replace(/-\d{6,}$/, ''));
            }
        } else if (host.includes('vjudge.net')) {
            platform = 'vjudge';
            const m = path.match(/\/problem\/([^\/\?#]+)/);
            if (m && m[1]) {
                problemName = m[1].replace(/[-_]+/g, ' ');
            }
        } else if (host.includes('spoj.com')) {
            platform = 'spoj';
            const m = path.match(/\/problems\/([^\/\?#]+)/);
            if (m && m[1]) {
                problemName = m[1].toUpperCase();
            }
        } else {
            const parts = host.replace(/^www\./, '').split('.');
            platform = parts[0] || 'other';
            const segments = path.split('/').filter(Boolean);
            if (segments.length > 0) {
                problemName = slugToTitle(segments[segments.length - 1]);
            }
        }
    } catch (e) {}

    return { url, platform, problemName, difficulty, tags };
}

function updateQuickPreview(info) {
    const previewEl = document.getElementById('quick-solve-preview');
    if (!previewEl) return;

    if (!info || (!info.platform && !info.problemName)) {
        previewEl.style.display = 'none';
        previewEl.innerHTML = '';
        return;
    }

    const p = PLATFORMS[info.platform] || { name: (info.platform || 'Platform').toUpperCase(), icon: '🌐', color: 'var(--accent)' };
    const pIcon = p.icon || '🌐';
    const pName = p.name || info.platform;
    const diffBadge = info.difficulty ? `<span class="quick-preview-diff ${getDifficultyClass(info.difficulty)}" style="background:rgba(255,255,255,0.06);">${escHtml(info.difficulty)}</span>` : '';
    const tagsHtml = (info.tags || []).slice(0, 3).map(t => `<span class="tag">${escHtml(t)}</span>`).join('');

    previewEl.innerHTML = `
        <span class="quick-preview-badge" style="color:${p.color || 'var(--accent)'}; border-color:${p.color || 'var(--border)'};">
            ${pIcon} ${escHtml(pName)}
        </span>
        <span class="quick-preview-name">${escHtml(info.problemName || 'Detecting problem name...')}</span>
        ${diffBadge}
        ${tagsHtml ? `<span class="quick-preview-tags">${tagsHtml}</span>` : ''}
    `;
    previewEl.style.display = 'flex';
}

function showQuickStatus(msg, type = 'info') {
    const el = document.getElementById('quick-solve-status');
    if (!el) return;
    el.className = `quick-solve-status ${type}`;
    el.innerHTML = msg;
    el.style.display = 'flex';
}

async function executeQuickSolve() {
    const input = document.getElementById('quick-solve-input');
    const btn = document.getElementById('btn-quick-solve');
    const spinner = document.getElementById('quick-solve-spinner');
    const statusEl = document.getElementById('quick-solve-status');
    const previewEl = document.getElementById('quick-solve-preview');

    if (!input) return;
    let rawText = input.value.trim();
    if (!rawText) {
        showQuickStatus('⚠️ Please paste a problem link first!', 'error');
        input.focus();
        return;
    }

    // Extract all URLs (supports single link or multiple newline/space separated links)
    let urls = rawText.match(/https?:\/\/[^\s"',;>)]+/gi) || [];
    if (urls.length === 0) {
        if (rawText.includes('.') && !rawText.includes(' ')) {
            urls = ['https://' + rawText];
        } else {
            showQuickStatus('⚠️ Please enter a valid URL (e.g. https://cses.fi/problemset/task/1068)', 'error');
            input.focus();
            return;
        }
    }

    // --- BULK MODE (multiple URLs pasted at once) ---
    if (urls.length > 1) {
        if (btn) {
            btn.disabled = true;
            const btnText = btn.querySelector('.btn-text');
            if (btnText) btnText.textContent = `⚡ Adding ${urls.length} problems...`;
            if (spinner) spinner.style.display = 'inline-block';
        }
        input.disabled = true;
        showQuickStatus(`⚡ Bulk processing ${urls.length} problem links...`, 'info');

        let addedCount = 0;
        const platformCounts = {};

        for (let i = 0; i < urls.length; i++) {
            const u = urls[i];
            const info = detectPlatformAndNameFromUrl(u) || {};
            const plat = info.platform || 'other';
            let name = info.problemName;

            // Fast lookup with 2s timeout
            try {
                const ctrl = new AbortController();
                const tid = setTimeout(() => ctrl.abort(), 2000);
                const res = await fetch(`/api/problem-info?url=${encodeURIComponent(u)}`, { signal: ctrl.signal });
                clearTimeout(tid);
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.success) {
                        if (data.problemName) name = data.problemName;
                        if (data.difficulty) info.difficulty = data.difficulty;
                        if (data.tags) info.tags = data.tags;
                    }
                }
            } catch (e) {}

            if (!name) {
                const seg = u.split('/').filter(Boolean);
                name = slugToTitle(seg[seg.length - 1]) || `Problem ${i + 1}`;
            }

            if (!PLATFORMS[plat]) {
                PLATFORMS[plat] = {
                    name: plat.charAt(0).toUpperCase() + plat.slice(1),
                    handle: 'user',
                    color: '#00d4aa',
                    icon: '🌐',
                    apiSupport: false,
                    url: u,
                    solved: 0,
                    isCustom: true
                };
            }

            const cleanU = normalizeProblemUrl(u);
            const exists = submissions.some(s => s.problemLink && normalizeProblemUrl(s.problemLink) === cleanU);
            if (!exists) {
                const newId = generateId();
                submissions.unshift({
                    id: newId,
                    platform: plat,
                    problemName: name,
                    problemLink: u,
                    submissionLink: '',
                    solutions: [],
                    difficulty: info.difficulty || 'Medium',
                    tags: info.tags || [],
                    language: 'C++',
                    date: new Date().toISOString().split('T')[0],
                    source: 'manual',
                    verdict: 'OK'
                });
                addedCount++;
                platformCounts[plat] = (platformCounts[plat] || 0) + 1;
            }
        }

        for (const [pKey, cnt] of Object.entries(platformCounts)) {
            const subCount = submissions.filter(s => s.platform === pKey).length;
            PLATFORMS[pKey].solved = Math.max((PLATFORMS[pKey].solved || 0) + cnt, subCount);
            if (!DEFAULT_PLATFORM_KEYS.includes(pKey)) PLATFORMS[pKey].isCustom = true;
        }

        savePlatformCounts();
        saveCustomPlatforms();
        saveToStorage();

        currentPage = 1;
        renderStatsBar();
        renderPlatformCards();
        applyFilters();
        syncStatsToServer();

        let totalSolved = 0;
        for (const [k, p] of Object.entries(PLATFORMS)) {
            if (k === 'cptracker') continue;
            const subCount = submissions.filter(s => s.platform === k).length;
            totalSolved += Math.max(subCount, p.solved || 0);
        }

        input.value = '';
        input.disabled = false;
        const clearBtn = document.getElementById('quick-clear-btn');
        if (clearBtn) clearBtn.style.display = 'none';

        if (btn) {
            btn.disabled = false;
            const btnText = btn.querySelector('.btn-text');
            if (btnText) btnText.textContent = '⚡ Mark Solved';
            if (spinner) spinner.style.display = 'none';
        }

        showQuickStatus(`🎉 Successfully marked <strong>${addedCount}</strong> problems solved! (Total Solved: <strong>${totalSolved}</strong>)`, 'success');
        toast(`🎉 Added ${addedCount} solved problems to CP Tracker!`, 'success');
        return;
    }

    // --- SINGLE URL MODE ---
    let url = urls[0];
    input.value = url;

    // Set UI loading state
    if (btn) {
        btn.disabled = true;
        const btnText = btn.querySelector('.btn-text');
        if (btnText) btnText.textContent = '⚡ Marking Solved...';
        if (spinner) spinner.style.display = 'inline-block';
    }
    input.disabled = true;
    showQuickStatus('⚡ Auto-detecting problem details from link & marking as solved...', 'info');

    // Fast client-side preliminary heuristics
    const initialInfo = detectPlatformAndNameFromUrl(url) || {};
    updateQuickPreview(initialInfo);

    let detectedPlatform = initialInfo.platform || 'other';
    let detectedName = initialInfo.problemName || '';
    let detectedDifficulty = initialInfo.difficulty || '';
    let detectedTags = initialInfo.tags || [];

    // Call /api/problem-info to get official name, rating/difficulty, and tags
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6500);

        const res = await fetch(`/api/problem-info?url=${encodeURIComponent(url)}`, {
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (res.ok) {
            const data = await res.json();
            if (data && data.success) {
                if (data.platform) detectedPlatform = data.platform;
                if (data.problemName) detectedName = data.problemName;
                if (data.difficulty) detectedDifficulty = data.difficulty;
                if (Array.isArray(data.tags) && data.tags.length > 0) {
                    detectedTags = Array.from(new Set([...detectedTags, ...data.tags]));
                }
            }
        }
    } catch (e) {
        console.warn('Quick solve autofetch note:', e.message);
    }

    if (!detectedName) {
        const seg = url.split('/').filter(Boolean);
        detectedName = initialInfo.problemName || slugToTitle(seg[seg.length - 1]) || 'New Problem';
    }

    // Ensure platform exists in PLATFORMS
    if (!PLATFORMS[detectedPlatform]) {
        const pName = detectedPlatform.charAt(0).toUpperCase() + detectedPlatform.slice(1);
        PLATFORMS[detectedPlatform] = {
            name: pName,
            handle: 'user',
            color: '#00d4aa',
            icon: '🌐',
            apiSupport: false,
            url: url,
            solved: 0,
            isCustom: true
        };
        populateFilterDropdown();
        populateFormPlatform();
    }

    // Check if duplicate
    const cleanCurrentUrl = normalizeProblemUrl(url);
    const existingIndex = submissions.findIndex(s => {
        if (s.problemLink && normalizeProblemUrl(s.problemLink) === cleanCurrentUrl) return true;
        if (s.problemName && detectedName && s.problemName.toLowerCase().trim() === detectedName.toLowerCase().trim() && s.platform === detectedPlatform) return true;
        return false;
    });

    const isDuplicate = existingIndex >= 0;

    // Create new submission entry
    const newId = generateId();
    const newSub = {
        id: newId,
        platform: detectedPlatform,
        problemName: detectedName,
        problemLink: url,
        submissionLink: '',
        solutions: [],
        difficulty: detectedDifficulty || 'Medium',
        tags: detectedTags,
        language: 'C++',
        date: new Date().toISOString().split('T')[0],
        source: 'manual',
        verdict: 'OK'
    };

    submissions.unshift(newSub);
    newlyAddedSubId = newId;

    // Auto-increment platform solved count
    const currentSubCount = submissions.filter(s => s.platform === detectedPlatform).length;
    PLATFORMS[detectedPlatform].solved = Math.max((PLATFORMS[detectedPlatform].solved || 0) + 1, currentSubCount);
    if (!DEFAULT_PLATFORM_KEYS.includes(detectedPlatform)) {
        PLATFORMS[detectedPlatform].isCustom = true;
    }

    // Save and re-render
    savePlatformCounts();
    saveCustomPlatforms();
    saveToStorage();

    // Reset pagination to first page so user sees new entry
    currentPage = 1;
    renderStatsBar();
    renderPlatformCards();
    applyFilters();
    syncStatsToServer(); // Auto-pushes immediately to /api/stats for Portfolio!

    // Calculate total solved
    let totalSolved = 0;
    for (const [k, p] of Object.entries(PLATFORMS)) {
        if (k === 'cptracker') continue;
        const subCount = submissions.filter(s => s.platform === k).length;
        totalSolved += Math.max(subCount, p.solved || 0);
    }

    const platName = PLATFORMS[detectedPlatform]?.name || detectedPlatform;
    const celebrationMsg = isDuplicate
        ? `✓ Marked as solved! <strong>${escHtml(detectedName)}</strong> updated (+1 ${escHtml(platName)}, Total Solved: <strong>${totalSolved}</strong>)`
        : `🎉 Marked as solved! <strong>${escHtml(detectedName)}</strong> added to ${escHtml(platName)} (+1, Total Solved: <strong>${totalSolved}</strong>)`;

    showQuickStatus(celebrationMsg, 'success');
    toast(`✓ Solved: "${detectedName}" marked solved on ${platName}! (+1)`, 'success');

    // Reset input & controls
    input.value = '';
    input.disabled = false;
    const clearBtn = document.getElementById('quick-clear-btn');
    if (clearBtn) clearBtn.style.display = 'none';

    if (btn) {
        btn.disabled = false;
        const btnText = btn.querySelector('.btn-text');
        if (btnText) btnText.textContent = '⚡ Mark Solved';
        if (spinner) spinner.style.display = 'none';
    }

    // Update preview with final resolved details
    updateQuickPreview({
        platform: detectedPlatform,
        problemName: detectedName,
        difficulty: detectedDifficulty,
        tags: detectedTags
    });

    // Fade out preview & success status after 7 seconds
    setTimeout(() => {
        if (previewEl && input.value === '') previewEl.style.display = 'none';
        if (statusEl && statusEl.classList.contains('success')) statusEl.style.display = 'none';
    }, 7000);

    // Remove row highlight after 4 seconds
    setTimeout(() => {
        newlyAddedSubId = null;
        const trs = document.querySelectorAll('tr.row-new-highlight');
        trs.forEach(tr => tr.classList.remove('row-new-highlight'));
    }, 4000);
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

    // Problem Link Autofetch in modal
    const formLinkInput = document.getElementById('form-link');
    if (formLinkInput) {
        formLinkInput.addEventListener('input', debounce(handleLinkAutofetch, 250));
        formLinkInput.addEventListener('paste', () => setTimeout(handleLinkAutofetch, 50));
        formLinkInput.addEventListener('change', handleLinkAutofetch);
    }

    // One-Click Quick Solve Bar
    const quickInput = document.getElementById('quick-solve-input');
    const quickBtn = document.getElementById('btn-quick-solve');
    const quickClearBtn = document.getElementById('quick-clear-btn');
    const quickPasteBtn = document.getElementById('quick-paste-btn');

    if (quickBtn) {
        quickBtn.addEventListener('click', executeQuickSolve);
    }
    if (quickInput) {
        quickInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                executeQuickSolve();
            }
        });
        quickInput.addEventListener('input', () => {
            const val = quickInput.value.trim();
            if (quickClearBtn) quickClearBtn.style.display = val ? 'flex' : 'none';
            if (val) {
                const info = detectPlatformAndNameFromUrl(val);
                updateQuickPreview(info);
            } else {
                updateQuickPreview(null);
                const status = document.getElementById('quick-solve-status');
                if (status) status.style.display = 'none';
            }
        });
        quickInput.addEventListener('paste', () => {
            setTimeout(() => {
                const val = quickInput.value.trim();
                if (quickClearBtn) quickClearBtn.style.display = val ? 'flex' : 'none';
                if (val) {
                    const info = detectPlatformAndNameFromUrl(val);
                    updateQuickPreview(info);
                }
            }, 30);
        });
    }
    if (quickClearBtn) {
        quickClearBtn.addEventListener('click', () => {
            quickInput.value = '';
            quickClearBtn.style.display = 'none';
            updateQuickPreview(null);
            const status = document.getElementById('quick-solve-status');
            if (status) status.style.display = 'none';
            quickInput.focus();
        });
    }
    if (quickPasteBtn) {
        quickPasteBtn.addEventListener('click', async () => {
            try {
                if (navigator.clipboard && navigator.clipboard.readText) {
                    const text = await navigator.clipboard.readText();
                    if (text && text.trim()) {
                        quickInput.value = text.trim();
                        if (quickClearBtn) quickClearBtn.style.display = 'flex';
                        const info = detectPlatformAndNameFromUrl(text.trim());
                        updateQuickPreview(info);
                        // True 1-click: paste and solve immediately!
                        executeQuickSolve();
                    } else {
                        toast('Clipboard is empty. Please copy a problem link first!', 'error');
                    }
                } else {
                    quickInput.focus();
                    toast('Please paste your link with Ctrl+V / Cmd+V', 'info');
                }
            } catch (err) {
                quickInput.focus();
            }
        });
    }

    // Platform Management & Portfolio Connection
    const btnAddPlat = document.getElementById('btn-add-platform');
    if (btnAddPlat) btnAddPlat.addEventListener('click', () => openPlatformModal());
    const btnConnPort = document.getElementById('btn-connect-portfolio');
    if (btnConnPort) btnConnPort.addEventListener('click', () => syncWithPortfolio(true));
    const btnPlatClose = document.getElementById('platform-modal-close');
    if (btnPlatClose) btnPlatClose.addEventListener('click', closePlatformModal);
    const btnPlatCancel = document.getElementById('btn-cancel-platform');
    if (btnPlatCancel) btnPlatCancel.addEventListener('click', closePlatformModal);
    const btnPlatDel = document.getElementById('btn-delete-platform');
    if (btnPlatDel) btnPlatDel.addEventListener('click', handleDeletePlatform);
    const platForm = document.getElementById('platform-form');
    if (platForm) platForm.addEventListener('submit', handlePlatformFormSubmit);
    const platColorInput = document.getElementById('platform-form-color');
    if (platColorInput) {
        platColorInput.addEventListener('input', (e) => {
            const hexEl = document.getElementById('platform-color-hex');
            if (hexEl) hexEl.textContent = e.target.value;
        });
    }
    const platOverlay = document.getElementById('platform-modal-overlay');
    if (platOverlay) {
        platOverlay.addEventListener('click', (e) => {
            if (e.target === e.currentTarget) closePlatformModal();
        });
    }

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
            closePlatformModal();
        }
        if (e.key === 'n' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); openModal(); }
    });
}

// ─── Stats Bar ──────────────────────────────────────────────
function renderStatsBar() {
    const bar = document.getElementById('stats-bar');
    let platformSum = 0;
    for (const [key, p] of Object.entries(PLATFORMS)) {
        if (key === 'cptracker') continue;
        const subCount = submissions.filter(s => s.platform === key).length;
        platformSum += Math.max(subCount, p.solved || 0);
    }
    const totalSolved = platformSum;
    const autoCount = submissions.filter(s => s.source === 'auto').length;
    const manualCount = submissions.filter(s => s.source === 'manual').length;
    const platformCount = new Set([...submissions.map(s => s.platform), ...Object.keys(PLATFORMS)]).size;
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
        const subCount = submissions.filter(s => s.platform === key).length;
        const count = Math.max(subCount, p.solved || 0);
        const card = document.createElement('div');
        card.className = `platform-card${activePlatformFilter === key ? ' active' : ''}`;
        card.style.setProperty('--platform-color', p.color || '#00d4aa');
        card.dataset.platform = key;

        let ratingHtml = '';
        if (p.rating || p.maxRating) {
            ratingHtml = `<div class="platform-meta">Rating: ${p.rating || '–'} (max: ${p.maxRating || '–'})</div>`;
        }

        const isCustom = p.isCustom || p.fromPortfolio || !DEFAULT_PLATFORM_KEYS.includes(key);

        card.innerHTML = `
            <div class="platform-header">
                <span class="platform-name">
                    <span class="platform-icon">${p.icon || '🌐'}</span>
                    ${p.name}
                </span>
                <span class="platform-badge ${p.apiSupport ? '' : 'manual'}">${p.apiSupport ? 'API' : (isCustom ? 'Custom' : 'Manual')}</span>
            </div>
            <div class="platform-solved">${count}</div>
            <div class="platform-meta">problems solved</div>
            ${ratingHtml}
            <div class="platform-actions">
                <a class="platform-link" href="${p.url || '#'}" target="_blank" onclick="event.stopPropagation()">
                    @${p.handle || 'user'}
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                </a>
                <div class="platform-btn-group" onclick="event.stopPropagation()">
                    <button class="btn-platform-action btn-add-sub-quick" data-add-platform="${key}" title="Add question for ${p.name}">+ Add Q</button>
                    <button class="btn-platform-action btn-edit-platform" data-edit-platform="${key}" title="Manage ${p.name}">⚙️</button>
                </div>
            </div>
        `;

        // Direct Action Buttons
        const addBtn = card.querySelector('.btn-add-sub-quick');
        if (addBtn) {
            addBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openModal(null, key);
            });
        }

        const editBtn = card.querySelector('.btn-edit-platform');
        if (editBtn) {
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openPlatformModal(key);
            });
        }

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

// ─── Platform Modal Logic ────────────────────────────────────
function openPlatformModal(key = null) {
    const overlay = document.getElementById('platform-modal-overlay');
    const title = document.getElementById('platform-modal-title');
    const form = document.getElementById('platform-form');
    const delBtn = document.getElementById('btn-delete-platform');
    
    editingPlatformKey = key;
    if (key && PLATFORMS[key]) {
        const p = PLATFORMS[key];
        title.textContent = `Edit Platform: ${p.name}`;
        document.getElementById('platform-form-key').value = key;
        document.getElementById('platform-form-name').value = p.name;
        document.getElementById('platform-form-icon').value = p.icon || '🌐';
        document.getElementById('platform-form-handle').value = p.handle || '';
        document.getElementById('platform-form-solved').value = p.solved || 0;
        document.getElementById('platform-form-url').value = p.url || '';
        document.getElementById('platform-form-rating').value = p.rating || '';
        document.getElementById('platform-form-max-rating').value = p.maxRating || '';
        document.getElementById('platform-form-color').value = p.color || '#00d4aa';
        document.getElementById('platform-color-hex').textContent = p.color || '#00d4aa';
        delBtn.style.display = DEFAULT_PLATFORM_KEYS.includes(key) ? 'none' : 'block';
    } else {
        editingPlatformKey = null;
        title.textContent = 'Add CP Platform';
        form.reset();
        document.getElementById('platform-form-key').value = '';
        document.getElementById('platform-form-icon').value = '🌐';
        document.getElementById('platform-form-color').value = '#00d4aa';
        document.getElementById('platform-color-hex').textContent = '#00d4aa';
        delBtn.style.display = 'none';
    }

    overlay.classList.add('open');
    setTimeout(() => document.getElementById('platform-form-name').focus(), 150);
}

function closePlatformModal() {
    const overlay = document.getElementById('platform-modal-overlay');
    if (overlay) overlay.classList.remove('open');
    editingPlatformKey = null;
}

function handlePlatformFormSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('platform-form-name').value.trim();
    if (!name) return;

    let key = document.getElementById('platform-form-key').value.trim();
    if (!key) {
        const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
        key = `platform_${slug}_${Date.now()}`;
    }

    const icon = document.getElementById('platform-form-icon').value.trim() || '🌐';
    const handle = document.getElementById('platform-form-handle').value.trim() || 'luffyy01';
    const solved = parseInt(document.getElementById('platform-form-solved').value) || 0;
    const url = document.getElementById('platform-form-url').value.trim();
    const rating = parseInt(document.getElementById('platform-form-rating').value) || 0;
    const maxRating = parseInt(document.getElementById('platform-form-max-rating').value) || 0;
    const color = document.getElementById('platform-form-color').value || '#00d4aa';

    const existing = PLATFORMS[key] || {};
    PLATFORMS[key] = {
        ...existing,
        name,
        handle,
        icon,
        solved,
        url,
        rating,
        maxRating,
        color,
        isCustom: true,
        apiSupport: existing.apiSupport || false
    };

    saveCustomPlatforms();
    renderStatsBar();
    renderPlatformCards();
    populateFilterDropdown();
    populateFormPlatform();
    closePlatformModal();

    toast(`Platform "${name}" saved & synced with Portfolio!`, 'success');
}

function handleDeletePlatform() {
    if (!editingPlatformKey || !PLATFORMS[editingPlatformKey]) return;
    const p = PLATFORMS[editingPlatformKey];
    if (confirm(`Are you sure you want to delete "${p.name}"?`)) {
        delete PLATFORMS[editingPlatformKey];
        saveCustomPlatforms();
        renderStatsBar();
        renderPlatformCards();
        populateFilterDropdown();
        populateFormPlatform();
        closePlatformModal();
        toast(`Platform "${p.name}" deleted.`, 'info');
    }
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
function levenshtein(a, b) {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    return matrix[b.length][a.length];
}

function matchesSearch(text, query) {
    if (!query) return true;
    const t = text.toLowerCase();
    const q = query.toLowerCase().trim();
    if (t.includes(q)) return true;

    const words = t.split(/[^a-z0-9]+/).filter(Boolean);
    const qWords = q.split(/[^a-z0-9]+/).filter(Boolean);

    return qWords.every(qw => {
        if (qw.length <= 2) return t.includes(qw);
        if (qw.length >= 4) {
            const prefix = qw.slice(0, 4);
            if (words.some(w => w.startsWith(prefix))) return true;
        }
        return words.some(w => {
            if (Math.abs(w.length - qw.length) > 2) return false;
            return levenshtein(w, qw) <= 2;
        });
    });
}

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
                s.problemLink || '',
                s.submissionLink || '',
                s.groupId || '',
                ...(s.tags || []),
                ...(s.solutions || []).map(sol => sol.title + ' ' + sol.code)
            ].join(' ');
            if (!matchesSearch(haystack, search)) return false;
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

        const isNew = s.id === newlyAddedSubId;
        return `<tr${isNew ? ' class="row-new-highlight"' : ''}>
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

    const nameInput = document.getElementById('form-name');
    if (nameInput) delete nameInput.dataset.autofilled;
    const diffInput = document.getElementById('form-difficulty');
    if (diffInput) delete diffInput.dataset.autofilled;
    const tagsInput = document.getElementById('form-tags');
    if (tagsInput) delete tagsInput.dataset.autofilled;
    const statusEl = document.getElementById('link-autofetch-status');
    if (statusEl) statusEl.style.display = 'none';

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
    if (autofetchAbortCtrl) {
        try { autofetchAbortCtrl.abort(); } catch (e) {}
    }
    const statusEl = document.getElementById('link-autofetch-status');
    if (statusEl) statusEl.style.display = 'none';
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
            const oldPlatform = submissions[idx].platform;
            submissions[idx] = { ...submissions[idx], ...data };
            if (oldPlatform !== data.platform && PLATFORMS[data.platform]) {
                const subCount = submissions.filter(s => s.platform === data.platform).length;
                PLATFORMS[data.platform].solved = Math.max((PLATFORMS[data.platform].solved || 0) + 1, subCount);
                if (!PLATFORMS[data.platform].isCustom && !DEFAULT_PLATFORM_KEYS.includes(data.platform)) {
                    PLATFORMS[data.platform].isCustom = true;
                }
            }
            toast('Submission updated', 'success');
        }
    } else {
        data.id = generateId();
        submissions.unshift(data);

        // Auto-increment the solved count for this platform and update total count!
        const pKey = data.platform;
        if (PLATFORMS[pKey]) {
            const currentSubCount = submissions.filter(s => s.platform === pKey).length;
            PLATFORMS[pKey].solved = Math.max((PLATFORMS[pKey].solved || 0) + 1, currentSubCount);
            if (!PLATFORMS[pKey].isCustom && !DEFAULT_PLATFORM_KEYS.includes(pKey)) {
                PLATFORMS[pKey].isCustom = true;
            }
        }
        toast(`Submission added! ${PLATFORMS[pKey]?.name || pKey} count auto-incremented (+1).`, 'success');
    }

    saveCustomPlatforms();
    saveToStorage();
    closeModal();
    renderStatsBar();
    renderPlatformCards();
    applyFilters();
    syncStatsToServer(); // Auto-pushes immediately to /api/stats for Portfolio!
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
    const sub = submissions.find(s => s.id === id);
    submissions = submissions.filter(s => s.id !== id);
    if (sub && PLATFORMS[sub.platform] && PLATFORMS[sub.platform].isCustom) {
        const currentCount = submissions.filter(s => s.platform === sub.platform).length;
        if (PLATFORMS[sub.platform].solved > currentCount) {
            PLATFORMS[sub.platform].solved = Math.max(0, PLATFORMS[sub.platform].solved - 1);
            saveCustomPlatforms();
        }
    }
    saveToStorage();
    renderStatsBar();
    renderPlatformCards();
    applyFilters();
    syncStatsToServer();
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
    renderStatsBar();
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
            (s.id && ns.id && s.id === ns.id) ||
            (s.platform === ns.platform && (
                (s.submissionLink && ns.submissionLink && s.submissionLink === ns.submissionLink) ||
                (s.problemLink && ns.problemLink && s.problemLink === ns.problemLink && (!s.submissionLink || !ns.submissionLink)) ||
                (!s.problemLink && !ns.problemLink && s.problemName === ns.problemName)
            ))
        );
        if (!exists) {
            submissions.push(ns);
        }
    }
}

// ─── Codeforces API ─────────────────────────────────────────
async function fetchCodeforces() {
    const handle = PLATFORMS.codeforces.handle;

    // First try our dedicated serverless API (signed with API key/secret, handles NTP clock & all private groups)
    try {
        const serverRes = await fetch(`/api/codeforces?handle=${encodeURIComponent(handle)}`);
        if (serverRes.ok) {
            const serverData = await serverRes.json();
            if (serverData.success && Array.isArray(serverData.submissions)) {
                if (serverData.rating) PLATFORMS.codeforces.rating = serverData.rating;
                if (serverData.maxRating) PLATFORMS.codeforces.maxRating = serverData.maxRating;
                PLATFORMS.codeforces.solved = Math.max(serverData.uniqueSolved || 0, serverData.submissions.length, PLATFORMS.codeforces.solved || 0);
                return serverData.submissions.map(s => ({
                    ...s,
                    id: s.id || generateId()
                }));
            }
        }
    } catch (e) {
        console.warn('Serverless CF fetch note:', e.message);
    }

    // Direct browser fallback with user credentials
    const apiKey = "802d01e31c9c9a038bdacc79fe8097f195cb425e";
    const apiSecret = "6b89fd9e78fc3636236ca7e5a4d16b7b1b5292b1";

    let data = null;
    try {
        const time = Math.floor(Date.now() / 1000);
        const rand = Math.random().toString(36).substring(2, 8).padStart(6, '0');
        const params = `apiKey=${apiKey}&handle=${handle}&time=${time}`;
        const base = `${rand}/user.status?${params}#${apiSecret}`;

        const msgBuffer = new TextEncoder().encode(base);
        const hashBuffer = await crypto.subtle.digest('SHA-512', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        const apiSig = `${rand}${hashHex}`;

        const res = await fetch(`https://codeforces.com/api/user.status?${params}&apiSig=${apiSig}`);
        data = await res.json();
    } catch (e) {
        console.warn('Authenticated CF fetch error, falling back to public:', e);
    }

    if (!data || data.status !== 'OK') {
        const fallbackRes = await fetch(`https://codeforces.com/api/user.status?handle=${handle}`);
        data = await fallbackRes.json();
    }

    if (data.status !== 'OK') throw new Error(data.comment || 'API Error');

    const subs = [];
    const defaultGroupId = 'nqUiki1EgM';

    for (const sub of data.result) {
        if (sub.verdict !== 'OK') continue;
        const prob = sub.problem;
        if (!prob) continue;

        const isPrivateGroup = prob.contestId >= 600000;
        const isGym = prob.contestId >= 100000 && prob.contestId < 600000;

        let probLink = '';
        let subLink = '';

        if (isPrivateGroup) {
            probLink = `https://codeforces.com/group/${defaultGroupId}/contest/${prob.contestId}/problem/${prob.index}`;
            subLink = `https://codeforces.com/group/${defaultGroupId}/contest/${prob.contestId}/submission/${sub.id}`;
        } else if (isGym) {
            probLink = `https://codeforces.com/gym/${prob.contestId}/problem/${prob.index}`;
            subLink = `https://codeforces.com/gym/${prob.contestId}/submission/${sub.id}`;
        } else {
            probLink = `https://codeforces.com/contest/${prob.contestId}/problem/${prob.index}`;
            subLink = `https://codeforces.com/contest/${prob.contestId}/submission/${sub.id}`;
        }

        const tags = Array.isArray(prob.tags) ? [...prob.tags] : [];
        if (isPrivateGroup) {
            tags.push('Private Group');
        }

        subs.push({
            id: `cf_${sub.id}`,
            platform: 'codeforces',
            problemName: `${prob.index}. ${prob.name || prob.index}`,
            problemLink: probLink,
            submissionLink: subLink,
            difficulty: prob.rating ? String(prob.rating) : '',
            tags: tags,
            language: sub.programmingLanguage || 'C++',
            date: new Date(sub.creationTimeSeconds * 1000).toISOString(),
            source: 'auto',
            isGroup: isPrivateGroup ? 'group' : (isGym ? 'gym' : false),
            groupId: isPrivateGroup ? defaultGroupId : undefined
        });
    }

    PLATFORMS.codeforces.solved = Math.max(subs.length, PLATFORMS.codeforces.solved || 0);
    return subs;
}

// ─── LeetCode API ───────────────────────────────────────────
async function fetchLeetcode() {
    const handle = PLATFORMS.leetcode.handle;
    const proxyUrl = `/api/leetcode?handle=${encodeURIComponent(handle)}`;
    const res = await fetch(proxyUrl);
    const data = await res.json();

    if (data.error) throw new Error(data.error);

    if (data.totalSolved) {
        PLATFORMS.leetcode.solved = Math.max(PLATFORMS.leetcode.solved || 0, data.totalSolved);
    }

    const submissionsList = data.submissions || [];
    return submissionsList.map(s => ({
        id: generateId(),
        platform: 'leetcode',
        problemName: s.questionId ? `${s.questionId}. ${s.title}` : s.title,
        problemLink: `https://leetcode.com/problems/${s.titleSlug}/`,
        submissionLink: `https://leetcode.com/problems/${s.titleSlug}/`,
        difficulty: s.difficulty || '',
        tags: s.tags || [],
        language: s.lang || 'C++',
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

    if (data.totalSolved) {
        PLATFORMS.codechef.solved = Math.max(PLATFORMS.codechef.solved || 0, data.totalSolved);
    }

    return data.problems.map(p => ({
        id: generateId(),
        platform: 'codechef',
        problemName: p.problemName || p.name,
        problemLink: p.problemLink || p.link,
        submissionLink: p.submissionLink || p.searchLink || (p.link ? `${p.link}` : ''),
        difficulty: p.difficulty || p.contest || '',
        tags: [p.contest].filter(Boolean),
        language: p.language || 'C++',
        date: p.date || new Date().toISOString(),
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
