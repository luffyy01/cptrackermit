import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import leetcodeHandler from './api/leetcode.js';
import cfLookupHandler from './api/cf-lookup.js';
import codechefHandler from './api/codechef.js';
import statsHandler from './api/stats.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

    // Handle /api/leetcode
    if (pathname === '/api/leetcode') {
        const query = Object.fromEntries(parsedUrl.searchParams.entries());
        const mockReq = { ...req, query };
        const mockRes = {
            setHeader: (k, v) => res.setHeader(k, v),
            status: (code) => ({
                json: (data) => {
                    res.writeHead(code, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(data));
                }
            })
        };
        try {
            await leetcodeHandler(mockReq, mockRes);
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
        return;
    }

    // Handle /api/cf-lookup
    if (pathname === '/api/cf-lookup') {
        const query = Object.fromEntries(parsedUrl.searchParams.entries());
        const mockReq = { ...req, query };
        const mockRes = {
            setHeader: (k, v) => res.setHeader(k, v),
            status: (code) => ({
                json: (data) => {
                    res.writeHead(code, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(data));
                }
            })
        };
        try {
            await cfLookupHandler(mockReq, mockRes);
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
        return;
    }

    // Handle /api/codechef
    if (pathname === '/api/codechef') {
        const query = Object.fromEntries(parsedUrl.searchParams.entries());
        const mockReq = { ...req, query };
        const mockRes = {
            setHeader: (k, v) => res.setHeader(k, v),
            status: (code) => ({
                json: (data) => {
                    res.writeHead(code, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(data));
                }
            })
        };
        try {
            await codechefHandler(mockReq, mockRes);
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
        const mockReq = { ...req, query, body };
        const mockRes = {
            setHeader: (k, v) => res.setHeader(k, v),
            status: (code) => ({
                end: () => res.end(),
                json: (data) => {
                    res.writeHead(code, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(data));
                }
            })
        };
        try {
            await statsHandler(mockReq, mockRes);
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
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
            return;
        }

        const ext = path.extname(resolvedPath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        res.writeHead(200, { 'Content-Type': contentType });
        fs.createReadStream(resolvedPath).pipe(res);
    });
});

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
