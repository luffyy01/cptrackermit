export default async function handler(req, res) {
    const { handle } = req.query;
    if (!handle) return res.status(400).json({ error: 'Handle required' });

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    try {
        const response = await fetch(`https://www.codechef.com/users/${encodeURIComponent(handle)}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        if (!response.ok) {
            return res.status(response.status).json({ error: 'CodeChef profile request failed' });
        }

        const html = await response.text();
        const sectionMatch = html.match(/<section class="[^"]*problems-solved[\s\S]*?<\/section>/);

        let problems = [];
        let rating = 0;
        let maxRating = 0;

        // Extract rating if present
        const ratingMatch = html.match(/"rating":\s*"?(\d+)"?/i) || html.match(/<div class="rating-number">(\d+)<\/div>/i);
        if (ratingMatch) rating = parseInt(ratingMatch[1]);

        const maxRatingMatch = html.match(/highest_rating":\s*"?(\d+)"?/i) || html.match(/\(Highest Rating\s*(\d+)\)/i);
        if (maxRatingMatch) maxRating = parseInt(maxRatingMatch[1]);

        if (sectionMatch) {
            const section = sectionMatch[0];
            const contentBlocks = section.match(/<div class='content'>[\s\S]*?<\/div>/g) || [];

            for (const block of contentBlocks) {
                const h5Match = block.match(/<h5>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/);
                const contest = h5Match ? h5Match[1].trim() : 'Contest';
                const spans = block.match(/<span style="font-size: 12px"[^>]*>([\s\S]*?)<\/span>/g) || [];

                for (const sp of spans) {
                    const name = sp.replace(/<[^>]+>/g, '').trim();
                    if (name) {
                        const slug = name.replace(/\s+/g, '_');
                        problems.push({
                            problemName: name,
                            contest: contest,
                            problemLink: `https://www.codechef.com/problems/${encodeURIComponent(slug)}`,
                            searchLink: `https://www.codechef.com/practice?search=${encodeURIComponent(name)}`
                        });
                    }
                }
            }
        }

        res.status(200).json({
            handle,
            rating,
            maxRating,
            totalSolved: problems.length,
            problems
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
}
