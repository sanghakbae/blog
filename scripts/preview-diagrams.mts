import { writeFileSync } from 'node:fs'
import { renderDiagram, type Diagram } from './diagram.mjs'

const samples: Diagram[] = [
  { type: 'flow', caption: 'SSRF 공격 경로', steps: [
    { label: '사용자 입력 URL', note: '이미지 주소' },
    { label: '서버가 대신 요청', note: '검증 누락' },
    { label: '메타데이터 응답', note: '169.254.169.254', danger: true },
    { label: '임시 자격 증명 유출', danger: true },
  ]},
  { type: 'matrix', caption: '취약점 처리 우선순위', x: ['내부에서만 접근', '인터넷 노출'], y: ['악용 사례 있음', '악용 사례 없음'], cells: ['이번 스프린트', '즉시 패치', '분기 내 처리', '모니터링'] },
  { type: 'bars', caption: '해시 알고리즘별 초당 시도 가능 횟수', unit: '만회', items: [
    { label: 'MD5', value: 8000, note: '비밀번호 저장에 부적합' },
    { label: 'SHA-256', value: 3000 },
    { label: 'bcrypt (cost 12)', value: 1 },
    { label: 'Argon2id', value: 1 },
  ]},
  { type: 'layers', caption: '심층 방어 구성', layers: [
    { label: '네트워크 경계', note: 'WAF · DDoS 완화' },
    { label: '애플리케이션', note: '입력 검증 · 인가' },
    { label: '데이터', note: '암호화 · 최소 권한' },
  ]},
  { type: 'steps', caption: '침해사고 대응 절차', steps: [
    { label: '탐지', note: '이상 징후 확인과 초동 판단' },
    { label: '격리', note: '감염 자산 분리, 확산 차단' },
    { label: '분석', note: '침투 경로와 영향 범위 파악' },
    { label: '복구', note: '정상 상태 복원과 재발 방지' },
  ]},
]

samples.forEach((d, i) => {
  writeFileSync(`public/img/posts/_preview-${d.type}.svg`, renderDiagram(d))
  console.log(`${i + 1}. ${d.type}`)
})
