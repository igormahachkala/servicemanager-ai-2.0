import { BadRequestException, Injectable } from '@nestjs/common'
import { InspectionReportStatus } from '@prisma/client'

import { buildInspectionDocumentDate } from './inspection.report.mapper'

type ReportPayload = {
  run: {
    id: string
    status: string
    startedAt: string
    completedAt?: string | null
    performedBy?: {
      email: string
      firstName?: string | null
      lastName?: string | null
    } | null
    template: { name: string }
    location: {
      name: string
      platformCode?: string | null
      city?: string | null
      address?: string | null
    }
    equipment?: {
      name: string
      type: string
    } | null
  }
  document: {
    title: string
    number: string
    date?: string | null
    executorCompany: {
      name: string
      legalName?: string | null
      address?: string | null
      phone?: string | null
      email?: string | null
      taxId?: string | null
      registrationNumber?: string | null
      signatureLineName?: string | null
      signatureLineTitle?: string | null
    }
    clientCompany: {
      name: string
      legalName?: string | null
      address?: string | null
      phone?: string | null
      email?: string | null
      signatureLineName?: string | null
      signatureLineTitle?: string | null
    }
  }
  reportMeta: {
    status: InspectionReportStatus
    approvedAt?: string | null
    submittedAt?: string | null
    submittedBy?: { email: string; firstName?: string | null; lastName?: string | null } | null
    reviewedAt?: string | null
    reviewedBy?: { email: string; firstName?: string | null; lastName?: string | null } | null
    reviewComment?: string | null
  }
  items: Array<{
    title: string
    description?: string | null
    status: string
    comment?: string | null
    requiresRepair: boolean
    attachments: Array<{ originalName?: string | null; url: string }>
    ticket?: { id: string; status: string; problemText?: string | null } | null
  }>
  summary: {
    totalItems: number
    okCount: number
    issueCount: number
    criticalCount: number
    skippedCount?: number
    repairRequiredCount: number
    createdTicketsCount: number
  }
}

type ExportResult = {
  buffer: Buffer
  contentType: string
  fileName: string
}

type ZipEntry = {
  name: string
  data: Buffer
  crc32: number
  offset: number
}

@Injectable()
export class InspectionExportService {
  exportReport(report: ReportPayload, format?: string): ExportResult {
    const normalizedFormat = (format || 'docx').toLowerCase()
    if (normalizedFormat !== 'docx') {
      throw new BadRequestException('Only DOCX export is currently supported')
    }

    const buffer = this.buildDocx(report)
    const safeNumber = sanitizeFileName(report.document.number || report.run.id)

    return {
      buffer,
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      fileName: `${safeNumber}.docx`,
    }
  }

  private buildDocx(report: ReportPayload) {
    const files = new Map<string, Buffer>()
    files.set('[Content_Types].xml', Buffer.from(this.contentTypesXml(), 'utf8'))
    files.set('_rels/.rels', Buffer.from(this.rootRelsXml(), 'utf8'))
    files.set('docProps/app.xml', Buffer.from(this.appXml(), 'utf8'))
    files.set('docProps/core.xml', Buffer.from(this.coreXml(report), 'utf8'))
    files.set('word/document.xml', Buffer.from(this.documentXml(report), 'utf8'))

    return buildZip(files)
  }

  private contentTypesXml() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`
  }

  private rootRelsXml() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`
  }

  private appXml() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Сервис Менеджер</Application>
  <DocSecurity>0</DocSecurity>
  <ScaleCrop>false</ScaleCrop>
  <Company>СМА-Тех</Company>
  <LinksUpToDate>false</LinksUpToDate>
  <SharedDoc>false</SharedDoc>
  <HyperlinksChanged>false</HyperlinksChanged>
  <AppVersion>1.0</AppVersion>
