// Shanghai guide E2E check — drives headless Edge over CDP (no npm deps).
// Usage: node qa/e2e.mjs [baseUrl] [debugPort]
import fs from 'node:fs';

const BASE = process.argv[2] || 'http://127.0.0.1:8123/index.html';
const DBG = `http://127.0.0.1:${process.argv[3] || 9222}`;
const results = [];
const consoleErrors = [];
const netFailures = [];
const externalFailures = [];

function ok(name, pass, detail = '') {
  results.push({ name, pass: !!pass, detail: String(detail).slice(0, 300) });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}

let ws, msgId = 0;
const pending = new Map();
const waiters = [];

function send(method, params = {}) {
  const id = ++msgId;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((res, rej) => pending.set(id, { res, rej, method }));
}

function waitEvent(method, timeout = 15000) {
  return new Promise((res, rej) => {
    const w = { method, res, rej };
    waiters.push(w);
    setTimeout(() => {
      const i = waiters.indexOf(w);
      if (i >= 0) { waiters.splice(i, 1); rej(new Error('timeout waiting ' + method)); }
    }, timeout);
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function evaluate(expression, awaitPromise = false) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise, userGesture: true });
  if (r.exceptionDetails) {
    const m = r.exceptionDetails.exception?.description || r.exceptionDetails.text;
    throw new Error('JS error: ' + m);
  }
  return r.result.value;
}

