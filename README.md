# CP Tracker

Auto-fetches accepted submissions from competitive programming platforms + manual entries.

## Platforms (Auto-fetch)
- **Codeforces** — Full submission history via public API
- **LeetCode** — Recent 20 accepted submissions via GraphQL
- **AtCoder** — Full submission history via kenkoooo API

## Platforms (Manual Entry)
CodeChef, GeeksforGeeks, CSES, SPOJ, VJudge, Kattis, Project Euler, USACO Guide

## Deploy to Vercel
```bash
cd CP
vercel
```

## Local Development
```bash
python3 -m http.server 8888
# Open http://localhost:8888
```

## Features
- 🔄 Auto-sync from Codeforces, LeetCode, AtCoder APIs
- ✏️ Manual add/edit/delete submissions
- 🔍 Search by name, tags, platform
- 🏷️ Filter by platform, source (auto/manual)
- 📊 Stats dashboard
- 📥 Export to JSON
- 💾 localStorage persistence
- 📱 Fully responsive
