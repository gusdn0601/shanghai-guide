# 상하이 가이드북 — 고덕지도(AMap) 링크·검색어 전수 점검표

- 점검일: 2026-10-30
- 원본(수정 금지): `D:/ai-factory/projects/shanghai-guide` — **손대지 않았습니다.**
- 수정본: `D:/ai-factory/projects/shanghai-guide-fixed` (모든 변경은 이쪽에만)
- 대조 자료
  - `D:/ai-factory/projects/travel-platform/app/maps-link.js` — 링크 생성 규칙(정본)
  - `D:/ai-factory/projects/travel-platform/docs/ux/amap-audit.md` — 상하이 189곳 감사 결과
  - `D:/ai-factory/projects/travel-platform/data/cities/shanghai/` — `id-map.json`, `places/*.json`(189), `guide-transit.json`, `guide-lodging.json`
  - `D:/ai-factory/projects/travel-platform/docs/ux/guide-verification.md` — 요금·노선 검증 결과
- 배포·push 없음. 가족 정보·PII는 이 문서에 넣지 않았습니다(호텔 전화번호 등은 가이드 원문에만 있음).

## 0. 요약

| 항목 | 결과 |
|---|---:|
| 점검 장소(PLACES 키) | 29 |
| 검색어 정정 | 13 |
| 그대로 둠(이미 정식명) | 13 |
| 플랫폼 미등재(검색어 유지·현지 확인) | 3 (`hotel`, `airporthotel`, `pvgT1`) |
| 여전히 어긋난/모호한 검색어 | 0 |
| 지점(branches) UI 추가 | 1곳 — 사계민복 5개 지점 |
| 지점 데이터는 있으나 UI에 넣지 않은 곳 | 1곳 — 딘타이펑(데이터 품질 문제, 아래 3절) |
| 요금·영업시간·교통 충돌 | 0건 (플랫폼 검증 범위 안에서) |

## 1. 링크 생성 로직 변경

### 1-1. 검색 링크 (지도 버튼·QR·택시 카드)

가이드북은 `keyword` 에 **표시명(cn)** 을 그대로 넣고 있었습니다. 표시명은 `上海城隍庙 九曲桥 湖心亭`, `思南路 思南公馆`, `北外滩滨江 / 苏州河北岸` 처럼 **한 장소에 여러 지명을 붙인 이름**이 많아, 고덕지도 검색이 다른 지점을 잡거나 0건이 되기 쉽습니다.

변경 전 (모든 index 계열 파일, 동일):

```js
const amap = P => `https://uri.amap.com/search?keyword=${enc(P.cn)}&city=${enc(P.city||'上海')}&src=familyguide&callnative=1`;
```

변경 후:

```js
const AMAP_SRC = 'familyguide';
const amapSearch = (kw, city) => `https://uri.amap.com/search?keyword=${enc(kw)}&city=${enc(city||'上海')}&view=list&src=${AMAP_SRC}&callnative=1`;
const amapMarker = (name, lat, lng) => `https://uri.amap.com/marker?position=${lng},${lat}&name=${enc(name)}&coordinate=wgs84&src=${AMAP_SRC}&callnative=1`;
const amapCity = P => P.amapCity || P.city || '上海';
const amap = P => amapSearch(P.amap || P.cn, amapCity(P));
const amapBranch = (b, P) => (b.lat != null && b.lng != null)
  ? amapMarker(b.name || P.cn, b.lat, b.lng)
  : amapSearch(b.name || P.cn, amapCity(P));
