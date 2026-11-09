let cachedProblems = null;
let lastFetchTime = 0;
const CACHE_TTL = 3600 * 1000; // 1 hour

async function getProblemset() {
    const now = Date.now();
    if (cachedProblems && (now - lastFetchTime < CACHE_TTL)) {
        return cachedProblems;
    }

    const res = await fetch('https://codeforces.com/api/problemset.problems');
    const data = await res.json();

    if (data.status !== 'OK') {
        throw new Error(data.comment || 'Failed to fetch CF problemset');
    }

    cachedProblems = data.result.problems;
    lastFetchTime = now;
    return cachedProblems;
}

module.exports = async (req, res) => {
    const { q, name, code } = req.query;
    const query = (q || name || code || '').trim();

    if (!query) {
        return res.status(400).json({ error: 'Query parameter q, name, or code required' });
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    try {
        const problems = await getProblemset();

        // 1. Direct code match: e.g. "1850A", "1850-A", "1850/A"
        const codeMatch = query.match(/^(\d+)[-/]?([A-Za-z0-9]+)$/);
        if (codeMatch) {
            const contestId = parseInt(codeMatch[1]);
            const index = codeMatch[2].toUpperCase();
            const found = problems.find(p => p.contestId === contestId && p.index.toUpperCase() === index);
            if (found) {
                return res.status(200).json({
                    found: true,
                    problem: formatProblem(found)
                });
            }
        }

        // 2. URL match: e.g. https://codeforces.com/problemset/problem/1850/A
        const urlMatch = query.match(/\/problemset\/problem\/(\d+)\/([A-Za-z0-9]+)/) ||
                         query.match(/\/contest\/(\d+)\/problem\/([A-Za-z0-9]+)/);
        if (urlMatch) {
            const contestId = parseInt(urlMatch[1]);
            const index = urlMatch[2].toUpperCase();
            const found = problems.find(p => p.contestId === contestId && p.index.toUpperCase() === index);
            if (found) {
                return res.status(200).json({
                    found: true,
                    problem: formatProblem(found)
                });
            }
        }

        // 3. Exact name match (case-insensitive)
        const lowerName = query.toLowerCase();
        let found = problems.find(p => p.name.toLowerCase() === lowerName);

        // 4. Clean prefix and match: e.g. "A. To My Critics" -> "To My Critics"
        if (!found) {
            const cleanName = query.replace(/^[A-Za-z0-9_]+\s*[-.:]\s*/, '').toLowerCase();
            found = problems.find(p => p.name.toLowerCase() === cleanName);
        }

        // 5. Starts-with or contains match
        if (!found && query.length >= 4) {
            found = problems.find(p => p.name.toLowerCase().startsWith(lowerName)) ||
                    problems.find(p => p.name.toLowerCase().includes(lowerName));
        }

        if (found) {
            return res.status(200).json({
                found: true,
                problem: formatProblem(found)
            });
        }

        res.status(200).json({
            found: false,
            message: `Problem "${query}" not found in Codeforces problemset`
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

function formatProblem(p) {
    return {
        contestId: p.contestId,
        index: p.index,
        code: `${p.contestId}${p.index}`,
        name: p.name,
        rating: p.rating || null,
        tags: p.tags || [],
        url: `https://codeforces.com/problemset/problem/${p.contestId}/${p.index}`,
        submitUrl: `https://codeforces.com/problemset/submit?submittedProblemCode=${p.contestId}${p.index}`
    };
}
