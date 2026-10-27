# Day 4·5 장소 데이터 포맷 규격 (경하 · 지아용)

현재 가이드북은 **3일 일정 / 장소 17곳**입니다. Day 4·5 데이터를 이 규격에 맞춰 넣으면
탭·일정표·해설 페이지·스탬프·책자·표지 지도까지 자동으로 따라옵니다.
(단, 새 날짜는 아래 5번의 "새 날짜 추가"를 한 번만 손봐 주셔야 합니다.)

검증은 언제든 이 한 줄로:

```bash
cd D:\ai-factory\projects\shanghai-guide
node qa/validate-places.mjs guide-new/index.html
```

`OK … PLACES 17개, STOPS 22개, DAYS 3일` 처럼 나오면 통과, `✗` 가 하나라도 나오면 실패입니다.
(검증기는 `PLACES`/`DAYS`/`STOPS`/`SHORT`/`ROUTE`/`PHOTOS` 를 실제로 읽어 서로 맞는지까지 봅니다.)

---

## 1. 어디에 넣나

| 파일 | 역할 | 지금 상태 |
| --- | --- | --- |
| `guide-new/index.html` | **실제로 배포·테스트하는 단일 파일.** 데이터가 안에 들어 있음 | 최신. 여기에 먼저 넣고 검증 |
| `guide-src/src/places.js` | `build.py` 로 다시 빌드할 때 쓰는 원본 | 3일치 그대로 |
| `guide-src/src/template.html` | 빌드 템플릿 (`/*__PLACES__*/` 자리에 places.js 가 들어감) | 탭 시스템이 아직 backport 안 됨 |

> ⚠️ 지금 `guide-new/index.html` 이 `guide-src` 빌드 결과보다 앞서 있습니다(탭/라우터, 모바일 하단 내비, 수정 8건).
> `build.py` 를 다시 돌리면 그 수정이 사라집니다. Day 4·5 는 **`guide-new/index.html` 에 직접** 넣고,
> 나중에 탭 시스템을 `template.html` 로 옮긴 뒤에 빌드 파이프라인으로 합치는 순서를 권합니다.

---

## 2. 장소 1곳 = `PLACES` 항목 1개

`PLACES` 는 `{ 키: {…} }` 형태입니다. 키는 `#p-키` 해시로도 쓰이므로 **영문 소문자/카멜케이스, 중복 금지**.

```js
suzhouCanal: {
  kr:'쑤저우허', sub:'강남 수운의 시작', cn:'苏州河', addr:'上海市普陀区苏州河畔', art:'water', kind:'sight',
  lead:'한 문장 소개. 왜 이곳을 가는지가 드러나게.',
  facts:[['지은 해','1934년'],['길이','약 1.6km'],['추천 시간','해 질 녘']],
  origin:['문단1 — 이 장소가 생긴 배경', '문단2 — 지금 모습이 된 과정'],
  timeline:[['1403','무슨 일'],['1923','무슨 일']],
  course:{ title:'산책 코스 이름', intro:'코스 한 줄 안내.', points:[
    { name:'볼거리 이름', cn:'中文名', look:'현장에서 무엇을 보면 되는지',
      story:'(선택) 해설사 이야기 — 있으면 회색 박스로 나옵니다', img:0 /* 선택: 사진 번호 */ }
  ]},
  order:['<b>菜名</b> 메뉴 설명'],                       // 선택: 식당만
  details:[{ t:'궁금증 제목', d:'설명', img:1 }],        // 선택
  kid:{ missions:['스탬프 미션 1','스탬프 미션 2'], fun:['아이에게 한마디'] },
  teen:['중등 탐구 질문'],
  quiz:[{ q:'질문', a:'정답' }],
  practical:['현장 팁 1','현장 팁 2'],                   // 선택
  dp:'大壶春 豫园',                                      // 선택: 대중점평 검색어(중국어)
  tip:'한 줄 꿀팁'                                       // 선택
}
```

### 필드 규격

