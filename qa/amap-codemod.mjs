// 고덕지도 링크 일괄 패치 (idempotent)
// 사용: node qa/amap-codemod.mjs [--dry]
// 대상: shanghai-guide-fixed 안의 index 계열 4개 + map.html 2개
// 원본 HTML 은 CRLF 이므로 읽을 때 LF 로 정규화하고, 쓸 때 CRLF 로 되돌린다.
import fs from 'fs';

const ROOT = 'D:/ai-factory/projects/shanghai-guide-fixed';
const PATCH = ROOT + '/qa/amap-patch/';
const dry = process.argv.includes('--dry');
const rd = f => fs.readFileSync(PATCH + f, 'utf8').replace(/\r\n/g, '\n').replace(/\n$/, '');
const keywords = JSON.parse(fs.readFileSync(PATCH + 'keywords.json', 'utf8'));
const branches = JSON.parse(fs.readFileSync(PATCH + 'branches.json', 'utf8'));

const IDX = ['index.html', 'guide-new/index.html', 'shanghai-offline.html', 'guide-new/shanghai-offline.html'];
const MAPS = ['map.html', 'guide-new/map.html'];

const log = [];
const problems = [];
const count = (s, n) => { let c = 0, i = -1; while ((i = s.indexOf(n, i + 1)) >= 0) c++; return c; };
const readLF = f => fs.readFileSync(ROOT + '/' + f, 'utf8').replace(/\r\n/g, '\n');
const writeCRLF = (f, s) => fs.writeFileSync(ROOT + '/' + f, s.replace(/\n/g, '\r\n'));

function replaceOnce(s, oldS, newS, label) {
  const c = count(s, oldS);
  if (c !== 1) { problems.push(`${label}: expected 1 occurrence, found ${c}`); return s; }
  return s.replace(oldS, () => newS);
}

// PLACES 항목(key: { … }) 안에 필드를 1회 삽입. 이미 있으면 건너뜀.
// 원본은 sinan 항목만 2칸 들여쓰기로 어긋나 있어 정규식으로 들여쓰기를 흡수한다.
function insertField(s, file, key, field) {
  const re = new RegExp('\\n([ \\t]*)' + key + ': *\\{', 'g');
  const hits = [...s.matchAll(re)];
  if (hits.length !== 1) { problems.push(`${file} ${key}: header hit count ${hits.length}`); return s; }
  const m = hits[0];
  const indent = m[1];
  const nl = s.indexOf('\n', m.index + m[0].length);
  if (nl < 0) { problems.push(`${file} ${key}: no newline after header`); return s; }
  // 항목 끝: 들여쓰기 0인 '},' 또는 파일 마지막 항목의 '};' 직전 '}'
  let close = s.indexOf('\n},', nl);
  const closeEnd = s.indexOf('\n}\n};', nl);
  if (closeEnd >= 0 && (close < 0 || closeEnd < close)) close = closeEnd;
  if (close < 0) close = s.indexOf('\n};', nl);
  if (close < 0) { problems.push(`${file} ${key}: entry close not found`); return s; }
  const entry = s.slice(nl + 1, close);
  if (entry.includes(field)) return s; // already patched
  return s.slice(0, nl + 1) + indent + '  ' + field + ',\n' + s.slice(nl + 1);
}

function patchIndex(file) {
  let s = readLF(file);
  const before = s;
  // [이름, 이미패치 표시, [ [old,new], ... 후보 ]]
  const steps = [
    ['amapSearch helper', 'const amapSearch = (kw, city)', [['old-helper.txt', 'new-helper.txt']]],
    ['.branches css', '.branches .brh', [['old-css.txt', 'new-css.txt']]],
    ['branch go-box', 'class="branches"', [['old-go.txt', 'new-go.txt']]],
    ['map interceptor', 'const pk = Object.keys(PLACES).find', [
      ['old-interceptor.txt', 'new-interceptor.txt'],
      ['old-offline-interceptor.txt', 'new-offline-interceptor.txt'],
    ]],
  ];
  for (const [name, marker, candidates] of steps) {
    if (s.includes(marker)) { log.push(`${file}: ${name} already patched`); continue; }
    const hit = candidates.find(([oldF]) => count(s, rd(oldF)) === 1);
    if (hit) { s = replaceOnce(s, rd(hit[0]), rd(hit[1]), `${file} ${name}`); log.push(`${file}: ${name} patched`); }
    else { problems.push(`${file} ${name}: no candidate anchor found once`); }
  }
  for (const [k, v] of Object.entries(keywords)) {
    s = insertField(s, file, k, "amap:'" + v.replace(/'/g, "\\'") + "'");
  }
  for (const [k, arr] of Object.entries(branches)) {
    s = insertField(s, file, k, 'branches:' + JSON.stringify(arr));
  }
  if (s !== before) { if (!dry) writeCRLF(file, s); log.push(`${file}: ${dry ? 'would write' : 'WRITTEN'}`); }
  else log.push(`${file}: no change`);
}

function patchMap(file) {
  let s = readLF(file);
  const before = s;
  if (s.includes('const kw = place.kw || place.cn;')) log.push(`${file}: amap block already patched`);
  else {
    const oldS = rd('old-map-amap.txt');
    if (count(s, oldS) === 1) { s = replaceOnce(s, oldS, rd('new-map-amap.txt'), `${file} amap block`); log.push(`${file}: amap block patched`); }
    else problems.push(`${file} amap block: anchor found ${count(s, oldS)}x`);
  }
  for (const [k, v] of Object.entries(keywords)) {
    const head = '"' + k + '":{"kr":';
    const c = count(s, head);
    if (c !== 1) { problems.push(`${file} ${k}: map head count ${c}`); continue; }
    const i = s.indexOf(head);
    const a = s.indexOf('"addr":', i);
    const o = s.indexOf('"kw":', i);
    if (o >= 0 && (a < 0 || o < a)) continue; // already patched
    if (a < 0) { problems.push(`${file} ${k}: no addr field`); continue; }
    s = s.slice(0, a) + '"kw":' + JSON.stringify(v) + ',' + s.slice(a);
  }
  if (s !== before) { if (!dry) writeCRLF(file, s); log.push(`${file}: ${dry ? 'would write' : 'WRITTEN'}`); }
  else log.push(`${file}: no change`);
}

for (const f of IDX) patchIndex(f);
for (const f of MAPS) patchMap(f);

console.log(log.join('\n'));
if (problems.length) {
  console.error('\nPROBLEMS:\n' + problems.map(p => ' - ' + p).join('\n'));
  process.exitCode = 1;
} else {
  console.log('\nOK — no problems');
}

// 셀프테스트: 새 헬퍼가 의도한 URL 을 만드는지 확인
const enc = encodeURIComponent;
const sandbox = new Function('enc', rd('new-helper.txt') + '\nreturn {amap,amapBranch};')(enc);
const demo = { cn: '上海城隍庙 九曲桥 湖心亭', amap: '上海城隍庙' };
console.log('\n[selftest] ' + sandbox.amap(demo));
console.log('[selftest] ' + sandbox.amapBranch({ name: '四季民福烤鸭店(香港广场店)', lat: 31.2258108, lng: 121.4701157 }, demo));
