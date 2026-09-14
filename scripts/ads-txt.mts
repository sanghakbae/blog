/**
 * ads.txt 를 만든다.
 *
 * 애드센스는 이 파일로 "이 도메인의 광고를 팔 권한이 누구에게 있는지" 를 밝힌다.
 * 없으면 심사에서 걸리거나, 통과하더라도 상당수 광고주가 입찰하지 않아 단가가
 * 크게 떨어진다. 사람이 손으로 두면 게시자 ID 를 바꿀 때 어긋나므로 빌드에서 만든다.
 *
 * 게시자 ID 가 없으면 만들지 않는다. 빈 파일을 두면 "권한 있는 판매자 없음" 이
 * 되어 아무것도 없는 것보다 나쁘다.
 */
import { writeFileSync } from 'node:fs'

const CLIENT = process.env.VITE_ADSENSE_CLIENT ?? ''
const OUT = 'dist/ads.txt'

if (!CLIENT) {
  console.log('애드센스 게시자 ID 가 없어 ads.txt 를 만들지 않습니다.')
  process.exit(0)
}

// ca-pub-1234... 형태로 오므로 앞의 ca- 를 뗀 pub-1234... 가 들어간다.
const pub = CLIENT.replace(/^ca-/, '')
if (!/^pub-\d{10,}$/.test(pub)) {
  console.error(`게시자 ID 형식이 올바르지 않습니다: ${CLIENT}`)
  process.exit(1)
}

// f08c47fec0942fa0 은 구글의 인증 기관 ID 로, 모든 게시자가 같은 값을 쓴다.
writeFileSync(OUT, `google.com, ${pub}, DIRECT, f08c47fec0942fa0\n`)
console.log(`ads.txt 생성 → ${OUT} (${pub})`)