async function rectOf(selector) {
  return evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return null;
    el.scrollIntoView({block:'center', inline:'center'});
    const r = el.getBoundingClientRect();
    const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
    const hit = document.elementFromPoint(cx, cy);
    return { x: cx, y: cy, w: r.width, h: r.height, visible: r.width > 0 && r.height > 0,
             hitOk: !!(hit && (el === hit || el.contains(hit))), hitTag: hit ? hit.tagName + '.' + hit.className : '' };
  })()`);
}

async function click(selector, { move = true } = {}) {
  let r = await rectOf(selector);
  if (!r) throw new Error('no element: ' + selector);
  if (!r.visible) throw new Error('element not visible: ' + selector);
  await sleep(120);
  // 레이아웃이 이동 중이면(스티키 헤더·부드러운 스크롤) 좌표를 다시 재서 한 번 재시도한다.
  if (!r.hitOk) { await sleep(200); r = (await rectOf(selector)) || r; }
  const p = { x: r.x, y: r.y, button: 'left', clickCount: 1 };
  if (move) await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: r.x, y: r.y });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...p });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...p });
  await sleep(220);
  return r;
}

async function key(keyName, code, keyCode) {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: keyName, code, windowsVirtualKeyCode: keyCode });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: keyName, code, windowsVirtualKeyCode: keyCode });
  await sleep(200);
}

async function navigateAndWait(url) {
  const loaded = waitEvent('Page.loadEventFired');
  await send('Page.navigate', { url });
  await loaded.catch(() => {});
  await sleep(700); // let deferred render (font/QR) settle
}

async function main() {
  const t = await (await fetch(`${DBG}/json/new?about:blank`, { method: 'PUT' })).json();
  ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id);
      pending.delete(m.id);
      m.error ? p.rej(new Error(p.method + ': ' + m.error.message)) : p.res(m.result);
      return;
    }
    for (let i = waiters.length - 1; i >= 0; i--) {
      if (waiters[i].method === m.method) waiters.splice(i, 1)[0].res(m.params);
    }
    if (m.method === 'Runtime.exceptionThrown') {
      consoleErrors.push('exception: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
    }
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
      consoleErrors.push('log: ' + m.params.entry.text + ' ' + (m.params.entry.url || ''));
    }
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      consoleErrors.push('console: ' + m.params.args.map(a => a.value ?? a.description).join(' '));
    }
    if (m.method === 'Network.responseReceived') {
      const { response, type } = m.params;
      if (response.status >= 400) {
        const rec = `${response.status} ${response.url}`;
        (/^https?:.*(fonts\.googleapis|cdnjs|gstatic)/.test(response.url) ? externalFailures : netFailures).push(rec);
      }
      if (type === 'Image' && response.status >= 400) netFailures.push(`img ${response.status} ${response.url}`);
    }
    if (m.method === 'Network.loadingFailed' && !m.params.canceled) {
      netFailures.push(`failed ${m.params.errorText} ${m.params.type}`);
    }
  };

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  // 데이터 작성자가 index.html 을 계속 고치는 중이라, 브라우저 HTTP 캐시가 남은 사본을
  // 물고 오면 검사 결과가 통째로 엉뚱해진다(실제로 한 번 그랬다). 항상 새로 받는다.
  await send('Network.setCacheDisabled', { cacheDisabled: true }).catch(() => {});
  // 서비스워커(sw.js)가 붙어 있어도 항상 서버 최신본을 받는다 — 오프라인 캐시가 검사 결과를 가리면 안 된다.
  await send('Network.setBypassServiceWorker', { bypass: true }).catch(() => {});
  await send('Log.enable');
  await send('Browser.grantPermissions', {
    origin: new URL(BASE).origin,
    permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite']
  }).catch(() => {});

  // ---------- 1. Render ----------
  await navigateAndWait(BASE);
  const render = await evaluate(`(() => ({
    title: document.title,
    views: document.querySelectorAll('.tab-view').length,
    homeVisible: !document.getElementById('homeView').hidden,
    placeHidden: document.getElementById('placeView').hidden,
    days: document.querySelectorAll('.tab-view section.day').length,
    stops: document.querySelectorAll('.stop').length,
    imgs: document.images.length,
    brokenImgs: [...document.images].filter(i => i.complete && i.naturalWidth === 0).map(i => i.getAttribute('src')),
    sheets: document.styleSheets.length,
    bodyH: document.body.scrollHeight,
    fontDisplay: getComputedStyle(document.querySelector('.cover .hangul')).fontFamily
  }))()`);
  ok('render: page loads with title', render.title.includes('상하이'), render.title);
  ok('render: 10 tab views exist', render.views === 10, `views=${render.views}`);
  ok('render: home visible / place hidden', render.homeVisible && render.placeHidden);
  ok('render: day sections + stop cards', render.days >= 5 && render.stops > 10, `days=${render.days} stops=${render.stops}`);
  ok('render: no broken images at load', render.brokenImgs.length === 0, render.brokenImgs.join(', '));
  ok('render: body content height', render.bodyH > 2000, `h=${render.bodyH}`);

  // 외부 스크립트에 기대면 비행기 모드·오프라인 번들에서 기능이 조용히 죽는다(실제로 QR 이 그랬다).
  const extScripts = await evaluate(`[...document.scripts]
    .filter(s => s.src)
    .map(s => s.src)
    .filter(u => { try { return new URL(u, location.href).origin !== location.origin; } catch { return true; } })`);
  ok('render: 외부 스크립트 의존 없음', extScripts.length === 0, extScripts.join(', ') || 'inline·same-origin 만');

  // 5일 각각 일정 카드가 실제로 렌더됐는지 (Day 4·5 데이터 통합 확인)
  const dayFill = await evaluate(`(() => {
    const out = {};
    for (const d of [1,2,3,4,5]) {
      const v = document.getElementById('view-day' + d);
      out['day' + d] = v ? v.querySelectorAll('.stop').length : -1;
    }
    return out;
  })()`);
  ok('render: every day view has stops',
    Object.values(dayFill).every(n => n > 0),
    Object.entries(dayFill).map(([k, v]) => `${k}=${v}`).join(' '));

  // ---------- 2. Top tabs ----------
  // 해시 변경은 hashchange 라는 별도 태스크로 처리된다. 고정 대기(sleep)로 읽으면
  // 한 칸 뒤 상태를 읽어 오탐이 난다(실제로 두 번 났다). 조건이 만족할 때까지 짧게 폴링한다.
  const tabState = tab => evaluate(`(() => ({
      hash: location.hash,
      active: document.querySelector('#view-${tab}')?.classList.contains('active'),
      btn: document.querySelector('#mainTabs .tab-btn[data-tab="${tab}"]')?.classList.contains('active'),
      visible: getComputedStyle(document.querySelector('#view-${tab}')).display !== 'none',
      actives: [...document.querySelectorAll('.tab-view.active')].map(v => v.id).join(',') || 'none',
      placeOpen: !document.getElementById('placeView').hidden
    }))()`);
  const waitTab = async (tab, ms = 1200) => {
    const until = Date.now() + ms;
    let st = await tabState(tab);
    while (Date.now() < until && !(st.hash === '#' + tab && st.active && st.btn)) { await sleep(80); st = await tabState(tab); }
    return st;
  };
  const tabs = ['home', 'day1', 'day2', 'day3', 'day4', 'day5', 'qr', 'talk', 'ready', 'stamp'];
  for (const tab of tabs) {
    const r = await click(`#mainTabs .tab-btn[data-tab="${tab}"]`);
    const state = await waitTab(tab);
    ok(`tab: ${tab} click switches view`, state.active && state.btn && state.visible && state.hash === '#' + tab,
      `hash=${state.hash} active=${state.active} actives=${state.actives} placeOpen=${state.placeOpen} hit=${r.hitOk}@${r.x.toFixed(0)},${r.y.toFixed(0)} over=${r.hitTag}`);
  }

  const qrFill = await evaluate(`(() => { const v = document.getElementById('view-qr'); return v ? v.textContent.trim().length : -1; })()`);
  ok('qr: 입국 QR view has content', qrFill > 50, `chars=${qrFill}`);

  // ---------- 3. Place detail + back ----------
  await click('#mainTabs .tab-btn[data-tab="day1"]');
  await waitTab('day1');
  const placeSelector = '#view-day1 .stop a.sopen';
  const firstPlace = await evaluate(`(() => { const a = document.querySelector(${JSON.stringify(placeSelector)}); return a ? { href: a.getAttribute('href'), txt: a.textContent.trim().slice(0,30) } : null; })()`);
  await click(placeSelector);
  const detail = await evaluate(`(() => ({
    hash: location.hash,
    placeShown: !document.getElementById('placeView').hidden,
    homeHidden: document.getElementById('homeView').hidden,
    hasBackBar: !!document.querySelector('#placeView [data-back]'),
    backBarVisible: (() => { const b = document.querySelector('#placeView [data-back]'); if(!b) return false; const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0; })(),
    title: document.title,
    h1: (document.querySelector('#placeView h1') || {}).textContent || '',
    len: document.getElementById('placeView').innerHTML.length
  }))()`);
  ok('place: opens detail view with back bar', detail.placeShown && detail.homeHidden && detail.hasBackBar && detail.backBarVisible,
    `${firstPlace?.txt} hash=${detail.hash} len=${detail.len}`);
  ok('place: document title updated', detail.title.includes('가이드북') && detail.title !== '상하이 가족 여행 가이드북', detail.title);

  // 장소 페이지의 고덕지도 QR — 라이브러리가 없으면 오류도 없이 빈 자리만 남는다.
  const placeQr = await evaluate(`(() => {
    const blocks = [...document.querySelectorAll('#placeView .qr[data-qr]')];
    const filled = blocks.filter(b => b.querySelector('svg'));
    return { lib: typeof window.qrcode, blocks: blocks.length, filled: filled.length,
             caption: (filled[0]?.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 24) };
  })()`);
  ok('place: 고덕지도 QR 이 생성된다', placeQr.blocks > 0 && placeQr.filled === placeQr.blocks && placeQr.lib === 'function',
    `lib=${placeQr.lib} blocks=${placeQr.blocks} filled=${placeQr.filled} "${placeQr.caption}"`);

  await click('#placeView [data-back]');
  const afterBack = await evaluate(`(() => ({ hash: location.hash, placeHidden: document.getElementById('placeView').hidden, homeVisible: !document.getElementById('homeView').hidden,
    activeView: [...document.querySelectorAll('.tab-view.active')].map(v => v.id).join(',') }))()`);
  ok('place: 목록으로 돌아가기 works', afterBack.placeHidden && afterBack.homeVisible, `hash=${afterBack.hash} active=${afterBack.activeView}`);

  // browser back
  await click(placeSelector);
  await sleep(300);
  await evaluate('history.back()');
  await sleep(500);
  const afterBrowserBack = await evaluate(`(() => ({ hash: location.hash, placeHidden: document.getElementById('placeView').hidden, homeVisible: !document.getElementById('homeView').hidden }))()`);
  ok('place: 브라우저 뒤로가기 works', afterBrowserBack.placeHidden && afterBrowserBack.homeVisible, `hash=${afterBrowserBack.hash}`);

  // ---------- 4. Taxi modal ----------
  await click('#mainTabs .tab-btn[data-tab="talk"]');
  const taxiSel = '#taxiGrid [data-taxi]';
  const taxiKey = await evaluate(`(() => { const b = document.querySelector(${JSON.stringify(taxiSel)}); return b ? b.dataset.taxi : null; })()`);
  await click(taxiSel);
  const modal = await evaluate(`(() => {
    const m = document.getElementById('modal');
    const P = PLACES[${JSON.stringify(taxiKey)}];
    return {
      open: !m.hidden,
      big: document.getElementById('mBig').textContent,
      addr: document.getElementById('mAddr').textContent,
      ko: document.getElementById('mKo').textContent,
      mapHref: document.getElementById('mMap').href,
      expectCn: P.cn,
      expectAddr: P.addr,
      focus: document.activeElement.id
    };
  })()`);
  ok('modal: opens with place data', modal.open && modal.big === modal.expectCn && modal.addr === modal.expectAddr,
    `${modal.big} / ${modal.addr}`);
  ok('modal: amap link populated', modal.mapHref.startsWith('https://uri.amap.com/search?keyword=') && modal.mapHref.includes('city='), modal.mapHref);
  await click('#mCopy');
  const copied = await evaluate(`(async () => {
    let clip = null;
    try { clip = await navigator.clipboard.readText(); } catch (e) { clip = 'ERR:' + e.name; }
    const toast = document.getElementById('toast');
    return { clip, toast: toast.hidden ? '' : toast.textContent };
  })()`, true);
  ok('modal: copy button sets clipboard or shows toast',
    (copied.clip && !copied.clip.startsWith('ERR') && copied.clip.includes(modal.expectAddr)) || !!copied.toast,
    `clip=${String(copied.clip).slice(0, 60)} toast=${copied.toast}`);
  await click('#mClose');
  const closed = await evaluate(`document.getElementById('modal').hidden`);
  ok('modal: 닫기 closes', closed === true);

  // reopen + backdrop + Escape
  await click(taxiSel);
  await key('Escape', 'Escape', 27);
  const escClosed = await evaluate(`document.getElementById('modal').hidden`);
  ok('modal: Escape closes', escClosed === true);

  // ---------- 5. Stamp mission -> gauge ----------
  await click('#mainTabs .tab-btn[data-tab="stamp"]');
  const stampBefore = await evaluate(`(() => ({
    num: document.getElementById('stampNum').textContent,
    numPage: document.getElementById('stampNumPage').textContent,
    width: document.getElementById('stampBar').style.width,
    total: document.querySelectorAll('#stampMissionsList input[type=checkbox]').length
  }))()`);
  await click('#stampMissionsList input[type=checkbox]');
  const stampAfter = await evaluate(`(() => {
    const first = document.querySelector('#stampMissionsList input[type=checkbox]');
    return {
      checked: first.checked,
      num: document.getElementById('stampNum').textContent,
      numPage: document.getElementById('stampNumPage').textContent,
      width: document.getElementById('stampBar').style.width,
      widthPage: document.getElementById('stampBarPage').style.width,
      stored: JSON.parse(localStorage.getItem('stamps3') || '{}')
    };
  })()`);
  const checkedIds = Object.keys(stampAfter.stored || {}).filter(k => stampAfter.stored[k]);
  ok('stamp: checkbox toggles and persists', stampAfter.checked && checkedIds.length >= 1, `stored=${checkedIds.join(',')}`);
  ok('stamp: gauge updates on both views',
    stampAfter.num !== stampBefore.num && stampAfter.width !== stampBefore.width && stampAfter.widthPage !== '0%',
    `${stampBefore.num}(${stampBefore.width}) -> ${stampAfter.num}(${stampAfter.width})`);
  // restore
  await click('#stampMissionsList input[type=checkbox]');
  const restored = await evaluate(`document.getElementById('stampNum').textContent`);
  ok('stamp: uncheck restores count', restored === stampBefore.num, `${restored}`);

  // ---------- 6. Booklet mode ----------
  await click('#mainTabs .tab-btn[data-tab="home"]');
  await click('#bookBtn');
  const booklet = await evaluate(`(() => ({
    on: document.body.classList.contains('booklet'),
    built: document.querySelectorAll('#bookPlaces .bookplace').length,
    viewsShown: getComputedStyle(document.getElementById('view-day2')).display !== 'none',
    navHidden: getComputedStyle(document.querySelector('.top-nav-bar')).display === 'none',
    exitVisible: (() => { const b = document.getElementById('bookExit'); if(!b) return false; const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0; })()
  }))()`);
  ok('booklet: builds all places + hides nav', booklet.on && booklet.built > 5 && booklet.viewsShown && booklet.navHidden,
    `places=${booklet.built}`);
  ok('booklet: has a visible way out', booklet.exitVisible === true);
  await click('#bookExit');
  const bookletOff = await evaluate(`(() => ({ off: !document.body.classList.contains('booklet'),
    exitHidden: getComputedStyle(document.getElementById('bookExit')).display === 'none',
    bookBtnVisible: document.getElementById('bookBtn').getBoundingClientRect().width > 0 }))()`);
  ok('booklet: exit returns to tab view', bookletOff.off && bookletOff.exitHidden && bookletOff.bookBtnVisible,
    `off=${bookletOff.off} exitHidden=${bookletOff.exitHidden}`);

  // ---------- 7. URL mapping + images ----------
  const links = await evaluate(`(() => {
    const out = { amap: [], dp: [], bad: [], places: Object.keys(PLACES).length };
    for (const k of Object.keys(PLACES)) {
      const P = PLACES[k];
      const a = amap(P);
      const u = new URL(a);
      const kwOk = u.searchParams.get('keyword') === (P.amap || P.cn);
      const cityOk = u.searchParams.get('city') === (P.amapCity || P.city || '上海');
      out.amap.push({ k, ok: kwOk && cityOk, kw: u.searchParams.get('keyword'), city: u.searchParams.get('city') });
      if (!kwOk || !cityOk) out.bad.push('amap:' + k);
      if (P.dp) {
        // dpUrl() 은 이제 https://www.dianping.com 이 아니라 로컬 브리지 페이지(dp.html?keyword=…)를 만든다.
        const d = new URL(dpUrl(P.dp), location.href);
        const ok = d.pathname.endsWith('/dp.html') && d.searchParams.get('keyword') === P.dp;
        out.dp.push({ k, ok, url: d.href });
        if (!ok) out.bad.push('dp:' + k);
      }
    }
    const domAmap = [...document.querySelectorAll('a[href^="https://uri.amap.com"]')];
    out.domAmap = domAmap.length;
    // marker 링크는 position+coordinate=wgs84, search 링크는 keyword+city 가 있어야 한다.
    out.domBad = domAmap.filter(a => {
      const u = new URL(a.href);
      if (u.pathname === '/marker') return !u.searchParams.get('position') || u.searchParams.get('coordinate') !== 'wgs84';
      return !u.searchParams.get('keyword') || !u.searchParams.get('city');
    }).map(a => a.href);
    return out;
  })()`);
  ok('links: amap keyword/city mapping for all places', links.bad.filter(b => b.startsWith('amap')).length === 0,
    `${links.amap.length} places, bad=${links.bad.join(',') || 'none'}`);
  ok('links: dp mapping where used', links.dp.every(d => d.ok), `${links.dp.length} dp links`);
  ok('links: DOM amap anchors well-formed', links.domAmap > 0 && links.domBad.length === 0, `anchors=${links.domAmap}`);

  // ---------- 7b. 지점별 주소·고덕지도 링크 (사계민복 5개 지점) ----------
  await navigateAndWait(new URL('#p-siji', BASE).href);
  const branchBox = await evaluate(`(() => {
    const box = document.querySelector('#placeView .branches');
    if (!box) return { found: false };
    const links = [...box.querySelectorAll('a[href^="https://uri.amap.com"]')];
    const marker = links.filter(a => new URL(a.href).pathname === '/marker');
    const wgs = marker.filter(a => new URL(a.href).searchParams.get('coordinate') === 'wgs84');
    return { found: true, items: box.querySelectorAll('li').length, links: links.length, marker: marker.length, wgs: wgs.length,
             title: (box.querySelector('.brh') || {}).textContent || '' };
  })()`);
  ok('branches: siji place page lists 5 branches with amap links', branchBox.found && branchBox.items === 5 && branchBox.links === 5,
    JSON.stringify(branchBox));
  ok('branches: links with coords use marker + coordinate=wgs84', branchBox.found && branchBox.wgs === branchBox.marker && branchBox.wgs >= 1,
    `marker=${branchBox.marker} wgs84=${branchBox.wgs}`);
  await navigateAndWait(BASE);

  // ---------- 8. All images actually load (fetch each img/) ----------
  const imgCheck = await evaluate(`(async () => {
    const srcs = [...new Set([...document.querySelectorAll('img[src^="img/"]')].map(i => i.getAttribute('src')))];
    const bad = [];
    await Promise.all(srcs.map(src => new Promise(res => {
      const im = new Image();
      im.onload = () => { if (!im.naturalWidth) bad.push('zero:' + src); res(); };
      im.onerror = () => { bad.push('error:' + src); res(); };
      im.src = src;
    })));
    return { total: srcs.length, bad };
  })()`, true);
  ok('images: every img/ reference loads', imgCheck.bad.length === 0, `${imgCheck.total} unique, bad=${imgCheck.bad.join(',') || 'none'}`);

  // ---------- 8b. dp 브리지 페이지 (dp.html) ----------
  // 1.8초 뒤 m.dianping.com 으로 자동 이동하므로, 넘어가기 전에 값만 빠르게 읽는다.
  const dpKw = '鼎泰丰 新天地';
  await navigateAndWait(new URL('dp.html?keyword=' + encodeURIComponent(dpKw), BASE).href);
  let dpState = null;
  for (let i = 0; i < 12; i++) {
    dpState = await evaluate(`(() => {
      const app = document.getElementById('btnDpApp'), web = document.getElementById('btnWeb'), t = document.getElementById('placeTitle');
      if (!app || !web || !t) return null;
      return { title: t.textContent, pageTitle: document.title, app: app.getAttribute('href'), web: web.getAttribute('href') };
    })()`);
    if (dpState) break;
    await sleep(100);
  }
  ok('dp bridge: 키워드·딥링크·웹폴백이 채워진다',
    !!dpState && dpState.title === dpKw
      && dpState.app.startsWith('dianping://searchshoplist?keyword=')
      && dpState.web.startsWith('https://m.dianping.com/search/keyword/1/0_')
      && dpState.pageTitle.includes(dpKw),
    dpState ? `title=${dpState.title} app=${dpState.app.slice(0, 40)}… web=${dpState.web.slice(0, 46)}…` : 'dp.html 렌더 실패');

  // ---------- 8c. 지도 브리지 페이지 (map.html) ----------
  // 가이드의 지도 버튼은 uri.amap.com 대신 map.html 로 넘어간다(앱 스킴·폴백 안내 페이지).
  const mapCases = [
    ['map.html?keyword=' + encodeURIComponent('鼎泰丰(新天地时尚Ⅰ店)') + '&city=' + encodeURIComponent('上海'), 'PLACES 매칭(cn)'],
    ['map.html?keyword=' + encodeURIComponent('없는가게이름') + '&city=' + encodeURIComponent('上海'), 'PLACES 미매칭 폴백'],
    ['map.html?p=sinan', 'p 키(내부 링크)'],
  ];
  for (const [href, label] of mapCases) {
    await navigateAndWait(new URL(href, BASE).href);
    const m = await evaluate(`(() => {
      const cn = document.getElementById('placeCn'), kr = document.getElementById('placeKr');
      const a = document.getElementById('btnAmap'), f = document.getElementById('btnFallback');
      if (!cn || !a || !f) return null;
      return { cn: cn.textContent, kr: kr.textContent, kw: (typeof kw !== 'undefined' ? kw : null),
               amap: a.getAttribute('href'), fallback: f.getAttribute('href') };
    })()`);
    const mu = m ? new URL(m.amap) : null;
    const amapOk = !!mu && mu.searchParams.get('keyword') === (m.kw || m.cn) && mu.searchParams.get('view') === 'list';
    ok(`map bridge: ${label}`, !!m && m.cn.length > 0 && amapOk && (m.fallback || '').startsWith('http'),
      m ? `cn=${m.cn} kw=${m.kw} amap=${(m.amap || '').slice(0, 52)}…` : 'map.html 렌더 실패');
  }

  // ---------- 9. Mobile bottom nav ----------
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await navigateAndWait(BASE);
  const mobile = await evaluate(`(() => {
    const nav = document.querySelector('.bottom-nav');
    const r = nav.getBoundingClientRect();
    return { display: getComputedStyle(nav).display, w: r.width, h: r.height, bottom: Math.round(r.bottom),
             items: nav.querySelectorAll('.bnav-item').length, viewport: innerWidth, topNavVisible: getComputedStyle(document.querySelector('.top-nav-bar')).display !== 'none' };
  })()`);
  ok('mobile: bottom nav visible at 390px', mobile.display !== 'none' && mobile.w > 300 && mobile.items >= 5,
    `${mobile.display} ${mobile.w.toFixed(0)}x${mobile.h.toFixed(0)} items=${mobile.items}`);

  const bnavTabs = await evaluate(`[...document.querySelectorAll('.bottom-nav .bnav-item')].map(b => b.dataset.tab)`);
  for (const tab of bnavTabs.filter(Boolean)) {
    await click(`.bottom-nav .bnav-item[data-tab="${tab}"]`);
    const read = () => evaluate(`(() => ({ hash: location.hash, active: document.querySelector('#view-${tab}')?.classList.contains('active'),
      itemActive: document.querySelector('.bottom-nav .bnav-item[data-tab="${tab}"]')?.classList.contains('active') }))()`);
    const until = Date.now() + 1200;
    let st = await read();
    while (Date.now() < until && !(st.hash === '#' + tab && st.active && st.itemActive)) { await sleep(80); st = await read(); }
    ok(`mobile: bottom nav ${tab}`, st.active && st.itemActive && st.hash === '#' + tab, `hash=${st.hash}`);
  }

  // mobile place detail back bar
  await click('.bottom-nav .bnav-item[data-tab="day1"]');
  await waitTab('day1');
  await click('#view-day1 .stop a.sopen');
  const mDetail = await evaluate(`(() => { const b = document.querySelector('#placeView [data-back]'); const r = b?.getBoundingClientRect(); return { shown: !document.getElementById('placeView').hidden, bar: !!b, barY: r ? Math.round(r.top) : null }; })()`);
  ok('mobile: place detail + back bar', mDetail.shown && mDetail.bar, `barTop=${mDetail.barY}`);
  await click('#placeView [data-back]');
  const mBack = await evaluate(`document.getElementById('placeView').hidden`);
  ok('mobile: back returns to list', mBack === true);

  // ---------- 10. Desktop nav hidden again ----------
  await send('Emulation.clearDeviceMetricsOverride');
  await navigateAndWait(BASE);

  // ---------- summary ----------
  const summary = {
    when: new Date().toISOString(),
    base: BASE,
    passed: results.filter(r => r.pass).length,
    failed: results.filter(r => !r.pass).length,
    results,
    pageErrors: consoleErrors,
    networkFailures: netFailures,
    externalFailures,
    fontFamily: render.fontDisplay
  };
  fs.writeFileSync(new URL('./e2e-report.json', import.meta.url), JSON.stringify(summary, null, 2));
  console.log(`\n${summary.passed} passed, ${summary.failed} failed; pageErrors=${consoleErrors.length}, netFailures=${netFailures.length}, external=${externalFailures.length}`);
  if (consoleErrors.length) console.log('page errors:\n  ' + consoleErrors.slice(0, 10).join('\n  '));
  if (netFailures.length) console.log('net failures:\n  ' + netFailures.slice(0, 10).join('\n  '));
  ws.close();
  process.exit(summary.failed ? 1 : 0);
}

main().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
