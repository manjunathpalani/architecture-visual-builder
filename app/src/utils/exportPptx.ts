import { downloadBlob, type ArchitectureBrief, type SystemBrief } from './architectureNarrative'
import type PptxGenJS from 'pptxgenjs'
import type { DiagramImage } from './captureDiagram'

type Slide = ReturnType<PptxGenJS['addSlide']>
type TableCell = { text: string; options?: Record<string, unknown> }

const NAVY = '0F172A'
const INDIGO = '4F46E5'
const INDIGO_DEEP = '312E81'
const SLATE = '334155'
const MUTED = '64748B'
const PAPER = 'F8FAFC'
const WHITE = 'FFFFFF'
const CARD = 'FFFFFF'
const LINE = 'E2E8F0'

async function createPresentation(): Promise<PptxGenJS> {
  // Try to load the browser-friendly build first, fall back to main package.
  let imported: unknown = null
  try {
    // Prefer the browser bundle if available. Use @vite-ignore so Vite doesn't
    // pre-bundle or statically analyze this import during build.
    // @ts-ignore
    imported = await import(/* @vite-ignore */ 'pptxgenjs/dist/pptxgen.browser.js')
  } catch {
    try {
      // Fallback to main package, still ignored by Vite's static analysis.
      // @ts-ignore
      imported = await import(/* @vite-ignore */ 'pptxgenjs')
    } catch (err) {
      throw new Error('PowerPoint library failed to load. Reload the page and try Export again.')
    }
  }

  const mod = imported as any
  const Ctor = (mod && (mod.default ?? mod)) as new () => PptxGenJS
  if (!Ctor) throw new Error('PowerPoint library failed to load. Reload the page and try Export again.')
  return new Ctor()
}

export async function exportArchitecturePptx(brief: ArchitectureBrief, diagram?: DiagramImage | null) {
  const pres = await createPresentation()
  pres.layout = 'LAYOUT_WIDE'
  pres.title = `${brief.title} — Architecture Briefing`
  pres.author = 'Architecture Visual Builder'
  pres.subject = 'Solution architecture briefing with diagram and explanations'

  addTitleSlide(pres, brief)
  addSnapshotSlide(pres, brief)
  addDiagramSlide(pres, brief, diagram)
  addNarrativeSlide(pres, brief)
  addLayerSlides(pres, brief)
  addSystemSlides(pres, brief)
  addIntegrationSlides(pres, brief)
  addApiSlides(pres, brief)
  addCloseSlide(pres, brief)

  const fileName = `${brief.fileBase || 'architecture'}-architecture-briefing.pptx`
  const output = await pres.write({ outputType: 'blob' })
  const blob =
    output instanceof Blob
      ? output
      : new Blob([output as BlobPart], {
          type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        })
  downloadBlob(blob, fileName)
}

function addTitleSlide(pres: PptxGenJS, brief: ArchitectureBrief) {
  const slide = pres.addSlide()
  slide.background = { color: NAVY }

  slide.addShape(pres.ShapeType.rect, {
    x: 0, y: 0, w: 0.18, h: 7.5, fill: { color: INDIGO }, line: { color: INDIGO },
  })

  slide.addText('ARCHITECTURE BRIEFING', {
    x: 0.7, y: 1.7, w: 12, h: 0.35,
    fontFace: 'Calibri', fontSize: 13, color: 'A5B4FC', bold: true, margin: 0,
  })
  slide.addText(brief.title, {
    x: 0.7, y: 2.1, w: 12, h: 1.2,
    fontFace: 'Calibri', fontSize: 36, color: WHITE, bold: true, margin: 0,
  })
  slide.addText(brief.description, {
    x: 0.7, y: 3.4, w: 11, h: 0.8,
    fontFace: 'Calibri Light', fontSize: 16, color: 'CBD5E1', margin: 0,
  })
  slide.addText(
    `Version ${brief.version}   ·   Updated ${brief.updatedAt}   ·   Generated ${brief.generatedAt}`,
    {
      x: 0.7, y: 6.7, w: 12, h: 0.3,
      fontFace: 'Calibri', fontSize: 12, color: '94A3B8', margin: 0,
    },
  )
}

