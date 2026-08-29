import type { Timestamp } from 'firebase/firestore'

export function formatDate(ts?: Timestamp): string {
  const d = ts?.toDate?.()
  if (!d) return ''
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`
}
