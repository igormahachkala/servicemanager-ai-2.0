export type DocsSection =
  | 'quick-start'
  | 'user-guide'
  | 'admin-guide'
  | 'executor-guide'
  | 'faq'
  | 'glossary'
  | 'legal'
  | 'support'

export type DocsAudience =
  | 'all'
  | 'platform-admin'
  | 'provider-admin'
  | 'dispatcher'
  | 'master'
  | 'technician'
  | 'client'

export type DocsAnchor = {
  id: string
  title: string
}

export type DocsContentBlock =
  | {
      type: 'heading'
      anchorId: string
      title: string
    }
  | {
      type: 'paragraph'
      text: string
    }
  | {
      type: 'list'
      items: string[]
    }
  | {
      type: 'steps'
      items: string[]
    }
  | {
      type: 'note'
      title: string
      text: string
      tone?: 'info' | 'warning'
    }
  | {
      type: 'supportContacts'
    }

export type DocsArticle = {
  id: string
  slug: string
  title: string
  summary: string
  section: DocsSection
  audience: DocsAudience[]
  keywords: string[]
  anchors: DocsAnchor[]
  content: DocsContentBlock[]
}

export type DocsSectionMeta = {
  id: DocsSection
  title: string
  summary: string
}
