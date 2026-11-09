const http = require('http');
const fs = require('fs');
const path = require('path');
const leetcodeHandler = require('./api/leetcode.js');
const cfLookupHandler = require('./api/cf-lookup.js');
const codechefHandler = require('./api/codechef.js');
const statsHandler = require('./api/stats.js');

const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

const server = http.createServer(async (req, res) => {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;

    // Helper to create mock Vercel-like req/res
    function createMockRes() {
        return {
            setHeader: (k, v) => res.setHeader(k, v),
            status: (code) => ({
                end: () => res.end(),
                json: (data) => {
                    res.writeHead(code, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(data));
                }
            })
        };
    }

    // Handle /api/leetcode
    if (pathname === '/api/leetcode') {
        const query = Object.fromEntries(parsedUrl.searchParams.entries());
        try {
            await leetcodeHandler({ ...req, query }, createMockRes());
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
        return;
    }

    // Handle /api/cf-lookup
    if (pathname === '/api/cf-lookup') {
        const query = Object.fromEntries(parsedUrl.searchParams.entries());
        try {
            await cfLookupHandler({ ...req, query }, createMockRes());
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
        return;
    }

    // Handle /api/codechef
    if (pathname === '/api/codechef') {
        const query = Object.fromEntries(parsedUrl.searchParams.entries());
        try {
            await codechefHandler({ ...req, query }, createMockRes());
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
        return;
    }

    // Handle /api/stats
    if (pathname === '/api/stats') {
        const query = Object.fromEntries(parsedUrl.searchParams.entries());
        let body = null;
        if (req.method === 'POST') {
            const chunks = [];
            for await (const chunk of req) chunks.push(chunk);
            try { body = JSON.parse(Buffer.concat(chunks).toString()); } catch(e) {}
        }
        try {
            await statsHandler({ ...req, query, body }, createMockRes());
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
        return;
    }

    // Serve static files
    let safePath = pathname === '/' ? '/index.html' : pathname;
    const resolvedPath = path.join(__dirname, path.normalize(safePath));
    if (!resolvedPath.startsWith(__dirname)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    fs.stat(resolvedPath, (err, stats) => {
        if (err || !stats.isFile()) {
            // SPA fallback or 404
            const indexPath = path.join(__dirname, 'index.html');
            fs.readFile(indexPath, (err2, data) => {
                if (err2) {
                    res.writeHead(404);
                    res.end('Not Found');
                } else {
                    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                    res.end(data);
                }
            });
            return;
        }

        const ext = path.extname(resolvedPath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        fs.readFile(resolvedPath, (err2, data) => {
            if (err2) {
                res.writeHead(500);
                res.end('Server Error');
            } else {
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(data);
            }
        });
    });
});

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