```

- `keyword` 는 새 필드 **`PLACES[k].amap`**(현지 정식명)을 우선 쓰고, 없으면 기존 `cn` 을 그대로 씁니다. **폴백이 있어 기존 데이터만으로도 동작합니다.**
- `view=list` 를 붙여 플랫폼(`app/maps-link.js`)과 규칙을 맞췄습니다.
- 좌표가 확인된 지점은 `/marker?...&coordinate=wgs84` 로 보냅니다. **`coordinate=wgs84` 를 빠뜨리면 고덕지도가 GCJ-02 로 해석해 100~700m 어긋납니다.** 좌표가 없으면 기존처럼 검색 링크로 폴백합니다.
- `amapCity` 는 도시를 바꿔야 하는 장소용 예비 필드입니다(현재는 우전이 기존 `city:'嘉兴'` 으로 이미 처리되어 미사용).

### 1-2. 지도 브리지 페이지 (`map.html`)

```js
-const searchTarget = (place.cn + ' ' + (place.addr || '')).trim();
-const amapWeb = 'https://uri.amap.com/search?keyword=' + enc(place.cn) + '&city=' + enc(place.city||'上海') + '&src=familyguide&callnative=1';
-const amapApp = isIos ? 'iosamap://poi?...&name=' + enc(place.cn) + ... : 'androidamap://poi?...&keywords=' + enc(place.cn);
+const kw = place.kw || place.cn;
+const searchTarget = (kw + ' ' + (place.addr || '')).trim();
+const amapWeb = 'https://uri.amap.com/search?keyword=' + enc(kw) + '&city=' + enc(place.city||'上海') + '&view=list&src=familyguide&callnative=1';
+const amapApp = isIos ? 'iosamap://poi?...&name=' + enc(kw) + ... : 'androidamap://poi?...&keywords=' + enc(kw);
```

`map.html` 의 `PLACES` 는 JSON 리터럴이라 같은 13곳에 `"kw":"…"` 를 넣었습니다.

### 1-3. 내부 지도 페이지로 넘길 때 장소 키 유지

지도 버튼은 클릭 가로채기로 `map.html?keyword=…&city=…` 로 넘어갑니다. 검색어가 `cn` 과 달라지면 `map.html` 이 PLACES 에서 장소를 못 찾아 **주소가 사라집니다.** 그래서 키를 함께 넘깁니다.

```js
+const pk = Object.keys(PLACES).find(k => (PLACES[k].amap || PLACES[k].cn) === kw);
+window.open(`map.html?${pk ? 'p=' + encodeURIComponent(pk) + '&' : ''}keyword=…&city=…`, '_blank');
```

(오프라인 번들은 `map.html` 을 절대 URL(`https://gusdn0601.github.io/shanghai-guide/map.html`)로 열기 때문에, 같은 변경을 절대 URL 버전으로 따로 적용했습니다.)

## 2. 29개 장소 점검표

`지도 검색어` = 수정 후 실제로 고덕지도에 넘어가는 `keyword`. `플랫폼 local_search` 는 `travel-platform` 의 검증된 현지 검색어입니다.

