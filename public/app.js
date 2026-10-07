// English Words — 화면 로직. 서버에서 온 글자는 모두 textContent 로만 넣습니다 (XSS 방지).
const $ = (s) => document.querySelector(s);
const el = (tag, props = {}, ...kids) => {
  const e = Object.assign(document.createElement(tag), props);
  e.append(...kids);
  return e;
};
const shuffle = (a) => {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toDate = (s) => new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* 저장 불가 환경은 무시 */ } },
};

async function api(path, opt = {}) {
  const res = await fetch('/api/' + path, {
    method: opt.method || 'GET',
    credentials: 'same-origin',
    headers: opt.body ? { 'Content-Type': 'application/json' } : {},
    body: opt.body ? JSON.stringify(opt.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || '문제가 생겼어요. 잠시 후 다시 해보세요.');
  return data;
}

function speak(text) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  u.rate = 0.85;
  speechSynthesis.speak(u);
}

const S = { name: '', ym: ymd(new Date()).slice(0, 7), words: [], byDate: new Map(), weeks: [], week: 0, date: null, stars: new Set() };
let timer = 0;

function show(id) {
  clearTimeout(timer);
  document.querySelectorAll('.view').forEach((v) => { v.hidden = v.id !== id; });
  window.scrollTo(0, 0);
}

// ───────── 시작 화면 ─────────
$('#mascot').addEventListener('error', (e) => { e.target.hidden = true; });
$('#f-name').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = $('#in-name').value.trim();
  const ok = /^[A-Za-z][A-Za-z .'\-]{0,19}$/.test(name);
  $('#name-err').hidden = ok;
  if (!ok) return;
  S.name = name;
  store.set('ew_name', name);
  openBook();
});
$('#b-rename').addEventListener('click', () => {
  $('#in-name').value = S.name;
  show('v-start');
  $('#in-name').focus();
});

// ───────── 단어장 ─────────
function openBook() {
  $('#who').textContent = S.name;
  show('v-book');
  loadMonth();
}

async function loadMonth(keepDate) {
  const [y, m] = S.ym.split('-');
  $('#month-label').textContent = `${y}년 ${+m}월`;
  $('#book-body').hidden = true;
  const msg = $('#book-msg');
  msg.hidden = false;
  msg.textContent = '단어를 불러오는 중…';
  try {
    const ym = S.ym;
    const [w, r] = await Promise.all([
      api(`words?month=${ym}`),
      api(`results?name=${encodeURIComponent(S.name)}&month=${ym}`).catch(() => ({ results: [] })),
    ]);
    if (ym !== S.ym) return; // 그 사이 다른 달로 이동함
    S.words = w.words;
    S.stars = new Set(r.results.filter((x) => x.best >= 90).map((x) => x.date));
  } catch (e) {
    msg.textContent = e.message;
    return;
  }
  S.byDate = new Map();
  for (const x of S.words) {
    if (!S.byDate.has(x.date)) S.byDate.set(x.date, []);
    S.byDate.get(x.date).push(x);
  }
  // DB 의 week_num 으로 주 묶기
  const weeks = new Map();
  for (const [d, list] of S.byDate) {
    const k = list[0].week;
    if (!weeks.has(k)) weeks.set(k, { num: k, dates: [] });
    weeks.get(k).dates.push(d);
  }
  S.weeks = [...weeks.values()].sort((a, b) => a.num - b.num);
  if (!S.weeks.length) {
    msg.textContent = '이 달에는 아직 단어가 없어요.';
    return;
  }
  const dates = [...S.byDate.keys()];
  const today = ymd(new Date());
  S.date = (keepDate && S.byDate.has(keepDate) && keepDate) ||
    dates.filter((d) => d <= today).pop() || dates[0];
  S.week = S.weeks.findIndex((w) => w.dates.includes(S.date));
  msg.hidden = true;
  $('#book-body').hidden = false;
  renderBook();
}

function chip(label, selected, onClick) {
  const b = el('button', { className: 'chip', textContent: label });
  b.setAttribute('role', 'tab');
  b.setAttribute('aria-selected', String(selected));
  b.addEventListener('click', onClick);
  return b;
}

