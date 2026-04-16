import { useEffect, useRef, useCallback } from 'react'
import { useStore } from '../store'
import { Voice } from '../types'

export function useAudioPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const {
    currentVoice,
    isPlaying,
    volume,
    settings,
    setIsPlaying,
    setCurrentTime,
    setPlayerDuration,
    playNext
  } = useStore()

  // Initialize audio element
  useEffect(() => {
    const audio = new Audio()
    audio.volume = volume
    audioRef.current = audio

    audio.addEventListener('timeupdate', () => {
      setCurrentTime(audio.currentTime)
    })

    audio.addEventListener('loadedmetadata', () => {
      const dur = audio.duration
      if (isFinite(dur) && !isNaN(dur)) {
        setPlayerDuration(dur)
      } else {
        // Streaming WAV reports Infinity — fall back to DB value
        const dbDuration = useStore.getState().currentVoice?.duration_sec
        if (dbDuration != null && isFinite(dbDuration)) {
          setPlayerDuration(dbDuration)
        }
      }
    })

    // durationchange fires when the browser finishes calculating the real duration
    audio.addEventListener('durationchange', () => {
      const dur = audio.duration
      if (isFinite(dur) && !isNaN(dur)) {
        setPlayerDuration(dur)
      }
    })

    audio.addEventListener('ended', () => {
      setIsPlaying(false)
      setCurrentTime(0)
      // Auto-play next if setting enabled
      if (settings?.continuousPlay === 'true') {
        playNext()
      }
    })

    audio.addEventListener('error', () => {
      setIsPlaying(false)
      console.error('Audio playback error')
    })

    return () => {
      audio.pause()
      audio.src = ''
    }
  }, [])

  // Load new voice
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !currentVoice) return

    const loadAndPlay = async () => {
      try {
        const absPath = await window.api.getAbsolutePath(currentVoice.file_path)
        // Convert path to koebako-file:// protocol URL
        const fileUrl = pathToKoebakoUrl(absPath)
        audio.src = fileUrl
        audio.volume = volume
        await audio.play()
        setIsPlaying(true)
      } catch (err) {
        console.error('Failed to play audio:', err)
        setIsPlaying(false)
      }
    }

    loadAndPlay()
  }, [currentVoice?.id])

  // Play/pause control
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) {
      audio.play().catch(console.error)
    } else {
      audio.pause()
    }
  }, [isPlaying])

  // Volume control
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume
    }
  }, [volume])

  const seek = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time
      setCurrentTime(time)
    }
  }, [])

  const togglePlay = useCallback(() => {
    setIsPlaying(!isPlaying)
  }, [isPlaying])

  return { audioRef, seek, togglePlay }
}

function pathToKoebakoUrl(absolutePath: string): string {
  // Convert Windows path like C:\foo\bar.wav to koebako-file:///C:/foo/bar.wav
  const normalized = absolutePath.replace(/\\/g, '/')
  return `koebako-file:///${encodeURIComponent(normalized).replace(/%2F/g, '/').replace(/%3A/g, ':')}`
}

export function useWaveSurfer(
  containerRef: React.RefObject<HTMLDivElement>,
  voice: Voice | null
) {
  const wavesurferRef = useRef<import('wavesurfer.js').default | null>(null)
  const { setCurrentTime, setPlayerDuration, setIsPlaying, isPlaying, volume } = useStore()

  useEffect(() => {
    if (!containerRef.current) return

    let ws: import('wavesurfer.js').default

    const init = async () => {
      const WaveSurfer = (await import('wavesurfer.js')).default

      ws = WaveSurfer.create({
        container: containerRef.current!,
        waveColor: '#3d3d58',
        progressColor: '#7c3aed',
        cursorColor: '#9d63f5',
        height: 56,
        barWidth: 2,
        barGap: 1,
        barRadius: 1,
        normalize: true,
        interact: true,
        backend: 'WebAudio'
      })

      ws.on('timeupdate', (t) => setCurrentTime(t))
      ws.on('ready', (d) => setPlayerDuration(d))
      ws.on('finish', () => setIsPlaying(false))
      ws.on('seeking', (t) => setCurrentTime(t))

      wavesurferRef.current = ws
    }

    init()

    return () => {
      ws?.destroy()
      wavesurferRef.current = null
    }
  }, [])

  // Load new voice
  useEffect(() => {
    const ws = wavesurferRef.current
    if (!ws || !voice) return

    const load = async () => {
      const absPath = await window.api.getAbsolutePath(voice.file_path)
      const fileUrl = pathToVoicelabUrl(absPath)
      ws.load(fileUrl)
    }

    load().catch(console.error)
  }, [voice?.id])

  // Sync play state
  useEffect(() => {
    const ws = wavesurferRef.current
    if (!ws) return
    if (isPlaying) {
      ws.play().catch(console.error)
    } else {
      ws.pause()
    }
  }, [isPlaying])

  // Volume
  useEffect(() => {
    wavesurferRef.current?.setVolume(volume)
  }, [volume])

  return wavesurferRef
}
