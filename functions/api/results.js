import { withDb } from '../../lib/db.js';
import { json, readJson, isDate, isMonth } from '../../lib/auth.js';

const MODES = ['meaning', 'match', 'spelling', 'monthly'];
const cleanName = (s) => {
  const n = String(s ?? '').trim();
  return /^[A-Za-z][A-Za-z .'\-]{0,19}$/.test(n) ? n : null;
};

// GET /api/results?name=Mini&month=YYYY-MM → 날짜/게임별 최고 점수(0~100)
export async function onRequestGet(context) {
  const q = new URL(context.request.url).searchParams;
  const name = cleanName(q.get('name'));
  const month = q.get('month');
  if (!name || !isMonth(month)) return json({ error: '잘못된 요청이에요.' }, 400);
  return withDb(context, async (db) => {
    const [rows] = await db.query(
      `SELECT h.study_date AS date, h.quiz_type AS mode, MAX(h.score) AS best
       FROM quiz_history h JOIN users u ON u.user_id = h.user_id
       WHERE u.user_name = ? AND h.study_date BETWEEN ? AND LAST_DAY(?)
       GROUP BY h.study_date, h.quiz_type`,
      [name, `${month}-01`, `${month}-01`]);
    return json({ results: rows.map((r) => ({ ...r, best: Number(r.best) })) });
  });
}

// POST /api/results { name, date, mode, score, total } → quiz_history.score 에는 100점 만점 점수 저장
export async function onRequestPost(context) {
  const b = await readJson(context.request);
  const name = cleanName(b?.name);
  const ok = name && isDate(b.date) && MODES.includes(b.mode) &&
    Number.isInteger(b.score) && Number.isInteger(b.total) &&
    b.total > 0 && b.total <= 500 && b.score >= 0 && b.score <= b.total;
  if (!ok) return json({ error: '잘못된 요청이에요.' }, 400);
  return withDb(context, async (db) => {
    let [u] = await db.query('SELECT user_id FROM users WHERE user_name = ? LIMIT 1', [name]);
    let userId = u[0]?.user_id;
    if (!userId) {
      const [r] = await db.query('INSERT INTO users (user_name) VALUES (?)', [name]);
      userId = r.insertId;
    }
    await db.query(
      'INSERT INTO quiz_history (user_id, study_date, quiz_type, score) VALUES (?, ?, ?, ?)',
      [userId, b.date, b.mode, Math.round((b.score / b.total) * 100)]);
    return json({ ok: true });
  });
}
