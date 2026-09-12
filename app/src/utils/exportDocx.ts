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
  type SystemBrief,
} from './architectureNarrative'

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

export async function exportArchitectureDocx(brief: ArchitectureBrief, diagram?: DiagramImage | null) {
  const blob = await buildArchitectureDocx(brief, diagram)
  downloadBlob(blob, `${brief.fileBase}-sad.docx`)
}

export async function buildArchitectureDocx(brief: ArchitectureBrief, diagram?: DiagramImage | null): Promise<Blob> {
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
      `${brief.stats.systems} systems | ${brief.stats.integrations} integrations | ${brief.stats.apis} APIs`,
    ),

    heading('1. Purpose'),
    body(brief.purpose),

    heading('2. Executive summary'),
    body(brief.executiveSummary),

    heading('3. Scope'),
    ...brief.scope.map((item) => bullet(item)),

    heading('4. Architecture overview'),
    body(
      'The following diagram is a snapshot of the current canvas in Architecture Visual Builder. Nested diagrams, if any, are described later in this document.',
    ),
  ]

  const diagramBlock = diagram ? diagramParagraph(diagram, brief.title) : null
  if (diagramBlock) {
    children.push(diagramBlock)
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: `Figure 1. ${brief.title} — current view`,
            italics: true,
            size: 18,
            color: MUTED,
            font: 'Arial',
          }),
        ],
        spacing: { after: 280 },
      }),
    )
  } else {
    children.push(
      body(
        'A raster snapshot of the canvas was not available for this export. The tables and narrative below still describe every modelled system and integration.',
      ),
    )
  }

  children.push(heading('5. Architectural layers'))
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

  children.push(heading('6. System catalogue'))
  children.push(body('The catalogue lists every modelled system, including vendor, environment, and the role it plays.'))
  children.push(
    makeTable(
      ['System', 'Type', 'Category', 'Vendor', 'Role'],
      [2200, 1400, 1600, 1600, CONTENT_W - 6800],
      brief.systems.map((s) => [s.label, s.typeLabel, s.category, s.vendor ?? '—', s.description]),
    ),
  )

  children.push(heading('7. Integration architecture'))
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

  children.push(heading('8. Component explanations'))
  children.push(body('The following narratives explain why each system is on the diagram and how it participates in the landscape.'))
  for (const system of brief.systems) {
    children.push(...systemSection(system))
  }

  children.push(heading('9. Integration explanations'))
  if (brief.integrations.length === 0) {
    children.push(body('Add connections on the canvas to document data movement in the next export.'))
  } else {
    for (const integration of brief.integrations) {
      children.push(...integrationSection(integration))
    }
  }

  if (brief.apis.length > 0) {
    children.push(heading('10. Interface specifications'))
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

  if (brief.views.length > 1) {
    children.push(heading(brief.apis.length > 0 ? '11. Nested diagrams' : '10. Nested diagrams'))
    children.push(body('These views were found under systems that have an internal diagram.'))
    for (const view of brief.views.slice(1)) {
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
      for (const system of view.systems) {
        children.push(bullet(`${system.label} — ${system.explanation}`))
      }
    }
  }

  children.push(heading(brief.apis.length > 0 || brief.views.length > 1 ? '12. Observations' : '10. Observations'))
  for (const note of brief.observations) {
    children.push(bullet(note))
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
