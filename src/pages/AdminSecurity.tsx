import { useEffect, useState } from 'react'
import { DEFAULT_SETTINGS, subscribeSettings, updateSettings, type SecuritySettings } from '../lib/settings'
import { ADMIN_EMAILS, auth } from '../lib/authClient'

function Row({
  title,
  desc,
  children,
}: {
  title: string
  desc: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-4 border-b border-[var(--line)] py-4 last:border-0">
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-medium">{title}</h3>
        <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">{desc}</p>
      </div>
      <div className="shrink-0 pt-0.5">{children}</div>
    </div>
  )
}

export default function AdminSecurity() {
  const [s, setS] = useState<SecuritySettings>(DEFAULT_SETTINGS)
  const [status, setStatus] = useState('')

  useEffect(() => subscribeSettings(setS), [])

  async function patch(next: Partial<SecuritySettings>) {
    setStatus('저장 중…')
    try {
      await updateSettings(next)
      setStatus('저장했습니다.')
    } catch (err) {
      setStatus((err as Error).message)
    }
  }

  const user = auth.currentUser
  const lastSignIn = user?.metadata.lastSignInTime
    ? new Date(user.metadata.lastSignInTime).toLocaleString('ko-KR')
    : '알 수 없음'

  return (
    <div className="space-y-10">
      <section>
        <h2 className="text-sm font-semibold">현재 세션</h2>
        <dl className="mt-3 grid grid-cols-[7rem_1fr] gap-y-2 text-sm">
          <dt className="text-[var(--muted)]">계정</dt>
          <dd>{user?.email}</dd>
          <dt className="text-[var(--muted)]">인증 수단</dt>
          <dd>Google OAuth 2.0</dd>
          <dt className="text-[var(--muted)]">이메일 확인</dt>
          <dd>{user?.emailVerified ? '확인됨' : '미확인'}</dd>
          <dt className="text-[var(--muted)]">마지막 로그인</dt>
          <dd>{lastSignIn}</dd>
        </dl>
      </section>

      <section>
        <h2 className="text-sm font-semibold">글쓰기 권한을 가진 계정</h2>
        <p className="mt-1 text-xs text-[var(--muted)]">
          이 목록은 Firestore 보안 규칙에도 함께 적혀 있어야 실제로 적용됩니다.
          브라우저 설정만으로는 바꿀 수 없습니다.
        </p>
        <ul className="mt-3 space-y-1 text-sm">
          {ADMIN_EMAILS.map((e) => (
            <li key={e} className="flex items-center gap-2">
              <span>{e}</span>
              {e === user?.email?.toLowerCase() && (
                <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-xs text-[var(--accent)]">
                  현재 계정
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-sm font-semibold">보안 설정</h2>
        <p className="mt-1 text-xs text-[var(--muted)]">
          아래 설정은 Firestore 보안 규칙이 직접 읽어 서버에서 강제합니다.
        </p>

        <div className="mt-2">
          <Row
            title="글쓰기 잠금"
            desc="켜면 글 작성·수정·삭제가 전면 차단됩니다. 계정이 털렸다고 의심될 때 즉시 잠그세요. 읽기는 계속 됩니다."
          >
            <button
              type="button"
              onClick={() => patch({ postingLocked: !s.postingLocked })}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                s.postingLocked
                  ? 'bg-red-500 text-white'
                  : 'border border-[var(--line)]'
              }`}
            >
              {s.postingLocked ? '잠김' : '해제됨'}
            </button>
          </Row>

          <Row
            title="재인증 요구 주기"
            desc="마지막 로그인 후 이 시간이 지나면 발행·삭제 전에 구글 재로그인을 요구합니다. 오래 열어둔 탭이 악용되는 걸 막습니다. 0 이면 요구하지 않습니다."
          >
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={1440}
                value={s.reauthAfterMinutes}
                onChange={(e) => setS({ ...s, reauthAfterMinutes: Number(e.target.value) })}
                onBlur={() => patch({ reauthAfterMinutes: s.reauthAfterMinutes })}
                className="w-20 rounded-lg border border-[var(--line)] bg-transparent px-2 py-1.5 text-right text-sm outline-none focus:border-[var(--accent)]"
              />
              <span className="text-xs text-[var(--muted)]">분</span>
            </div>
          </Row>

          <Row
            title="이미지 업로드"
            desc="끄면 에디터에서 R2 로의 이미지 업로드가 막힙니다."
          >
            <button
              type="button"
              onClick={() => patch({ allowImageUpload: !s.allowImageUpload })}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                s.allowImageUpload
                  ? 'border border-[var(--line)]'
                  : 'bg-red-500 text-white'
              }`}
            >
              {s.allowImageUpload ? '허용' : '차단'}
            </button>
          </Row>
        </div>

        <p className="mt-3 text-xs text-[var(--muted)]">{status}</p>
      </section>
    </div>
  )
}
