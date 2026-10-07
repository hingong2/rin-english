import { withDb } from '../../../lib/db.js';
import { isAdmin, json, readJson, isDate, isMonth, cleanWord } from '../../../lib/auth.js';

const DAYS = { 1: 'Mon', 3: 'Wed', 5: 'Fri' }; // vocab_words.day_of_week enum
const cleanText = (s) => String(s ?? '').trim().slice(0, 1000) || null;

// GET /api/words?month=YYYY-MM  → 그 달의 모든 단어
export async function onRequestGet(context) {
  const month = new URL(context.request.url).searchParams.get('month');
  if (!isMonth(month)) return json({ error: 'month 형식이 올바르지 않아요.' }, 400);
  const [y, m] = month.split('-').map(Number);
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;

  return withDb(context, async (db) => {
    const [rows] = await db.query(
      `SELECT word_id AS id, study_date AS date, week_num AS week, word, meaning, example_en, example_ko
       FROM vocab_words WHERE study_date >= ? AND study_date < ? ORDER BY study_date, word_id`,
      [`${month}-01`, next]);
    return json({ words: rows });
  });
}

// POST /api/words  { date, week?, items: [{word, meaning, example_en?, example_ko?}] }  (관리자)
export async function onRequestPost(context) {
  const { request, env } = context;
  if (!(await isAdmin(request, env))) return json({ error: '로그인이 필요해요.' }, 401);
  const body = await readJson(request);
  if (!body || !isDate(body.date) || !Array.isArray(body.items) || !body.items.length || body.items.length > 100) {
    return json({ error: '입력 값이 올바르지 않아요.' }, 400);
  }
  const dow = DAYS[new Date(body.date + 'T00:00:00Z').getUTCDay()];
  if (!dow) return json({ error: '월·수·금 날짜만 등록할 수 있어요.' }, 400);
  if (body.week != null && !(Number.isInteger(body.week) && body.week >= 1 && body.week <= 6)) {
    return json({ error: 'Week 는 1~6 사이 숫자예요.' }, 400);
  }
  const items = body.items.map((i) => {
    const c = cleanWord(i?.word, i?.meaning);
    return c && { ...c, en: cleanText(i.example_en), ko: cleanText(i.example_ko) };
  });
  if (items.includes(null)) {
    return json({ error: '단어는 영문, 뜻은 100자 이내로 입력하세요.' }, 400);
  }

  return withDb(context, async (db) => {
    // Week: 직접 지정 > 그 날짜의 기존 값 > 날짜로 계산
    const [w] = await db.query('SELECT week_num FROM vocab_words WHERE study_date = ? LIMIT 1', [body.date]);
    const week = body.week ?? w[0]?.week_num ?? Math.ceil(Number(body.date.slice(8)) / 7);
    for (const it of items) {
      const [ex] = await db.query(
        'SELECT word_id FROM vocab_words WHERE study_date = ? AND word = ? LIMIT 1', [body.date, it.word]);
      if (ex.length) {
        await db.query(
          `UPDATE vocab_words SET meaning = ?, example_en = COALESCE(?, example_en),
           example_ko = COALESCE(?, example_ko) WHERE word_id = ?`,
          [it.meaning, it.en, it.ko, ex[0].word_id]);
      } else {
        await db.query(
          `INSERT INTO vocab_words (study_date, week_num, day_of_week, word, meaning, example_en, example_ko)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [body.date, week, dow, it.word, it.meaning, it.en, it.ko]);
      }
    }
    if (body.week != null) {
      await db.query('UPDATE vocab_words SET week_num = ? WHERE study_date = ?', [week, body.date]);
    }
    return json({ ok: true, count: items.length });
  });
}
