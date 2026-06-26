import type { VisualLabTimelineEntry } from '../../domain/visualLab'
import { formatFeedTime } from '../../mission-control/components/ui'
import { useI18n } from '../../i18n'

type Props = {
  allTimeline: VisualLabTimelineEntry[]
  activeIndex: number
  playing: boolean
  maxIndex: number
  onSeek: (index: number) => void
  onPlay: () => void
  onPause: () => void
  onRestart: () => void
  onStepBack: () => void
  onStepForward: () => void
}

const KIND_CLASS: Record<VisualLabTimelineEntry['kind'], string> = {
  test_started: 'vlTimelineKindTest',
  file_changed: 'vlTimelineKindFile',
  terminal_line: 'vlTimelineKindTerminal',
  cursor_move: 'vlTimelineKindCursor',
  click: 'vlTimelineKindClick',
  highlight: 'vlTimelineKindHighlight',
  button_added: 'vlTimelineKindButton',
  screenshot: 'vlTimelineKindScreenshot',
  build_passed: 'vlTimelineKindBuild',
}

export function VisualLabActionTimeline({
  allTimeline,
  activeIndex,
  playing,
  maxIndex,
  onSeek,
  onPlay,
  onPause,
  onRestart,
  onStepBack,
  onStepForward,
}: Props) {
  const { t } = useI18n()
  const vl = t.visualLab.timeline

  return (
    <section className="vlTimelinePanel">
      <div className="vlTimelineHeader">
        <span>{vl.title}</span>
        <div className="vlTimelineControls">
          <button type="button" className="mcBtn mcBtnSecondary mcBtnSmall" onClick={onStepBack}>
            {vl.back}
          </button>
          {playing ? (
            <button type="button" className="mcBtn mcBtnSecondary mcBtnSmall" onClick={onPause}>
              {vl.pause}
            </button>
          ) : (
            <button type="button" className="mcBtn mcBtnPrimary mcBtnSmall" onClick={onPlay}>
              {activeIndex >= maxIndex ? vl.replay : vl.play}
            </button>
          )}
          <button type="button" className="mcBtn mcBtnSecondary mcBtnSmall" onClick={onStepForward}>
            {vl.forward}
          </button>
          <button type="button" className="mcBtn mcBtnSecondary mcBtnSmall" onClick={onRestart}>
            {vl.restart}
          </button>
        </div>
      </div>

      <div className="vlTimelineTrack" role="list">
        {allTimeline.map((entry, index) => {
          const active = index <= activeIndex
          const current = index === activeIndex
          return (
            <button
              key={entry.id}
              type="button"
              role="listitem"
              className={[
                'vlTimelineEvent',
                KIND_CLASS[entry.kind],
                active ? 'vlTimelineEventActive' : '',
                current ? 'vlTimelineEventCurrent' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => onSeek(index)}
            >
              <span className="vlTimelineEventTime acMono">{formatFeedTime(entry.at)}</span>
              <span className="vlTimelineEventLabel">{entry.label}</span>
              {entry.detail ? (
                <span className="vlTimelineEventDetail acMono">{entry.detail}</span>
              ) : null}
            </button>
          )
        })}
      </div>

      <div className="vlTimelineProgress">
        <div
          className="vlTimelineProgressFill"
          style={{ width: `${maxIndex === 0 ? 100 : (activeIndex / maxIndex) * 100}%` }}
        />
      </div>
    </section>
  )
}
