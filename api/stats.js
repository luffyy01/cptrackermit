/**
 * CP Tracker API - Stats & Sync Endpoint
 * Exports unified platform statistics and solved counts for portfolio integration.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const CACHE_FILE = path.join('/tmp', 'cptracker_stats_cache.json');

const BASELINE_SOLVED = {
    codeforces: 1491,
    leetcode: 84,
    codechef: 31,
    atcoder: 17,
    cses: 22,
    vjudge: 32,
    gfg: 14,
    usaco: 10,
    euler: 3,
    spoj: 1,
    platform_1792915561929: 14,
    platform_1792598493339: 1
};

function readDiskCache() {
    try {
        if (fs.existsSync(CACHE_FILE)) {
            const raw = fs.readFileSync(CACHE_FILE, 'utf8');
            return JSON.parse(raw);
        }
    } catch (e) {}
    return null;
}

function writeDiskCache(data) {
    try {
        fs.writeFileSync(CACHE_FILE, JSON.stringify(data));
    } catch (e) {}
}

let cachedData = readDiskCache();

module.exports = async (req, res) => {
    // Enable CORS and disable HTTP caching so clients always get fresh data immediately
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Allow clients to POST their local platform stats and custom solved questions to sync
    if (req.method === 'POST') {
        try {
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
            if (body && (body.platforms || body.submissions)) {
                const disk = readDiskCache();
                const prev = disk || cachedData || {};
                const prevPlatforms = prev.platforms || {};
                const incomingPlatforms = body.platforms || {};

                const mergedPlatforms = { ...prevPlatforms, ...incomingPlatforms };
                for (const [k, p] of Object.entries(mergedPlatforms)) {
                    if (k === 'cptracker') {
                        p.solved = 0;
                        p.url = 'https://cptrackermit.vercel.app';
                    } else if (typeof p.solved === 'number') {
                        const floor = BASELINE_SOLVED[k] || 0;
                        p.solved = Math.max(p.solved, floor);
                    }
                }

                // Honor deleted platforms (never delete cptracker)
                const deletedList = Array.isArray(body.deletedPlatforms) 
                    ? body.deletedPlatforms.filter(k => k !== 'cptracker') 
                    : [];
                for (const delKey of deletedList) {
                    delete mergedPlatforms[delKey];
                }

                cachedData = {
                    ...prev,
                    ...body,
                    platforms: mergedPlatforms,
                    deletedPlatforms: deletedList,
                    updatedAt: new Date().toISOString()
                };
                writeDiskCache(cachedData);
                return res.status(200).json({ success: true, message: 'Stats synced successfully', data: cachedData });
            }
        } catch (e) {
            return res.status(400).json({ error: 'Invalid JSON payload: ' + e.message });
        }
    }

    // Handle GET
    const handle = req.query?.handle || 'luffyy01';

    // Baseline platform data with true solved numbers
    const platforms = {
        codeforces: {
            name: 'Codeforces',
            handle: handle,
            solved: 1491,
            rating: 1478,
            maxRating: 1478,
            url: `https://codeforces.com/profile/${handle}`,
            color: '#1890ff',
            icon: '⚡'
        },
        leetcode: {
            name: 'LeetCode',
            handle: handle,
            solved: 84,
            rating: 0,
            maxRating: 1720,
            url: `https://leetcode.com/u/${handle}/`,
            color: '#ffa116',
            icon: '🔥'
        },
        codechef: {
            name: 'CodeChef',
            handle: handle,
            solved: 31,
            rating: 1120,
            maxRating: 1346,
            url: `https://www.codechef.com/users/${handle}`,
            color: '#5b4638',
            icon: '👨‍🍳'
        },
        atcoder: {
            name: 'AtCoder',
            handle: handle,
            solved: 17,
            rating: 53,
            maxRating: 820,
            url: `https://atcoder.jp/users/${handle}`,
            color: '#2196f3',
            icon: '🏯'
        },
        cses: {
            name: 'CSES',
            handle: 'mit_001',
            solved: 22,
            rating: 0,
            maxRating: 0,
            url: 'https://cses.fi/user/mit_001',
            color: '#607d8b',
            icon: '📘',
            isCustom: true
        },
        vjudge: {
            name: 'Vjudge',
            handle: handle,
            solved: 32,
            rating: 0,
            maxRating: 0,
            url: `https://vjudge.net/user/${handle}`,
            color: '#5cb85c',
            icon: '⚖️',
            isCustom: true
        },
        gfg: {
            name: 'GeeksforGeeks',
            handle: handle,
            solved: 14,
            rating: 0,
            maxRating: 0,
            url: `https://www.geeksforgeeks.org/profile/${handle}`,
            color: '#2f8d46',
            icon: '🟢',
            isCustom: true
        },
        usaco: {
            name: 'USACO Guide',
            handle: handle,
            solved: 10,
            rating: 0,
            maxRating: 0,
            url: 'https://usaco.guide/problems?status=Solved',
            color: '#0066cc',
            icon: '🐄',
            isCustom: true
        },
        euler: {
            name: 'Project Euler',
            handle: handle,
            solved: 3,
            rating: 0,
            maxRating: 0,
            url: 'https://projecteuler.net/',
            color: '#666666',
            icon: '🔢',
            isCustom: true
        },
        spoj: {
            name: 'SPOJ',
            handle: handle,
            solved: 1,
            rating: 0,
            maxRating: 0,
            url: 'https://www.spoj.com/myaccount/',
            color: '#0066aa',
            icon: '🔵',
            isCustom: true
        },
        kattis: {
            name: 'Kattis',
            handle: 'mit-jain',
            solved: 0,
            rating: 1,
            maxRating: 0,
            url: 'https://open.kattis.com/users/mit-jain',
            color: '#333333',
            icon: '🐱'
        },
        newton: {
            name: 'Newton School',
            handle: handle,
            solved: 0,
            rating: 0,
            maxRating: 0,
            url: `https://my.newtonschool.co/user/${handle}`,
            color: '#00d4aa',
            icon: '🌐',
            isCustom: true
        },
        qoj: {
            name: 'QOJ',
            handle: handle,
            solved: 0,
            rating: 0,
            maxRating: 0,
            url: `https://qoj.ac/user/profile/${handle}`,
            color: '#00d4aa',
            icon: '🌐',
            isCustom: true
        },
        cphof: {
            name: 'CPHOF',
            handle: 'mitjain70',
            solved: 0,
            rating: 0,
            maxRating: 0,
            url: 'https://cphof.org/contests',
            color: '#00d4aa',
            icon: '🌐',
            isCustom: true
        },
        platform_1792598493339: {
            name: 'Repopive',
            handle: 'Repopive',
            solved: 1,
            rating: 0,
            maxRating: 0,
            url: 'https://repovive.com/users/6950ecc1c8ed4329fd80462c',
            color: '#8b5cf6',
            icon: '🌐',
            isCustom: true
        },
        platform_hackerrank_1794230485918: {
            name: 'Hackerrank',
            handle: 'mitjain70',
            solved: 0,
            rating: 0,
            maxRating: 0,
            url: 'https://www.hackerrank.com/profile/mitjain70',
            color: '#00d4aa',
            icon: '🌐',
            isCustom: true
        },
        platform_uoj_1794231317534: {
            name: 'UOJ',
            handle: handle,
            solved: 0,
            rating: 0,
            maxRating: 0,
            url: `https://uoj.ac/user/profile/${handle}`,
            color: '#00d4aa',
            icon: '🌐',
            isCustom: true
        },
        platform_1792915561929: {
            name: 'Clist-atc-qs',
            handle: 'Clist',
            solved: 14,
            rating: 0,
            maxRating: 0,
            url: 'https://clist.by/problems/?resource=93&status=allsolved',
            color: '#10b981',
            icon: '🌐',
            isCustom: true
        },
        cptracker: {
            name: 'CP Tracker',
            handle: 'cptrackermit',
            solved: 0,
            rating: 0,
            maxRating: 0,
            url: 'https://cptrackermit.vercel.app'
        }
    };

    // If client posted custom cached data, merge it safely without dropping counts
    const activeCache = readDiskCache() || cachedData;
    if (activeCache && activeCache.platforms) {
        for (const [k, v] of Object.entries(activeCache.platforms)) {
            if (k === 'cptracker') continue;
            const floor = BASELINE_SOLVED[k] || 0;
            const safeSolved = Math.max(typeof v.solved === 'number' ? v.solved : 0, floor);
            if (platforms[k]) {
                platforms[k] = { 
                    ...platforms[k], 
                    ...v,
                    solved: safeSolved
                };
            } else {
                platforms[k] = { ...v, solved: safeSolved };
            }
        }
    }

    // Prune any platforms explicitly deleted by client (never delete cptracker)
    if (activeCache && Array.isArray(activeCache.deletedPlatforms)) {
        for (const delKey of activeCache.deletedPlatforms) {
            if (delKey !== 'cptracker') {
                delete platforms[delKey];
            }
        }
    }

    // Try to auto-fetch live Codeforces data including private groups & rating
    try {
        const apiKey = "802d01e31c9c9a038bdacc79fe8097f195cb425e";
        const apiSecret = "6b89fd9e78fc3636236ca7e5a4d16b7b1b5292b1";
        const time = Math.floor(Date.now() / 1000);
        const rand = Math.random().toString(36).substring(2, 8).padStart(6, '0');
        const params = `apiKey=${apiKey}&handle=${encodeURIComponent(handle)}&time=${time}`;
        const base = `${rand}/user.status?${params}#${apiSecret}`;
        const hash = crypto.createHash('sha512').update(base).digest('hex');
        const apiSig = `${rand}${hash}`;

        const statusRes = await fetch(`https://codeforces.com/api/user.status?${params}&apiSig=${apiSig}`);
        const statusData = await statusRes.json();
        if (statusData.status === 'OK' && Array.isArray(statusData.result)) {
            const okSubs = statusData.result.filter(s => s.verdict === 'OK');
            if (okSubs.length > 0) {
                platforms.codeforces.solved = Math.max(platforms.codeforces.solved || 0, okSubs.length);
            }
        }

        const cfRes = await fetch(`https://codeforces.com/api/user.info?handles=${encodeURIComponent(handle)}`);
        const cfData = await cfRes.json();
        if (cfData.status === 'OK' && cfData.result && cfData.result[0]) {
            const u = cfData.result[0];
            platforms.codeforces.rating = u.rating || platforms.codeforces.rating;
            platforms.codeforces.maxRating = u.maxRating || platforms.codeforces.maxRating;
        }
    } catch (e) {
        console.error('CF live sync note in stats:', e);
    }

    // Always keep cptracker platform solved at 0 as requested
    if (platforms.cptracker) {
        platforms.cptracker.solved = 0;
    }

    // Calculate total solved (excluding CP Tracker itself)
    let totalSolved = 0;
    for (const p of Object.values(platforms)) {
        if (p.name !== 'CP Tracker' && typeof p.solved === 'number') {
            totalSolved += p.solved;
        }
    }

    return res.status(200).json({
        success: true,
        handle,
        totalSolved,
        platforms,
        source: 'cptrackermit.vercel.app',
        updatedAt: new Date().toISOString()
    });
};
