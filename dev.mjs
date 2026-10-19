// npm run dev: the app and its API on one local server, with no accounts or services. Static files
// come from this folder; /api/blitz runs the same handler as the deployed function, keeping shared
// blitzes in memory (they're gone when the server stops).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as api from './api/blitz.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 5300;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.woff2': 'font/woff2',
};
const PRIVATE = /^(node_modules|\.git|\.vercel)(\/|$)|(^|\/)\.env/;

async function serveApi(req, res, url) {
  const handler = api[req.method];
  if (!handler) {
    res.writeHead(405).end();
    return;
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const out = await handler(
    new Request(url, { method: req.method, headers: req.headers, body: chunks.length ? Buffer.concat(chunks) : undefined }),
  );
  res.writeHead(out.status, Object.fromEntries(out.headers));
  res.end(Buffer.from(await out.arrayBuffer()));
}

function serveFile(res, url) {
  const rel = path.normalize(decodeURIComponent(url.pathname)).replace(/^[/\\]+/, '') || 'index.html';
  const file = path.join(ROOT, rel);
  const inside = path.relative(ROOT, file);
  if (
    inside.startsWith('..') ||
    path.isAbsolute(inside) ||
    PRIVATE.test(inside.split(path.sep).join('/')) ||
    !fs.existsSync(file) ||
    fs.statSync(file).isDirectory()
  ) {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(file).pipe(res);
}

http
  .createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const done = url.pathname === '/api/blitz' ? serveApi(req, res, url) : serveFile(res, url);
    Promise.resolve(done).catch((err) => {
      console.error(err);
      if (!res.headersSent) res.writeHead(500).end();
    });
  })
  .listen(PORT, () => console.log(`Bug Blitz on http://localhost:${PORT}`));
