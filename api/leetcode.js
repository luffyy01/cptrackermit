export default async function handler(req, res) {
    const { handle } = req.query;
    if (!handle) return res.status(400).json({ error: 'Handle required' });

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    try {
        const query = `{
            matchedUser(username: "${handle}") {
                submitStatsGlobal {
                    acSubmissionNum {
                        difficulty
                        count
                    }
                }
            }
            recentAcSubmissionList(username: "${handle}", limit: 50) {
                title
                titleSlug
                timestamp
            }
        }`;

        const response = await fetch('https://leetcode.com/graphql', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://leetcode.com'
            },
            body: JSON.stringify({ query })
        });

        const data = await response.json();

        let totalSolved = 0;
        let stats = [];
        if (data.data?.matchedUser?.submitStatsGlobal?.acSubmissionNum) {
            stats = data.data.matchedUser.submitStatsGlobal.acSubmissionNum;
            const allStat = stats.find(s => s.difficulty === 'All');
            if (allStat) totalSolved = allStat.count;
        }

        const submissions = (data.data?.recentAcSubmissionList || []).map(s => ({
            title: s.title,
            titleSlug: s.titleSlug,
            timestamp: s.timestamp
        }));

        res.status(200).json({
            handle,
            totalSolved,
            stats,
            submissions,
            count: submissions.length
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
}