</Properties>`
  }

  private coreXml(report: ReportPayload) {
    const now = new Date().toISOString()
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${xmlEscape(report.document.title)}</dc:title>
  <dc:creator>Сервис Менеджер</dc:creator>
  <cp:lastModifiedBy>Сервис Менеджер</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>
</cp:coreProperties>`
  }

  private documentXml(report: ReportPayload) {
    const lines: Array<ReturnType<typeof paragraphXml>> = []
    const watermark = watermarkLabel(report.reportMeta.status)
    if (watermark) {
      lines.push(paragraphXml(watermark, { align: 'center', bold: true, size: 32, color: report.reportMeta.status === 'REJECTED' ? '991B1B' : '92400E' }))
    }

    lines.push(paragraphXml(report.document.title, { align: 'center', bold: true, size: 32 }))
    lines.push(paragraphXml(`№ ${report.document.number} от ${formatDocDate(report.document.date)}`, { align: 'center', size: 24 }))
    lines.push(paragraphXml(''))
    lines.push(paragraphXml('Исполнитель', { bold: true, size: 24 }))
    lines.push(...partyParagraphs(report.document.executorCompany))
    lines.push(paragraphXml(''))
    lines.push(paragraphXml('Заказчик', { bold: true, size: 24 }))
    lines.push(...partyParagraphs(report.document.clientCompany))
    lines.push(paragraphXml(''))
    lines.push(paragraphXml('Контекст работ', { bold: true, size: 24 }))
    lines.push(paragraphXml(`Локация: ${report.run.location.name}${report.run.location.city ? ' · ' + report.run.location.city : ''}`))
    lines.push(paragraphXml(`Адрес: ${report.run.location.address || '—'}`))
    lines.push(paragraphXml(`Код точки: ${report.run.location.platformCode || '—'}`))
    lines.push(paragraphXml(`Оборудование: ${report.run.equipment ? `${report.run.equipment.name} (${report.run.equipment.type})` : '—'}`))
    lines.push(paragraphXml(`Исполнитель обхода: ${formatPerson(report.run.performedBy)}`))
    lines.push(paragraphXml(`Шаблон: ${report.run.template.name}`))
    lines.push(paragraphXml(`Начат: ${formatDocDateTime(report.run.startedAt)}`))
    lines.push(paragraphXml(`Завершен: ${formatDocDateTime(report.run.completedAt)}`))
    lines.push(paragraphXml(''))
    lines.push(paragraphXml('Сводка', { bold: true, size: 24 }))
    lines.push(paragraphXml(`Всего пунктов: ${report.summary.totalItems}`))
    lines.push(paragraphXml(`OK: ${report.summary.okCount}; Проблемы: ${report.summary.issueCount}; Критично: ${report.summary.criticalCount}; Пропущено: ${report.summary.skippedCount || 0}`))
    lines.push(paragraphXml(`Нужен ремонт: ${report.summary.repairRequiredCount}; Создано заявок: ${report.summary.createdTicketsCount}`))
    lines.push(paragraphXml(''))
    lines.push(paragraphXml('Статус согласования', { bold: true, size: 24 }))
    lines.push(paragraphXml(`Статус: ${statusLabel(report.reportMeta.status)}`))
    lines.push(paragraphXml(`Отправлено: ${formatDocDateTime(report.reportMeta.submittedAt)} · ${formatPerson(report.reportMeta.submittedBy)}`))
    lines.push(paragraphXml(`Проверено: ${formatDocDateTime(report.reportMeta.reviewedAt)} · ${formatPerson(report.reportMeta.reviewedBy)}`))
    lines.push(paragraphXml(`Комментарий проверки: ${report.reportMeta.reviewComment || '—'}`))
    lines.push(paragraphXml(''))
    lines.push(paragraphXml('Пункты обхода', { bold: true, size: 24 }))

    report.items.forEach((item, index) => {
      lines.push(paragraphXml(`${index + 1}. ${item.title}`, { bold: true }))
      if (item.description) lines.push(paragraphXml(`Описание: ${item.description}`))
      lines.push(paragraphXml(`Статус: ${itemStatusLabel(item.status)}`))
      lines.push(paragraphXml(`Комментарий: ${item.comment || '—'}`))
      lines.push(paragraphXml(`Нужен ремонт: ${item.requiresRepair ? 'Да' : 'Нет'}`))
      if (item.attachments.length) {
        lines.push(paragraphXml(`Фото: ${item.attachments.map((a) => a.originalName || a.url).join(', ')}`))
      }
      if (item.ticket) {
        lines.push(paragraphXml(`Заявка: #${item.ticket.id} · ${item.ticket.status} · ${item.ticket.problemText || 'Без описания'}`))
      }
      lines.push(paragraphXml(''))
    })

    lines.push(paragraphXml('Подписи', { bold: true, size: 24 }))
    lines.push(paragraphXml(`Исполнитель: ${report.document.executorCompany.signatureLineName || formatPerson(report.run.performedBy)} / ${report.document.executorCompany.signatureLineTitle || 'Исполнитель работ'}`))
    lines.push(paragraphXml('Дата / подпись: ______________________________'))
    lines.push(paragraphXml(`Проверил: ${formatPerson(report.reportMeta.reviewedBy)} / ${report.reportMeta.status === 'APPROVED' ? 'Акт подтвержден' : 'Проверка акта'}`))
    lines.push(paragraphXml('Дата / подпись: ______________________________'))
    lines.push(paragraphXml(`Представитель клиента: ${report.document.clientCompany.signatureLineName || '________________'} / ${report.document.clientCompany.signatureLineTitle || 'Представитель заказчика'}`))
    lines.push(paragraphXml('Дата / подпись: ______________________________'))

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:w10="urn:schemas-microsoft-com:office:word" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk" xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" mc:Ignorable="w14 wp14">
  <w:body>
    ${lines.join('')}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1134" w:right="850" w:bottom="1134" w:left="850" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`
  }
}

