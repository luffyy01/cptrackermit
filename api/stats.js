/**
 * CP Tracker API - Stats & Sync Endpoint
 * Exports unified platform statistics and solved counts for portfolio integration.
 */

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

    // Baseline platform data
    const platforms = {
        codeforces: {
            name: 'Codeforces',
            handle: handle,
            solved: 791,
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
            solved: 22,
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

    // Try to auto-fetch live Codeforces rating if possible
    try {
        const cfRes = await fetch(`https://codeforces.com/api/user.info?handles=${encodeURIComponent(handle)}`);
        const cfData = await cfRes.json();
        if (cfData.status === 'OK' && cfData.result && cfData.result[0]) {
            const u = cfData.result[0];
            platforms.codeforces.rating = u.rating || platforms.codeforces.rating;
            platforms.codeforces.maxRating = u.maxRating || platforms.codeforces.maxRating;
        }
    } catch (e) {}

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
