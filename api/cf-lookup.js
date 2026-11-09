let cfProblemsCache = null;
let cfProblemsFetchTime = 0;

async function getCfProblems() {
    const now = Date.now();
    // Cache for 1 hour
    if (cfProblemsCache && (now - cfProblemsFetchTime < 3600000)) {
        return cfProblemsCache;
    }
    try {
        const res = await fetch('https://codeforces.com/api/problemset.problems');
        const json = await res.json();
        if (json.status === 'OK') {
            cfProblemsCache = json.result.problems;
            cfProblemsFetchTime = now;
            return cfProblemsCache;
        }
    } catch (e) {
        console.error('Failed to fetch CF problems:', e);
    }
    return cfProblemsCache || [];
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    const { q } = req.query || {};
    if (!q || !q.trim()) {
        return res.status(400).json({ error: 'Query parameter q is required' });
    }

    const query = q.trim();
    const problems = await getCfProblems();

    // 1. Check if problem URL like /problem/1539/C or /problemset/problem/1539/C
    const urlMatch = query.match(/\/problem\/(\d+)\/([A-Za-z0-9]+)/);
    if (urlMatch) {
        const cid = parseInt(urlMatch[1]);
        const idx = urlMatch[2].toUpperCase();
        const p = problems.find(x => x.contestId === cid && x.index.toUpperCase() === idx);
        if (p) return res.status(200).json(formatResult(p));
    }

    // 2. Check code like "1539C" or "1539-C"
    const codeMatch = query.match(/^(\d+)[-_ ]?([A-Za-z0-9]+)$/);
    if (codeMatch) {
        const cid = parseInt(codeMatch[1]);
        const idx = codeMatch[2].toUpperCase();
        const p = problems.find(x => x.contestId === cid && x.index.toUpperCase() === idx);
        if (p) return res.status(200).json(formatResult(p));
    }

    // 3. Name lookup (strip prefixes like "A - ", "C. ")
    const nameClean = query.replace(/^[A-Za-z0-9_]+\s*[-.:]\s*/, '').toLowerCase().trim();
    
    // Exact name match
    let match = problems.find(p => p.name.trim().toLowerCase() === nameClean);
    
    // If not found, try startsWith or contains
    if (!match && nameClean.length >= 3) {
        match = problems.find(p => p.name.trim().toLowerCase().startsWith(nameClean)) ||
                problems.find(p => p.name.trim().toLowerCase().includes(nameClean));
    }

    if (match) {
        return res.status(200).json(formatResult(match));
    }

    // Also return top 5 partial matches if any
    const candidates = problems
        .filter(p => p.name.toLowerCase().includes(nameClean))
        .slice(0, 5)
        .map(formatProblem);

    return res.status(200).json({
        matched: false,
        query,
        candidates
    });
}

function formatResult(p) {
    const formatted = formatProblem(p);
    return {
        matched: true,
        problem: formatted
    };
}

function formatProblem(p) {
    const problemCode = `${p.contestId}${p.index}`;
    return {
        contestId: p.contestId,
        index: p.index,
        name: p.name,
        rating: p.rating || null,
        tags: p.tags || [],
        problemCode,
        problemUrl: `https://codeforces.com/problemset/problem/${p.contestId}/${p.index}`,
        contestProblemUrl: `https://codeforces.com/contest/${p.contestId}/problem/${p.index}`,
        submitUrl: `https://codeforces.com/problemset/submit?submittedProblemCode=${problemCode}`
    };
}