| # | 키 | 표시명(cn) | 지도 검색어 | city | 플랫폼 코드 | 플랫폼 local_search | 판정 |
|---:|---|---|---|---|---|---|---|
| 1 | hotel | 金郁金香外滩新亚酒店 | 金郁金香外滩新亚酒店 | 上海 | — | — | — 플랫폼 미등재 — 검색어 그대로 유지(현지 확인) |
| 2 | siji | 四季民福烤鸭店(外滩外白渡桥店) | 四季民福 外白渡桥 | 上海 | CN-SHA-F-0001 | 四季民福 外白渡桥 | ✅ 검색어 정정 |
| 3 | yuyuanEve | 上海城隍庙 九曲桥 湖心亭 | 上海城隍庙 | 上海 | CN-SHA-S-0001 | 上海城隍庙 | ✅ 검색어 정정 |
| 4 | bund | 外滩 | 外滩 | 上海 | CN-SHA-S-0002 | 外滩 | ✅ 이상 없음(cn = 정식명) |
| 5 | nanxiang | 南翔馒头店(豫园店) | 南翔馒头店 豫园 | 上海 | CN-SHA-F-0002 | 南翔馒头店 豫园 | ✅ 검색어 정정 |
| 6 | yugarden | 豫园 | 豫园 | 上海 | CN-SHA-S-0003 | 豫园 | ✅ 이상 없음(cn = 정식명) |
| 7 | newworld | 新世界城 莉莲蛋挞 | 莉莲蛋挞 新世界 | 上海 | CN-SHA-F-0003 | 莉莲蛋挞 新世界 | ✅ 검색어 정정 |
| 8 | xizha | 乌镇西栅景区 | 乌镇西栅 | 嘉兴 | CN-SHA-S-0004 | 乌镇西栅 | ✅ 검색어 정정 |
| 9 | jingan | 静安寺 | 静安寺 | 上海 | CN-SHA-S-0005 | 静安寺 | ✅ 이상 없음(cn = 정식명) |
| 10 | roastery | 星巴克臻选上海烘焙工坊 | 星巴克臻选上海烘焙工坊 | 上海 | CN-SHA-P-0001 | 星巴克臻选上海烘焙工坊 | ✅ 이상 없음(cn = 정식명) |
| 11 | louis | 路易号 兴业太古汇 | 路易号 兴业太古汇 | 上海 | CN-SHA-P-0002 | 路易号 兴业太古汇 | ✅ 이상 없음(cn = 정식명) |
| 12 | skewer | 很久以前羊肉串(南京西路818广场店) | 很久以前羊肉串 南京西路 | 上海 | CN-SHA-F-0004 | 很久以前羊肉串 南京西路 | ✅ 검색어 정정 |
| 13 | nanjing | 南京东路步行街 | 南京东路步行街 | 上海 | CN-SHA-S-0006 | 南京东路步行街 | ✅ 이상 없음(cn = 정식명) |
| 14 | lujiazui | 陆家嘴 | 陆家嘴 | 上海 | CN-SHA-S-0007 | 陆家嘴 | ✅ 이상 없음(cn = 정식명) |
| 15 | shtower | 上海中心大厦 | 上海中心大厦 | 上海 | CN-SHA-S-0008 | 上海中心大厦 | ✅ 이상 없음(cn = 정식명) |
| 16 | hotpot | 左庭右院鲜牛肉火锅 正大广场 | 左庭右院 正大广场 | 上海 | CN-SHA-F-0005 | 左庭右院 正大广场 | ✅ 검색어 정정 |
| 17 | binjiang | 滨江大道 | 滨江大道 | 上海 | CN-SHA-S-0009 | 滨江大道 | ✅ 이상 없음(cn = 정식명) |
| 18 | circus | 上海马戏城 | 上海马戏城 | 上海 | CN-SHA-S-0015 | 上海马戏城 | ✅ 이상 없음(cn = 정식명) |
| 19 | sinan | 思南路 思南公馆 | 思南公馆 | 上海 | CN-SHA-S-0012 | 思南公馆 | ✅ 검색어 정정 |
| 20 | madi | 大韩民国临时政府旧址 | 大韩民国临时政府旧址 | 上海 | CN-SHA-S-0013 | 大韩民国临时政府旧址 | ✅ 이상 없음(cn = 정식명) |
| 21 | xintiandi | 新天地 | 新天地 | 上海 | CN-SHA-P-0010 | 新天地 | ✅ 이상 없음(cn = 정식명) |
| 22 | dintaifung | 鼎泰丰(新天地时尚Ⅰ店) | 鼎泰丰 新天地 | 上海 | CN-SHA-F-0007 | 鼎泰丰 新天地 | ✅ 검색어 정정 |
| 23 | tianzifang | 田子坊 | 田子坊 | 上海 | CN-SHA-P-0011 | 田子坊 | ✅ 이상 없음(cn = 정식명) |
| 24 | wukang | 武康路 武康大楼(诺曼底公寓) | 武康大楼 | 上海 | CN-SHA-S-0010 | 武康大楼 | ✅ 검색어 정정 |
| 25 | laojishi | 老吉士酒家(天平路店) | 老吉士 天平路 | 上海 | CN-SHA-F-0006 | 老吉士 天平路 | ✅ 검색어 정정 |
| 26 | beiwaitan | 北外滩滨江 / 苏州河北岸 | 北外滩滨江 | 上海 | CN-SHA-S-0016 | 北外滩滨江 | ✅ 검색어 정정 |
| 27 | airporthotel | 艺龙安悦酒店(上海浦东国际机场店) | 艺龙安悦酒店(上海浦东国际机场店) | 上海 | — | — | — 플랫폼 미등재 — 검색어 그대로 유지(현지 확인) |
| 28 | pvgT1 | 上海浦东国际机场 1号航站楼 | 上海浦东国际机场 1号航站楼 | 上海 | — | — | — 플랫폼 미등재 — 검색어 그대로 유지(현지 확인) |
| 29 | maglev | 上海磁浮列车 | 上海磁浮示范运营线 | 上海 | CN-SHA-T-0006 | 上海磁浮示范运营线 | ✅ 검색어 정정 |

