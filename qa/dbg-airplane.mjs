// 재생성된 오프라인 단일 파일을 '비행기 모드'로 열어 실제 동작을 본다.
//  - QR 라이브러리가 인라인되어 장소 페이지 QR 이 그려지는가
//  - 지도·대중점평 버튼이 절대 URL 로 열리는가
//  - 사진이 data URI 로 살아 있는가
const DBG = 'http://127.0.0.1:9222';
const FILE = process.argv[2];
if (!FILE) { console.error('usage: node qa/dbg-airplane.mjs <file:// 경로>'); process.exit(2); }
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
const failed = [], pageErr = [], reqUrl = new Map();
ws.onmessage = e => {
  const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); }
  if (m.method === 'Network.requestWillBeSent') reqUrl.set(m.params.requestId, m.params.request.url);
  if (m.method === 'Network.loadingFailed' && !m.params.canceled) failed.push(`${m.params.errorText}  ${(reqUrl.get(m.params.requestId) || '?').slice(0, 80)}`);
  if (m.method === 'Runtime.exceptionThrown') pageErr.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
};
await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true }).catch(() => {});
await send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
await send('Page.navigate', { url: FILE });
for (let i = 0; i < 60; i++) { await sleep(250); if (await ev('document.readyState') === 'complete') break; }
await sleep(1500);

const out = {};
out.boot = await ev(`(() => ({
  title: document.title,
  views: document.querySelectorAll('.tab-view').length,
  stops: document.querySelectorAll('.stop').length,
  qrLib: typeof (window.qrcode),
  manifest: !!document.querySelector('link[rel="manifest"]'),
  scripts: [...document.scripts].map(s => s.src || '(inline)').slice(0, 4),
  sw: 'serviceWorker' in navigator ? (navigator.serviceWorker.controller ? 'controlled' : 'not-controlled') : 'unsupported'
}))()`);

// 장소 3곳을 차례로 열어 QR 이 실제로 그려지는지 본다
out.places = {};
for (const key of ['bund', 'yugarden', 'xizha']) {
  out.places[key] = await ev(`(async () => {
    location.hash = 'p-${key}';
    await new Promise(r => setTimeout(r, 900));
    const pv = document.getElementById('placeView');
    const blocks = [...pv.querySelectorAll('.qr[data-qr]')];
    const filled = blocks.filter(b => b.querySelector('svg'));
    const imgs = [...pv.querySelectorAll('img')];
    await new Promise(r => setTimeout(r, 400));
    return { shown: !pv.hidden, blocks: blocks.length, qrSvg: filled.length,
      caption: (filled[0]?.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 26),
      imgs: imgs.length, imgsLoaded: imgs.filter(i => i.naturalWidth > 0).length };
  })()`, true);
}

// 지도/대중점평 버튼이 여는 URL (window.open 을 가로채 확인)
out.links = await ev(`(async () => {
  const opened = [];
  const realOpen = window.open;
  window.open = (u) => { opened.push(String(u).slice(0, 90)); return null; };
  location.hash = 'p-bund';
  await new Promise(r => setTimeout(r, 800));
  const map = document.querySelector('#placeView a.act.map') || document.querySelector('#placeView a#mMap');
  if (map) map.click();
  await new Promise(r => setTimeout(r, 300));
  const dpref = [...document.querySelectorAll('#placeView a')].find(a => (a.getAttribute('href') || '').includes('dp.html'));
  const dpHref = dpref ? dpref.getAttribute('href') : null;
  window.open = realOpen;
  return { opened, dpHref };
})()`, true);

console.log(JSON.stringify(out, null, 1));
console.log('실패 요청:', failed.length ? failed : 'none');
console.log('페이지 오류:', pageErr.length ? pageErr : 'none');
ws.close();
