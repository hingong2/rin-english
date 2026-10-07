import { withDb } from '../../lib/db.js';
import { checkPassword, sessionCookie, json, readJson } from '../../lib/auth.js';

const MAX_FAILS = 5; // 15분 동안 허용되는 실패 횟수

export async function onRequestPost(context) {
  const { request, env } = context;
  const body = await readJson(request);
  const password = typeof body?.password === 'string' ? body.password.slice(0, 200) : '';
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

  return withDb(context, async (db) => {
    const [rows] = await db.query(
      'SELECT COUNT(*) AS n FROM login_attempts WHERE ip = ? AND attempted_at > NOW() - INTERVAL 15 MINUTE', [ip]);
    if (rows[0].n >= MAX_FAILS) {
      return json({ error: '로그인 시도가 너무 많아요. 15분 뒤에 다시 시도하세요.' }, 429);
    }
    if (!(await checkPassword(env, password))) {
      await db.query('INSERT INTO login_attempts (ip) VALUES (?)', [ip]);
      await db.query('DELETE FROM login_attempts WHERE attempted_at < NOW() - INTERVAL 1 DAY');
      return json({ error: '비밀번호가 맞지 않아요.' }, 401);
    }
    return json({ ok: true }, 200, { 'Set-Cookie': await sessionCookie(env) });
  });
}
