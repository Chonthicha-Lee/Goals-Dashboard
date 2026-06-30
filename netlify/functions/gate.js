const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const RESET_HOUR = 5; // เวลาที่ token หมดอายุทุกวัน (ตี 5)
const SECRET = process.env.AUTH_SECRET || 'change-this-secret';
const PASSWORD = process.env.SITE_PASSWORD || '';

function currentDayKey() {
  const d = new Date();
  if (d.getUTCHours() + 7 < RESET_HOUR) d.setUTCDate(d.getUTCDate() - 1);
  // ใช้เวลาไทย (UTC+7)
  const th = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  return `${th.getUTCFullYear()}-${th.getUTCMonth()}-${th.getUTCDate()}`;
}

function tokenFor(dayKey) {
  return crypto.createHmac('sha256', SECRET).update(dayKey).digest('hex');
}

function secondsUntilNextReset() {
  const now = new Date();
  const th = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const next = new Date(Date.UTC(th.getUTCFullYear(), th.getUTCMonth(), th.getUTCDate(), RESET_HOUR, 0, 0));
  if (th.getUTCHours() >= RESET_HOUR) next.setUTCDate(next.getUTCDate() + 1);
  return Math.floor((next.getTime() - th.getTime()) / 1000);
}

function parseCookies(header) {
  const out = {};
  (header || '').split(';').forEach(p => {
    const i = p.indexOf('=');
    if (i > -1) out[p.slice(0, i).trim()] = p.slice(i + 1).trim();
  });
  return out;
}

function loginPage(error) {
  return `<!DOCTYPE html>
<html lang="th"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>เข้าสู่ระบบ — Goals Dashboard</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f4f3ef;min-height:100vh;display:flex;align-items:center;justify-content:center}
  .box{background:#fff;border:1px solid #e4e1d8;border-radius:12px;padding:2rem;width:320px;max-width:90vw;text-align:center}
  input{width:100%;height:38px;border:1px solid #e4e1d8;border-radius:8px;padding:0 12px;font-size:14px;margin:14px 0 10px;outline:none}
  button{width:100%;height:38px;background:#15171b;color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer}
  .err{font-size:12px;color:#a32d2d;margin-bottom:8px}
</style></head>
<body>
  <form class="box" method="POST" action="/">
    <p style="font-size:28px;margin-bottom:8px">🔒</p>
    <p style="font-weight:700;font-size:16px;margin-bottom:6px">Goals Dashboard</p>
    <p style="font-size:12px;color:#7a7872">กรอกรหัสผ่านเพื่อเข้าใช้งาน</p>
    <input type="password" name="password" placeholder="รหัสผ่าน" autofocus />
    ${error ? '<p class="err">รหัสผ่านไม่ถูกต้อง</p>' : ''}
    <button type="submit">เข้าสู่ระบบ</button>
  </form>
</body></html>`;
}

exports.handler = async (event) => {
  const dayKey = currentDayKey();
  const expected = tokenFor(dayKey);
  const cookies = parseCookies(event.headers.cookie);

  if (event.httpMethod === 'POST') {
    const params = new URLSearchParams(event.body || '');
    const submitted = params.get('password');

    if (PASSWORD && submitted === PASSWORD) {
      const maxAge = secondsUntilNextReset();
      return {
        statusCode: 303,
        headers: {
          'Set-Cookie': `auth=${expected}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Strict`,
          Location: '/',
        },
        body: '',
      };
    }
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      body: loginPage(true),
    };
  }

  if (cookies.auth === expected) {
    const html = fs.readFileSync(path.join(__dirname, 'dashboard.html'), 'utf8');
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      body: html,
    };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
    body: loginPage(false),
  };
};
