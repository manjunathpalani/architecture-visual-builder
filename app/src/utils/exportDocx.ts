import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx'
import type { DiagramImage } from './captureDiagram'
import { dataUrlToBytes } from './captureDiagram'
import {
  downloadBlob,
  type ArchitectureBrief,
  type IntegrationBrief,
  type NfrBrief,
  type SequenceFlowBrief,
  type SystemBrief,
} from './architectureNarrative'

export interface SadDiagramSet {
  overview?: DiagramImage | null
  views?: Array<{ key: string; title: string; image: DiagramImage }>
}

const PAGE_W = 12240
const MARGIN = 1080
const CONTENT_W = PAGE_W - MARGIN * 2
const INDIGO = '312E81'
const SLATE = '334155'
const MUTED = '64748B'
const HEADER_FILL = 'EEF2FF'
const ALT_FILL = 'F8FAFC'
const LINE = 'E2E8F0'

const border = { style: BorderStyle.SINGLE, size: 4, color: LINE }
const borders = { top: border, bottom: border, left: border, right: border }

export async function exportArchitectureDocx(
  brief: ArchitectureBrief,
  diagrams?: DiagramImage | SadDiagramSet | null,
) {
  const blob = await buildArchitectureDocx(brief, diagrams)
  downloadBlob(blob, `${brief.fileBase}-sad.docx`)
}

