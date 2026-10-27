# -*- coding: utf-8 -*-
"""
상하이 가이드북 빌드 스크립트
- data/itinerary.json 을 index.html 안에 <script id="itinerary-data" type="application/json"> 로 인라인 번들링
- PWA / 애플 홈화면 추가용 메타태그 + 아이콘 자동 생성
- 결과물: 루트 index.html, dist/index.html, dist/manifest.webmanifest, dist/icon-*.png, dist/sw.js
"""
import json
import os
import re
import shutil
import struct
import zlib

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC_HTML = os.path.join(ROOT, "index.html")
DATA_JSON = os.path.join(ROOT, "data", "itinerary.json")
DIST = os.path.join(ROOT, "dist")

DATA_MARK_START = "<!-- INLINE_ITINERARY_DATA_START -->"
DATA_MARK_END = "<!-- INLINE_ITINERARY_DATA_END -->"


# --------------------------------------------------------------------------
# 1) 아이콘 PNG 생성 (외부 의존성 없이 순수 zlib 로 RGBA PNG 인코딩)
# --------------------------------------------------------------------------
def _png_chunk(tag: bytes, data: bytes) -> bytes:
    return (
        struct.pack(">I", len(data))
        + tag
        + data
        + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    )


def write_png(path: str, size: int, pixels) -> None:
    """pixels: (x, y) -> (r, g, b, a)"""
    raw = bytearray()
    for y in range(size):
        raw.append(0)  # filter type 0
        for x in range(size):
            r, g, b, a = pixels(x, y)
            raw += bytes((r, g, b, a))
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    png = (
        b"\x89PNG\r\n\x1a\n"
        + _png_chunk(b"IHDR", ihdr)
        + _png_chunk(b"IDAT", zlib.compress(bytes(raw), 9))
        + _png_chunk(b"IEND", b"")
    )
    with open(path, "wb") as f:
        f.write(png)


def make_icon(size: int, maskable: bool = False):
    """로즈→앰버 그라데이션 배경 + 흰색 '上' 글리프(픽셀 아트) 아이콘."""
    # '上' 자를 9x9 픽셀맵으로 정의 (1 = 글리프)
    GLYPH = [
        "000010000",
        "000010000",
        "000010000",
        "000010000",
        "011111110",
        "000010000",
        "000010000",
        "000010000",
        "000010000",
    ]
    g = len(GLYPH)
    # maskable 은 안전영역(80%) 확보를 위해 글리프를 조금 작게
    glyph_ratio = 0.46 if maskable else 0.56
    glyph_px = size * glyph_ratio
    cell = glyph_px / g
    gx0 = (size - glyph_px) / 2
    gy0 = (size - glyph_px) / 2
    radius = size * 0.22

    def in_rounded(x, y):
        if maskable:
            return True  # maskable 은 꽉 찬 사각형(플랫폼이 알아서 마스킹)
        cx = min(max(x, radius), size - radius)
        cy = min(max(y, radius), size - radius)
        return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2

    def pixels(x, y):
        if not in_rounded(x, y):
            return (0, 0, 0, 0)
        # 대각선 그라데이션: rose(#e11d48) -> amber(#d97706)
        t = (x + y) / (2 * size)
        r = int(225 + (217 - 225) * t)
        gg = int(29 + (119 - 29) * t)
        b = int(72 + (6 - 72) * t)
        # 글리프 영역 판정
        if gx0 <= x < gx0 + glyph_px and gy0 <= y < gy0 + glyph_px:
            col = int((x - gx0) / cell)
            row = int((y - gy0) / cell)
            col = min(col, g - 1)
            row = min(row, g - 1)
            if GLYPH[row][col] == "1":
                return (255, 255, 255, 255)
        return (r, gg, b, 255)

    return pixels


# --------------------------------------------------------------------------
# 2) PWA 메타 블록
# --------------------------------------------------------------------------
PWA_HEAD = """  <!-- ===== PWA / 모바일 홈화면 추가 (애플 터치 아이콘 & 웹앱 메타) ===== -->
  <meta name="theme-color" content="#e11d48">
  <meta name="color-scheme" content="light">
  <meta name="description" content="2026 상하이 & 우전 가족여행 가이드북 - 일정, 맛집, 생존회화, 택시카드까지 오프라인 단일 파일로 작동하는 여행 필수 앱">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="상하이 가이드">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="application-name" content="상하이 가이드">
  <meta name="format-detection" content="telephone=no">
  <link rel="manifest" href="manifest.webmanifest">
  <link rel="apple-touch-icon" href="icon-180.png">
  <link rel="apple-touch-icon" sizes="180x180" href="icon-180.png">
  <link rel="apple-touch-icon" sizes="167x167" href="icon-167.png">
  <link rel="apple-touch-icon" sizes="152x152" href="icon-152.png">
  <link rel="apple-touch-icon" sizes="120x120" href="icon-120.png">
  <link rel="icon" type="image/png" sizes="512x512" href="icon-512.png">
  <link rel="icon" type="image/png" sizes="192x192" href="icon-192.png">
  <link rel="shortcut icon" href="icon-192.png">
  <!-- ===== /PWA ===== -->
"""

# iOS 홈화면 앱은 상태바가 콘텐츠를 덮으므로 safe-area 패딩 보강
SAFE_AREA_CSS = """    /* iOS 홈화면 앱(standalone) 상태바/홈바 인디케이터 대응 */
    @supports (padding: env(safe-area-inset-top)) {
      body { padding-top: env(safe-area-inset-top); padding-bottom: env(safe-area-inset-bottom); }
      header { padding-top: calc(1.5rem + env(safe-area-inset-top)); }
    }
"""


