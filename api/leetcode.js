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
        const query = `{
            matchedUser(username: "${handle}") {
                submitStatsGlobal {
                    acSubmissionNum {
                        difficulty
                        count
                    }
                }
            }
            userContestRanking(username: "${handle}") {
                rating
            }
            recentAcSubmissionList(username: "${handle}", limit: 50) {
                id
                title
                titleSlug
                timestamp
            }
            recentSubmissionList(username: "${handle}", limit: 50) {
                id
                title
                titleSlug
                statusDisplay
                lang
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
        let rating = 0;

        if (data.data?.matchedUser?.submitStatsGlobal?.acSubmissionNum) {
            stats = data.data.matchedUser.submitStatsGlobal.acSubmissionNum;
            const allStat = stats.find(s => s.difficulty === 'All');
            if (allStat) totalSolved = allStat.count;
        }

        if (data.data?.userContestRanking?.rating) {
            rating = Math.round(data.data.userContestRanking.rating);
        }

        const seenSlugs = new Set();
        const submissions = [];

        // Add recent AC submissions
        const recentAc = data.data?.recentAcSubmissionList || [];
        for (const s of recentAc) {
            if (!seenSlugs.has(s.titleSlug)) {
                seenSlugs.add(s.titleSlug);
                submissions.push({
                    id: s.id,
                    title: s.title,
                    titleSlug: s.titleSlug,
                    timestamp: s.timestamp,
                    statusDisplay: 'Accepted',
                    lang: 'C++'
                });
            }
        }

        // Add any additional AC submissions from recentSubmissionList
        const recentAll = data.data?.recentSubmissionList || [];
        for (const s of recentAll) {
            if (s.statusDisplay === 'Accepted' && !seenSlugs.has(s.titleSlug)) {
                seenSlugs.add(s.titleSlug);
                submissions.push({
                    id: s.id,
                    title: s.title,
                    titleSlug: s.titleSlug,
                    timestamp: s.timestamp,
                    statusDisplay: s.statusDisplay,
                    lang: s.lang || 'C++'
                });
            }
        }

        // Enrich the submissions with question difficulty & topic tags
        const enrichedSubmissions = await Promise.all(
            submissions.map(async (sub) => {
                try {
                    const qQuery = `{
                        question(titleSlug: "${sub.titleSlug}") {
                            questionId
                            difficulty
                            topicTags { name }
                        }
                    }`;
                    const qRes = await fetch('https://leetcode.com/graphql', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'User-Agent': 'Mozilla/5.0'
                        },
                        body: JSON.stringify({ query: qQuery })
                    });
                    const qData = await qRes.json();
                    const qInfo = qData.data?.question;
                    return {
                        ...sub,
                        questionId: qInfo?.questionId || '',
                        difficulty: qInfo?.difficulty || '',
                        tags: (qInfo?.topicTags || []).map(t => t.name)
                    };
                } catch (e) {
                    return sub;
                }
            })
        );

        res.status(200).json({
            handle,
            totalSolved,
            rating,
            stats,
            submissions: enrichedSubmissions,
            count: enrichedSubmissions.length
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};