| 필드 | 필수 | 타입 | 규칙 |
| --- | --- | --- | --- |
| `kr` | ✅ | 문자열 | 한국어 이름. 페이지 제목·목록·스탬프에 그대로 나옴 |
| `sub` | – | 문자열 | 부제(작게 표시) |
| `cn` | ✅ | 문자열 | **중국어만.** 고덕지도 검색어로 쓰임 |
| `addr` | ✅ | 문자열 | **지도에 붙여넣을 실제 주소**(중국어). 택시 카드 복사 대상 |
| `city` | – | 문자열 | 생략하면 `上海`. 다른 도시(우전 등)는 반드시 지정 |
| `art` | ✅ | 문자열 | 일러스트 키. 사용 가능: `hotel duck garden bund night basket street tart water temple roastery ship skewer towers tower hotpot bus` |
| `kind` | – | 문자열 | `stay` `food` `sight` `shop` `cafe` `show` `move` 중 하나 |
| `lead` | ✅ | 문자열 | 1~2문장 소개 |
| `facts` | ✅ | `[[라벨,값], …]` | 3~4개 권장 |
| `origin` | ✅ | 문자열 배열 | 2문단 권장 |
| `timeline` | ✅ | `[[연도,설명], …]` | 3개 이상, 오래된 순 |
| `course.title/intro` | ✅ | 문자열 | |
| `course.points[]` | ✅ | 객체 배열 | 2개 이상. `name`, `look` 필수 / `cn`, `story`, `img` 선택 |
| `order` | – | 문자열 배열 | 있으면 "꼭 시킬 메뉴" 절이 생김. 메뉴명은 `<b>`, 중국어는 `<span class="cn">` |
| `details` | – | `[{t,d,img?}]` | |
| `kid.missions` | ✅ | 문자열 배열 | **1개 이상** — 개수만큼 스탬프 미션이 생김(전체 33개 → 늘어남) |
| `kid.fun` | ✅ | 문자열 배열 | 1개 이상 |
| `teen` | ✅ | 문자열 배열 | 1개 이상 |
| `quiz` | ✅ | `[{q,a}]` | 1개 이상 |
| `practical` | – | 문자열 배열 | |
| `dp` | – | 문자열 | 대중점평 검색어. 있으면 리뷰 버튼이 생김 |
| `tip` | – | 문자열 | 한 줄 꿀팁 |

`img` 는 **그 장소 사진 배열의 0부터 시작하는 번호**입니다. 사진 장수보다 크면 검증기가 잡아 줍니다.

---

## 3. 새 장소 등록 체크리스트 (5군데)

1. `PLACES` 에 항목 추가 (위 규격)
2. `STOPS` 에 일정 한 줄 추가
   ```js
   {day:'day4', t:'10:00', ap:'오전', p:'suzhouCanal', tags:['산책','사진']},
   {day:'day4', t:'12:30', ap:'점심', move:'점심 먹으러 이동', note:'설명', taxi:'suzhouCanal'},
   ```
   → `p` 가 있으면 장소, 없으면 `move`(이동) 줄. `taxi` 는 택시 카드로 띄울 장소 키.
3. 표지 지도에 찍고 싶으면 `ROUTE` 에 좌표 추가 — `['suzhouCanal', 120, 470, 'd4']`
   (viewBox 360×560 기준 x, y / 마지막 값은 날짜 색 `d1`~`d5`)
4. `SHORT` 에 지도 라벨 추가 — `suzhouCanal:'쑤저우허'` (ROUTE 에 넣은 것만 필요)
5. 사진을 쓸 경우 `PHOTOS` 에 `키: [{src:'img/파일.jpg', cap:'설명', credit:'작가 · Wikimedia Commons'}]`
   → 실제 파일은 `guide-new/img/` 에 넣기. 없는 파일을 가리키면 사진이 일러스트로 대체됩니다.

`ORDER`(책자 순서)는 `STOPS` 에서 자동 계산되므로 손대지 않습니다.

---

## 4. 새 날짜(Day 4·5) 추가 체크리스트

한 번만 하면 되는 작업입니다.

1. **색 토큰** — `:root` 에 날짜 색 추가
   ```css
   --d4:#c0622a; --d4-soft:#fbeade; --d5:#6d5bb5; --d5-soft:#ece8fa;
   ```
2. **`DAYS`** 에 항목 추가
   ```js
   {id:'day4', n:4, cls:'d4', date:'11.1 일', title:'한 줄 제목', note:'그날의 핵심 안내 한두 문장.'}
   ```
