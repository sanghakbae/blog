import type { Post } from './posts'

/** 파일 이름으로 쓸 수 없는 문자를 정리한다 */
export function safeName(title: string): string {
  return title.replace(/[\\/:*?"<>|]/g, '').trim().slice(0, 80) || 'post'
}

/**
 * 글을 PDF 파일로 내려받는다.
 *
 * 인쇄 대화상자를 띄우지 않고 바로 저장되도록, 본문을 화면 밖에 A4 폭으로
 * 다시 그려서 이미지로 만든 뒤 페이지 단위로 잘라 넣는다. 무거운 라이브러리라
 * 이 함수를 부를 때만 내려받는다.
 */
export async function downloadPdf(post: Post, article: HTMLElement): Promise<void> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas-pro'),
    import('jspdf'),
  ])

  // 화면이 어두운 테마여도 문서는 흰 바탕이어야 한다. 토큰을 밝은 값으로 고정한다.
  const holder = document.createElement('div')
  holder.style.cssText = [
    'position:fixed', 'left:-20000px', 'top:0', 'width:794px', 'padding:40px 44px',
    'background:#ffffff', 'box-sizing:border-box',
    '--bg:#ffffff', '--bg-elev:#f4f4f5', '--ink:#18181b', '--muted:#52525b',
    '--line:#e4e4e7', '--accent:#4f46e5', '--accent-soft:#eef2ff', '--accent-ink:#ffffff',
  ].join(';')

  const clone = article.cloneNode(true) as HTMLElement
  clone.querySelectorAll('.no-print').forEach((el) => el.remove())
  holder.appendChild(clone)
  document.body.appendChild(holder)

  try {
    const canvas = await html2canvas(holder, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
    })

    const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
    const pageW = pdf.internal.pageSize.getWidth()
    const pageH = pdf.internal.pageSize.getHeight()
    const imgH = (canvas.height * pageW) / canvas.width
    const image = canvas.toDataURL('image/jpeg', 0.92)

    let offset = 0
    while (offset < imgH) {
      if (offset > 0) pdf.addPage()
      // 전체 이미지를 음수 위치로 밀어 넣어 해당 페이지 구간만 보이게 한다
      pdf.addImage(image, 'JPEG', 0, -offset, pageW, imgH, undefined, 'FAST')
      offset += pageH
    }

    pdf.save(`${safeName(post.title)}.pdf`)
  } finally {
    document.body.removeChild(holder)
  }
}