function renderBook() {
  $('#weeks').replaceChildren(...S.weeks.map((w, i) =>
    chip(`Week ${w.num}`, i === S.week, () => { S.week = i; S.date = w.dates[0]; renderBook(); })));
  $('#days').replaceChildren(...S.weeks[S.week].dates.map((d) => {
    const t = toDate(d);
    const label = `${DOW[t.getDay()]} ${t.getMonth() + 1}/${t.getDate()}${S.stars.has(d) ? ' ⭐' : ''}`;
    return chip(label, d === S.date, () => { S.date = d; renderBook(); });
  }));
  const list = S.byDate.get(S.date);
  $('#count').textContent = `오늘의 단어 ${list.length}개`;
  $('#wordlist').replaceChildren(...list.map((x) => {
    const b = el('button', { className: 'btn w', textContent: `🔊 ${x.word}` });
    b.setAttribute('aria-label', `${x.word} 발음 듣기`);
    b.addEventListener('click', () => speak(x.word));
    const info = el('div', { className: 'info' }, el('span', { className: 'm', textContent: x.meaning }));
    if (x.example_en) info.append(el('small', { textContent: x.example_en }));
    if (x.example_ko) info.append(el('small', { className: 'm', textContent: x.example_ko }));
    return el('li', {}, b, info);
  }));
  $('#b-monthly').disabled = S.words.length < 4;
}

function moveMonth(step) {
  const [y, m] = S.ym.split('-').map(Number);
  const d = new Date(y, m - 1 + step, 1);
  S.ym = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  loadMonth();
}
$('#b-prev').addEventListener('click', () => moveMonth(-1));
$('#b-next').addEventListener('click', () => moveMonth(1));
$('#b-hide').addEventListener('click', (e) => {
  const on = $('#wordlist').classList.toggle('hide');
  e.target.setAttribute('aria-pressed', String(on));
  e.target.textContent = on ? '뜻 보기' : '뜻 가리기';
});
$('#b-play').addEventListener('click', () => show('v-modes'));
$('#b-monthly').addEventListener('click', () =>
  startGame('monthly', shuffle(S.words).slice(0, 20), `${S.ym}-01`));
document.querySelectorAll('.mode').forEach((b) =>
  b.addEventListener('click', () => startGame(b.dataset.mode, S.byDate.get(S.date), S.date)));
document.querySelectorAll('[data-back]').forEach((b) =>
  b.addEventListener('click', () => { speechSynthesis?.cancel(); show('v-book'); renderBook(); }));

// ───────── 게임 ─────────
let G = null;

function startGame(mode, list, date) {
  G = { mode, list, date, score: 0, total: list.length, missed: [] };
  show('v-game');
  $('#prog').value = 0;
  if (mode === 'match') playMatch();
  else if (mode === 'spelling') playSpelling(shuffle(list), 0);
  else playMeaning(shuffle(list), 0);
}
$('#b-again').addEventListener('click', () => {
  const list = G.mode === 'monthly' ? shuffle(S.words).slice(0, 20) : G.list;
  startGame(G.mode, list, G.date);
});

function progress(i, total) { $('#prog').value = i / total; }
function shake(node) {
  node.classList.remove('shake');
  void node.offsetWidth;
  node.classList.add('shake');
}

// 뜻 고르기 (Monthly Test 도 같은 방식)
function playMeaning(qs, i) {
  if (i >= qs.length) return finish();
  progress(i, qs.length);
  const q = qs[i];
  const others = shuffle([...new Set(S.words.map((x) => x.meaning))].filter((m) => m !== q.meaning)).slice(0, 3);
  let first = true;
  const word = el('button', { className: 'q', textContent: q.word });
  word.setAttribute('aria-label', `${q.word} 발음 듣기`);
  word.addEventListener('click', () => speak(q.word));
  const box = el('div', { className: 'choices' }, ...shuffle([q.meaning, ...others]).map((m) => {
    const b = el('button', { className: 'choice', textContent: m });
    b.addEventListener('click', () => {
      if (m !== q.meaning) {
        first = false;
        b.classList.add('bad');
        b.disabled = true;
        return shake(b);
      }
      b.classList.add('ok');
      box.querySelectorAll('button').forEach((x) => { x.disabled = true; });
      if (first) G.score++; else G.missed.push(q);
      timer = setTimeout(() => playMeaning(qs, i + 1), 700);
    });
    return b;
  }));
  $('#stage').replaceChildren(
    el('p', { className: 'hint', textContent: `${i + 1} / ${qs.length} · 단어를 누르면 소리가 나요` }), word, box);
  speak(q.word);
}

