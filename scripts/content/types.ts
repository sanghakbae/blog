import type { Diagram } from '../diagram.mjs'

export type SeedPost = {
  /** 도식 파일 이름이 된다 */
  slug: string
  title: string
  /** 마크다운 본문. 표와 도식 이미지를 포함한다. */
  body: string
  diagram: Diagram
  /** 두 번째 도식. 있으면 <slug>-2.svg 로 만들어진다. */
  diagram2?: Diagram
}
