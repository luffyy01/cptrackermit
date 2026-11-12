/**
 * CP Tracker API - Codeforces Submissions Endpoint
 * Authenticates with Codeforces API using API Key and Secret
 * Returns all accepted submissions (including private groups, gym mashups, and contests)
 */
const crypto = require('crypto');

let cachedSubs = null;
let lastFetchTime = 0;
const CACHE_TTL = 60 * 1000; // 1 minute in-memory cache

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const handle = req.query?.handle || 'luffyy01';
    const forceRefresh = req.query?.refresh === 'true';

    // Return cached if fresh
    const now = Date.now();
    if (!forceRefresh && cachedSubs && (now - lastFetchTime < CACHE_TTL) && cachedSubs.handle === handle) {
        return res.status(200).json(cachedSubs);
    }

    const apiKey = "802d01e31c9c9a038bdacc79fe8097f195cb425e";
    const apiSecret = "6b89fd9e78fc3636236ca7e5a4d16b7b1b5292b1";

    let rawData = null;

    try {
        const time = Math.floor(now / 1000);
        const rand = Math.random().toString(36).substring(2, 8).padStart(6, '0');
        const params = `apiKey=${apiKey}&handle=${encodeURIComponent(handle)}&time=${time}`;
        const base = `${rand}/user.status?${params}#${apiSecret}`;
        const hash = crypto.createHash('sha512').update(base).digest('hex');
        const apiSig = `${rand}${hash}`;

        const statusRes = await fetch(`https://codeforces.com/api/user.status?${params}&apiSig=${apiSig}`);
        rawData = await statusRes.json();
    } catch (e) {
        console.warn('Authenticated CF fetch failed, trying public fallback:', e.message);
    }

    // Fallback to unauthenticated if signed request failed
    if (!rawData || rawData.status !== 'OK') {
        try {
            const fallbackRes = await fetch(`https://codeforces.com/api/user.status?handle=${encodeURIComponent(handle)}`);
            rawData = await fallbackRes.json();
        } catch (e) {
            return res.status(500).json({ error: 'Failed to fetch from Codeforces: ' + e.message });
        }
    }

    if (!rawData || rawData.status !== 'OK') {
        return res.status(500).json({ error: rawData?.comment || 'Codeforces API error' });
    }

    // Fetch user info for rating
    let rating = 1227;
    let maxRating = 1467;
    try {
        const userRes = await fetch(`https://codeforces.com/api/user.info?handles=${encodeURIComponent(handle)}`);
        const userData = await userRes.json();
        if (userData.status === 'OK' && userData.result && userData.result[0]) {
            rating = userData.result[0].rating || rating;
            maxRating = userData.result[0].maxRating || maxRating;
        }
    } catch (e) {}

    const defaultGroupId = req.query?.groupId || 'nqUiki1EgM';

    const totalSubmissions = rawData.result.length;
    const okSubmissions = rawData.result.filter(s => s.verdict === 'OK');

    // Deduplicate submissions to keep only UNIQUE questions
    const seenProblems = new Map();

    for (const sub of rawData.result) {
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

        const subEntry = {
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
            groupId: isPrivateGroup ? defaultGroupId : undefined,
            _contestId: prob.contestId
        };

        const nameKey = prob.name ? prob.name.trim().toLowerCase() : `${prob.contestId}-${prob.index}`;

        if (!seenProblems.has(nameKey)) {
            seenProblems.set(nameKey, subEntry);
        } else {
            // Prefer public contest over private group for accessibility
            const prev = seenProblems.get(nameKey);
            if (prev && prev._contestId >= 600000 && prob.contestId < 600000) {
                seenProblems.set(nameKey, subEntry);
            }
        }
    }

    const formattedSubmissions = Array.from(seenProblems.values()).map(s => {
        delete s._contestId;
        return s;
    });

    const result = {
        success: true,
        handle,
        rating,
        maxRating,
        totalSubmissions,
        totalAcceptedSubmissions: okSubmissions.length,
        acceptedSubmissions: formattedSubmissions.length,
        uniqueSolved: formattedSubmissions.length,
        submissions: formattedSubmissions,
        fetchedAt: new Date().toISOString()
    };

    cachedSubs = result;
    lastFetchTime = now;

    return res.status(200).json(result);
};
