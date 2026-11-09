/**
 * CP Tracker API - Problem Information Autofetch Endpoint
 * Extracts problem title, platform, difficulty, and tags from any problem URL.
 */
const crypto = require('crypto');

function slugToTitle(slug) {
    if (!slug) return '';
    return slug
        .replace(/[-_]+/g, ' ')
        .split(' ')
        .filter(Boolean)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
}

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const targetUrl = req.query?.url;
    if (!targetUrl) {
        return res.status(400).json({ error: 'Missing url parameter' });
    }

    let urlObj;
    try {
        urlObj = new URL(targetUrl);
    } catch (e) {
        return res.status(400).json({ error: 'Invalid URL format' });
    }

    const host = urlObj.hostname.toLowerCase();
    const pathname = urlObj.pathname;

    let result = {
        success: true,
        url: targetUrl,
        platform: '',
        problemName: '',
        difficulty: '',
        tags: []
    };

    // 1. LeetCode
    if (host.includes('leetcode.com')) {
        result.platform = 'leetcode';
        const match = pathname.match(/\/problems\/([^\/]+)/);
        if (match && match[1]) {
            const titleSlug = match[1];
            result.problemName = slugToTitle(titleSlug);

            try {
                const query = `query questionTitle($titleSlug: String!) {
                    question(titleSlug: $titleSlug) {
                        questionFrontendId
                        title
                        difficulty
                        topicTags {
                            name
                        }
                    }
                }`;
                const lcRes = await fetch('https://leetcode.com/graphql', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    },
                    body: JSON.stringify({
                        query,
                        variables: { titleSlug }
                    })
                });
                const lcData = await lcRes.json();
                const q = lcData?.data?.question;
                if (q) {
                    result.problemName = `${q.questionFrontendId ? q.questionFrontendId + '. ' : ''}${q.title}`;
                    result.difficulty = q.difficulty || '';
                    if (Array.isArray(q.topicTags)) {
                        result.tags = q.topicTags.map(t => t.name);
                    }
                    return res.status(200).json(result);
                }
            } catch (e) {
                console.warn('LeetCode GraphQL error:', e.message);
            }
        }
        return res.status(200).json(result);
    }

    // 2. Codeforces
    if (host.includes('codeforces.com')) {
        result.platform = 'codeforces';
        // /group/nqUiki1EgM/contest/661565/problem/A or /contest/2040/problem/B or /gym/100000/problem/A
        const match = pathname.match(/(?:group\/([^\/]+)\/contest|contest|gym|problemset\/problem)\/(\d+)\/(?:problem\/)?([A-Za-z0-9]+)/);
        if (match) {
            const groupId = match[1];
            const contestId = match[2];
            const index = match[3].toUpperCase();
            result.problemName = `${index}. Problem ${contestId}${index}`;
            if (groupId) {
                result.groupId = groupId;
                result.tags.push('Private Group');
            }

            try {
                // First try to find in Codeforces public problemset
                const cfRes = await fetch('https://codeforces.com/api/problemset.problems');
                const cfData = await cfRes.json();
                if (cfData.status === 'OK' && cfData.result && Array.isArray(cfData.result.problems)) {
                    const prob = cfData.result.problems.find(
                        p => String(p.contestId) === contestId && p.index.toUpperCase() === index
                    );
                    if (prob) {
                        result.problemName = `${prob.index}. ${prob.name}`;
                        if (prob.rating) result.difficulty = String(prob.rating);
                        if (Array.isArray(prob.tags)) result.tags = [...result.tags, ...prob.tags];
                        return res.status(200).json(result);
                    }
                }
            } catch (e) {
                console.warn('Codeforces problemset lookup error:', e.message);
            }

            // If not found in public problemset (e.g. private group contest or gym mashup), look in user status
            try {
                const apiKey = "802d01e31c9c9a038bdacc79fe8097f195cb425e";
                const apiSecret = "6b89fd9e78fc3636236ca7e5a4d16b7b1b5292b1";
                const time = Math.floor(Date.now() / 1000);
                const rand = Math.random().toString(36).substring(2, 8).padStart(6, '0');
                const params = `apiKey=${apiKey}&handle=luffyy01&time=${time}`;
                const base = `${rand}/user.status?${params}#${apiSecret}`;
                const hash = crypto.createHash('sha512').update(base).digest('hex');
                const apiSig = `${rand}${hash}`;
                const statusRes = await fetch(`https://codeforces.com/api/user.status?${params}&apiSig=${apiSig}`);
                const statusData = await statusRes.json();
                if (statusData.status === 'OK' && Array.isArray(statusData.result)) {
                    const sub = statusData.result.find(
                        s => String(s.problem?.contestId) === contestId && s.problem?.index?.toUpperCase() === index
                    );
                    if (sub && sub.problem) {
                        result.problemName = `${sub.problem.index}. ${sub.problem.name || ('Problem ' + contestId + index)}`;
                        if (sub.problem.rating) result.difficulty = String(sub.problem.rating);
                        if (Array.isArray(sub.problem.tags)) result.tags = [...result.tags, ...sub.problem.tags];
                        return res.status(200).json(result);
                    }
                }
            } catch (e) {
                console.warn('Codeforces private group lookup error:', e.message);
            }
        }
    }

    // 3. CodeChef
    if (host.includes('codechef.com')) {
        result.platform = 'codechef';
        const match = pathname.match(/\/problems\/([^\/\?#]+)/);
        if (match && match[1]) {
            result.problemName = match[1];
        }
    }

    // 4. AtCoder
    if (host.includes('atcoder.jp')) {
        result.platform = 'atcoder';
        const match = pathname.match(/\/tasks\/([^\/\?#]+)/);
        if (match && match[1]) {
            result.problemName = match[1].toUpperCase().replace('_', ' ');
        }
    }

    // 5. CSES
    if (host.includes('cses.fi')) {
        result.platform = 'cses';
        const match = pathname.match(/\/task\/(\d+)/);
        if (match && match[1]) {
            result.problemName = `CSES ${match[1]}`;
        }
    }

    // 6. GeeksforGeeks
    if (host.includes('geeksforgeeks.org')) {
        result.platform = 'gfg';
        const match = pathname.match(/\/problems\/([^\/\?#]+)/);
        if (match && match[1]) {
            result.problemName = slugToTitle(match[1].replace(/-\d{6,}$/, ''));
        }
    }

    // 7. General Web Scraping Fallback for Title
    try {
        const fetchRes = await fetch(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            },
            signal: AbortSignal.timeout(4000)
        });

        if (fetchRes.ok) {
            const html = await fetchRes.text();
            
            // Try og:title
            const ogTitleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i) ||
                                 html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:title["']/i);
            // Try <title>
            const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);

            let pageTitle = ogTitleMatch ? ogTitleMatch[1] : (titleMatch ? titleMatch[1] : '');

            if (pageTitle) {
                pageTitle = pageTitle
                    .replace(/\s*-\s*LeetCode\s*$/i, '')
                    .replace(/\s*\|\s*LeetCode\s*$/i, '')
                    .replace(/\s*-\s*Codeforces\s*$/i, '')
                    .replace(/\s*\|\s*Codeforces\s*$/i, '')
                    .replace(/\s*\|\s*Practice\s*\|\s*GeeksforGeeks\s*$/i, '')
                    .replace(/\s*-\s*GeeksforGeeks\s*$/i, '')
                    .replace(/\s*\|\s*GeeksforGeeks\s*$/i, '')
                    .replace(/\s*Practice\s*Coding\s*Problem\s*$/i, '')
                    .replace(/\s*Coding\s*Problem\s*$/i, '')
                    .replace(/\s*\|\s*CodeChef\s*$/i, '')
                    .replace(/\s*-\s*CodeChef\s*$/i, '')
                    .replace(/^\s*CSES\s*-\s*/i, '')
                    .replace(/\s*-\s*CSES\s*$/i, '')
                    .replace(/\s*-\s*AtCoder\s*$/i, '')
                    .replace(/\s*\|\s*HackerRank\s*$/i, '')
                    .replace(/\s*-\s*VJudge\s*$/i, '')
                    .trim();

                if (pageTitle && pageTitle.length > 1) {
                    if (result.platform === 'codechef' && result.problemName) {
                        result.problemName = `${result.problemName} - ${pageTitle}`;
                    } else if (result.platform === 'cses' && result.problemName) {
                        result.problemName = `${result.problemName}: ${pageTitle}`;
                    } else if (!result.problemName || result.problemName.startsWith('Problem ')) {
                        result.problemName = pageTitle;
                    }
                }
            }
        }
    } catch (e) {
        // Fallback title from pathname slug if scraping timed out
        if (!result.problemName) {
            const segments = pathname.split('/').filter(Boolean);
            if (segments.length > 0) {
                result.problemName = slugToTitle(segments[segments.length - 1]);
            }
        }
    }

    if (!result.problemName) {
        result.problemName = 'New Problem';
    }

    return res.status(200).json(result);
};
