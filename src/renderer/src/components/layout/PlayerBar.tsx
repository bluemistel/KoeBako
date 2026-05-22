import { useRef } from 'react'
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Music,
  Heart
} from 'lucide-react'
import { useStore } from '../../store'
import { useWaveSurfer } from '../../hooks/useAudioPlayer'
import { formatDuration } from '../../types'

export default function PlayerBar() {
  const {
    currentVoice,
    isPlaying,
    currentTime,
    playerDuration,
    volume,
    setIsPlaying,
    setVolume,
    playNext,
    playPrev,
    updateVoiceInList
  } = useStore()

  const waveContainerRef = useRef<HTMLDivElement>(null)
  const { seek, togglePlay } = useWaveSurfer(waveContainerRef, currentVoice)

  const handleToggleFavorite = async () => {
    if (!currentVoice) return
    const newVal = await window.api.toggleFavorite(currentVoice.id)
    updateVoiceInList(currentVoice.id, { is_favorite: newVal })
  }

  return (
    <div className="h-20 bg-bg-surface border-t border-bg-border flex items-center px-4 gap-4 shrink-0">
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

      {/* Controls + waveform */}
      <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
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

        {/* Waveform + time */}
        <div className="flex items-center gap-2 w-full">
          <span className="text-xs text-txt-muted w-10 text-right tabular-nums shrink-0">
            {formatDuration(currentTime)}
          </span>
          <div
            ref={waveContainerRef}
            className={`flex-1 rounded overflow-hidden transition-opacity ${
              currentVoice ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          />
          <span className="text-xs text-txt-muted w-10 tabular-nums shrink-0">
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
