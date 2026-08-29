/**
 * 태그 용어집.
 *
 * 본문에서 단어를 뽑는 방식은 '실수', '전체', '공개' 같은 말이 태그가 된다.
 * 기술 블로그의 태그는 분류 체계여야 하므로, 여기 정의된 용어만 태그가 된다.
 * match 에는 본문에 나타날 수 있는 표기를 모두 적는다 (소문자로 비교).
 */
export type VocabEntry = { tag: string; match: string[] }

export const VOCABULARY: VocabEntry[] = [
  // 웹 취약점
  { tag: 'sql인젝션', match: ['sql 인젝션', 'sql인젝션', 'sql injection', '인젝션'] },
  { tag: 'xss', match: ['xss', '크로스 사이트 스크립팅', '스크립팅'] },
  { tag: 'csrf', match: ['csrf', '요청 위조'] },
  { tag: 'ssrf', match: ['ssrf', '서버 측 요청 위조'] },
  { tag: '경로탐색', match: ['경로 탐색', '경로탐색', 'path traversal', '상위 디렉터리'] },
  { tag: '파일업로드', match: ['파일 업로드', '업로드 기능', '업로드 디렉터리'] },
  { tag: '역직렬화', match: ['역직렬화', '직렬화', 'deserialization'] },
  { tag: '템플릿인젝션', match: ['템플릿 인젝션', 'ssti', '템플릿 엔진'] },
  { tag: '프롬프트인젝션', match: ['프롬프트 인젝션', 'prompt injection'] },
  { tag: '캐시오염', match: ['캐시 오염', '캐시 기만', 'cache poisoning'] },
  { tag: '클릭재킹', match: ['클릭재킹', 'clickjacking'] },

  // 인증·인가
  { tag: '인증', match: ['인증 수단', '로그인', '자격 증명', 'authentication', '인증서 고정'] },
  { tag: '인가', match: ['인가', '접근 통제', '접근통제', 'authorization'] },
  { tag: '세션', match: ['세션', 'session'] },
  { tag: 'jwt', match: ['jwt', 'json web token', '토큰 본문'] },
  { tag: 'oauth', match: ['oauth', 'oidc', '인가 코드', 'pkce'] },
  { tag: 'mfa', match: ['mfa', '다단계 인증', '이중 인증', '2단계'] },
  { tag: '패스키', match: ['패스키', 'fido2', 'webauthn', '하드웨어 키'] },
  { tag: '비밀번호', match: ['비밀번호', 'password', '패스워드'] },
  { tag: '해시', match: ['해시', 'bcrypt', 'argon2', 'scrypt', 'pbkdf2'] },
  { tag: 'sso', match: ['sso', '통합 인증', '싱글 사인온'] },
  { tag: '최소권한', match: ['최소 권한', '최소권한', 'least privilege'] },
  { tag: '권한상승', match: ['권한 상승', 'privilege escalation'] },
  { tag: '권한검토', match: ['권한 재검토', '접근권한 검토', '권한 회수'] },

  // 암호·데이터
  { tag: '암호화', match: ['암호화', 'encryption'] },
  { tag: '키관리', match: ['키 관리', '키 회전', 'kms', '봉투 암호화', '마스터 키'] },
  { tag: 'tls', match: ['tls', 'https', 'ssl', '인증서'] },
  { tag: '난수', match: ['난수', 'csprng', '무작위 값'] },
  { tag: '개인정보', match: ['개인정보', '정보주체', 'pii'] },
  { tag: '가명처리', match: ['가명처리', '익명처리', '비식별', 'k-익명성', '재식별'] },
  { tag: '데이터분류', match: ['데이터 분류', '정보 분류', '등급 부여'] },
  { tag: '보유기간', match: ['보유 기간', '보관 기간', '파기', '수명 주기'] },
  { tag: 'db접근통제', match: ['운영 데이터베이스', '직접 접속', '데이터베이스 접근', 'db 계정', '조회 상한', '조회 이력'] },
  { tag: '마스킹', match: ['마스킹', 'redact', '가림 처리'] },
  { tag: '백업', match: ['백업', '복구', 'rpo', 'rto', '스냅샷'] },

  // 인프라·네트워크
  { tag: '방화벽', match: ['방화벽', 'firewall', '보안 그룹'] },
  { tag: '제로트러스트', match: ['제로 트러스트', 'zero trust', 'ztna'] },
  { tag: '네트워크분할', match: ['네트워크 분할', '세그먼테이션', '구간 분리'] },
  { tag: 'ddos', match: ['ddos', '서비스 거부', '트래픽 폭주'] },
  { tag: 'dns', match: ['dns', '서브도메인', '도메인 탈취', '레코드'] },
  { tag: '자산관리', match: ['자산 목록', '자산관리', '공격 표면', '그림자 자산'] },
  { tag: '배스천', match: ['배스천', '점프 서버', '점프서버'] },
  { tag: '원격접속', match: ['원격 접속', 'ssh', 'rdp', 'vpn'] },
  { tag: '패치관리', match: ['패치', '업데이트 적용', '취약점 조치'] },
  { tag: '취약점관리', match: ['취약점 관리', '취약점 우선순위', 'cve', '취약점 스캔'] },

  // 클라우드·컨테이너
  { tag: '클라우드', match: ['클라우드', 'aws', 'gcp', 'azure'] },
  { tag: 'iam', match: ['iam', '역할 기반', '자격 증명 관리'] },
  { tag: '스토리지', match: ['버킷', 's3', '오브젝트 스토리지'] },
  { tag: '감사로그', match: ['감사 로그', 'cloudtrail', '접속기록'] },
  { tag: '컨테이너', match: ['컨테이너', 'docker', '도커', '이미지 스캔', '베이스 이미지'] },
  { tag: '쿠버네티스', match: ['쿠버네티스', 'kubernetes', 'k8s', 'rbac', '파드'] },
  { tag: '시크릿관리', match: ['시크릿', '비밀값', 'secret', 'vault'] },
  { tag: '서버리스', match: ['서버리스', 'serverless', 'lambda', '람다'] },
  { tag: 'iac', match: ['인프라 코드', 'terraform', '테라폼', 'iac', '드리프트'] },
  { tag: '멀티계정', match: ['계정 분리', '멀티 계정', '조직 정책', 'scp'] },
  { tag: '공동책임', match: ['공동 책임', '책임 경계', '책임 공유'] },

  // 탐지·대응
  { tag: '로그설계', match: ['로그 설계', '로그 수집', '추적 id', '로그 보관'] },
  { tag: '탐지', match: ['탐지 규칙', '탐지 수단', '이상 징후', '탐지 공백', 'detection'] },
  { tag: '경보', match: ['알람', '경보', 'alert', '알람 피로'] },
  { tag: '침해대응', match: ['침해사고', '사고 대응', '초동 조치', '격리'] },
  { tag: '포렌식', match: ['포렌식', '증거 수집', '휘발성', '메모리 덤프'] },
  { tag: '랜섬웨어', match: ['랜섬웨어', 'ransomware', '암호화 공격'] },
  { tag: '위협헌팅', match: ['위협 헌팅', 'threat hunting', '가설 수립'] },
  { tag: 'attck', match: ['att&ck', 'attack 프레임워크', '기법 분류'] },
  { tag: 'edr', match: ['edr', '단말 탐지', '백신'] },
  { tag: '위협인텔', match: ['침해지표', 'ioc', '위협 인텔리전스'] },
  { tag: '모의훈련', match: ['도상 훈련', '모의 훈련', '훈련 시나리오', '모의침투', '모의 침투'] },

  // 사람·프로세스
  { tag: '피싱', match: ['피싱', 'phishing', '사칭 메일'] },
  { tag: '소셜엔지니어링', match: ['소셜 엔지니어링', '사회공학', '헬프데스크'] },
  { tag: '내부자위협', match: ['내부자', 'insider'] },
  { tag: '계정관리', match: ['퇴사자', '계정 회수', '오프보딩', '입퇴사'] },
  { tag: '보안교육', match: ['보안 교육', '보안 인식', '교육 프로그램'] },
  { tag: '보안문화', match: ['보안 챔피언', '개발자와의 협업', '비난 없는'] },
  { tag: '공급망', match: ['협력업체', '공급망', '위탁', '재위탁', 'sbom'] },
  { tag: '회고', match: ['회고', '포스트모템', 'postmortem'] },
  { tag: '보안지표', match: ['보안 지표', 'mttd', 'mttr', '커버리지'] },

  // 컴플라이언스
  { tag: 'ismsp', match: ['isms-p', 'isms', '인증 심사'] },
  { tag: '개인정보보호법', match: ['개인정보보호법', '보호법', '제3자 제공', '동의'] },
  { tag: '위험평가', match: ['위험평가', '위험 평가', '위험 수용', '위험 관리'] },
  { tag: '보안정책', match: ['보안 정책', '정책 문서', '지침', '절차서'] },
  { tag: '영향평가', match: ['영향평가', '영향 평가', 'dpia'] },
  { tag: '감사대응', match: ['감사 대응', '증적', '심사 대응'] },
  { tag: '보안예산', match: ['보안 예산', '예산 설득', '투자 우선순위'] },

  // 개발 보안
  { tag: '위협모델링', match: ['위협 모델링', 'stride', '신뢰 경계'] },
  { tag: 'sast', match: ['sast', 'dast', 'sca', '정적 분석', '동적 분석'] },
  { tag: 'cicd', match: ['ci/cd', '파이프라인', '빌드 시스템'] },
  { tag: '아티팩트서명', match: ['cosign', 'slsa', '출처 증명', '이미지 서명', '서명 검증', '코드 서명'] },
  { tag: '코드리뷰', match: ['코드 리뷰', '리뷰어', '코드 소유자'] },
  { tag: '시프트레프트', match: ['시프트 레프트', '왼쪽으로', 'shift left'] },
  { tag: '저장소보안', match: ['브랜치 보호', '저장소 설정', '강제 푸시'] },
  { tag: '의존성', match: ['의존성', 'dependency', '패키지 관리', '잠금 파일'] },

  // 응용
  { tag: 'api보안', match: ['api 보안', 'rest api', '엔드포인트', '대량 할당'] },
  { tag: 'graphql', match: ['graphql', '리졸버', '인트로스펙션'] },
  { tag: '웹소켓', match: ['웹소켓', 'websocket'] },
  { tag: '모바일보안', match: ['모바일 앱', 'apk', '안드로이드', 'ios 앱', '인증서 고정'] },
  { tag: '브라우저확장', match: ['확장 프로그램', 'extension'] },
  { tag: 'llm보안', match: ['llm', '언어 모델', 'ai 애플리케이션'] },
  { tag: '결제보안', match: ['결제', 'pg', '멱등', 'pci dss'] },
  { tag: 'iot', match: ['iot', '기기 보안', '펌웨어'] },
  { tag: '이메일보안', match: ['메일 인증', '메일 위조', '이메일 보안', 'dmarc', 'spf', 'dkim'] },
  { tag: '보안헤더', match: ['보안 헤더', 'csp', 'hsts', 'content-security-policy'] },
  { tag: '레이트리밋', match: ['레이트 리밋', '요청 수 제한', '크리덴셜 스터핑', '429'] },
  { tag: '오류처리', match: ['오류 메시지', '스택 트레이스', '예외 처리'] },
  { tag: '취약점공개', match: ['취약점 제보', '취약점 공개', 'security.txt', '버그 바운티'] },
  { tag: '보안부채', match: ['보안 부채', '기술 부채', '기한 초과'] },
  { tag: '보안로드맵', match: ['우선순위 정하는', '보안 로드맵', '단계 설계'] },
]
