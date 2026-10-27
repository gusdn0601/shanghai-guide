/* 상하이 가이드북 오프라인 캐시 서비스워커 — guide-new 전용
   입국 QR 7장·장소 사진·바우처 PDF까지 미리 받아 두어 비행기 모드에서도 바로 뜹니다. */
const CACHE = 'shanghai-guide-v1793112600';
const ASSETS = [
  './',
  './index.html',
  './map.html',
  './dp.html',
  './manifest.webmanifest',
  './icon-120.png',
  './icon-152.png',
  './icon-167.png',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png',

  './26KK252694528_kkday_voucher.pdf',
  './img/madi-0.jpg',
  './img/xintiandi-0.jpg',
  './img/dintaifung-0.jpg',
  './img/tianzifang-0.jpg',
  './img/wukang-0.jpg',
  './img/laojishi-0.jpg',
  './img/beiwaitan-0.jpg',
  './img/airporthotel-0.jpg',
  './img/pvgT1-0.jpg',
  './img/binjiang-0.jpg',
  './img/bund-0.jpg',
  './img/bund-1.jpg',
  './img/bund-2.jpg',
  './img/bund-3.jpg',
  './img/bund-4.jpg',
  './img/bund-5.jpg',
  './img/bund-6.jpg',
  './img/entry-qr-1.png',
  './img/entry-qr-2.png',
  './img/entry-qr-3.png',
  './img/entry-qr-4.png',
  './img/entry-qr-5.png',
  './img/entry-qr-6.png',
  './img/entry-qr-7.png',
  './img/hotel-0.jpg',
  './img/hotel-1.jpg',
  './img/hotpot-0.jpg',
  './img/jingan-0.jpg',
  './img/jingan-1.jpg',
  './img/lujiazui-0.jpg',
  './img/lujiazui-1.jpg',
  './img/lujiazui-2.jpg',
  './img/lujiazui-3.jpg',
  './img/lujiazui-4.jpg',
  './img/nanjing-0.jpg',
  './img/nanjing-1.jpg',
  './img/nanxiang-0.jpg',
  './img/newworld-0.jpg',
  './img/newworld-1.jpg',
  './img/roastery-0.jpg',
  './img/roastery-1.jpg',
  './img/shtower-0.jpg',
  './img/shtower-1.jpg',
  './img/shtower-2.jpg',
  './img/siji-0.jpg',
  './img/skewer-0.jpg',
  './img/xizha-0.jpg',
  './img/xizha-1.jpg',
  './img/xizha-2.jpg',
  './img/xizha-3.jpg',
  './img/yugarden-0.jpg',
  './img/yugarden-1.jpg',
  './img/yugarden-2.jpg',
  './img/yugarden-3.jpg',
  './img/yugarden-4.jpg',
  './img/yugarden-5.jpg',
  './img/yuyuanEve-0.jpg',
  './img/yuyuanEve-1.jpg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      // 하나라도 실패하면 install 전체가 깨지므로 개별 add 로 담는다
      .then((c) => Promise.all(ASSETS.map((a) => c.add(new Request(a, {cache:'reload'})).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;

  // HTML 문서 탐색(navigation)은 네트워크 우선(Network-First): 온라인이면 항상 최신판, 오프라인이면 캐시
  if (e.request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/')) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(e.request).then((hit) => hit || caches.match('./index.html')))
    );
    return;
  }

  // 그 외 정적 자원(이미지, PDF 등)은 캐시 우선(Cache-First)
  e.respondWith(
    caches.match(e.request).then((hit) => {
      if (hit) return hit;
      return fetch(e.request).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        }
        return res;
      });
    })
  );
});