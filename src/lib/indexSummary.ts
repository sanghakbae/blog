import { doc, getDoc } from 'firebase/firestore'
import { db, isConfigured } from './firebase'

/**
 * 12시간마다 도는 색인 확인이 남긴 요약.
 *
 * scripts/index-status.mts 가 조회를 끝낸 뒤 meta/index-status 한 장에 적는다.
 * 화면에서 500편을 다시 읽어 세지 않으려고 만든 것이라, 여기서는 그 한 장만 읽는다.
 * 규칙상 관리자만 읽을 수 있다.
 */
export type IndexSummary = {
  /** 확인을 끝낸 시각(ISO) */
  at: string
  published: number
  indexed: number
  /** 이번에 실제로 조회한 편수 — 이미 색인된 글은 7일간 건너뛴다 */
  checked: number
  skipped: number
  failed: number
  newlyIndexed: { id: string; title: string }[]
  lost: { id: string; title: string }[]
  states: { state: string; count: number }[]
}

export async function fetchIndexSummary(): Promise<IndexSummary | null> {
  if (!isConfigured) return null
  try {
    const snap = await getDoc(doc(db, 'meta', 'index-status'))
    if (!snap.exists()) return null
    const d = snap.data()
    return {
      at: d.at ?? '',
      published: d.published ?? 0,
      indexed: d.indexed ?? 0,
      checked: d.checked ?? 0,
      skipped: d.skipped ?? 0,
      failed: d.failed ?? 0,
      newlyIndexed: Array.isArray(d.newlyIndexed) ? d.newlyIndexed : [],
      lost: Array.isArray(d.lost) ? d.lost : [],
      states: Array.isArray(d.states) ? d.states : [],
    }
  } catch {
    // 아직 한 번도 돌지 않았거나 권한이 없는 경우 — 모달을 띄우지 않는다
    return null
  }
}
