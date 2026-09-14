/**
 * 초안 하나를 12시간마다 한 편씩 발행한다.
 *
 * 짧은 기간에 많은 글을 한꺼번에 올리면 검색엔진이 주소만 발견해 두고 크롤링을
 * 미룬다 — 실제로 500편을 2주 만에 올린 뒤 그렇게 됐다. 글은 미리 써 두되
 * 세상에 나가는 속도는 늦춘다.
 *
 *   npx tsx scripts/publish-daily.mts          한 편 발행
 *   npx tsx scripts/publish-daily.mts --dry    무엇이 나갈지만 본다
 *   npx tsx scripts/publish-daily.mts --count=2
 *
 * 간격은 호출 횟수가 아니라 결과로 지킨다. 배포가 하루에 여러 번 돌아도 마지막
 * 발행이 12시간 안이면 아무것도 하지 않는다. 워크플로 조건에만 기대면 수동 실행
 * 한 번에 이틀치가 나간다.
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

const PROJECT = process.env.VITE_FIREBASE_PROJECT_ID ?? 'tag-blog-8408e'
const MARKER = 'meta/daily-publish'
const INTERVAL_HOURS = 12
const INTERVAL_MS = INTERVAL_HOURS * 60 * 60 * 1000

const dry = process.argv.includes('--dry')
const countArg = process.argv.find((a) => a.startsWith('--count='))?.split('=')[1]
const count = Number(countArg ?? 1)
if (!Number.isInteger(count) || count < 1) {
  console.error('--count 는 1 이상의 정수여야 합니다.')
  process.exit(1)
}

initializeApp({ credential: applicationDefault(), projectId: PROJECT })
const db = getFirestore()

const [markerPath, markerId] = [MARKER.split('/')[0], MARKER.split('/')[1]]
const markerRef = db.collection(markerPath).doc(markerId)
const marker = await markerRef.get()
const lastAt = Date.parse((marker.data()?.at as string) ?? '')
const sinceLast = Number.isNaN(lastAt) ? Infinity : Date.now() - lastAt

if (sinceLast < INTERVAL_MS) {
  const left = Math.ceil((INTERVAL_MS - sinceLast) / 60000)
  console.log(`마지막 발행이 ${Math.floor(sinceLast / 3600000)}시간 전입니다. ${left}분 뒤에 다시 오세요.`)
  process.exit(0)
}

// 쓴 순서대로 내보낸다. 초안에는 createdAt 을 시드가 넣어 둔다.
const drafts = await db
  .collection('posts')
  .where('published', '==', false)
  .orderBy('createdAt', 'asc')
  .limit(count)
  .get()

if (drafts.empty) {
  console.log('발행할 초안이 없습니다.')
  process.exit(0)
}

const now = new Date()
for (const d of drafts.docs) {
  const data = d.data()
  console.log(`${dry ? '[dry] ' : ''}발행 ${d.id} — ${data.title}`)
  if (dry) continue

  // 발행 시각을 지금으로 바꾼다. 초안으로 넣을 때의 시각을 그대로 두면
  // 목록 맨 아래에 조용히 붙어서 새 글로 보이지 않는다.
  await d.ref.update({
    published: true,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })

  // 세는 문서가 없으면 화면에서 만들 수 없어 조회수가 영영 0 이 된다
  await db.collection('stats').doc(d.id).set({ views: 0, likes: 0 }, { merge: true })

  for (const tag of (data.tags ?? []) as string[])
    await db.collection('tags').doc(tag).set({ name: tag, count: FieldValue.increment(1) }, { merge: true })
}

if (!dry) {
  await markerRef.set({ at: now.toISOString(), published: drafts.docs.map((d) => d.id) })
}

const left = (await db.collection('posts').where('published', '==', false).count().get()).data().count
console.log(`${dry ? '[dry] ' : ''}${drafts.size}편 발행 · 남은 초안 ${left}편`)
process.exit(0)