function addSnapshotSlide(pres: PptxGenJS, brief: ArchitectureBrief) {
  const slide = contentSlide(pres, 'Landscape at a glance', 'Inventory of the modelled architecture')

  const cards = [
    { value: String(brief.stats.systems), label: 'Systems' },
    { value: String(brief.stats.integrations), label: 'Integrations' },
    { value: String(brief.stats.apis), label: 'API contracts' },
    { value: String(brief.stats.subDiagrams), label: 'Nested diagrams' },
  ]

  cards.forEach((card, i) => {
    const x = 0.5 + i * 3.2
    slide.addShape(pres.ShapeType.rect, {
      x, y: 1.6, w: 3.0, h: 2.1,
      fill: { color: CARD },
      line: { color: LINE },
      shadow: { type: 'outer', color: '000000', blur: 8, offset: 2, angle: 135, opacity: 0.08 },
    })
    slide.addShape(pres.ShapeType.rect, {
      x, y: 1.6, w: 0.1, h: 2.1, fill: { color: INDIGO }, line: { color: INDIGO },
    })
    slide.addText(card.value, {
      x: x + 0.25, y: 1.85, w: 2.6, h: 1.0,
      fontFace: 'Calibri', fontSize: 40, bold: true, color: INDIGO_DEEP, margin: 0,
    })
    slide.addText(card.label, {
      x: x + 0.25, y: 2.9, w: 2.6, h: 0.4,
      fontFace: 'Calibri', fontSize: 14, color: MUTED, margin: 0,
    })
  })

  slide.addText('Protocols in use', {
    x: 0.5, y: 4.05, w: 12, h: 0.3,
    fontFace: 'Calibri', fontSize: 14, bold: true, color: NAVY, margin: 0,
  })
  slide.addText(brief.stats.protocols.length ? brief.stats.protocols.join('   ·   ') : 'No protocols modelled yet', {
    x: 0.5, y: 4.4, w: 12.3, h: 0.4,
    fontFace: 'Calibri', fontSize: 16, color: SLATE, margin: 0,
  })

  slide.addText(brief.scope.map((item) => ({ text: item, options: { bullet: true, breakLine: true } })), {
    x: 0.5, y: 5.0, w: 12.3, h: 1.8,
    fontFace: 'Calibri', fontSize: 15, color: SLATE, paraSpaceAfter: 6, valign: 'top',
  })
}

function addDiagramSlide(pres: PptxGenJS, brief: ArchitectureBrief, diagram?: DiagramImage | null) {
  const slide = contentSlide(pres, 'Current diagram', 'Snapshot of the open canvas')

  if (!diagram) {
    slide.addShape(pres.ShapeType.rect, {
      x: 0.5, y: 1.55, w: 12.3, h: 5.3,
      fill: { color: WHITE }, line: { color: LINE },
    })
    slide.addText(
      'The live canvas could not be captured in this browser session. Systems and integrations are still explained on the following slides.',
      {
        x: 1.2, y: 3.4, w: 10.8, h: 1.0,
        fontFace: 'Calibri', fontSize: 16, color: MUTED, align: 'center',
      },
    )
    return
  }

  const box = { x: 0.5, y: 1.5, w: 12.3, h: 5.4 }
  const fitted = fitContain(diagram.width, diagram.height, box.w, box.h)
  slide.addShape(pres.ShapeType.rect, {
    x: box.x, y: box.y, w: box.w, h: box.h,
    fill: { color: WHITE }, line: { color: LINE },
  })
  try {
    slide.addImage({
      data: diagram.dataUrl,
      x: box.x + (box.w - fitted.w) / 2,
      y: box.y + (box.h - fitted.h) / 2,
      w: fitted.w,
      h: fitted.h,
      altText: `${brief.title} architecture diagram`,
    })
  } catch {
    slide.addText('The diagram snapshot could not be embedded by the PowerPoint library. The remaining slides still explain the architecture.', {
      x: 1.2, y: 3.4, w: 10.8, h: 1.0,
      fontFace: 'Calibri', fontSize: 16, color: MUTED, align: 'center',
    })
  }
}

