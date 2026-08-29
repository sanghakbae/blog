/**
 * 개발용 일회성 도구 — 고정 데이터 100편을 실제 Firestore 에 넣는다.
 * 관리자로 로그인한 상태에서 브라우저 콘솔로 실행한다.
 *
 *   (await import('/src/dev/seedToFirestore.ts')).run()
 *
 * 앱과 같은 Firebase 인스턴스를 쓰기 위해 앱 모듈을 그대로 import 한다.
 */
import { Timestamp, collection, doc, getDocs, increment, writeBatch } from 'firebase/firestore'
import { db } from '../lib/firebase'
import data from './seed-data.json'

const AUTHOR = 'totoriverce@gmail.com'

export async function run(): Promise<string> {
  const posts = collection(db, 'posts')
  const tags = collection(db, 'tags')
  let saved = 0

  for (let i = 0; i < data.posts.length; i += 25) {
    const batch = writeBatch(db)
    for (const p of data.posts.slice(i, i + 25)) {
      batch.set(doc(posts, p.id), {
        title: p.title,
        body: p.body,
        excerpt: p.excerpt,
        tags: p.tags,
        published: true,
        author: AUTHOR,
        seed: true,
        createdAt: Timestamp.fromDate(new Date(p.createdAt)),
        updatedAt: Timestamp.fromDate(new Date(p.updatedAt)),
      })
    }
    await batch.commit()
    saved += Math.min(25, data.posts.length - i)
  }

  for (let i = 0; i < data.tags.length; i += 100) {
    const batch = writeBatch(db)
    for (const t of data.tags.slice(i, i + 100)) {
      batch.set(doc(tags, t.id), { name: t.name, count: increment(t.count) }, { merge: true })
    }
    await batch.commit()
  }

  const check = await getDocs(posts)
  return `글 ${saved}편, 태그 ${data.tags.length}종 저장. 현재 posts 문서 수: ${check.size}`
}

/** 시드로 넣은 글만 지운다 */
export async function purge(): Promise<string> {
  const snap = await getDocs(collection(db, 'posts'))
  for (let i = 0; i < snap.docs.length; i += 100) {
    const batch = writeBatch(db)
    snap.docs.slice(i, i + 100).forEach((d) => batch.delete(d.ref))
    await batch.commit()
  }
  const tagSnap = await getDocs(collection(db, 'tags'))
  const tb = writeBatch(db)
  tagSnap.docs.forEach((d) => tb.delete(d.ref))
  await tb.commit()
  return `삭제 완료: 글 ${snap.size}편, 태그 ${tagSnap.size}종`
}
