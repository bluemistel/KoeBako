import { useEffect, useRef } from 'react'
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Music,
  Heart,
  Repeat
} from 'lucide-react'
import { useStore } from '../../store'
import { useAudioPlayer } from '../../hooks/useAudioPlayer'
import { formatDuration } from '../../types'

export default function PlayerBar() {
  const {
    currentVoice,
    isPlaying,
    currentTime,
    playerDuration,
    volume,
    settings,
    setIsPlaying,
    setVolume,
    playNext,
    playPrev,
    toggleFavorite: toggleFav,
    updateVoiceInList
  } = useStore()

  const { seek, togglePlay } = useAudioPlayer()
  const progressRef = useRef<HTMLInputElement>(null)

  // Update progress bar CSS custom property
  useEffect(() => {
    if (progressRef.current && playerDuration > 0) {
      const pct = (currentTime / playerDuration) * 100
      progressRef.current.style.setProperty('--progress', `${pct}%`)
      progressRef.current.value = String(currentTime)
    }
  }, [currentTime, playerDuration])

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const t = parseFloat(e.target.value)
    seek(t)
  }

  const handleToggleFavorite = async () => {
    if (!currentVoice) return
    const newVal = await window.api.toggleFavorite(currentVoice.id)
    updateVoiceInList(currentVoice.id, { is_favorite: newVal })
  }

  return (
    <div className="h-16 bg-bg-surface border-t border-bg-border flex items-center px-4 gap-4 shrink-0">
      {/* Now playing info */}
      <div className="flex items-center gap-3 w-56 shrink-0">
        <div
          className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
            currentVoice ? 'bg-accent/20' : 'bg-bg-elevated'
          }`}
        >
          {currentVoice && isPlaying ? (
            <div className="playing-bars">
              <span />
              <span />
              <span />
            </div>
          ) : (
            <Music className="w-4 h-4 text-txt-muted" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          {currentVoice ? (
            <>
              <p className="text-sm text-txt-primary truncate">{currentVoice.original_name}</p>
              <p className="text-xs text-txt-muted truncate">
                {currentVoice.character_name || '未設定'}
                {currentVoice.software_name ? ` • ${currentVoice.software_name}` : ''}
              </p>
            </>
          ) : (
            <p className="text-sm text-txt-muted">未選択</p>
          )}
        </div>

        {currentVoice && (
          <button
            onClick={handleToggleFavorite}
            className={`p-1 shrink-0 rounded transition-colors ${
              currentVoice.is_favorite
                ? 'text-warning'
                : 'text-txt-muted hover:text-warning'
            }`}
          >
            <Heart className={`w-4 h-4 ${currentVoice.is_favorite ? 'fill-warning' : ''}`} />
          </button>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
        {/* Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={playPrev}
            disabled={!currentVoice}
            className="btn-ghost p-1.5 disabled:opacity-30"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          <button
            onClick={togglePlay}
            disabled={!currentVoice}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-95 disabled:opacity-30 ${
              currentVoice
                ? 'bg-accent hover:bg-accent-dark text-white'
                : 'bg-bg-elevated text-txt-muted'
            }`}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>

          <button
            onClick={playNext}
            disabled={!currentVoice}
            className="btn-ghost p-1.5 disabled:opacity-30"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 w-full max-w-sm">
          <span className="text-xs text-txt-muted w-10 text-right tabular-nums">
            {formatDuration(currentTime)}
          </span>
          <input
            ref={progressRef}
            type="range"
            min={0}
            max={playerDuration || 100}
            step={0.01}
            defaultValue={0}
            disabled={!currentVoice}
            onChange={handleProgressChange}
            className="flex-1 progress-bar disabled:opacity-30"
            style={{ '--progress': '0%' } as React.CSSProperties}
          />
          <span className="text-xs text-txt-muted w-10 tabular-nums">
            {formatDuration(playerDuration || null)}
          </span>
        </div>
      </div>

      {/* Volume */}
      <div className="flex items-center gap-2 w-36 shrink-0">
        <button
          onClick={() => setVolume(volume > 0 ? 0 : 0.8)}
          className="btn-ghost p-1 text-txt-muted"
        >
          {volume === 0 ? (
            <VolumeX className="w-4 h-4" />
          ) : (
            <Volume2 className="w-4 h-4" />
          )}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          className="flex-1"
        />
        <span className="text-xs text-txt-muted w-7 tabular-nums">
          {Math.round(volume * 100)}%
        </span>
      </div>
    </div>
  )
}