**검색어를 고친 13곳의 이유**

- `yuyuanEve` 上海城隍庙 九曲桥 湖心亭 → **上海城隍庙**: 세 지명을 붙인 표시명. 플랫폼 감사에서도 이 장소의 `local_search` 가 복사 오류로 다른 가게(大壶春) 값이 되어 엉뚱한 곳이 열린 이력이 있고, 지금은 上海城隍庙 로 고정되어 있습니다.
- `sinan` 思南路 思南公馆 → **思南公馆**: '길 이름 + 건물 이름'. 길 이름으로 검색하면 도로 한가운데가 찍힙니다.
- `beiwaitan` 北外滩滨江 / 苏州河北岸 → **北外滩滨江**: 슬래시로 두 지명을 붙였고 한쪽(苏州河北岸)은 하천 이름이라 결과가 흔들립니다.
- `wukang` 武康路 武康大楼(诺曼底公寓) → **武康大楼**: 랜드마크 건물명으로 고정. 괄호 안 옛 이름까지 붙이면 0건이 되기 쉽습니다.
- `dintaifung` 鼎泰丰(新天地时尚Ⅰ店) → **鼎泰丰 新天地**: 괄호 안에 전각 로마숫자 `Ⅰ` 이 들어 있어 고덕지도가 매칭하지 못합니다. 새우알 매장 대신 상호+동네명으로 유지.
- `siji`/`nanxiang`/`skewer`/`hotpot`/`laojishi`/`newworld`/`maglev`: 지점 괄호·수식어를 떼고 **상호 + 동네/역명**만 남겼습니다.
- `xizha` 乌镇西栅景区 → **乌镇西栅**: '景区' 를 떼고, `city` 는 기존 `嘉兴` 유지(우전은 상하이 행정구역이 아님).

**그대로 둔 곳** — `cn` 이 이미 현지 정식명이고, 플랫폼 `local_search` 와도 일치합니다. `binjiang`(滨江大道)·`nanjing`(南京东路步行街)·`lujiazui`(陆家嘴)처럼 넓은 지명은 도시 범위(`city=上海`)로 좁혀지므로 그대로 둬도 무방합니다. `louis`(路易号 兴业太古汇)는 고유 전시·설치물 이름이라 대체 검색어가 없어 유지합니다(현지 확인 항목).

**플랫폼 미등재 3곳** — `hotel`(숙소), `airporthotel`(공항 호텔), `pvgT1`(터미널). 플랫폼 데이터에 대응 항목이 없어 검증할 근거가 없으므로 **검색어를 임의로 바꾸지 않았습니다.** 셋 다 고유 상호/시설명이라 검색 자체는 문제없을 것으로 보지만, "검증됨"으로 표시할 수는 없습니다.

## 3. 다지점 음식점 (지점별 주소·링크)

### 3-1. 사계민복 — 지점 안내 추가함

`travel-platform` `CN-SHA-F-0001.branches[]`(5개 지점)을 그대로 옮겨, 장소 페이지 **'가는 법' 박스 안**에 지점 목록을 넣었습니다. 인쇄/책자에서도 주소는 보이고 링크만 숨겨집니다(`.noprint`).