// 카드 짝 맞추기
function playMatch() {
  const pairs = shuffle(G.list).slice(0, 6);
  G.total = pairs.length;
  let sel = null, done = 0, wrong = 0;
  const cards = shuffle(pairs.flatMap((p, n) => [
    { n, kind: 'w', text: p.word }, { n, kind: 'm', text: p.meaning }]));
  const grid = el('div', { className: 'grid' }, ...cards.map((c) => {
    const b = el('button', { className: 'mcard', textContent: c.text });
    b.addEventListener('click', () => {
      if (c.kind === 'w') speak(c.text);
      if (!sel) { sel = { c, b }; b.classList.add('sel'); return; }
      if (sel.b === b) { b.classList.remove('sel'); sel = null; return; }
      sel.b.classList.remove('sel');
      if (sel.c.n === c.n && sel.c.kind !== c.kind) {
        for (const x of [sel.b, b]) { x.classList.add('done', 'c' + c.n); x.disabled = true; }
        progress(++done, pairs.length);
        if (done === pairs.length) {
          G.score = Math.max(0, pairs.length - wrong);
          timer = setTimeout(finish, 800);
        }
      } else {
        wrong++;
        shake(sel.b); shake(b);
      }
      sel = null;
    });
    return b;
  }));
  const again = el('button', { className: 'btn ghost', textContent: '처음부터 다시' });
  again.addEventListener('click', playMatch);
  progress(0, 1);
  $('#stage').replaceChildren(
    el('p', { className: 'hint', textContent: '같은 짝을 찾으면 같은 색으로 변해요!' }), grid, again);
}

// 스펠링 게임
function playSpelling(qs, i) {
  if (i >= qs.length) return finish();
  progress(i, qs.length);
  const q = qs[i];
  const chars = [...q.word];
  const isLetter = (c) => /[A-Za-z]/.test(c);
  let pos = 0, clean = true;
  const slots = el('div', { className: 'slots' });
  const draw = () => {
    while (pos < chars.length && !isLetter(chars[pos])) pos++;
    slots.textContent = chars.map((c, k) => (k < pos || !isLetter(c) ? c : '_')).join('');
  };
  const tiles = el('div', { className: 'tiles' }, ...shuffle(chars.filter(isLetter)).map((c) => {
    const b = el('button', { className: 'tile', textContent: c.toLowerCase() });
    b.addEventListener('click', () => {
      if (c.toLowerCase() !== chars[pos].toLowerCase()) { clean = false; return shake(b); }
      b.classList.add('ok');
      b.disabled = true;
      pos++;
      draw();
      if (pos >= chars.length) {
        speak(q.word);
        if (clean) G.score++; else G.missed.push(q);
        timer = setTimeout(() => playSpelling(qs, i + 1), 1000);
      }
    });
    return b;
  }));
  draw();
  $('#stage').replaceChildren(
    el('p', { className: 'hint', textContent: `${i + 1} / ${qs.length} · 철자를 순서대로 톡톡!` }),
    el('div', { className: 'q', textContent: q.meaning }), slots, tiles);
}

function finish() {
  const ratio = G.score / G.total;
  const n = ratio >= 0.9 ? 3 : ratio >= 0.6 ? 2 : 1;
  $('#stars').replaceChildren(...[0, 1, 2].map((k) =>
    el('span', { className: k < n ? '' : 'off', textContent: '⭐' })));
  $('#done-title').textContent = n === 3 ? '대단해요! 최고예요!' : n === 2 ? '잘했어요!' : '좋아요, 한 번 더 해볼까요?';
  $('#done-score').textContent = `${G.total}개 중 ${G.score}개를 한 번에 맞혔어요.`;
  $('#review').hidden = !G.missed.length;
  $('#review-list').replaceChildren(...G.missed.map((x) =>
    el('li', {}, el('b', { textContent: x.word }), el('span', { textContent: x.meaning }))));
  if (n === 3) S.stars.add(G.date);
  show('v-done');
  api('results', { method: 'POST', body: { name: S.name, date: G.date, mode: G.mode, score: G.score, total: G.total } })
    .catch(() => { /* 기록 저장 실패는 학습을 막지 않음 */ });
}

