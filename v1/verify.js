// 단일 파일 오프라인 동작 검증: index.html 의 인라인 JSON 만으로 렌더링되는지 확인
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'dist', 'index.html'), 'utf8');

// 1) 인라인 JSON 추출 & 파싱
const m = html.match(/<script id="itinerary-data" type="application\/json">([\s\S]*?)<\/script>/);
if (!m) { console.error('FAIL: 인라인 데이터 블록 없음'); process.exit(1); }
const data = JSON.parse(m[1]);
console.log('OK  inline JSON parse:', data.days.length, 'days /',
  data.days.map(d => d.timeline.length).join('+'), 'items');

// 2) fetch 호출이 인라인 폴백 경로에만 있는지
const fetchCount = (html.match(/fetch\('data\/itinerary\.json'\)/g) || []).length;
console.log(fetchCount === 1 ? 'OK  fetch fallback only (1회, 인라인 우선)' : 'FAIL fetch count=' + fetchCount);

// 3) 렌더링 함수가 참조하는 필드가 데이터에 존재하는지
const required = ['time', 'title', 'place_kr', 'category'];
let missing = 0;
for (const d of data.days) for (const it of d.timeline)
  for (const k of required) if (!(k in it)) { console.error('MISSING', d.day, k, it.title); missing++; }
console.log(missing === 0 ? 'OK  required fields present' : 'FAIL missing=' + missing);

// 4) PWA 자산 존재 확인
const assets = ['manifest.webmanifest', 'sw.js', 'icon-180.png', 'icon-192.png', 'icon-512.png', 'icon-512-maskable.png'];
for (const a of assets) {
  const p = path.join(__dirname, 'dist', a);
  console.log(fs.existsSync(p) ? 'OK  ' + a : 'FAIL missing ' + a);
}

// 5) 메타태그 확인
const checks = {
  'apple-mobile-web-app-capable': /name="apple-mobile-web-app-capable" content="yes"/,
  'apple-touch-icon 180': /rel="apple-touch-icon"[^>]*icon-180\.png/,
  'theme-color': /name="theme-color" content="#e11d48"/,
  'manifest link': /rel="manifest" href="manifest\.webmanifest"/,
  'viewport': /name="viewport"/,
  'safe-area css': /env\(safe-area-inset-top\)/,
};
for (const [k, re] of Object.entries(checks))
  console.log(re.test(html) ? 'OK  meta: ' + k : 'FAIL meta: ' + k);

// 6) 루트 index.html 과 dist/index.html 동일 여부
const rootHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
console.log(rootHtml === html ? 'OK  root == dist' : 'FAIL root != dist');
