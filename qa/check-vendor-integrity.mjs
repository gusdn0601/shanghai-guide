// 벤더링한 qrcode.min.js 가 원래 CDN 이 내려주던 파일과 같은 바이트인지 확인한다.
// (배포물에 들어가는 외부 코드의 무결성 검사 — 실행하지 않고 해시만 비교)
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const localFile = process.argv[2] || 'vendor/qrcode.min.js';
const url = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js';

const local = readFileSync(localFile);
const sha = b => createHash('sha256').update(b).digest('hex');

let remote;
try {
  const r = await fetch(url, { redirect: 'follow' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  remote = Buffer.from(await r.arrayBuffer());
} catch (e) {
  console.log('업로드 비교 불가(네트워크):', e.message);
  process.exit(2);
}

console.log('local :', local.length, 'B', sha(local).slice(0, 24));
console.log('cdnjs :', remote.length, 'B', sha(remote).slice(0, 24));
const same = sha(local) === sha(remote);
console.log(same ? '일치 — 동일 파일' : '불일치 — 내용이 다릅니다');
process.exit(same ? 0 : 1);
