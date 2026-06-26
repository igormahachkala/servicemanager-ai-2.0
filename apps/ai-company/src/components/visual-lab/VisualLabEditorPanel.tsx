import type { VisualLabFileChange, VisualLabFileTab } from '../../domain/visualLab'
import { useI18n } from '../../i18n'

type Props = {
  files: VisualLabFileTab[]
  activeFileId: string
  latestFileChange: VisualLabFileChange | null
}

export function VisualLabEditorPanel({ files, activeFileId, latestFileChange }: Props) {
  const { t } = useI18n()
  const active = files.find((item) => item.id === activeFileId) ?? files[0]

  return (
    <section className="vlEditorPanel">
      <div className="vlPanelHeader">
        <span>{t.visualLab.editor.title}</span>
        {latestFileChange ? (
          <span className="vlEditorChangeBadge">{t.visualLab.editor.changed}</span>
        ) : null}
      </div>

      <div className="vlEditorTabs">
        {files.map((file) => (
          <button
            key={file.id}
            type="button"
            className={`vlEditorTab ${file.id === activeFileId ? 'vlEditorTabActive' : ''}`}
          >
            {file.path.split('/').pop()}
          </button>
        ))}
      </div>

      {latestFileChange ? (
        <div className="vlFileChangePreview">
          <div className="vlFileChangePath acMono">{latestFileChange.path}</div>
          <div className="vlFileChangeSummary">{latestFileChange.summary}</div>
          <pre className="vlFileChangeDiff">
            {latestFileChange.addedLines.map((line) => (
              <div key={line} className="vlDiffAdded">
                + {line}
              </div>
            ))}
          </pre>
        </div>
      ) : null}

      <pre className="vlEditorCode">
        <code>{active?.content ?? ''}</code>
      </pre>
    </section>
  )
}