| 지점 | 주소 | 좌표 | 링크 |
|---|---|---|---|
| 四季民福烤鸭店(外滩外白渡桥店) | 上海市虹口区吴淞路130号城投控股大厦辅楼彩虹北三层 | 없음 | 검색 링크 |
| 四季民福烤鸭店(香港广场店) | 上海市黄浦区淮海中路282号香港广场北座3层 | 31.2258108, 121.4701157 | 마커(WGS84) |
| 四季民福烤鸭店(静安大悦城店) | 上海市静安区西藏北路198号静安大悦城北座5层 | 31.2459874, 121.467506 | 마커(WGS84) |
| 四季民福烤鸭店(中信泰富店) | 上海市静安区南京西路1168号中信泰富广场L402-L403 | 없음 | 검색 링크 |
| 四季民福烤鸭店(龙之梦店) | 上海市长宁区长宁路1018号龙之梦城市生活中心8~10层 | 31.2208976, 121.411965 | 마커(WGS84) |

- 첫 지점이 이 일정의 식당입니다(`이 일정의 지점` 배지). 가이드 본문 주소는 `吴淞路130号北楼3楼`, 플랫폼 지점 주소는 `…城投控股大厦辅楼彩虹北三层` — **같은 건물의 층/동 표기가 다릅니다.** 본문을 고치지 않고 지점 표에만 플랫폼 표기를 병기했으니, 출발 전 한 번 확인하세요.
- 좌표는 WGS84 기준이며 `coordinate=wgs84` 를 명시해 넘깁니다.

### 3-2. 딘타이펑 — 지점 UI 를 넣지 않음 (의도적)

플랫폼 `CN-SHA-F-0007.branches[]` 는 OpenStreetMap 노드 2개입니다.

| 지점 | 주소 | 비고 |
|---|---|---|
| 鼎泰丰((New World)) | — | 이름에 이중 괄호, 주소 없음. OSM node 6350970774 |
| 鼎泰丰 | 南京西路 1376 | 주소가 도로명+번지뿐. OSM node 1750771478 |

둘 다 **이번 일정의 매장(신천지 남리)이 아니고**, 주소·표기 품질이 낮아 화면에 내보내면 오히려 잘못된 지점으로 유도합니다. 그래서 UI 는 넣지 않고, 검색어를 `鼎泰丰 新天地` 로 고정하는 것으로 일정 매장을 정확히 겨냥했습니다. (플랫폼 감사 문서도 이 2건을 "저품질 OSM" 으로 기록하고 있습니다.)

### 3-3. 하이디라오(海底捞)

플랫폼에 `CN-SHA-F-0020`(4개 지점)이 있으나 **가이드북에 이 식당이 없어** 손대지 않았습니다. 나중에 일정에 넣는다면 그때 `branches[]` 를 같은 방식으로 붙이면 됩니다.

## 4. 요금·영업시간·교통 대조 (`guide-verification.md` 기준)

플랫폼이 **검증 완료(verified)** 로 표시한 상하이 항목과 가이드 본문을 1:1로 맞춰 봤습니다.

| 가이드 기재 | 플랫폼 검증값 | 판정 |
|---|---|---|
| 지하철 2·7·14호선 징안쓰역 바로 위 | 징안쓰역 = 2·7·14호선 | 일치 |
| 9호선 다푸차오역 1번 출구(티엔즈팡) | 9호선 다푸차오 | 일치 |
| 2호선 한 줄로 정안사 → 난징루 → 루자쭈이 | 2호선 인민광장·난징둥루·루자쭈이 | 일치 |
| 2호선으로 강 건너 루자쭈이 | 2호선 루자쭈이 | 일치 |
| 자기부상 편도 50위안 / 당일 항공권·교통카드 40위안 | 플랫폼 미검증(자기부상 요금은 검증 항목 아님) | 충돌 없음·현지 확인 |
| 자기부상 첫차 06:45 · 막차 21:40 · 15~20분 간격 · 약 8분 | 동일(플랫폼 미검증, 가이드 내부 일관) | 충돌 없음 |
| 공항 호텔 셔틀 픽업 16:00~03:00 · 12시간 전 예약 | 플랫폼 숙박 데이터에 셔틀 항목 없음 | 충돌 없음·현지 확인 |
| 호텔→공항호텔 택시 15~25분 / 룽양루역 약 20분 | 플랫폼은 '시내↔푸동공항 택시 50~80분·180~250위안'만 검증 | **다른 구간** — 충돌 아님 |
| 상하이타워 입장 180위안(2026 안내 기준) | 플랫폼 `price_hint` 없음(추정치만 존재) | 충돌 없음·현지 확인 |
| 임정청사 입장 20위안 / 쑹칭링 옛집 20위안 | 플랫폼 추정치만 존재 | 충돌 없음·현지 확인 |
| 우전 서책 입장권 150위안 안팎 | 플랫폼 미검증 | 충돌 없음·현지 확인 |