// ───────── 관리자 ─────────
const dLogin = $('#d-login'), dAdmin = $('#d-admin');
document.querySelectorAll('[data-close]').forEach((b) =>
  b.addEventListener('click', () => b.closest('dialog').close()));

$('#b-admin').addEventListener('click', async () => {
  const { admin } = await api('session').catch(() => ({ admin: false }));
  if (admin) return openAdmin();
  $('#login-err').hidden = true;
  $('#in-pw').value = '';
  dLogin.showModal();
});

$('#f-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('login', { method: 'POST', body: { password: $('#in-pw').value } });
    dLogin.close();
    openAdmin();
  } catch (err) {
    $('#login-err').textContent = err.message;
    $('#login-err').hidden = false;
  }
});

$('#b-logout').addEventListener('click', async () => {
  await api('session', { method: 'DELETE' }).catch(() => {});
  dAdmin.close();
});

function adminMsg(text) {
  $('#admin-msg').textContent = text || '';
  $('#admin-msg').hidden = !text;
}

function openAdmin() {
  $('#in-date').value = S.date || ymd(new Date());
  adminMsg('');
  dAdmin.showModal();
  loadAdmin();
}
$('#in-date').addEventListener('change', loadAdmin);

async function loadAdmin() {
  const date = $('#in-date').value;
  const ul = $('#admin-list');
  if (!date) return ul.replaceChildren();
  let rows;
  try {
    rows = (await api(`words?month=${date.slice(0, 7)}`)).words.filter((x) => x.date === date);
  } catch (e) {
    return adminMsg(e.message);
  }
  $('#in-week').value = rows[0]?.week ?? Math.ceil(Number(date.slice(8)) / 7);
  if (!rows.length) {
    return ul.replaceChildren(el('li', {}, el('span', { className: 'empty', textContent: '이 날짜에는 단어가 없어요.' })));
  }
  ul.replaceChildren(...rows.map((x) => {
    const w = el('input', { value: x.word, maxLength: 100 });
    const m = el('input', { value: x.meaning, maxLength: 100 });
    w.setAttribute('aria-label', '단어');
    m.setAttribute('aria-label', '뜻');
    const save = el('button', { className: 'btn ghost small', textContent: '저장' });
    const del = el('button', { className: 'btn ghost small', textContent: '삭제' });
    save.addEventListener('click', () => change(`words/${x.id}`, 'PUT', { word: w.value, meaning: m.value }));
    del.addEventListener('click', () => {
      // 한 번 더 눌러야 삭제 (실수 방지)
      if (del.dataset.sure) return change(`words/${x.id}`, 'DELETE');
      del.dataset.sure = '1';
      del.textContent = '정말?';
      setTimeout(() => { delete del.dataset.sure; del.textContent = '삭제'; }, 3000);
    });
    return el('li', {}, w, m, save, del);
  }));
}

async function change(path, method, body) {
  try {
    await api(path, { method, body });
    adminMsg('');
    await loadAdmin();
    refreshBook();
  } catch (e) {
    adminMsg(e.message);
  }
}

function refreshBook() {
  if (S.name && !$('#v-book').hidden) loadMonth(S.date);
}

$('#f-add').addEventListener('submit', async (e) => {
  e.preventDefault();
  const items = [];
  for (const line of $('#in-bulk').value.split('\n').map((l) => l.trim()).filter(Boolean)) {
    const [head, en, ko] = line.split('|').map((x) => x.trim());
    const m = head.match(/^(.+?)\s*[=\t,:]\s*(.+)$/);
    if (!m) return adminMsg(`형식을 확인하세요: "${line}"`);
    items.push({ word: m[1].trim(), meaning: m[2].trim(), example_en: en, example_ko: ko });
  }
  if (!items.length) return;
  try {
    await api('words', { method: 'POST', body: { date: $('#in-date').value, week: Number($('#in-week').value) || undefined, items } });
    $('#in-bulk').value = '';
    adminMsg('');
    await loadAdmin();
    refreshBook();
  } catch (err) {
    adminMsg(err.message);
  }
});

// ───────── 시작 ─────────
S.name = store.get('ew_name') || '';
if (/^[A-Za-z][A-Za-z .'\-]{0,19}$/.test(S.name)) openBook();
else show('v-start');
