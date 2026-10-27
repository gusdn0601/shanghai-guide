// shanghai-offline.html 이 사진 59장을 정말 전부 품고 있는지 검사한다.
// data:image/...base64 본문을 디코드해서 원본 img/*.jpg|png 의 해시와 대조.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const root = process.argv[2] || '.';
const html = readFileSync(join(root, 'shanghai-offline.html'), 'utf8');
const imgDir = join(root, 'img');

const files = readdirSync(imgDir).filter(f => /\.(jpe?g|png|webp)$/i.test(f));
const fileHashes = new Map();
for (const f of files) {
  const h = createHash('sha256').update(readFileSync(join(imgDir, f))).digest('hex');
  fileHashes.set(h, f);
}
// 루트의 파비콘/터치아이콘도 인라인될 수 있으므로 해시에 포함
for (const f of ['icon-192.png', 'icon-180.png']) {
  const p = join(root, f);
  if (existsSync(p)) {
    fileHashes.set(createHash('sha256').update(readFileSync(p)).digest('hex'), f);
  }
}

const uris = [...html.matchAll(/data:image\/(?:jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)/g)].map(m => m[1]);
const embedded = new Map();
let decodeErr = 0;
for (const b64 of uris) {
  try {
    const h = createHash('sha256').update(Buffer.from(b64, 'base64')).digest('hex');
    embedded.set(h, (embedded.get(h) || 0) + 1);
  } catch { decodeErr++; }
}

const missing = [...fileHashes].filter(([h]) => !embedded.has(h)).map(([, f]) => f);
const matched = [...fileHashes.keys()].filter(h => embedded.has(h)).length;
const unknown = [...embedded.keys()].filter(h => !fileHashes.has(h)).length;

// 단일 파일 안에 인터넷/폴더 의존이 남아 있으면 '오프라인'이 아니다.
const extScripts = [...html.matchAll(/<script[^>]+src="(https?:\/\/[^"]+)"/g)].map(m => m[1]);
// JS 템플릿 문자열 안의 상대 페이지 참조도 잡는다 — 다운로드한 단일 파일 옆에는 존재하지 않는다.
const relPages = [...new Set([...html.matchAll(/[`"'(]([\w.-]+\.html)\b/g)].map(m => m[1]))]
  .filter(p => p !== 'shanghai-offline.html' && p !== 'index.html');
const relSrc = [...html.matchAll(/\bsrc="(?!data:|https?:|file:|#)([^"]*)"/g)]
  .map(m => m[1])
  .filter(s => !s.includes('${'));  // 템플릿 자리표시자는 런타임 값이라 검사 대상이 아니다

console.log(`img 원본 파일   : ${files.length}장`);
console.log(`data URI 본문   : ${uris.length}개 (고유 ${embedded.size}개, 디코드 실패 ${decodeErr})`);
console.log(`원본과 일치     : ${matched}장`);
console.log(`빠진 사진       : ${missing.length ? missing.join(', ') : '없음'}`);
console.log(`원본에 없는 Data: ${unknown}개`);
console.log(`외부 <script>   : ${extScripts.length ? extScripts.join(', ') : '없음'}`);
console.log(`상대 .html 참조 : ${relPages.length ? relPages.join(', ') : '없음'}`);
console.log(`상대 src= 참조  : ${relSrc.length ? [...new Set(relSrc)].slice(0, 5).join(', ') : '없음'}`);

const bad = missing.length || decodeErr || extScripts.length || relPages.length || relSrc.length;
process.exit(bad ? 1 : 0);