**결론: 플랫폼이 검증한 범위 안에서 가이드와 어긋나는 요금·영업시간·교통 정보는 없습니다.** 다만 플랫폼의 상하이 장소 요금은 대부분 `추정` 이라, 가이드의 구체적 금액을 "검증됨" 으로 올릴 근거는 아닙니다. 위 표의 '현지 확인' 항목은 그대로 두는 것이 맞습니다.

참고로 플랫폼이 과거에 고쳤던 항목(4호선 주요역 세기공원→세기대도, 9호선 싱가오루→샤오난먼, 푸동공항 2호선 60~75분·7위안, 1일권 18위안·3일권 45위안)은 **가이드북에 해당 서술 자체가 없어** 손볼 곳이 없었습니다. 가이드에 4호선·9호선 노선 설명을 추가할 일이 생기면 위 정정값을 쓰세요.

## 5. 점검 중 발견한 별도 문제 (링크와 무관)

### 5-1. `guide-new/index.html` 은 갱신이 멈춘 옛 사본입니다

| 파일 | 표지 경로 지도 | 최근 커밋 |
|---|---|---|
| `index.html` | `viewBox="0 0 360 580"` (3열 스네이크) | 최신 커밋 계속 반영 |
| `shanghai-offline.html` 2종 | `viewBox="0 0 360 580"` | 최신 커밋 계속 반영 |
| `guide-new/index.html` | `viewBox="0 0 360 1280"` (옛 곡선형) | `843bcfa` 이후 **갱신 없음** |

- 최근 라우트맵·쓰난루 보강 커밋은 `index.html` + 두 오프라인 번들만 건드렸고 `guide-new/index.html` 은 빠져 있습니다.
- 쓰난루(`sinan`) 카드도 `guide-new/index.html` 이 짧은 옛 버전입니다.
- 이번 작업에서는 **네 파일 모두에 같은 고덕지도 수정을 넣었지만**, 본문 내용(지도·쓰난루 서술)은 동기화하지 않았습니다. 내용 동기화는 링크 점검 범위 밖이고, 잘못 합치면 최신 라우트맵을 되돌릴 위험이 있어 **판단을 남깁니다.**
- 권고: `guide-new/index.html` 을 루트 `index.html` 에서 다시 만들거나, 더 이상 쓰지 않으면 삭제. (현재 배포 사이트는 루트 파일을 서빙합니다.)

### 5-2. 오프라인 번들은 `map.html` 을 절대 URL 로 엽니다

`shanghai-offline.html` 은 `https://gusdn0601.github.io/shanghai-guide/map.html?…` 로 이동합니다. 그래서 인터넷이 없으면 지도 버튼이 동작하지 않습니다(원래 있던 동작). 이번에 `p=<키>` 전달도 절대 URL 쪽에 똑같이 넣었습니다.

### 5-3. `qa/bundle-offline.py` 는 원본 경로가 하드코딩되어 있습니다

`repo = 'D:/ai-factory/projects/shanghai-guide'` 로 박혀 있어, 수정본에서 그대로 실행하면 **read-only 원본을 덮어씁니다.** 이번 작업에서는 실행하지 않았고, 대신 이미 만들어진 번들 HTML 을 직접 패치했습니다. 앞으로 수정본에서 번들을 다시 만들려면 이 경로를 인자로 받게 고쳐야 합니다.

