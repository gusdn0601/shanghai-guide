// AUDIT.md 의 29개 장소 표를 만든다 (수정본 index.html + travel-platform 데이터 대조)
// 사용: node qa/audit-table.mjs
import fs from 'fs';

const ROOT = 'D:/ai-factory/projects/shanghai-guide-fixed';
const TP = 'D:/ai-factory/projects/travel-platform/data/cities/shanghai';

const src = fs.readFileSync(ROOT + '/index.html', 'utf8');
function grab(name) {
  let start = src.indexOf(`const ${name} = `);
  if (start < 0) start = src.indexOf(`const ${name}=`);
  if (start < 0) return undefined;
  const eq = src.indexOf('=', start);
  let open = Math.min(...['{', '['].map(ch => { const i = src.indexOf(ch, eq); return i < 0 ? Infinity : i; }));
  const openCh = src[open], closeCh = openCh === '{' ? '}' : ']';
  let depth = 0, i = open, quote = null;
  for (; i < src.length; i++) {
    const c = src[i], prev = src[i - 1];
    if (quote) { if (c === quote && prev !== '\\') quote = null; continue; }
    if (c === "'" || c === '"' || c === '`') { quote = c; continue; }
    if (c === openCh) depth++;
    else if (c === closeCh) { depth--; if (depth === 0) break; }
  }
  return new Function(`return (${src.slice(open, i + 1)});`)();
}

const PLACES = grab('PLACES');
const idMap = JSON.parse(fs.readFileSync(TP + '/id-map.json', 'utf8'));
const byId = {};
for (const f of fs.readdirSync(TP + '/places')) {
  const j = JSON.parse(fs.readFileSync(TP + '/places/' + f, 'utf8'));
  byId[j.id] = j;
}

const rows = [];
let n = 0;
for (const [k, P] of Object.entries(PLACES)) {
  n++;
  const id = idMap[k];
  const tp = id ? byId[id] : null;
  const kw = P.amap || P.cn;
  const city = P.amapCity || P.city || '上海';
  const ls = tp ? (tp.local_search || tp.name_local || '') : '';
  let verdict, mark;
  if (!tp) { verdict = '플랫폼 미등재 — 검색어 그대로 유지(현지 확인)'; mark = '—'; }
  else if (P.amap) { verdict = '검색어 정정'; mark = '✅'; }
  else if (ls === P.cn) { verdict = '이상 없음(cn = 정식명)'; mark = '✅'; }
  else { verdict = `확인 필요(플랫폼 검색어 '${ls}')`; mark = '⚠️'; }
  rows.push([n, k, P.cn, kw, city, tp ? tp.code : '—', ls || '—', mark + ' ' + verdict]);
}
const esc = s => String(s).replace(/\|/g, '\\|');
console.log('| # | 키 | 표시명(cn) | 지도 검색어 | city | 플랫폼 코드 | 플랫폼 local_search | 판정 |');
console.log('|---:|---|---|---|---|---|---|---|');
for (const r of rows) console.log('| ' + r.map(esc).join(' | ') + ' |');

// 통계
const stat = rows.reduce((a, r) => { a.total++; const v = r[7]; if (v.startsWith('✅ 검색어 정정')) a.fixed++; else if (v.startsWith('✅')) a.ok++; else if (v.startsWith('⚠️')) a.check++; else a.unmapped++; return a; }, { total: 0, fixed: 0, ok: 0, check: 0, unmapped: 0 });
console.error('\n' + JSON.stringify(stat));