3. **뷰 마크업** — `#view-day3` 다음에 복사해서 `#view-day4` 만들기
   ```html
   <div id="view-day4" class="tab-view sheet">
     <div class="day-switcher">
       <a href="#day1">1일차 (10.29)</a> … <a href="#day4" class="active">4일차 (11.1)</a>
     </div>
     <div id="day-container-day4"></div>
   </div>
   ```
   ⚠️ 기존 `#view-day1~3` 의 `day-switcher` 에도 4·5일차 링크를 같이 추가해야 서로 오갈 수 있습니다.
4. **상단 탭** — `#mainTabs` 에
   ```html
   <a href="#day4" class="tab-btn" data-tab="day4"><span class="badge-dot" style="background:var(--d4)"></span><span>4일차 (11.1)</span></a>
   ```
5. **모바일 하단 내비** — `.bottom-nav` 에 `data-tab="day4"` 항목 추가
6. **`switchTab()` 의 `validTabs` 배열**에 `'day4'` 추가 ← 빠뜨리면 홈으로 튕깁니다
7. **홈 화면** `#view-home` 의 `.home-quick-days` 에 `quick-day-card` 하나 추가
8. **표지 지도 범례**(`renderRoute()` 안의 `col`, 범례 `<g>`)에 날짜 색 추가

`renderPanels()`·`renderHome()`·`renderStampTab()`·책자는 `DAYS`/`STOPS` 를 돌면서 그리므로 손댈 필요 없습니다.

---

## 5. 포맷 규칙 (검증기가 못 잡는 것들)

- **문자열 안에 HTML 이 들어갑니다.** `origin`·`note`·`order`·`look` 등에서 `<b>`, `<span class="cn">中文</span>` 사용 가능.
  값은 작은따옴표로 감싸니, **HTML 속성은 큰따옴표**로 쓰세요. 예: `'<span class="cn">糖葫芦</span>'` ✅
  문자열 안에 `'`(작은따옴표)를 넣으면 거기서 문자열이 끊깁니다. ❌
- **중국어는 항상 `cn` 또는 `<span class="cn">` 안에.** 본문에 그냥 섞으면 폰트가 섞여 보입니다.
- **`addr` 은 지도 검색이 되는 주소**여야 합니다. "예원 근처" 같은 표현은 택시 카드에서 실패합니다.
- **키 이름은 나중에 바꾸지 마세요.** 키가 바뀌면 기존 스탬프(`localStorage.stamps3` 의 `키-번호`)가 초기화됩니다.
- **미션 번호는 자동**입니다. `kid.missions` 순서만 지키면 `키-0`, `키-1` … 로 붙습니다.
- 날짜 표기는 `10.29 목` 처럼 **월.일 요일** 형식으로 통일해 주세요(탭·일정표·책자에 그대로 나옴).

---

## 6. 다 넣은 뒤 확인 순서

```powershell
cd D:\ai-factory\projects\shanghai-guide
node qa/validate-places.mjs guide-new/index.html      # 데이터 스키마/교차참조
node qa/e2e.mjs                                        # 브라우저 동작 41개 항목
```

`qa/e2e.mjs` 는 정적 서버(`python -m http.server 8123 --directory guide-new`)와
헤드리스 엣지(`--remote-debugging-port=9222`)가 떠 있어야 합니다.
Day 4·5 를 넣은 뒤에는 `e2e.mjs` 의 `const tabs = [...]`, 모바일 내비 기대값에 `day4`, `day5` 를 추가해 주세요.

---

## 7. 지아·경하에게 남기는 확인 요청

- Day 4·5 의 **도시가 상하이 밖**이라면 `city` 필드를 꼭 채워 주세요(예: `'苏州'`, `'杭州'`).
  고덕지도 URL 의 `city` 파라미터가 이 값으로 결정됩니다.
- 사진은 저작권 표기를 `credit` 에 남겨 주세요(`작가 · Wikimedia Commons` 형식).
- `kid.missions` 는 **아이가 현장에서 실제로 할 수 있는 행동**으로 써 주세요. 스탬프 개수가 곧 아이의 동기입니다.
- Day 4·5 를 넣으면 전체 스탬프 총 개수가 바뀝니다(현재 33). 진행률 문구는 자동 계산이라 수정 불필요.
