import { useEffect, useRef } from 'react'
import { useI18n } from '../../i18n'

type Props = {
  lines: string[]
}

export function VisualLabTerminalPanel({ lines }: Props) {
  const { t } = useI18n()
  const endRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines.length])

  return (
    <section className="vlTerminalPanel">
      <div className="vlPanelHeader">{t.visualLab.terminal.title}</div>
      <div className="vlTerminalBody">
        {lines.length === 0 ? (
          <div className="vlTerminalEmpty">{t.visualLab.terminal.waiting}</div>
        ) : (
          lines.map((line, index) => (
            <div key={`${line}-${index}`} className="vlTerminalLine">
              {line}
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>
    </section>
  )
}
