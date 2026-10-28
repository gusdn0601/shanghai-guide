// PWA 실제 오프라인 시나리오 검증 (사용자 관점):
//   1) 온라인으로 접속 → 서비스워커 설치/활성
//   2) 네트워크 차단(오프라인)
//   3) 새로고침 → 캐시에서 부팅되는가, QR·사진·탭이 살아 있는가
// 사용: node qa/check-pwa-offline.mjs <URL>   (기본 http://127.0.0.1:8124/index.html)
// 필요: 헤드리스 Edge + --remote-debugging-port=9222
const DBG = 'http://127.0.0.1:9222';
const URL_ = process.argv[2] || 'http://127.0.0.1:8124/index.html';

let ws, id = 0; const pend = new Map();
const send = (m, p = {}) => { const i = ++id; ws.send(JSON.stringify({ id: i, method: m, params: p })); return new Promise((res, rej) => pend.set(i, { res, rej })); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ev = async (e, a) => {
  const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: !!a, userGesture: true });
  if (r.exceptionDetails) throw new Error('JS ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  return r.result.value;
};

const t = await (await fetch(`${DBG}/json/new?about:blank`, { method: 'PUT' })).json();
ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
const pageErr = [], reqFail = [], reqUrl = new Map();
ws.onmessage = e => {
  const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); }
  if (m.method === 'Network.requestWillBeSent') reqUrl.set(m.params.requestId, m.params.request.url);
  if (m.method === 'Network.loadingFailed' && !m.params.canceled) reqFail.push(`${m.params.errorText} ${(reqUrl.get(m.params.requestId) || '?').slice(0, 70)}`);
  if (m.method === 'Runtime.exceptionThrown') pageErr.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
};
await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };

// 1) 온라인 접속 + SW 활성 대기
await send('Page.navigate', { url: URL_ });
for (let i = 0; i < 60; i++) { await sleep(250); if (await ev('document.readyState') === 'complete') break; }
let sw = await ev(`(async () => {
  if (!('serviceWorker' in navigator)) return { supported: false };
  const reg = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise(r => setTimeout(() => r(null), 8000))
  ]);
  return { supported: true, ready: !!reg, active: !!(reg && reg.active), state: reg && reg.active ? reg.active.state : null,
           controller: !!navigator.serviceWorker.controller, scope: reg && reg.scope };
})()`, true);
check('service worker 설치/활성', !!sw.supported && !!sw.active, `state=${sw.state} scope=${sw.scope || '-'}`);

// 캐시 목록
const caches = await ev(`(async () => {
  const keys = await caches.keys();
  const out = [];
  for (const k of keys) { const c = await caches.open(k); out.push({ name: k, n: (await c.keys()).length }); }
  return out;
})()`, true);
check('프리캐시 채워짐', caches.length > 0 && caches[0].n > 50, caches.map(c => `${c.name}(${c.n})`).join(', '));

// 2) 오프라인 전환
await send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
reqFail.length = 0;

// 3) 새로고침 (사용자가 지하철에서 앱을 다시 여는 상황)
await send('Page.reload', { ignoreCache: false });
await sleep(500);
for (let i = 0; i < 60; i++) { await sleep(250); const rs = await ev('document.readyState').catch(() => null); if (rs === 'complete') break; }
await sleep(1500);

// loading="lazy" 이미지는 뷰포트에 들어와야 받는다. 숨은 탭 안 이미지는 화면에 나오지 않으므로
// 사용자처럼 탭을 하나씩 열어 스크롤한 뒤 측정한다(= 캐시에서 실제로 받아지는지 확인).
const tabNames = await ev(`[...document.querySelectorAll('[data-tab]')].map(b => b.dataset.tab)`);
let switched = 0;
for (const name of tabNames) {
  const r = await ev(`(async () => {
    document.querySelector('[data-tab="${name}"]')?.click();
    await new Promise(r => setTimeout(r, 400));
    for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 100)); }
    window.scrollTo(0, 0); await new Promise(r => setTimeout(r, 600));
    return { hash: location.hash, active: !!document.getElementById('view-${name}')?.classList.contains('active') };
  })()`, true);
  if (r.active) switched++;
}
check('오프라인 탭 전환', switched === tabNames.length && tabNames.length >= 2, `${switched}/${tabNames.length} 탭 활성화됨`);

const boot = await ev(`(() => ({
  title: document.title,
  views: document.querySelectorAll('.tab-view').length,
  stops: document.querySelectorAll('.stop').length,
  expectedStops: typeof STOPS !== 'undefined' ? STOPS.length : -1,
  qrLib: typeof window.qrcode,
  controlled: !!navigator.serviceWorker.controller,
  imgs: [...document.images].length,
  imgsLoaded: [...document.images].filter(i => i.naturalWidth > 0 || (i.getAttribute('src') || '').startsWith('data:')).length
}))()`);
check('오프라인 새로고침 후 부팅', boot.views >= 10 && boot.stops > 0 && boot.stops === boot.expectedStops, `views=${boot.views} stops=${boot.stops}/${boot.expectedStops}`);
check('오프라인에서도 SW 가 제어', boot.controlled === true, `controller=${boot.controlled}`);
check('QR 라이브러리 사용 가능', boot.qrLib === 'function', `typeof qrcode=${boot.qrLib}`);
check('사진 캐시 로드', boot.imgsLoaded === boot.imgs, `${boot.imgsLoaded}/${boot.imgs}`);

// 장소 상세 + QR 렌더
const place = await ev(`(async () => {
  location.hash = 'p-bund';
  await new Promise(r => setTimeout(r, 1200));
  const pv = document.getElementById('placeView');
  const blocks = [...pv.querySelectorAll('.qr[data-qr]')];
  return { shown: !pv.hidden, blocks: blocks.length, rendered: blocks.filter(b => b.querySelector('svg')).length };
})()`, true);
check('오프라인 장소 상세 + QR 렌더', place.shown && place.rendered > 0, `blocks=${place.blocks} rendered=${place.rendered}`);

console.log(`\n요청 실패 ${reqFail.length}건:`, reqFail.slice(0, 6));
console.log('페이지 오류:', pageErr.length ? pageErr.slice(0, 4) : 'none');
const failed = results.filter(r => !r.ok);
console.log(`\n=== ${results.length - failed.length}/${results.length} 통과 ===`);
ws.close();
process.exit(failed.length ? 1 : 0);