export async function buildArchitectureDocx(
  brief: ArchitectureBrief,
  diagrams?: DiagramImage | SadDiagramSet | null,
): Promise<Blob> {
  const images = asSadDiagrams(diagrams)
  const children: (Paragraph | Table)[] = [
    new Paragraph({
      children: [
        new TextRun({ text: 'SOLUTION ARCHITECTURE DOCUMENT', bold: true, size: 20, color: INDIGO, font: 'Arial' }),
      ],
      spacing: { after: 80 },
    }),
    new Paragraph({
      heading: HeadingLevel.TITLE,
      children: [new TextRun({ text: brief.title, font: 'Arial', size: 48, bold: true, color: '0F172A' })],
    }),
    new Paragraph({
      children: [new TextRun({ text: brief.description, italics: true, size: 22, color: SLATE, font: 'Arial' })],
      spacing: { after: 240 },
    }),
    metaLine('Version', brief.version),
    metaLine('Architecture updated', brief.updatedAt),
    metaLine('Document generated', brief.generatedAt),
    metaLine(
      'Inventory',
      `${brief.stats.systems} systems | ${brief.stats.integrations} integrations | ${brief.stats.apis} APIs | ${brief.stats.subDiagrams} nested diagrams`,
    ),
    metaLine('Narrative', brief.aiWritten ? 'AI-assisted SAD writing with architect notes' : 'Generated from the modelled canvas'),
  ]

  let section = 1
  const addHeading = (title: string) => {
    children.push(heading(`${section}. ${title}`))
    section += 1
  }
  let figure = 1
  const addFigure = (image: DiagramImage | null | undefined, caption: string) => {
    const block = image ? diagramParagraph(image, caption) : null
    if (!block) {
      children.push(body(`A raster snapshot for “${caption}” was not available. The narrative still describes this view.`))
      return
    }
    children.push(block)
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: `Figure ${figure}. ${caption}`,
            italics: true,
            size: 18,
            color: MUTED,
            font: 'Arial',
          }),
        ],
        spacing: { after: 280 },
      }),
    )
    figure += 1
  }

  addHeading('Purpose')
  children.push(body(brief.purpose))

  addHeading('Executive summary')
  children.push(body(brief.executiveSummary))

  addHeading('Scope')
  for (const item of brief.scope) children.push(bullet(item))

  if (brief.assumptions.length > 0) {
    addHeading('Assumptions')
    for (const item of brief.assumptions) children.push(bullet(item))
  }

  addHeading('Architecture overview')
  children.push(
    body(
      'The following diagram is the top-level canvas. Nested diagrams and sequence flows are documented in later sections.',
    ),
  )
  addFigure(imageFor(images, 'root'), `${brief.title} — landscape`)

  addHeading('Architectural layers')
  children.push(
    body(
      'Components are grouped by the categories used on the canvas. Each layer is a planning unit: change control, ownership, and runtime characteristics tend to align with these groups.',
    ),
  )
  children.push(
    makeTable(
      ['Layer', 'Components', 'Explanation'],
      [1800, 1400, CONTENT_W - 3200],
      brief.layers.map((layer) => [layer.name, String(layer.count), layer.explanation]),
    ),
  )

  addHeading('System catalogue')
  children.push(body('The catalogue lists every modelled system, including vendor, environment, and the role it plays.'))
  children.push(
    makeTable(
      ['System', 'Type', 'Category', 'Vendor', 'Role'],
      [2200, 1400, 1600, 1600, CONTENT_W - 6800],
      brief.systems.map((s) => [s.label, s.typeLabel, s.category, s.vendor ?? '—', s.description]),
    ),
  )

  addHeading('Integration architecture')
  if (brief.integrations.length === 0) {
    children.push(body('No integrations are modelled on this canvas.'))
  } else {
    children.push(
      body(
        'Each row is a contract between two systems: who talks to whom, in which direction, over which protocol, and how often.',
      ),
    )
    children.push(
      makeTable(
        ['Integration', 'From', 'To', 'Protocol', 'Frequency', 'Format'],
        [2000, 1700, 1700, 1400, 1400, CONTENT_W - 8200],
        brief.integrations.map((i) => [i.label, i.sourceLabel, i.targetLabel, i.protocol, i.frequency, i.dataFormat]),
      ),
    )
  }

  addHeading('Sequence flows')
  if (brief.sequenceFlows.length === 0) {
    children.push(body('Add integrations on the canvas to document end-to-end sequence flows in the next export.'))
  } else {
    children.push(
      body(
        'Sequence flows are derived from modelled integrations on the landscape and on every nested diagram. Each flow is a time-ordered conversation between participants.',
      ),
    )
    const byView = groupByView(brief.sequenceFlows)
    for (const group of byView) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: group.viewPath, font: 'Arial' })],
        }),
      )
      for (const flow of group.flows) {
        children.push(...sequenceSection(flow))
      }
    }
  }

  const nestedViews = brief.views.filter((view) => view.key !== 'root')
  if (nestedViews.length > 0) {
    addHeading('Nested diagrams')
    children.push(
      body(
        'Every sub-diagram under a parent component is included so reviewers can inspect internal design without opening the builder.',
      ),
    )
    for (const view of nestedViews) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: view.path, font: 'Arial' })],
        }),
      )
      if (view.description) children.push(body(view.description))
      children.push(
        body(
          `${view.systems.length} internal component${view.systems.length === 1 ? '' : 's'} and ${view.integrations.length} integration${view.integrations.length === 1 ? '' : 's'}.`,
        ),
      )
      addFigure(imageFor(images, view.key), view.path)
      for (const system of view.systems) {
        children.push(bullet(`${system.label} — ${system.explanation}`))
      }
      if (view.integrations.length > 0) {
        children.push(
          makeTable(
            ['From', 'To', 'Protocol', 'Frequency'],
            [2400, 2400, 2200, CONTENT_W - 7000],
            view.integrations.map((item) => [item.sourceLabel, item.targetLabel, item.protocol, item.frequency]),
          ),
        )
      }
    }
  }

  addHeading('Non-functional requirements')
  if (brief.nfrs.length === 0) {
    children.push(body('No non-functional requirements were derived. Add feature NFRs or use AI Write SAD to draft quality attributes.'))
  } else {
    children.push(
      body(
        'Quality attributes for this landscape. Feature-authored NFRs are included when present; remaining items are inferred from the modelled systems, APIs, and flows.',
      ),
    )
    children.push(nfrTable(brief.nfrs))
  }

  addHeading('Component explanations')
  children.push(body('The following narratives explain why each system is on the diagram and how it participates in the landscape.'))
  for (const system of brief.systems) {
    children.push(...systemSection(system))
  }

  addHeading('Integration explanations')
  if (brief.integrations.length === 0) {
    children.push(body('Add connections on the canvas to document data movement in the next export.'))
  } else {
    for (const integration of brief.integrations) {
      children.push(...integrationSection(integration))
    }
  }

  if (brief.apis.length > 0) {
    addHeading('Interface specifications')
    children.push(
      body(
        'API components and integrations that carry an interface spec are expanded here so reviewers can see available methods without opening Swagger.',
      ),
    )
    for (const api of brief.apis) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: `${api.title}  v${api.version}`, font: 'Arial' })],
        }),
      )
      if (api.baseUrl) {
        children.push(body(`Base URL: ${api.baseUrl}`))
      }
      if (api.description) children.push(body(api.description))
      children.push(body(`Available methods: ${api.methods.join(', ') || 'none listed'}.`))
      children.push(
        makeTable(
          ['Method', 'Path', 'Summary'],
          [1400, 3600, CONTENT_W - 5000],
          api.endpoints.map((e) => [e.method, e.path, e.summary ?? '']),
        ),
      )
    }
  }

  addHeading('Observations')
  for (const note of brief.observations) {
    children.push(bullet(note))
  }

  if (brief.risks.length > 0 || brief.recommendations.length > 0) {
    addHeading('Risks and recommendations')
    if (brief.risks.length > 0) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: 'Risks', font: 'Arial' })],
        }),
      )
      for (const item of brief.risks) children.push(bullet(item))
    }
    if (brief.recommendations.length > 0) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: 'Recommendations', font: 'Arial' })],
        }),
      )
      for (const item of brief.recommendations) children.push(bullet(item))
    }
  }

  const doc = new Document({
    styles: {
      default: { document: { run: { font: 'Arial', size: 22 } } },
      paragraphStyles: [
        {
          id: 'Title',
          name: 'Title',
          basedOn: 'Normal',
          quickFormat: true,
          run: { size: 48, bold: true, font: 'Arial', color: '0F172A' },
          paragraph: { spacing: { after: 200 } },
        },
        {
          id: 'Heading1',
          name: 'Heading 1',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { size: 28, bold: true, font: 'Arial', color: INDIGO },
          paragraph: { spacing: { before: 360, after: 160 }, outlineLevel: 0 },
        },
        {
          id: 'Heading2',
          name: 'Heading 2',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { size: 24, bold: true, font: 'Arial', color: '1E1B4B' },
          paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 },
        },
        {
          id: 'Heading3',
          name: 'Heading 3',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { size: 22, bold: true, font: 'Arial', color: '312E81' },
          paragraph: { spacing: { before: 180, after: 80 }, outlineLevel: 2 },
        },
      ],
    },
    numbering: {
      config: [
        {
          reference: 'bullets',
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: '•',
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: PAGE_W, height: 15840 },
            margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: INDIGO, space: 6 } },
                children: [
                  new TextRun({ text: 'Solution Architecture Document', bold: true, size: 16, color: INDIGO, font: 'Arial' }),
                  new TextRun({ text: `    ${brief.title}`, size: 16, color: MUTED, font: 'Arial' }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                border: { top: { style: BorderStyle.SINGLE, size: 6, color: LINE, space: 8 } },
                children: [
                  new TextRun({ text: 'Architecture Visual Builder', size: 16, color: MUTED, font: 'Arial' }),
                  new TextRun({ text: '    Page ', size: 16, color: MUTED, font: 'Arial' }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 16, color: MUTED, font: 'Arial' }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  })

  return Packer.toBlob(doc)
}

function sanitizeXml(value: unknown): string {
  const text = String(value ?? '').trim() || '—'
  return text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
}

function heading(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun({ text, font: 'Arial' })],
  })
}

