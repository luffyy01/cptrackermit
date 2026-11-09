module.exports = async (req, res) => {
    const { handle } = req.query;
    if (!handle) return res.status(400).json({ error: 'Handle required' });

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const profileRes = await fetch(`https://www.codechef.com/users/${encodeURIComponent(handle)}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        if (!profileRes.ok) {
            return res.status(profileRes.status).json({ error: 'CodeChef profile request failed' });
        }

        const html = await profileRes.text();

        let rating = 0;
        let maxRating = 0;
        const ratingMatch = html.match(/"rating":\s*"?(\d+)"?/i) || html.match(/<div class="rating-number">(\d+)<\/div>/i);
        if (ratingMatch) rating = parseInt(ratingMatch[1]);

        const maxRatingMatch = html.match(/highest_rating":\s*"?(\d+)"?/i) || html.match(/\(Highest Rating\s*(\d+)\)/i);
        if (maxRatingMatch) maxRating = parseInt(maxRatingMatch[1]);

        const totalSolvedMatch = html.match(/Total Problems Solved:\s*(\d+)/i);
        const profileTotalSolved = totalSolvedMatch ? parseInt(totalSolvedMatch[1]) : 0;

        const seen = new Set();
        const problems = [];

        // 1. Fetch recent AC submissions from recent submissions API
        try {
            const firstRes = await fetch(`https://www.codechef.com/recent/user?page=0&user_handle=${encodeURIComponent(handle)}`, {
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            if (firstRes.ok) {
                const firstData = await firstRes.json();
                const maxPage = Math.min(firstData.max_page || 1, 6);

                for (let page = 0; page < maxPage; page++) {
                    let pageData = firstData;
                    if (page > 0) {
                        const pageRes = await fetch(`https://www.codechef.com/recent/user?page=${page}&user_handle=${encodeURIComponent(handle)}`, {
                            headers: { 'User-Agent': 'Mozilla/5.0' }
                        });
                        if (pageRes.ok) pageData = await pageRes.json();
                        else continue;
                    }

                    const rows = (pageData.content || '').match(/<tr\s*>[\s\S]*?<\/tr>/g) || [];
                    for (const row of rows) {
                        if (row.includes('accepted') || row.includes('tick-icon.gif') || row.includes("title='(100)'")) {
                            const probMatch = row.match(/href='(\/problems\/[^']+)'[^>]*>([^<]+)<\/a>/);
                            const solMatch = row.match(/href='(\/viewsolution\/[^']+)'/);
                            const langMatch = row.match(/<td\s*>([A-Za-z0-9+]+)<\/td>/);
                            const timeMatch = row.match(/tooltiptext'>([^<]+)<\/span>/);

                            if (probMatch) {
                                const name = probMatch[2].trim();
                                const key = name.toLowerCase();
                                if (!seen.has(key)) {
                                    seen.add(key);
                                    const probLink = `https://www.codechef.com${probMatch[1]}`;
                                    const subLink = solMatch ? `https://www.codechef.com${solMatch[1]}` : `https://www.codechef.com/status/${encodeURIComponent(name)},${handle}`;
                                    problems.push({
                                        name,
                                        problemName: name,
                                        link: probLink,
                                        problemLink: probLink,
                                        submissionLink: subLink,
                                        searchLink: subLink,
                                        contest: 'Practice',
                                        difficulty: 'Practice',
                                        language: langMatch ? langMatch[1] : 'C++',
                                        date: timeMatch ? timeMatch[1] : new Date().toISOString()
                                    });
                                }
                            }
                        }
                    }
                }
            }
        } catch (e) {
            console.error('Error fetching CodeChef recent submissions:', e);
        }

        // 2. Extract contest problems from the profile HTML
        const sectionMatch = html.match(/<section class="[^"]*problems-solved[\s\S]*?<\/section>/);
        if (sectionMatch) {
            const section = sectionMatch[0];
            const contentBlocks = section.match(/<div class='content'>[\s\S]*?<\/div>/g) || [];

            for (const block of contentBlocks) {
                const h5Match = block.match(/<h5>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/);
                const contest = h5Match ? h5Match[1].trim() : 'Contest';
                const spans = block.match(/<span style="font-size: 12px"[^>]*>([\s\S]*?)<\/span>/g) || [];

                for (const span of spans) {
                    const textMatch = span.match(/>([^<]+)</);
                    if (textMatch) {
                        const name = textMatch[1].trim();
                        const key = name.toLowerCase();
                        if (name && !seen.has(key)) {
                            seen.add(key);
                            const probCode = name.replace(/\s+/g, '_');
                            const probLink = `https://www.codechef.com/problems/${encodeURIComponent(probCode)}`;
                            const subLink = `https://www.codechef.com/status/${encodeURIComponent(probCode)},${handle}`;
                            problems.push({
                                name,
                                problemName: name,
                                link: probLink,
                                problemLink: probLink,
                                submissionLink: subLink,
                                searchLink: subLink,
                                contest,
                                difficulty: contest,
                                language: 'C++',
                                date: new Date().toISOString()
                            });
                        }
                    }
                }
            }
        }

        const totalSolved = Math.max(problems.length, profileTotalSolved);

        res.status(200).json({
            handle,
            rating,
            maxRating,
            totalSolved,
            problems
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};
