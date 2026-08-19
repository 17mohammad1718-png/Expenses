/**
 * Expenses — سرور محلی ذخیره‌سازی دائمی مخارج کلبه
 *
 * اجرا:  node server.js   →  http://localhost:3000
 *
 * مسیرها:
 *   GET  /                    داشبورد (dashboard.html)
 *   GET  /api/expenses        خروجی JSON داده‌ها
 *   POST /api/expenses        ذخیره‌سازی کامل مجموعه (body = آرایه JSON)
 *
 * ذخیره‌سازی اتمیک است (فایل موقت + rename) و همیشه یک نسخهٔ بکاپ
 * قبل از هر نوشتن در data/backups/ ساخته می‌شود.
 * بدون هیچ وابستگی — فقط ماژول‌های داخلی Node.
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, 'data', 'expenses.json');
const BACKUP_DIR = path.join(ROOT, 'data', 'backups');
const MAX_BODY = 4 * 1024 * 1024; // 4MB — کافی برای صدها ردیف
const KEEP_BACKUPS = 30;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function send(res, code, body, type) {
  res.writeHead(code, { 'Content-Type': type || 'text/plain; charset=utf-8' });
  res.end(body);
}

function sendJson(res, code, obj) {
  send(res, code, JSON.stringify(obj), MIME['.json']);
}

function readData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (err) {
    throw new Error('data/expenses.json خوانده نشد: ' + err.message);
  }
}

function backupRaw(raw) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  fs.writeFileSync(path.join(BACKUP_DIR, `expenses-${stamp}.json`), raw + '\n', 'utf8');
  // نگه‌داشتن فقط KEEP_BACKUPS بکاپ آخر
  try {
    const files = fs.readdirSync(BACKUP_DIR).filter(f => f.startsWith('expenses-')).sort();
    while (files.length > KEEP_BACKUPS) {
      fs.unlinkSync(path.join(BACKUP_DIR, files.shift()));
    }
  } catch (_) { /* ignore */ }
}

/** نوشتن اتمیک + بکاپ. ورودی: آرایهٔ ردیف‌ها (خالی نباشد). */
function writeData(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('payload باید آرایه‌ای غیرخالی باشد');
  }
  for (const r of rows) {
    if (!Number.isInteger(r.id) || typeof r.desc !== 'string' ||
        typeof r.date !== 'string' || !Number.isInteger(r.amount) ||
        typeof r.category !== 'string' || typeof r.source !== 'string') {
      throw new Error('ساختار ردیف ناقص است: ' + JSON.stringify(r).slice(0, 120));
    }
  }
  const raw = JSON.stringify(rows, null, 1) + '\n';
  backupRaw(raw);
  const tmp = DATA_FILE + '.tmp-' + crypto.randomBytes(4).toString('hex');
  fs.writeFileSync(tmp, raw, 'utf8');
  fs.renameSync(tmp, DATA_FILE);
  return rows;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const p = url.pathname;

  if (p === '/api/expenses') {
    if (req.method === 'GET') {
      try {
        send(res, 200, JSON.stringify(readData(), null, 1), MIME['.json']);
      } catch (err) {
        sendJson(res, 500, { error: err.message });
      }
      return;
    }
    if (req.method === 'POST') {
      let raw = '';
      req.on('data', c => {
        raw += c;
        if (raw.length > MAX_BODY) {
          req.destroy();
          return;
        }
      });
      req.on('end', () => {
        try {
          const rows = JSON.parse(raw);
          const saved = writeData(rows);
          const total = saved.reduce((s, r) => s + r.amount, 0);
          sendJson(res, 200, { ok: true, rows: saved.length, total });
        } catch (err) {
          sendJson(res, 400, { error: err.message });
        }
      });
      return;
    }
    sendJson(res, 405, { error: 'فقط GET و POST پشتیبانی می‌شود' });
    return;
  }

  if (p === '/' || p === '/dashboard.html') {
    const f = path.join(ROOT, 'dashboard.html');
    if (!fs.existsSync(f)) return send(res, 404, 'dashboard.html پیدا نشد — کد را کامل fetch کنید.');
    return send(res, 200, fs.readFileSync(f, 'utf8'), MIME['.html']);
  }

  // فایل‌های استاتیک (فقط مسیرهای داخل پروژه)
  const rel = p.replace(/^\/+/, '');
  const full = path.resolve(ROOT, rel);
  if (full.startsWith(ROOT + path.sep) && fs.existsSync(full) && fs.statSync(full).isFile()) {
    const ext = path.extname(full).toLowerCase();
    return send(res, 200, fs.readFileSync(full), MIME[ext] || 'application/octet-stream');
  }

  send(res, 404, 'پیدا نشد');
});

server.listen(PORT, () => {
  console.log(`Expenses dashboard: http://localhost:${PORT}`);
  console.log(`Data file: ${DATA_FILE}`);
});
