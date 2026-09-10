/** 보강 파일에서 이스케이프하지 않은 백틱을 잡는다 — node 가 읽기 전에 알려 준다 */
import { readFileSync } from 'node:fs'
let bad = 0
for (const f of process.argv.slice(2)) {
  readFileSync(f, 'utf8').split('\n').forEach((l, i) => {
    const s = l
      .replace(/\\`/g, '')                    // 이스케이프된 백틱
      .replace(/```/g, '')                    // 코드 펜스
      .replace(/^'[A-Za-z0-9-]+': R`/, '')    // 항목 시작 구분자
      .replace(/`,$/, '')                     // 항목 끝 구분자 (같은 줄에 올 수 있다)
    if (s.includes('`')) { console.error(`${f}:${i + 1}  ${l.trim().slice(0, 90)}`); bad++ }
  })
}
console.log(bad ? `백틱 문제 ${bad}건` : '백틱 검사 통과')
process.exit(bad ? 1 : 0)