function body(text: string) {
  return new Paragraph({
    children: [new TextRun({ text: sanitizeXml(text), font: 'Arial', size: 22, color: SLATE })],
    spacing: { after: 160 },
  })
}

function bullet(text: string) {
  return new Paragraph({
    numbering: { reference: 'bullets', level: 0 },
    children: [new TextRun({ text: sanitizeXml(text), font: 'Arial', size: 22, color: SLATE })],
    spacing: { after: 80 },
  })
}

function metaLine(label: string, value: string) {
  return new Paragraph({
    children: [
      new TextRun({ text: `${label}: `, bold: true, size: 20, color: MUTED, font: 'Arial' }),
      new TextRun({ text: value, size: 20, color: SLATE, font: 'Arial' }),
    ],
    spacing: { after: 60 },
  })
}

function systemSection(system: SystemBrief): (Paragraph | Table)[] {
  return [
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: [new TextRun({ text: system.label, font: 'Arial' })],
    }),
    body(system.explanation),
  ]
}

function integrationSection(integration: IntegrationBrief): (Paragraph | Table)[] {
  return [
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: [new TextRun({ text: `${integration.sourceLabel} → ${integration.targetLabel}`, font: 'Arial' })],
    }),
    body(integration.explanation),
  ]
}

function sequenceSection(flow: SequenceFlowBrief): (Paragraph | Table)[] {
  const rows: (Paragraph | Table)[] = [
    new Paragraph({
      heading: HeadingLevel.HEADING_3,
      children: [new TextRun({ text: flow.name, font: 'Arial' })],
    }),
    body(flow.summary),
    body(`Participants: ${flow.participants.join(', ') || '—'}`),
    makeTable(
      ['Step', 'From', 'To', 'Protocol', 'Message'],
      [700, 1800, 1800, 1400, CONTENT_W - 5700],
      flow.steps.map((step, index) => [
        String(index + 1),
        step.from,
        step.to,
        step.protocol,
        step.message,
      ]),
    ),
  ]
  if (flow.script) {
    rows.push(
      new Paragraph({
        children: [
          new TextRun({
            text: flow.script,
            font: 'Consolas',
            size: 18,
            color: SLATE,
          }),
        ],
        spacing: { before: 80, after: 200 },
      }),
    )
  }
  return rows
}