function addNarrativeSlide(pres: PptxGenJS, brief: ArchitectureBrief) {
  const slide = contentSlide(pres, 'How this architecture works', 'Plain-language explanation of the landscape')

  slide.addShape(pres.ShapeType.rect, {
    x: 0.5, y: 1.55, w: 8.2, h: 5.3,
    fill: { color: WHITE }, line: { color: LINE },
  })
  slide.addText(brief.executiveSummary, {
    x: 0.75, y: 1.8, w: 7.7, h: 4.8,
    fontFace: 'Calibri', fontSize: 16, color: SLATE, valign: 'top',
  })

  brief.observations.slice(0, 4).forEach((note, i) => {
    const y = 1.55 + i * 1.35
    slide.addShape(pres.ShapeType.rect, {
      x: 8.95, y, w: 3.85, h: 1.22,
      fill: { color: WHITE }, line: { color: LINE },
    })
    slide.addShape(pres.ShapeType.rect, {
      x: 8.95, y, w: 0.1, h: 1.22, fill: { color: INDIGO }, line: { color: INDIGO },
    })
    slide.addText(note, {
      x: 9.2, y: y + 0.12, w: 3.45, h: 0.98,
      fontFace: 'Calibri', fontSize: 12, color: SLATE, valign: 'middle',
    })
  })
}

function addLayerSlides(pres: PptxGenJS, brief: ArchitectureBrief) {
  const chunks = chunk(brief.layers, 6)
  chunks.forEach((group, page) => {
    const slide = contentSlide(
      pres,
      page === 0 ? 'Architectural layers' : 'Architectural layers (continued)',
      'How components are grouped on the canvas',
    )
    group.forEach((layer, i) => {
      const col = i % 3
      const row = Math.floor(i / 3)
      const x = 0.5 + col * 4.2
      const y = 1.6 + row * 2.6
      slide.addShape(pres.ShapeType.rect, {
        x, y, w: 4.0, h: 2.4,
        fill: { color: WHITE }, line: { color: LINE },
      })
      slide.addText(String(layer.count), {
        x: x + 0.2, y: y + 0.2, w: 3.6, h: 0.55,
        fontFace: 'Calibri', fontSize: 28, bold: true, color: INDIGO, margin: 0,
      })
      slide.addText(layer.name, {
        x: x + 0.2, y: y + 0.75, w: 3.6, h: 0.4,
        fontFace: 'Calibri', fontSize: 16, bold: true, color: NAVY, margin: 0,
      })
      slide.addText(layer.explanation, {
        x: x + 0.2, y: y + 1.2, w: 3.6, h: 1.0,
        fontFace: 'Calibri', fontSize: 12, color: SLATE, margin: 0,
      })
    })
  })
}

function addSystemSlides(pres: PptxGenJS, brief: ArchitectureBrief) {
  const chunks = chunk(brief.systems, 4)
  if (chunks.length === 0) return

  chunks.forEach((group, page) => {
    const slide = contentSlide(
      pres,
      page === 0 ? 'Systems and their roles' : 'Systems and their roles (continued)',
      'Why each component exists in the landscape',
    )
    group.forEach((system, i) => {
      const y = 1.5 + i * 1.4
      addSystemCard(pres, slide, system, y)
    })
  })
}

function addSystemCard(pres: PptxGenJS, slide: Slide, system: SystemBrief, y: number) {
  slide.addShape(pres.ShapeType.rect, {
    x: 0.5, y, w: 12.3, h: 1.28,
    fill: { color: WHITE }, line: { color: LINE },
  })
  slide.addShape(pres.ShapeType.rect, {
    x: 0.5, y, w: 0.1, h: 1.28, fill: { color: INDIGO }, line: { color: INDIGO },
  })
  slide.addText(system.label, {
    x: 0.8, y: y + 0.1, w: 7.5, h: 0.35,
    fontFace: 'Calibri', fontSize: 16, bold: true, color: NAVY, margin: 0,
  })
  slide.addText(`${system.typeLabel}  ·  ${system.category}${system.vendor ? `  ·  ${system.vendor}` : ''}`, {
    x: 8.4, y: y + 0.12, w: 4.2, h: 0.3,
    fontFace: 'Calibri', fontSize: 11, color: MUTED, align: 'right', margin: 0,
  })
  slide.addText(system.explanation, {
    x: 0.8, y: y + 0.48, w: 11.8, h: 0.7,
    fontFace: 'Calibri', fontSize: 13, color: SLATE, margin: 0,
  })
}

