export function hasRichNotes(value?: string | null): boolean {
  return Boolean(value?.trim())
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function inlineMarkdown(text: string): string {
  return text
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(
      /\[([^\]]+)\]\((https?:[^)\s]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
    )
}

/** Small markdown subset: headings, lists, quotes, bold, italic, code, links. */
export function renderRichNotes(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const html: string[] = []
  let inUl = false
  let inOl = false

  const closeLists = () => {
    if (inUl) {
      html.push('</ul>')
      inUl = false
    }
    if (inOl) {
      html.push('</ol>')
      inOl = false
    }
  }

  for (const raw of lines) {
    const line = escapeHtml(raw)
    if (/^\s*$/.test(line)) {
      closeLists()
      continue
    }
    const ul = line.match(/^[-*]\s+(.*)$/)
    const ol = line.match(/^\d+\.\s+(.*)$/)
    const heading = line.match(/^(#{1,3})\s+(.*)$/)
    const quote = line.match(/^&gt;\s?(.*)$/)
    if (ul) {
      if (inOl) {
        html.push('</ol>')
        inOl = false
      }
      if (!inUl) {
        html.push('<ul>')
        inUl = true
      }
      html.push(`<li>${inlineMarkdown(ul[1])}</li>`)
      continue
    }
    if (ol) {
      if (inUl) {
        html.push('</ul>')
        inUl = false
      }
      if (!inOl) {
        html.push('<ol>')
        inOl = true
      }
      html.push(`<li>${inlineMarkdown(ol[1])}</li>`)
      continue
    }
    closeLists()
    if (heading) {
      const level = heading[1].length
      html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`)
      continue
    }
    if (quote) {
      html.push(`<blockquote>${inlineMarkdown(quote[1])}</blockquote>`)
      continue
    }
    html.push(`<p>${inlineMarkdown(line)}</p>`)
  }
  closeLists()
  return html.join('')
}

export function wrapSelection(
  value: string,
  start: number,
  end: number,
  before: string,
  after = before,
  placeholder = 'text',
): { next: string; selectStart: number; selectEnd: number } {
  const selected = value.slice(start, end) || placeholder
  const next = `${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`
  const selectStart = start + before.length
  return { next, selectStart, selectEnd: selectStart + selected.length }
}
