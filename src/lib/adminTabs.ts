/**
 * 관리 화면의 탭 목록.
 *
 * 넓은 화면은 관리 화면 안의 탭 줄로, 좁은 화면은 헤더의 메뉴 패널로 같은 곳에
 * 간다. 목록을 두 군데에 따로 적어 두었더니 통계 탭이 모바일에서만 빠져 있었다 —
 * 좁은 화면에서는 그 화면에 닿을 길이 아예 없었다. 한 곳에서 가져다 쓴다.
 */
export const ADMIN_TABS = [
  { to: '/admin', label: '글', end: true },
  { to: '/admin/audit', label: '감사 로그', end: false },
  { to: '/admin/seo', label: 'SEO / GEO', end: false },
  { to: '/admin/security', label: '보안', end: false },
  { to: '/admin/stats', label: '통계', end: false },
] as const
