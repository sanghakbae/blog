import type { Diagram } from '../diagram.mjs'

export type SeedPost = {
  /** 도식 파일 이름이 된다 */
  slug: string
  title: string
  /** 마크다운 본문. 표와 도식 이미지를 포함한다. */
  body: string
  diagram: Diagram
}
