/**
 * CP Tracker API - Stats & Sync Endpoint
 * Exports unified platform statistics and solved counts for portfolio integration.
 */
const crypto = require('crypto');

let cachedData = null;

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Allow clients to POST their local platform stats and custom solved questions to sync
    if (req.method === 'POST') {
        try {
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
            if (body && (body.platforms || body.submissions)) {
                cachedData = {
                    ...cachedData,
                    ...body,
                    updatedAt: new Date().toISOString()
                };
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
            solved: 1081,
            rating: 1227,
            maxRating: 1467,
            url: `https://codeforces.com/profile/${handle}`
        },
        leetcode: {
            name: 'LeetCode',
            handle: handle,
            solved: 84,
            rating: 0,
            maxRating: 1720,
            url: `https://leetcode.com/u/${handle}/`
        },
        codechef: {
            name: 'CodeChef',
            handle: handle,
            solved: 31,
            rating: 1120,
            maxRating: 1650,
            url: `https://www.codechef.com/users/${handle}`
        },
        atcoder: {
            name: 'AtCoder',
            handle: handle,
            solved: 14,
            rating: 53,
            maxRating: 820,
            url: `https://atcoder.jp/users/${handle}`
        },
        cses: {
            name: 'CSES',
            handle: 'mit_001',
            solved: 35,
            rating: 0,
            maxRating: 0,
            url: 'https://cses.fi/user/mit_001'
        },
        vjudge: {
            name: 'Vjudge',
            handle: handle,
            solved: 32,
            rating: 0,
            maxRating: 0,
            url: `https://vjudge.net/user/${handle}`
        },
        gfg: {
            name: 'GeeksforGeeks',
            handle: handle,
            solved: 3,
            rating: 0,
            maxRating: 0,
            url: `https://www.geeksforgeeks.org/profile/${handle}`
        },
        usaco: {
            name: 'USACO Guide',
            handle: handle,
            solved: 6,
            rating: 0,
            maxRating: 0,
            url: 'https://usaco.guide/problems?status=Solved'
        },
        euler: {
            name: 'Project Euler',
            handle: handle,
            solved: 3,
            rating: 0,
            maxRating: 0,
            url: 'https://projecteuler.net/'
        },
        spoj: {
            name: 'SPOJ',
            handle: handle,
            solved: 2,
            rating: 0,
            maxRating: 0,
            url: 'https://www.spoj.com/myaccount/'
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

    // If client posted custom cached data, merge it
    if (cachedData && cachedData.platforms) {
        for (const [k, v] of Object.entries(cachedData.platforms)) {
            if (platforms[k]) {
                platforms[k] = { ...platforms[k], ...v };
            } else {
                platforms[k] = v;
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
            const seenProbs = new Set();
            statusData.result.forEach(s => {
                if (s.verdict === 'OK') {
                    const name = s.problem?.name ? s.problem.name.trim().toLowerCase() : `${s.problem?.contestId}-${s.problem?.index}`;
                    seenProbs.add(name);
                }
            });
            if (seenProbs.size > 0) {
                platforms.codeforces.solved = Math.max(platforms.codeforces.solved || 0, seenProbs.size);
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
