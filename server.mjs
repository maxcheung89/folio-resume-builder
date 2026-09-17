import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createResumePdf, validatePdfInput } from './pdf-export.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const files = new Map([
  ['/', ['index.html', 'text/html']], ['/index.html', ['index.html', 'text/html']],
  ['/style.css', ['style.css', 'text/css']], ['/app.js', ['app.js', 'text/javascript']],
  ['/profile.js', ['profile.js', 'text/javascript']], ['/sample.md', ['sample.md', 'text/markdown']],
  ['/preferences.js', ['preferences.js', 'text/javascript']], ['/design.css', ['design.css', 'text/css']],
  ['/pdf-preview.js', ['pdf-preview.js', 'text/javascript']],
  ['/custom-fonts.js', ['custom-fonts.js', 'text/javascript']],
  ['/AI-MARKDOWN-PROMPT.md', ['AI-MARKDOWN-PROMPT.md', 'text/markdown']],
  ['/vendor/pdf.min.mjs', ['vendor/pdf.min.mjs', 'text/javascript']],
  ['/vendor/pdf.worker.min.mjs', ['vendor/pdf.worker.min.mjs', 'text/javascript']],
]);
const server = http.createServer(async (req, res) => {
  if (req.url === '/api/export-pdf' && req.method === 'POST') {
    const host = req.headers.host || '';
    if (!/^(127\.0\.0\.1|localhost):\d+$/.test(host) || (req.headers.origin && req.headers.origin !== `http://${host}`)) { res.writeHead(403); res.end('Forbidden'); return; }
    if (!(req.headers['content-type'] || '').startsWith('application/json')) { res.writeHead(415); res.end('JSON required'); return; }
    try {
      const chunks = []; let length = 0;
      for await (const chunk of req) {
        length += chunk.length;
        if (length > 8 * 1024 * 1024) { res.writeHead(413); res.end('Resume is too large'); return; }
        chunks.push(chunk);
      }
      const data = JSON.parse(Buffer.concat(chunks).toString('utf8')); validatePdfInput(data);
      const pdf = await createResumePdf(data);
      res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="resume.pdf"', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(Buffer.from(pdf));
    } catch (error) { res.writeHead(400, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify({ error: error.message || 'PDF could not be generated.' })); }
    return;
  }
  const entry = files.get(new URL(req.url, 'http://localhost').pathname);
  if (!entry || !['GET', 'HEAD'].includes(req.method)) {
    res.writeHead(404); res.end('Not found'); return;
  }
  try {
    const body = await readFile(path.join(root, entry[0]));
    res.writeHead(200, {
      'Content-Type': `${entry[1]}; charset=utf-8`, 'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch { res.writeHead(500); res.end('Unable to read application file'); }
});
server.on('error', error => { console.error(`Cannot start Folio: ${error.message}`); process.exitCode = 1; });
server.listen(Number(process.env.PORT || 4173), '127.0.0.1', () => console.log(`Folio is ready at http://127.0.0.1:${server.address().port}`));

