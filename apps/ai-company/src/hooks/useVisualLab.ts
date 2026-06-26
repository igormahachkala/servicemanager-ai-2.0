import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  buildVisualLabSession,
  deriveVisualLabState,
  type VisualLabPlaybackState,
  type VisualLabSession,
} from '../domain/visualLab'

const TICK_MS = 1400

export function useVisualLab() {
  const [session] = useState<VisualLabSession>(() => buildVisualLabSession())
  const [playback, setPlayback] = useState<VisualLabPlaybackState>({
    activeIndex: 0,
    playing: true,
    speed: 1,
  })

  const maxIndex = session.timeline.length - 1

  const derived = useMemo(
    () => deriveVisualLabState(session, playback.activeIndex),
    [playback.activeIndex, session],
  )

  const play = useCallback(() => {
    setPlayback((prev) => ({ ...prev, playing: true }))
  }, [])

  const pause = useCallback(() => {
    setPlayback((prev) => ({ ...prev, playing: false }))
  }, [])

  const restart = useCallback(() => {
    setPlayback({ activeIndex: 0, playing: true, speed: 1 })
  }, [])

  const stepForward = useCallback(() => {
    setPlayback((prev) => ({
      ...prev,
      activeIndex: Math.min(prev.activeIndex + 1, maxIndex),
      playing: false,
    }))
  }, [maxIndex])

  const stepBack = useCallback(() => {
    setPlayback((prev) => ({
      ...prev,
      activeIndex: Math.max(prev.activeIndex - 1, 0),
      playing: false,
    }))
  }, [])

  const seek = useCallback(
    (index: number) => {
      setPlayback((prev) => ({
        ...prev,
        activeIndex: Math.max(0, Math.min(index, maxIndex)),
        playing: false,
      }))
    },
    [maxIndex],
  )

  const setSpeed = useCallback((speed: VisualLabPlaybackState['speed']) => {
    setPlayback((prev) => ({ ...prev, speed }))
  }, [])

  useEffect(() => {
    if (!playback.playing || playback.activeIndex >= maxIndex) return

    const timer = window.setInterval(() => {
      setPlayback((prev) => {
        if (prev.activeIndex >= maxIndex) {
          return { ...prev, playing: false }
        }
        return { ...prev, activeIndex: prev.activeIndex + 1 }
      })
    }, TICK_MS / playback.speed)

    return () => window.clearInterval(timer)
  }, [maxIndex, playback.activeIndex, playback.playing, playback.speed])

  return {
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
    setSpeed,
  }
}