function addIntegrationSlides(pres: PptxGenJS, brief: ArchitectureBrief) {
  if (brief.integrations.length === 0) {
    const slide = contentSlide(pres, 'Integration flows', 'How systems exchange data')
    slide.addText('No integrations are modelled on this canvas yet.', {
      x: 0.5, y: 2.2, w: 12, h: 0.4, fontFace: 'Calibri', fontSize: 16, color: MUTED,
    })
    return
  }

  const header = [
    cell('From', true),
    cell('To', true),
    cell('Protocol', true),
    cell('Cadence', true),
    cell('Explanation', true),
  ]

  chunk(brief.integrations, 6).forEach((group, page) => {
    const slide = contentSlide(
      pres,
      page === 0 ? 'Integration flows' : 'Integration flows (continued)',
      'Contracts between systems, with protocol and intent',
    )
    const rows = [
      header,
      ...group.map((item) => [
        cell(item.sourceLabel),
        cell(item.targetLabel),
        cell(item.protocol),
        cell(item.frequency),
        cell(shorten(item.explanation, 140)),
      ]),
    ]
    slide.addTable(rows, {
      x: 0.4, y: 1.5, w: 12.5, colW: [2.2, 2.2, 1.7, 1.6, 4.8],
      border: { pt: 0.5, color: LINE },
      fontFace: 'Calibri',
      fontSize: 11,
      color: SLATE,
      valign: 'middle',
      align: 'left',
    })
  })
}

function addApiSlides(pres: PptxGenJS, brief: ArchitectureBrief) {
  if (brief.apis.length === 0) return

  chunk(brief.apis, 2).forEach((group, page) => {
    const slide = contentSlide(
      pres,
      page === 0 ? 'API components and methods' : 'API components and methods (continued)',
      'Documented operations available on each interface',
    )
    group.forEach((api, i) => {
      const x = 0.45 + i * 6.45
      slide.addShape(pres.ShapeType.rect, {
        x, y: 1.5, w: 6.25, h: 5.4,
        fill: { color: WHITE }, line: { color: LINE },
      })
      slide.addText(api.title, {
        x: x + 0.25, y: 1.65, w: 5.8, h: 0.4,
        fontFace: 'Calibri', fontSize: 18, bold: true, color: NAVY, margin: 0,
      })
      slide.addText(
        `v${api.version}${api.baseUrl ? `  ·  ${api.baseUrl}` : ''}  ·  ${api.methods.join(', ')}`,
        {
          x: x + 0.25, y: 2.05, w: 5.8, h: 0.35,
          fontFace: 'Calibri', fontSize: 11, color: MUTED, margin: 0,
        },
      )
      const rows = [
        [cell('Method', true), cell('Path', true), cell('Summary', true)],
        ...api.endpoints.slice(0, 10).map((e) => [cell(e.method), cell(e.path), cell(e.summary ?? '')]),
      ]
      slide.addTable(rows, {
        x: x + 0.2, y: 2.5, w: 5.85, colW: [1.1, 2.3, 2.45],
        border: { pt: 0.5, color: LINE },
        fontFace: 'Calibri',
        fontSize: 10,
        color: SLATE,
        valign: 'middle',
      })
    })
  })
}

function addCloseSlide(pres: PptxGenJS, brief: ArchitectureBrief) {
  const slide = contentSlide(pres, 'Review notes', 'What to watch as this architecture evolves')
  slide.addText(
    brief.observations.map((item) => ({ text: item, options: { bullet: true, breakLine: true } })),
    {
      x: 0.6, y: 1.6, w: 12.1, h: 4.6,
      fontFace: 'Calibri', fontSize: 18, color: SLATE, paraSpaceAfter: 10,
    },
  )
}

function contentSlide(pres: PptxGenJS, title: string, subtitle: string) {
  const slide = pres.addSlide()
  slide.background = { color: PAPER }
  slide.addText(title, {
    x: 0.5, y: 0.28, w: 12.3, h: 0.5,
    fontFace: 'Calibri', fontSize: 26, bold: true, color: NAVY, margin: 0,
  })
  slide.addText(subtitle, {
    x: 0.5, y: 0.78, w: 12.3, h: 0.32,
    fontFace: 'Calibri Light', fontSize: 13, color: MUTED, margin: 0,
  })
  return slide
}

function cell(text: string, header = false): TableCell {
  return {
    text,
    options: {
      fill: { color: header ? 'EEF2FF' : WHITE },
      color: header ? INDIGO_DEEP : SLATE,
      bold: header,
      align: 'left',
      valign: 'middle',
    },
  }
}

function fitContain(srcW: number, srcH: number, maxW: number, maxH: number) {
  const ratio = srcW / srcH || 16 / 9
  let w = maxW
  let h = maxW / ratio
  if (h > maxH) {
    h = maxH
    w = maxH * ratio
  }
  return { w, h }
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out.length ? out : []
}

function shorten(text: string, max: number) {
  if (text.length <= max) return text
  return `${text.slice(0, max - 1).trimEnd()}...`
}
