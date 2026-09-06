import type { PaletteItem } from '../types'

export const MICROSOFT_PALETTE_CATEGORIES = [
  'Microsoft 365',
  'Microsoft Apps',
  'Microsoft Identity',
] as const

const V = 'Microsoft 365'
const COLOR = '#0078D4'

function ms(
  category: (typeof MICROSOFT_PALETTE_CATEGORIES)[number],
  label: string,
  service: string,
  extras?: Record<string, string>,
): PaletteItem {
  return {
    type: 'saas',
    label,
    category,
    defaultProperties: { vendor: V, service, color: extras?.color ?? COLOR, ...extras },
  }
}

export const MICROSOFT_PALETTE_ITEMS: PaletteItem[] = [
  ms('Microsoft 365', 'Microsoft 365', 'Microsoft 365', { color: '#D83B01' }),
  ms('Microsoft 365', 'Microsoft 365 Copilot', 'Microsoft 365 Copilot', { color: '#5B2C6F' }),
  ms('Microsoft 365', 'SharePoint', 'SharePoint', { color: '#038387' }),
  ms('Microsoft 365', 'SharePoint Hub Site', 'SharePoint Hub Site', { color: '#038387' }),
  ms('Microsoft 365', 'SharePoint Site', 'SharePoint Site', { color: '#038387' }),
  ms('Microsoft 365', 'SharePoint Library', 'SharePoint Library', { color: '#038387' }),
  ms('Microsoft 365', 'SharePoint List', 'SharePoint List', { color: '#038387' }),
  ms('Microsoft 365', 'SharePoint Server', 'SharePoint Server', { color: '#038387' }),
  ms('Microsoft 365', 'OneDrive', 'OneDrive', { color: '#0078D4' }),
  ms('Microsoft 365', 'OneDrive for Business', 'OneDrive for Business', { color: '#0078D4' }),
  ms('Microsoft 365', 'Microsoft Teams', 'Microsoft Teams', { color: '#6264A7' }),
  ms('Microsoft 365', 'Teams Channel', 'Teams Channel', { color: '#6264A7' }),
  ms('Microsoft 365', 'Teams Phone', 'Teams Phone', { color: '#6264A7' }),
  ms('Microsoft 365', 'Outlook', 'Outlook', { color: '#0078D4' }),
  ms('Microsoft 365', 'Exchange Online', 'Exchange Online', { color: '#0078D4' }),
  ms('Microsoft 365', 'Exchange Server', 'Exchange Server', { color: '#0078D4' }),
  ms('Microsoft 365', 'Microsoft Graph', 'Microsoft Graph', { color: '#5B2C6F' }),
  ms('Microsoft 365', 'Microsoft Loop', 'Microsoft Loop', { color: '#0078D4' }),
  ms('Microsoft 365', 'Microsoft Lists', 'Microsoft Lists', { color: '#D83B01' }),
  ms('Microsoft 365', 'Microsoft Stream', 'Microsoft Stream', { color: '#BC1948' }),
  ms('Microsoft 365', 'Microsoft Viva', 'Microsoft Viva', { color: '#C43B8C' }),
  ms('Microsoft 365', 'Viva Engage', 'Viva Engage', { color: '#C43B8C' }),
  ms('Microsoft 365', 'Microsoft Bookings', 'Microsoft Bookings', { color: '#0078D4' }),
  ms('Microsoft 365', 'Windows 365', 'Windows 365', { color: '#0078D4' }),

  ms('Microsoft Apps', 'Word', 'Word', { color: '#2B579A' }),
  ms('Microsoft Apps', 'Excel', 'Excel', { color: '#217346' }),
  ms('Microsoft Apps', 'PowerPoint', 'PowerPoint', { color: '#D24726' }),
  ms('Microsoft Apps', 'OneNote', 'OneNote', { color: '#7719AA' }),
  ms('Microsoft Apps', 'Microsoft Planner', 'Microsoft Planner', { color: '#31752F' }),
  ms('Microsoft Apps', 'Microsoft To Do', 'Microsoft To Do', { color: '#5B2C6F' }),
  ms('Microsoft Apps', 'Microsoft Forms', 'Microsoft Forms', { color: '#0078D4' }),
  ms('Microsoft Apps', 'Microsoft Whiteboard', 'Microsoft Whiteboard', { color: '#D83B01' }),
  ms('Microsoft Apps', 'Microsoft Edge', 'Microsoft Edge', { color: '#0078D4' }),
  ms('Microsoft Apps', 'Microsoft Clipchamp', 'Microsoft Clipchamp', { color: '#0078D4' }),

  ms('Microsoft Identity', 'Microsoft Entra ID', 'Entra ID', { color: '#0078D4' }),
  ms('Microsoft Identity', 'Microsoft Intune', 'Microsoft Intune', { color: '#0078D4' }),
  ms('Microsoft Identity', 'Microsoft Defender', 'Microsoft Defender', { color: '#0078D4' }),
  ms('Microsoft Identity', 'Microsoft Purview', 'Microsoft Purview', { color: '#0078D4' }),
  ms('Microsoft Identity', 'Microsoft Fabric', 'Microsoft Fabric', { color: '#0078D4' }),
]