function partyParagraphs(party: ReportPayload['document']['executorCompany']) {
  return [
    paragraphXml(party.name),
    paragraphXml(party.legalName || '—'),
    paragraphXml(`Адрес: ${party.address || '—'}`),
    paragraphXml(`Телефон: ${party.phone || '—'}`),
    paragraphXml(`Email: ${party.email || '—'}`),
    paragraphXml(`ИНН / Tax ID: ${party.taxId || '—'}`),
    paragraphXml(`Регистрационный номер: ${party.registrationNumber || '—'}`),
  ]
}

function statusLabel(status: InspectionReportStatus) {
  if (status === 'DRAFT') return 'Черновик'
  if (status === 'SUBMITTED') return 'На согласовании'
  if (status === 'APPROVED') return 'Подтверждено'
  if (status === 'REJECTED') return 'Возвращено'
  return status
}

function watermarkLabel(status: InspectionReportStatus) {
  if (status === 'SUBMITTED') return 'НА СОГЛАСОВАНИИ'
  if (status === 'REJECTED') return 'ВОЗВРАЩЕНО'
  if (status === 'DRAFT') return 'ЧЕРНОВИК'
  return ''
}

function itemStatusLabel(status: string) {
  if (status === 'PENDING') return 'Не заполнено'
  if (status === 'OK') return 'OK'
  if (status === 'ISSUE') return 'Проблема'
  if (status === 'CRITICAL') return 'Критично'
  if (status === 'SKIPPED') return 'Пропущено'
  return status
}

function formatPerson(user?: { email: string; firstName?: string | null; lastName?: string | null } | null) {
  if (!user) return '—'
  const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim()
  return fullName || user.email
}

function formatDocDate(value?: string | null) {
  if (!value) return '—'
  const normalized = buildInspectionDocumentDate(value)
  if (!normalized) return String(value)
  const [year, month, day] = normalized.split('-')
  return `${day}.${month}.${year}`
}

function formatDocDateTime(value?: string | null) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString('ru-RU')
  } catch {
    return String(value)
  }
}

