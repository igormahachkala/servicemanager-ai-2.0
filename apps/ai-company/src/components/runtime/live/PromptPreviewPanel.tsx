import { useState } from 'react'
import {
  exportRuntimePromptMarkdown,
  type RuntimePromptPreview,
} from '../../../domain/runtime/runtimePromptBuilder'
import { useI18n } from '../../../i18n'

type Props = {
  preview: RuntimePromptPreview | null
}

type SectionKey = keyof Pick<
  RuntimePromptPreview,
  | 'systemPrompt'
  | 'employeeIdentity'
  | 'employeePersona'
  | 'languagePolicy'
  | 'task'
  | 'context'
  | 'instructions'
  | 'finalPrompt'
>

const SECTION_KEYS: SectionKey[] = [
  'languagePolicy',
  'systemPrompt',
  'employeeIdentity',
  'employeePersona',
  'task',
  'context',
  'instructions',
  'finalPrompt',
]

export function PromptPreviewPanel({ preview }: Props) {
  const { t } = useI18n()
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle')

  if (!preview) {
    return <p className="mcMuted">{t.runtimePromptBuilder.empty}</p>
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(preview.finalPrompt)
      setCopyStatus('copied')
      window.setTimeout(() => setCopyStatus('idle'), 2000)
    } catch {
      setCopyStatus('error')
    }
  }

  const handleExport = () => {
    const markdown = exportRuntimePromptMarkdown(preview)
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `runtime-prompt-${Date.now()}.md`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  const outputLanguageLabel =
    preview.outputLanguage === 'en'
      ? t.runtimePromptBuilder.outputLanguages.en
      : t.runtimePromptBuilder.outputLanguages.ru

  return (
    <div className="mcRuntimePromptPreview">
      <p className="mcMuted mcRuntimePromptPreviewLead">{t.runtimePromptBuilder.leadHint}</p>
      <div className="mcRuntimePromptPreviewMeta">
        <div className="mcRuntimeProfileRow">
          <span>{t.runtimePromptBuilder.outputLanguage}</span>
          <span className="mcMono">{outputLanguageLabel}</span>
        </div>
      </div>

      {preview.explicitOverride ? (
        <p className="mcRuntimePromptPreviewNote">{t.runtimePromptBuilder.explicitOverrideNote}</p>
      ) : null}

      {preview.projectLabel || preview.workspaceLabel ? (
        <div className="mcRuntimePromptPreviewMeta">
          {preview.projectLabel ? (
            <div className="mcRuntimeProfileRow">
              <span>{t.runtimePromptBuilder.project}</span>
              <span className="mcMono">{preview.projectLabel}</span>
            </div>
          ) : null}
          {preview.workspaceLabel ? (
            <div className="mcRuntimeProfileRow">
              <span>{t.runtimePromptBuilder.workspace}</span>
              <span className="mcMono">{preview.workspaceLabel}</span>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mcRuntimePromptPreviewActions">
        <button type="button" className="mcBtn mcBtnSecondary mcBtnSm" onClick={() => void handleCopy()}>
          {t.runtimePromptBuilder.copyPrompt}
        </button>
        <button type="button" className="mcBtn mcBtnSecondary mcBtnSm" onClick={handleExport}>
          {t.runtimePromptBuilder.exportPrompt}
        </button>
        {copyStatus === 'copied' ? (
          <span className="mcMuted mcRuntimePromptPreviewCopyStatus">{t.runtimePromptBuilder.copied}</span>
        ) : null}
        {copyStatus === 'error' ? (
          <span className="mcRuntimeExecutionError mcRuntimePromptPreviewCopyStatus">
            {t.runtimePromptBuilder.copyFailed}
          </span>
        ) : null}
      </div>

      <div className="mcRuntimePromptPreviewSections">
        {SECTION_KEYS.map((key) => (
          <section key={key} className="mcRuntimePromptPreviewSection">
            <h4 className="mcRuntimePromptPreviewSectionTitle">{t.runtimePromptBuilder.sections[key]}</h4>
            <pre
              className={`mcRuntimePromptPreviewText${key === 'finalPrompt' ? ' mcRuntimePromptPreviewTextFinal' : ''}`}
            >
              {preview[key]}
            </pre>
          </section>
        ))}
      </div>
    </div>
  )
}
