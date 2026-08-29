import { useEffect } from 'react'

const BASE = 'sanghak'

/** 열어둔 탭이 여러 개일 때 어떤 글인지 구분되도록 문서 제목을 바꾼다 */
export function useDocumentTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · ${BASE}` : BASE
    return () => {
      document.title = BASE
    }
  }, [title])
}