### 5-4. 기존 검증기 경고 3건(이번 변경과 무관)

`dintaifung`, `beiwaitan`, `maglev` 는 `STOPS`(일정)에 등장하지 않아 책자·일정에 나오지 않습니다. 원본에도 있던 경고이고 이번에 건드리지 않았습니다.

## 6. 적용 범위

같은 수정을 아래 6개 파일에 넣었습니다(원본은 그대로).

| 파일 | 헬퍼 | CSS | 지점 박스 | 인터셉터 | `amap`/`kw` | 지점 데이터 |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| `index.html` | ✔ | ✔ | ✔ | ✔ | 13 | siji |
| `shanghai-offline.html` | ✔ | ✔ | ✔ | ✔(절대 URL) | 13 | siji |
| `guide-new/index.html` | ✔ | ✔ | ✔ | ✔ | 13 | siji |
| `guide-new/shanghai-offline.html` | ✔ | ✔ | ✔ | ✔(절대 URL) | 13 | siji |
| `map.html` | – | – | – | – | 13 (`"kw"`) | – |
| `guide-new/map.html` | – | – | – | – | 13 (`"kw"`) | – |

패치 도구(다시 돌려도 안전, idempotent): `qa/amap-codemod.mjs` + `qa/amap-patch/`
표 생성기: `qa/audit-table.mjs`

## 7. 검증 실행 결과

```bash
# 1) PLACES 스키마 + 교차 참조 (amap/amapCity/branches 검사 추가)
node qa/validate-places.mjs index.html
node qa/validate-places.mjs guide-new/index.html
node qa/validate-places.mjs shanghai-offline.html
node qa/validate-places.mjs guide-new/shanghai-offline.html
# → 4개 모두 OK, 경고 3건(5-4의 기존 경고)만

# 2) 헤드리스 Edge E2E (정적 서버 8123 + CDP 9222)
node qa/e2e.mjs
# → 54 passed, 0 failed
#   · links: amap keyword/city mapping for all places  (amap||cn 기준으로 갱신)
#   · links: DOM amap anchors well-formed (marker 는 position+coordinate=wgs84 검사)
#   · branches: siji place page lists 5 branches with amap links  items=5 links=5
#   · branches: links with coords use marker + coordinate=wgs84   marker=3 wgs84=3
#   · map bridge 3케이스(cn 매칭 / 미매칭 폴백 / p= 키) 모두 keyword·view=list 확인

# 3) 오프라인 번들 사진 무손실 확인
node qa/check-offline-bundle.mjs .
node qa/check-offline-bundle.mjs guide-new
# → 61장 일치, 빠진 사진 없음, 외부 스크립트 없음 (양쪽 동일)
```

E2E 로그에 찍히는 `page errors 4건` 은 헤드리스 환경에 `dianping://`·`androidamap://` 핸들러가 없어서 나오는 **정상 로그**입니다(실패 아님).

## 8. 남은 일 (사람이 확인할 것)

1. `guide-new/index.html` 처리 방향 결정(5-1) — 최신 루트로 재생성 or 삭제.
2. 플랫폼 미등재 3곳(`hotel`, `airporthotel`, `pvgT1`)은 검색어를 검증하지 못했습니다. 현지에서 고덕지도로 한 번씩 검색해 확인 권장.
3. `louis`(路易号 兴业太古汇) — 전시·설치물 이름이라 상시 검색 결과가 바뀔 수 있습니다.
4. 사계민복 본문 주소와 플랫폼 지점 주소의 층/동 표기 차이(3-1) — 출발 전 확인.
5. 자기부상 요금(50/40위안)·첫차/막차, 우전 입장권(150위안), 상하이타워 입장권(180위안)은 플랫폼 검증 범위 밖입니다. 그대로 "약" 표기 유지.
6. `qa/bundle-offline.py` 의 하드코딩 경로(5-3) 수정 — 다음에 번들을 다시 만들 때 필요.