function nfrTable(items: NfrBrief[]) {
  return makeTable(
    ['ID', 'Category', 'Requirement', 'Rationale'],
    [1200, 1600, 4200, CONTENT_W - 7000],
    items.map((item) => [item.id, item.category, item.requirement, item.rationale]),
  )
}

function asSadDiagrams(diagrams?: DiagramImage | SadDiagramSet | null): SadDiagramSet {
  if (!diagrams) return {}
  if ('dataUrl' in diagrams) {
    return {
      overview: diagrams,
      views: [{ key: 'root', title: 'Overview', image: diagrams }],
    }
  }
  return diagrams
}

function imageFor(diagrams: SadDiagramSet, key: string): DiagramImage | null {
  const match = diagrams.views?.find((view) => view.key === key)
  if (match) return match.image
  if (key === 'root') return diagrams.overview ?? null
  return null
}

function groupByView(flows: SequenceFlowBrief[]): Array<{ viewPath: string; flows: SequenceFlowBrief[] }> {
  const groups: Array<{ viewPath: string; flows: SequenceFlowBrief[] }> = []
  const index = new Map<string, number>()
  for (const flow of flows) {
    const existing = index.get(flow.viewKey)
    if (existing != null) {
      groups[existing].flows.push(flow)
      continue
    }
    index.set(flow.viewKey, groups.length)
    groups.push({ viewPath: flow.viewPath, flows: [flow] })
  }
  return groups
}

function diagramParagraph(diagram: DiagramImage, title: string): Paragraph | null {
  if (!diagram.dataUrl?.includes('base64,')) return null
  const maxW = 620
  const maxH = 420
  const ratio = diagram.width / diagram.height || 16 / 9
  let width = maxW
  let height = Math.round(maxW / ratio)
  if (height > maxH) {
    height = maxH
    width = Math.round(maxH * ratio)
  }

  try {
    const bytes = dataUrlToBytes(diagram.dataUrl)
    const data = Uint8Array.from(bytes)
    return new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new ImageRun({
          type: 'png',
          data,
          transformation: { width, height },
          altText: {
            name: `${title} diagram`,
            description: `Architecture diagram for ${title}`,
            title: `${title} diagram`,
          },
        }),
      ],
      spacing: { before: 120, after: 80 },
    })
  } catch {
    return null
  }
}

function makeTable(headers: string[], columnWidths: number[], rows: string[][]) {
  const safeRows = rows.length > 0 ? rows : [headers.map(() => '—')]
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map(
      (text, i) =>
        new TableCell({
          borders,
          width: { size: columnWidths[i], type: WidthType.DXA },
          shading: { fill: HEADER_FILL, type: ShadingType.CLEAR },
          margins: { top: 60, bottom: 60, left: 80, right: 80 },
          children: [
            new Paragraph({
              children: [new TextRun({ text, bold: true, size: 16, font: 'Arial', color: INDIGO })],
            }),
          ],
        }),
    ),
  })

  const dataRows = safeRows.map(
    (row, rowIndex) =>
      new TableRow({
        children: row.map(
          (text, i) =>
            new TableCell({
              borders,
              width: { size: columnWidths[i], type: WidthType.DXA },
              shading: { fill: rowIndex % 2 === 1 ? ALT_FILL : 'FFFFFF', type: ShadingType.CLEAR },
              margins: { top: 50, bottom: 50, left: 80, right: 80 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: sanitizeXml(text), size: 16, font: 'Arial', color: SLATE })],
                }),
              ],
            }),
        ),
      }),
  )

  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths,
    rows: [headerRow, ...dataRows],
  })
}
