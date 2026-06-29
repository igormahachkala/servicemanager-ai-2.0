import {
  VisualLabActionTimeline,
  VisualLabBrowserPreview,
  VisualLabEditorPanel,
  VisualLabSidebar,
  VisualLabTerminalPanel,
} from '../components/visual-lab'
import { useVisualLab } from '../hooks/useVisualLab'
import { PageHeader } from '../mission-control/components/ui'
import { useI18n } from '../i18n'

export function VisualLabPage() {
  const { t } = useI18n()
  const {
    session,
    derived,
    playback,
    maxIndex,
    play,
    pause,
    restart,
    stepForward,
    stepBack,
    seek,
  } = useVisualLab()

  return (
    <div className="vlPage">
      <PageHeader title={t.visualLab.title} description={t.visualLab.description} />

      <div className="vlWorkspace">
        <VisualLabSidebar
          context={session.context}
          testSteps={derived.testSteps}
          currentTimelineEntry={session.timeline[playback.activeIndex] ?? null}
        />

        <div className="vlCenterColumn">
          <VisualLabEditorPanel
            files={session.files}
            activeFileId={derived.activeFileId}
            latestFileChange={derived.latestFileChange}
          />
          <VisualLabTerminalPanel lines={derived.visibleTerminalLines} />
        </div>

        <VisualLabBrowserPreview browser={derived.browser} screenshots={derived.screenshots} />
      </div>

      <VisualLabActionTimeline
        allTimeline={session.timeline}
        activeIndex={playback.activeIndex}
        playing={playback.playing}
        maxIndex={maxIndex}
        onSeek={seek}
        onPlay={play}
        onPause={pause}
        onRestart={restart}
        onStepBack={stepBack}
        onStepForward={stepForward}
      />

      <p className="vlMockNote">{t.visualLab.mockNote}</p>
    </div>
  )
}