function paragraphXml(text: string, options?: { bold?: boolean; size?: number; align?: 'left' | 'center'; color?: string }) {
  const alignXml = options?.align ? `<w:jc w:val="${options.align}"/>` : ''
  const boldXml = options?.bold ? '<w:b/>' : ''
  const sizeXml = options?.size ? `<w:sz w:val="${options.size}"/><w:szCs w:val="${options.size}"/>` : ''
  const colorXml = options?.color ? `<w:color w:val="${options.color}"/>` : ''
  return `<w:p><w:pPr>${alignXml}</w:pPr><w:r><w:rPr>${boldXml}${sizeXml}${colorXml}</w:rPr><w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r></w:p>`
}

function xmlEscape(value: string) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function sanitizeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'work-act'
}

function buildZip(files: Map<string, Buffer>) {
  const entries: ZipEntry[] = []
  let offset = 0
  const localParts: Buffer[] = []

  for (const [name, data] of files.entries()) {
    const nameBuffer = Buffer.from(name.replace(/\\/g, '/'), 'utf8')
    const crc32 = calculateCrc32(data)
    const localHeader = Buffer.alloc(30)
    localHeader.writeUInt32LE(0x04034b50, 0)
    localHeader.writeUInt16LE(20, 4)
    localHeader.writeUInt16LE(0, 6)
    localHeader.writeUInt16LE(0, 8)
    localHeader.writeUInt16LE(0, 10)
    localHeader.writeUInt16LE(0, 12)
    localHeader.writeUInt32LE(crc32 >>> 0, 14)
    localHeader.writeUInt32LE(data.length, 18)
    localHeader.writeUInt32LE(data.length, 22)
    localHeader.writeUInt16LE(nameBuffer.length, 26)
    localHeader.writeUInt16LE(0, 28)
    localParts.push(localHeader, nameBuffer, data)
    entries.push({ name, data, crc32, offset })
    offset += localHeader.length + nameBuffer.length + data.length
  }

  const centralParts: Buffer[] = []
  let centralSize = 0
  for (const entry of entries) {
    const nameBuffer = Buffer.from(entry.name.replace(/\\/g, '/'), 'utf8')
    const centralHeader = Buffer.alloc(46)
    centralHeader.writeUInt32LE(0x02014b50, 0)
    centralHeader.writeUInt16LE(20, 4)
    centralHeader.writeUInt16LE(20, 6)
    centralHeader.writeUInt16LE(0, 8)
    centralHeader.writeUInt16LE(0, 10)
    centralHeader.writeUInt16LE(0, 12)
    centralHeader.writeUInt16LE(0, 14)
    centralHeader.writeUInt32LE(entry.crc32 >>> 0, 16)
    centralHeader.writeUInt32LE(entry.data.length, 20)
    centralHeader.writeUInt32LE(entry.data.length, 24)
    centralHeader.writeUInt16LE(nameBuffer.length, 28)
    centralHeader.writeUInt16LE(0, 30)
    centralHeader.writeUInt16LE(0, 32)
    centralHeader.writeUInt16LE(0, 34)
    centralHeader.writeUInt16LE(0, 36)
    centralHeader.writeUInt32LE(0, 38)
    centralHeader.writeUInt32LE(entry.offset, 42)
    centralParts.push(centralHeader, nameBuffer)
    centralSize += centralHeader.length + nameBuffer.length
  }

  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(0, 4)
  end.writeUInt16LE(0, 6)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(centralSize, 12)
  end.writeUInt32LE(offset, 16)
  end.writeUInt16LE(0, 20)

  return Buffer.concat([...localParts, ...centralParts, end])
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i += 1) {
    let c = i
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
    }
    table[i] = c >>> 0
  }
  return table
})()

function calculateCrc32(buffer: Buffer) {
  let crc = 0 ^ -1
  for (let i = 0; i < buffer.length; i += 1) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buffer[i]) & 0xff]
  }
  return (crc ^ -1) >>> 0
}
