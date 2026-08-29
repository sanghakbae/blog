import {
  collection, doc, getDocs, limit, orderBy, query, serverTimestamp, setDoc,
  type Timestamp, type WriteBatch,
} from 'firebase/firestore'
import { db } from './firebase'
import { auth } from './authClient'

export type AuditAction =
  | 'auth.signin'
  | 'auth.signout'
  | 'post.create'
  | 'post.update'
  | 'post.publish'
  | 'post.unpublish'
  | 'post.delete'
  | 'image.upload'
  | 'tags.analyze'
  | 'settings.update'

export type AuditEntry = {
  id: string
  at?: Timestamp
  action: AuditAction
  actorEmail: string
  actorUid: string
  target: string
  detail: string
}

export const AUDIT_LABELS: Record<AuditAction, string> = {
  'auth.signin': '로그인',
  'auth.signout': '로그아웃',
  'post.create': '글 작성',
  'post.update': '글 수정',
  'post.publish': '발행',
  'post.unpublish': '발행 취소',
  'post.delete': '글 삭제',
  'image.upload': '이미지 업로드',
  'tags.analyze': '태그 분석',
  'settings.update': '보안 설정 변경',
}

const auditCol = collection(db, 'audit')

function entryData(action: AuditAction, target = '', detail = '') {
  const user = auth.currentUser
  return {
    at: serverTimestamp(),
    action,
    actorEmail: user?.email ?? '',
    actorUid: user?.uid ?? '',
    target,
    detail,
    userAgent: navigator.userAgent.slice(0, 200),
  }
}

/**
 * 감사 로그 한 줄 기록.
 * 로그 실패가 본래 작업을 막으면 안 되므로 조용히 삼킨다.
 */
export async function logAudit(action: AuditAction, target = '', detail = ''): Promise<void> {
  try {
    await setDoc(doc(auditCol), entryData(action, target, detail))
  } catch (err) {
    console.warn('감사 로그 기록 실패', err)
  }
}

/** 글 저장처럼 원자성이 필요한 작업에서는 같은 배치에 로그를 함께 넣는다. */
export function addAuditToBatch(
  batch: WriteBatch,
  action: AuditAction,
  target = '',
  detail = '',
): void {
  batch.set(doc(auditCol), entryData(action, target, detail))
}

export async function listAudit(max = 200): Promise<AuditEntry[]> {
  const snap = await getDocs(query(auditCol, orderBy('at', 'desc'), limit(max)))
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AuditEntry, 'id'>) }))
}
