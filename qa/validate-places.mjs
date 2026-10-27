#!/usr/bin/env node
/*
 * 가이드북 데이터 검증기 (의존성 없음)
 *
 *   node qa/validate-places.mjs guide-new/index.html
 *   node qa/validate-places.mjs guide-src/src/places.js
 *
 * index.html 처럼 PLACES + DAYS + STOPS + ORDER + SHORT + ROUTE + PHOTOS 가
 * 한 파일에 있으면 교차 참조까지 모두 검사합니다.
 * places.js 만 넘기면 PLACES 스키마만 검사합니다.
 * 위반이 있으면 exit 1.
 */
import { readFileSync } from 'node:fs';

const file = process.argv[2];
if (!file) { console.error('usage: node qa/validate-places.mjs <places.js|index.html>'); process.exit(2); }
const src = readFileSync(file, 'utf8');

/* ---------- 소스에서 `const X = {...}` 블록을 뽑아 평가 ---------- */
function grab(name) {
  let start = src.indexOf(`const ${name} = `);
  if (start < 0) start = src.indexOf(`const ${name}=`);
  if (start < 0) return undefined;
  // '=' 뒤 첫 '{' 또는 '[' 부터 짝을 맞춰 리터럴만 잘라 낸다 (배열/객체 모두 지원)
  const eq = src.indexOf('=', start);
  let open = Math.min(...['{', '['].map(ch => { const i = src.indexOf(ch, eq); return i < 0 ? Infinity : i; }));
  if (!Number.isFinite(open)) return undefined;
  const openCh = src[open], closeCh = openCh === '{' ? '}' : ']';
  let depth = 0, i = open, quote = null;
  for (; i < src.length; i++) {
    const c = src[i], prev = src[i - 1];
    if (quote) {
      if (c === quote && prev !== '\\') quote = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') { quote = c; continue; }
    if (c === openCh) depth++;
    else if (c === closeCh) { depth--; if (depth === 0) break; }
  }
  if (depth !== 0) throw new Error(`${name}: ${openCh}${closeCh} 짝이 맞지 않습니다`);
  const literal = src.slice(open, i + 1);
  return new Function(`return (${literal});`)();
}

const PLACES = grab('PLACES');
if (!PLACES) { console.error(`${file}: const PLACES 를 찾지 못했습니다`); process.exit(2); }
const DAYS = grab('DAYS'), STOPS = grab('STOPS'), SHORT = grab('SHORT'), ROUTE = grab('ROUTE'), PHOTOS = grab('PHOTOS');

/* ---------- 검사 도우미 ---------- */
const errors = [], warns = [];
const fail = (k, m) => errors.push(`${k}: ${m}`);
const warn = (k, m) => warns.push(`${k}: ${m}`);
const isStr = v => typeof v === 'string' && v.trim() !== '';
const isPairs = (a, n = 2) => Array.isArray(a) && a.length > 0 && a.every(p => Array.isArray(p) && p.length === n && p.every(x => isStr(String(x))));
const strList = a => Array.isArray(a) && a.every(x => isStr(x));

const KINDS = ['stay', 'food', 'sight', 'shop', 'cafe', 'show', 'move'];

/* ---------- PLACES 검사 ---------- */
const keys = Object.keys(PLACES);
for (const k of keys) {
  const P = PLACES[k];
  if (P === null || typeof P !== 'object') { fail(k, '객체가 아닙니다'); continue; }

  for (const f of ['kr', 'cn', 'addr', 'art', 'lead']) if (!isStr(P[f])) fail(k, `${f} 는 비어 있지 않은 문자열이어야 합니다`);
  if (isStr(P.kind) && !KINDS.includes(P.kind)) warn(k, `kind '${P.kind}' — 쓰는 값: ${KINDS.join(', ')}`);
  if (P.city !== undefined && !isStr(P.city)) fail(k, 'city 는 문자열이어야 합니다(기본값 上海)');
  if (P.dp !== undefined && !isStr(P.dp)) fail(k, 'dp 는 대중점평 검색어 문자열이어야 합니다');
  if (P.tip !== undefined && !isStr(P.tip)) fail(k, 'tip 은 문자열이어야 합니다');

  if (!isPairs(P.facts)) fail(k, 'facts 는 [[라벨, 값], ...] 형태로 1개 이상');
  else if (P.facts.length < 3) warn(k, `facts 가 ${P.facts.length}개 — 보통 3~4개`);
  if (!strList(P.origin)) fail(k, 'origin 은 문단 문자열 배열');
  if (!isPairs(P.timeline)) fail(k, 'timeline 은 [[연도, 설명], ...] 형태');

  if (!P.course || typeof P.course !== 'object') fail(k, 'course {title,intro,points} 가 필요합니다');
  else {
    if (!isStr(P.course.title)) fail(k, 'course.title 이 비었습니다');
    if (!isStr(P.course.intro)) fail(k, 'course.intro 가 비었습니다');
    if (!Array.isArray(P.course.points) || P.course.points.length < 2) fail(k, 'course.points 는 2개 이상');
    else P.course.points.forEach((pt, i) => {
      if (!isStr(pt.name)) fail(k, `course.points[${i}].name 이 비었습니다`);
      if (!isStr(pt.look)) fail(k, `course.points[${i}].look 이 비었습니다`);
      if (pt.story !== undefined && !isStr(pt.story)) fail(k, `course.points[${i}].story 는 문자열`);
      if (pt.cn !== undefined && !isStr(pt.cn)) fail(k, `course.points[${i}].cn 은 문자열`);
    });
  }

  if (!P.kid || typeof P.kid !== 'object') fail(k, 'kid {missions,fun} 이 필요합니다');
  else {
    if (!strList(P.kid.missions)) fail(k, 'kid.missions 는 문자열 배열');
    else if (P.kid.missions.length === 0) warn(k, 'kid.missions 가 비어 스탬프가 생기지 않습니다');
    if (!strList(P.kid.fun)) fail(k, 'kid.fun 은 문자열 배열');
  }
  if (!strList(P.teen)) fail(k, 'teen 은 문자열 배열');
  if (!Array.isArray(P.quiz) || P.quiz.length === 0 || !P.quiz.every(q => q && isStr(q.q) && isStr(q.a)))
    fail(k, 'quiz 는 [{q,a}, ...] 형태로 1개 이상');
  if (P.practical !== undefined && !strList(P.practical)) fail(k, 'practical 은 문자열 배열');
  if (P.order !== undefined && !strList(P.order)) fail(k, 'order 는 문자열 배열(메뉴)');
  if (P.details !== undefined && !(Array.isArray(P.details) && P.details.every(d => d && isStr(d.t) && isStr(d.d))))
    fail(k, 'details 는 [{t,d}, ...] 형태');

  // 사진 인덱스 검사
  const nPhotos = PHOTOS && Array.isArray(PHOTOS[k]) ? PHOTOS[k].length : null;
  if (nPhotos !== null) {
    const refs = [];
    (P.details || []).forEach(d => { if (d && d.img !== undefined) refs.push([`details.img`, d.img]); });
    (P.course.points || []).forEach((pt, i) => { if (pt && pt.img !== undefined) refs.push([`course.points[${i}].img`, pt.img]); });
    for (const [where, v] of refs) {
      const idxs = Array.isArray(v) ? v : [v];
      for (const j of idxs) {
        if (typeof j !== 'number' || !Number.isInteger(j) || j < 0 || j >= nPhotos)
          fail(k, `${where}=${JSON.stringify(j)} — ${k} 사진은 ${nPhotos}장뿐입니다`);
      }
    }
  }
}

/* ---------- 교차 참조 검사 ---------- */
if (DAYS && STOPS) {
  const dayIds = DAYS.map(d => d.id);
  DAYS.forEach(d => {
    if (!isStr(d.id) || !/^day\d+$/.test(d.id)) fail('DAYS', `id '${d.id}' 는 day1, day2 … 형식`);
    if (!isStr(d.cls)) fail('DAYS', `${d.id}.cls 가 비었습니다`);
    if (!isStr(d.date)) fail('DAYS', `${d.id}.date 가 비었습니다`);
    if (!isStr(d.title)) fail('DAYS', `${d.id}.title 이 비었습니다`);
    if (!isStr(d.note)) warn('DAYS', `${d.id}.note 가 비었습니다`);
  });

  STOPS.forEach((s, i) => {
    if (!dayIds.includes(s.day)) fail('STOPS', `[${i}] day '${s.day}' 가 DAYS 에 없습니다`);
    if (s.p === undefined) {
      if (!isStr(s.move)) fail('STOPS', `[${i}] 장소도 이동(move)도 없습니다`);
    } else if (!PLACES[s.p]) {
      fail('STOPS', `[${i}] p '${s.p}' 가 PLACES 에 없습니다`);
    }
    if (s.p !== undefined && !Array.isArray(s.tags)) warn('STOPS', `[${i}] (${s.p}) tags 가 없습니다`);
    if (s.taxi !== undefined && !PLACES[s.taxi]) fail('STOPS', `[${i}] taxi '${s.taxi}' 가 PLACES 에 없습니다`);
  });

  const visited = new Set(STOPS.filter(s => s.p).map(s => s.p));
  for (const k of keys) if (!visited.has(k)) warn(k, 'STOPS 어디에도 등장하지 않아 일정·책자에 나오지 않습니다');
  // SHORT 는 표지 지도(ROUTE)에 찍히는 장소에만 필요합니다.
  if (SHORT) {
    for (const r of ROUTE || []) if (!isStr(SHORT[r[0]])) warn('SHORT', `'${r[0]}' 표지 지도 라벨(SHORT)이 없습니다`);
    for (const k of Object.keys(SHORT)) if (!PLACES[k]) fail('SHORT', `'${k}' 가 PLACES 에 없습니다`);
  }
  if (ROUTE) {
    ROUTE.forEach(([k, x, y], i) => {
      if (!PLACES[k]) fail('ROUTE', `[${i}] '${k}' 가 PLACES 에 없습니다`);
      if (typeof x !== 'number' || typeof y !== 'number') fail('ROUTE', `[${i}] 좌표가 숫자가 아닙니다`);
      if (x < 0 || x > 360 || y < 0 || y > 560) warn('ROUTE', `[${i}] (${x},${y}) 가 지도 viewBox(360x560) 밖입니다`);
    });
  }
}

/* ---------- 출력 ---------- */
const summary = `PLACES ${keys.length}개` +
  (STOPS ? `, STOPS ${STOPS.length}개` : '') +
  (DAYS ? `, DAYS ${DAYS.length}일` : '');
if (errors.length === 0) {
  console.log(`OK  ${file} — ${summary}`);
  if (warns.length) console.log(`    경고 ${warns.length}건:\n      ${warns.join('\n      ')}`);
  process.exit(0);
}
console.error(`FAIL ${file} — 오류 ${errors.length}건, 경고 ${warns.length}건 (${summary})`);
for (const e of errors) console.error('  ✗ ' + e);
for (const w of warns) console.error('  ! ' + w);
process.exit(1);
