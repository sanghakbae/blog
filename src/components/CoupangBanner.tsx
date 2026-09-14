import { useEffect, useState } from 'react'

/**
 * 본문 끝에 붙는 쿠팡 파트너스 추천 상품.
 *
 * 자리는 본문과 댓글 사이다. 다 읽은 뒤라 이탈 부담이 적고, 첫 화면을 밀어내지
 * 않아 레이아웃이 흔들리지 않는다.
 *
 * 쿠팡이 주는 배너는 iframe 이나 그들의 스크립트를 쓴다. 둘 다 카카오톡·인스타그램
 * 같은 앱 안의 웹뷰에서 막혀 아무것도 그려지지 않는다 — 모바일에서 배너가 비어
 * 보이던 실제 원인이 이것이다. 그래서 워커가 상품 데이터만 받아 오고 화면이 직접
 * 그린다. 프레임도 외부 스크립트도 없으니 어디서나 뜬다.
 *
 * 공정거래위원회 추천·보증 심사지침상 대가를 받는다는 사실을 소비자가 쉽게 알
 * 수 있게 표시해야 한다. 상품 아래에 적는다.
 */
const ENDPOINT = import.meta.env.VITE_UPLOAD_ENDPOINT ?? ''

type Item = {
  name: string
  image: string
  url: string
  price: number
  discountRate: number
}

const won = (n: number) => n.toLocaleString('ko-KR')

export default function CoupangBanner() {
  const [items, setItems] = useState<Item[] | null>(null)

  useEffect(() => {
    if (!ENDPOINT) return
    let alive = true
    fetch(`${ENDPOINT}/coupang?width=680`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { items?: Item[] } | null) => {
        if (alive && d?.items?.length) setItems(d.items)
      })
      .catch(() => {
        // 광고를 못 받아 오는 것이 글 읽기를 방해할 이유는 없다
      })
    return () => {
      alive = false
    }
  }, [])

  // 받아 오기 전에는 자리를 만들지 않는다. 빈 칸이 남으면 본문이 끊겨 보이고,
  // 나중에 채워지며 아래가 밀리는 것보다 아예 없다가 나타나는 편이 덜 거슬린다.
  if (!items) return null

  return (
    <aside className="no-print mt-10 border-t border-[var(--line)] pt-6">
      <p className="mb-3 text-[11px] text-[var(--muted)]">쿠팡 추천 상품</p>

      {/* 가로로 미는 목록. 좁은 화면에서는 두어 개가 보이고 밀어서 더 본다.
          세로로 쌓으면 본문 끝에 광고가 길게 눕는다. */}
      <ul className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1">
        {items.map((it) => (
          <li key={it.url} className="w-[150px] shrink-0 snap-start sm:w-[160px]">
            <a
              href={it.url}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="group block overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--bg-elev)] transition-colors hover:border-[var(--accent)]"
            >
              <div className="grid aspect-square place-items-center overflow-hidden bg-white">
                <img
                  src={it.image}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  className="size-full object-contain"
                />
              </div>
              <div className="px-2 py-2">
                <p className="line-clamp-2 text-[11.5px] leading-snug text-[var(--ink)] transition-colors group-hover:text-[var(--accent)]">
                  {it.name}
                </p>
                <p className="mt-1 flex items-baseline gap-1">
                  {it.discountRate > 0 && (
                    <span className="font-mono text-[11px] font-semibold text-red-500">
                      {it.discountRate}%
                    </span>
                  )}
                  <span className="font-mono text-[12px] font-semibold tabular-nums">
                    {won(it.price)}원
                  </span>
                </p>
              </div>
            </a>
          </li>
        ))}
      </ul>

      <p className="mt-2 text-[11px] leading-relaxed text-[var(--muted)]">
        이 영역은 쿠팡 파트너스 활동의 일환으로, 이를 통해 구매가 이루어지면
        운영자가 일정액의 수수료를 제공받습니다.
      </p>
    </aside>
  )
}