def build():
    with open(SRC_HTML, "r", encoding="utf-8") as f:
        html = f.read()
    with open(DATA_JSON, "r", encoding="utf-8") as f:
        data = json.load(f)

    # --- (1) 인라인 데이터 번들 ---
    # </script> 문자열이 JSON 안에 있으면 파서가 깨지므로 이스케이프
    payload = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    payload = payload.replace("</", "<\\/")
    data_block = (
        DATA_MARK_START
        + '\n  <script id="itinerary-data" type="application/json">'
        + payload
        + "</script>\n  "
        + DATA_MARK_END
    )

    if DATA_MARK_START in html:
        html = re.sub(
            re.escape(DATA_MARK_START) + r".*?" + re.escape(DATA_MARK_END),
            lambda _m: data_block,
            html,
            flags=re.S,
        )
    else:
        html = html.replace("</head>", data_block + "\n</head>", 1)

    # --- (2) PWA 메타 블록 ---
    if "<!-- ===== PWA" in html:
        html = re.sub(
            r"  <!-- ===== PWA.*?<!-- ===== /PWA ===== -->\n",
            lambda _m: PWA_HEAD,
            html,
            flags=re.S,
        )
    else:
        html = html.replace("</head>", PWA_HEAD + "</head>", 1)

    # --- (3) safe-area CSS ---
    if "safe-area-inset-top" not in html:
        html = html.replace("  </style>", SAFE_AREA_CSS + "  </style>", 1)

    # --- (4) 데이터 로더: 인라인 우선, fetch 는 폴백 ---
    old_init = """    async function init() {
      try {
        const res = await fetch('data/itinerary.json');
        tripData = await res.json();
        renderDay(1);
      } catch (err) {
        console.error("데이터 로드 실패:", err);
      }
    }"""
    new_init = """    // 1순위: index.html 에 인라인 번들된 JSON (네트워크 요청 0회 → 중국 현지/비행기 모드에서도 100% 동작)
    // 2순위: 인라인이 없을 때만 data/itinerary.json fetch (개발용 폴백)
    function loadInlineData() {
      const el = document.getElementById('itinerary-data');
      if (!el) return null;
      try {
        return JSON.parse(el.textContent);
      } catch (err) {
        console.error("인라인 데이터 파싱 실패:", err);
        return null;
      }
    }

    async function init() {
      tripData = loadInlineData();
      if (tripData) {
        renderDay(1);
        return;
      }
      try {
        const res = await fetch('data/itinerary.json');
        tripData = await res.json();
        renderDay(1);
      } catch (err) {
        console.error("데이터 로드 실패:", err);
        document.getElementById('timeline-list').innerHTML =
          '<div class="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-4 rounded-2xl">일정 데이터를 불러오지 못했습니다. 페이지를 새로고침 해주세요.</div>';
      }
    }"""
    if old_init in html:
        html = html.replace(old_init, new_init, 1)

    # --- (5) 서비스워커 등록 (http/https 에서만, file:// 에서는 조용히 무시) ---
    if "serviceWorker" not in html:
        html = html.replace(
            "    init();",
            """    // PWA 서비스워커 등록 (오프라인 캐시). file:// 로 열었을 때는 건너뜀.
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(() => {});
      });
    }

    init();""",
            1,
        )

    # --- (6) 출력 ---
    os.makedirs(DIST, exist_ok=True)
    with open(SRC_HTML, "w", encoding="utf-8") as f:
        f.write(html)
    with open(os.path.join(DIST, "index.html"), "w", encoding="utf-8") as f:
        f.write(html)

    # 아이콘
    icon_specs = [
        (512, False),
        (192, False),
        (180, False),
        (167, False),
        (152, False),
        (120, False),
        (512, True),  # maskable
    ]
    for size, maskable in icon_specs:
        name = f"icon-{size}-maskable.png" if maskable else f"icon-{size}.png"
        write_png(os.path.join(DIST, name), size, make_icon(size, maskable))

    # 매니페스트
    manifest = {
        "name": "2026 상하이 & 우전 가족여행 가이드북",
        "short_name": "상하이 가이드",
        "description": "일정·맛집·생존회화·택시카드까지, 오프라인에서도 100% 작동하는 상하이 가족여행 가이드북",
        "lang": "ko",
        "dir": "ltr",
        "start_url": "./index.html",
        "scope": "./",
        "display": "standalone",
        "orientation": "portrait",
        "background_color": "#fffbeb",
        "theme_color": "#e11d48",
        "categories": ["travel", "navigation", "lifestyle"],
        "icons": [
            {"src": "icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any"},
            {"src": "icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any"},
            {"src": "icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"},
        ],
    }
    with open(os.path.join(DIST, "manifest.webmanifest"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)

    # 서비스워커 (오프라인 캐시)
    sw = """/* 상하이 가이드북 오프라인 캐시 서비스워커 */
const CACHE = 'shanghai-guide-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-180.png',
  './icon-152.png',
  './icon-120.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((hit) => {
      if (hit) return hit;
      return fetch(e.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
"""
    with open(os.path.join(DIST, "sw.js"), "w", encoding="utf-8") as f:
        f.write(sw)

    # data 폴더도 dist 에 복사(폴백용, 없어도 동작)
    os.makedirs(os.path.join(DIST, "data"), exist_ok=True)
    shutil.copy2(DATA_JSON, os.path.join(DIST, "data", "itinerary.json"))

    print("[OK] build complete")
    print("  - root index.html  :", os.path.getsize(SRC_HTML), "bytes")
    print("  - dist/index.html  :", os.path.getsize(os.path.join(DIST, "index.html")), "bytes")
    print("  - inline json      :", len(payload), "chars")


if __name__ == "__main__":
    build()
