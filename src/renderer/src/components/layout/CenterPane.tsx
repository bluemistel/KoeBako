import { useCallback, useRef, useState } from 'react'
import {
  Play,
  Pause,
  Heart,
  Upload,
  ChevronUp,
  ChevronDown,
  Music
} from 'lucide-react'
import { useStore } from '../../store'
import { Voice, formatDuration, formatFileSize, parseVoiceTags } from '../../types'

export default function CenterPane() {
  const {
    voices,
    totalVoices,
    selectedVoiceId,
    selectedVoiceIds,
    viewMode,
    sortBy,
    sortOrder,
    currentVoice,
    isPlaying,
    isLoading,
    setSelectedVoice,
    toggleVoiceSelection,
    setRangeSelection,
    playVoice,
    setIsPlaying,
    setSortBy,
    setSortOrder,
    setImportPendingFiles,
    setShowImportDialog
  } = useStore()

  const isTruncated = totalVoices > voices.length

  const [isDraggingFiles, setIsDraggingFiles] = useState(false)
  const dragCounter = useRef(0)

  const handleRowClick = useCallback(
    (voice: Voice, e: React.MouseEvent) => {
      if (e.shiftKey) {
        // Range selection between anchor (selectedVoiceId) and this row
        if (selectedVoiceId === null) {
          setSelectedVoice(voice.id)
          return
        }
        const anchorIdx = voices.findIndex((v) => v.id === selectedVoiceId)
        const targetIdx = voices.findIndex((v) => v.id === voice.id)
        if (anchorIdx === -1 || targetIdx === -1) {
          toggleVoiceSelection(voice.id)
          return
        }
        const [start, end] =
          anchorIdx <= targetIdx ? [anchorIdx, targetIdx] : [targetIdx, anchorIdx]
        const rangeIds = voices.slice(start, end + 1).map((v) => v.id)
        setRangeSelection(rangeIds)
      } else if (e.ctrlKey || e.metaKey) {
        toggleVoiceSelection(voice.id)
      } else {
        setSelectedVoice(voice.id)
        if (currentVoice?.id === voice.id) {
          setIsPlaying(!isPlaying)
        } else {
          playVoice(voice)
        }
      }
    },
    [voices, selectedVoiceId, currentVoice, isPlaying]
  )

  const handleSort = useCallback(
    (col: typeof sortBy) => {
      if (sortBy === col) {
        setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC')
      } else {
        setSortBy(col)
        setSortOrder('DESC')
      }
    },
    [sortBy, sortOrder]
  )

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current = 0
    setIsDraggingFiles(false)

    const paths = Array.from(e.dataTransfer.files).map((f) => f.path)
    if (paths.length === 0) return

    const { files, allFolderNames } = await window.api.analyzeFiles(paths)
    if (files.length === 0) return

    setImportPendingFiles(files, allFolderNames)
    setShowImportDialog(true)
  }, [])

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (Array.from(e.dataTransfer.types).includes('Files')) {
      dragCounter.current++
      setIsDraggingFiles(true)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const handleDragLeave = useCallback(() => {
    dragCounter.current--
    if (dragCounter.current <= 0) {
      dragCounter.current = 0
      setIsDraggingFiles(false)
    }
  }, [])

  const SortIcon = ({ col }: { col: typeof sortBy }) => {
    if (sortBy !== col) return <ChevronUp className="w-3 h-3 opacity-20" />
    return sortOrder === 'ASC' ? (
      <ChevronUp className="w-3 h-3 text-accent-light" />
    ) : (
      <ChevronDown className="w-3 h-3 text-accent-light" />
    )
  }

  if (isLoading && voices.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-bg-base">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-txt-muted">読み込み中...</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="flex-1 flex flex-col bg-bg-base transition-colors min-w-0 relative"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
    >
      {isDraggingFiles && voices.length > 0 && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-accent/10 border-2 border-dashed border-accent pointer-events-none">
          <div className="text-center space-y-2">
            <Upload className="w-10 h-10 text-accent mx-auto" />
            <p className="text-sm font-medium text-accent">ドロップして取り込む</p>
          </div>
        </div>
      )}
      {voices.length === 0 ? (
        <EmptyState onImport={() => setShowImportDialog(true)} />
      ) : viewMode === 'list' ? (
        <ListView
          voices={voices}
          selectedVoiceId={selectedVoiceId}
          selectedVoiceIds={selectedVoiceIds}
          currentVoice={currentVoice}
          isPlaying={isPlaying}
          sortBy={sortBy}
          SortIcon={SortIcon}
          onRowClick={handleRowClick}
          onSort={handleSort}
          isTruncated={isTruncated}
          totalVoices={totalVoices}
        />
      ) : (
        <GridView
          voices={voices}
          selectedVoiceId={selectedVoiceId}
          currentVoice={currentVoice}
          isPlaying={isPlaying}
          onRowClick={handleRowClick}
          isTruncated={isTruncated}
          totalVoices={totalVoices}
        />
      )}
    </div>
  )
}

function EmptyState({ onImport }: { onImport: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
      <div className="w-20 h-20 rounded-2xl bg-bg-elevated flex items-center justify-center">
        <Music className="w-10 h-10 text-txt-muted" />
      </div>
      <div>
        <h3 className="text-base font-medium text-txt-secondary">音声ファイルがありません</h3>
        <p className="text-sm text-txt-muted mt-1">
          ファイルをここにドラッグ＆ドロップするか、取り込みボタンを押してください
        </p>
      </div>
      <button onClick={onImport} className="btn-primary">
        <Upload className="w-4 h-4" />
        音声ファイルを取り込む
      </button>
    </div>
  )
}

function TruncatedNotice({ totalVoices, shown }: { totalVoices: number; shown: number }) {
  return (
    <div className="flex items-center justify-center gap-1.5 py-3 px-4 text-xs text-txt-muted border-t border-bg-border/50">
      <span>
        {shown} 件を表示中 / 全 {totalVoices} 件 — 表示上限（{shown} 件）に達したため、残り {totalVoices - shown} 件は省略されています
      </span>
    </div>
  )
}

function ListView({
  voices,
  selectedVoiceId,
  selectedVoiceIds,
  currentVoice,
  isPlaying,
  sortBy,
  SortIcon,
  onRowClick,
  onSort,
  isTruncated,
  totalVoices
}: {
  voices: Voice[]
  selectedVoiceId: number | null
  selectedVoiceIds: number[]
  currentVoice: Voice | null
  isPlaying: boolean
  sortBy: string
  SortIcon: React.FC<{ col: any }>
  onRowClick: (voice: Voice, e: React.MouseEvent) => void
  onSort: (col: any) => void
  isTruncated: boolean
  totalVoices: number
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-3 py-2 border-b border-bg-border text-xs text-txt-muted bg-bg-surface shrink-0">
        <div className="w-5" />
        <button
          className="flex items-center gap-1 flex-1 min-w-0 hover:text-txt-primary transition-colors"
          onClick={() => onSort('original_name')}
        >
          ファイル名 <SortIcon col="original_name" />
        </button>
        <div className="w-28 text-center">キャラクター</div>
        <div className="w-40">タグ</div>
        <button
          className="flex items-center gap-1 w-16 justify-end hover:text-txt-primary transition-colors"
          onClick={() => onSort('duration_sec')}
        >
          時間 <SortIcon col="duration_sec" />
        </button>
        <button
          className="flex items-center gap-1 w-20 justify-end hover:text-txt-primary transition-colors"
          onClick={() => onSort('created_at')}
        >
          登録日 <SortIcon col="created_at" />
        </button>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto py-1 px-1">
        {voices.map((voice) => (
          <VoiceListRow
            key={voice.id}
            voice={voice}
            isSelected={selectedVoiceId === voice.id || selectedVoiceIds.includes(voice.id)}
            isPlaying={currentVoice?.id === voice.id && isPlaying}
            isCurrent={currentVoice?.id === voice.id}
            onClick={(e) => onRowClick(voice, e)}
          />
        ))}
        {isTruncated && (
          <TruncatedNotice totalVoices={totalVoices} shown={voices.length} />
        )}
      </div>
    </div>
  )
}

function VoiceListRow({
  voice,
  isSelected,
  isPlaying,
  isCurrent,
  onClick
}: {
  voice: Voice
  isSelected: boolean
  isPlaying: boolean
  isCurrent: boolean
  onClick: (e: React.MouseEvent) => void
}) {
  const tags = voice.parsedTags ?? parseVoiceTags(voice.tags)
  const ext = voice.original_name.split('.').pop()?.toUpperCase() ?? '?'

  const handleDragStart = (e: React.DragEvent) => {
    e.preventDefault()
    window.api.startNativeDrag(voice.file_path)
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onClick={onClick}
      className={`voice-row ${isSelected ? 'selected' : ''} ${isCurrent ? 'playing' : ''}`}
    >
      {/* Play indicator */}
      <div className="w-5 flex items-center justify-center shrink-0">
        {isPlaying ? (
          <div className="playing-bars">
            <span />
            <span />
            <span />
          </div>
        ) : isCurrent ? (
          <div className="w-1.5 h-1.5 rounded-full bg-accent" />
        ) : (
          <Play className="w-3.5 h-3.5 text-txt-muted opacity-0 group-hover:opacity-100" />
        )}
      </div>

      {/* File info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {/* Format badge */}
          <span className="text-xs px-1.5 py-0.5 rounded bg-bg-elevated text-txt-muted font-mono shrink-0">
            {ext}
          </span>
          <span className="text-sm text-txt-primary truncate">{voice.original_name}</span>
          {voice.is_favorite === 1 && (
            <Heart className="w-3 h-3 text-warning fill-warning shrink-0" />
          )}
        </div>
      </div>

      {/* Character */}
      <div className="w-28 shrink-0">
        {voice.character_name ? (
          <span
            className="text-xs px-2 py-0.5 rounded-full truncate block text-center"
            style={{
              backgroundColor: `${voice.character_color || '#6366f1'}22`,
              color: voice.character_color || '#9d63f5'
            }}
          >
            {voice.character_name}
          </span>
        ) : (
          <span className="text-xs text-txt-muted text-center block">-</span>
        )}
      </div>

      {/* Tags */}
      <div className="w-40 flex items-center gap-1 overflow-hidden shrink-0">
        {tags.slice(0, 3).map((tag) => (
          <span
            key={tag.id}
            className="tag-chip text-xs px-1.5 py-0.5 truncate max-w-[70px]"
            style={{
              backgroundColor: `${tag.color}22`,
              color: tag.color
            }}
          >
            {tag.name}
          </span>
        ))}
        {tags.length > 3 && (
          <span className="text-xs text-txt-muted">+{tags.length - 3}</span>
        )}
      </div>

      {/* Duration */}
      <div className="w-16 text-right text-xs text-txt-muted shrink-0">
        {formatDuration(voice.duration_sec)}
      </div>

      {/* Date */}
      <div className="w-20 text-right text-xs text-txt-muted shrink-0">
        {voice.created_at.split(' ')[0]}
      </div>
    </div>
  )
}

function GridView({
  voices,
  selectedVoiceId,
  currentVoice,
  isPlaying,
  onRowClick,
  isTruncated,
  totalVoices
}: {
  voices: Voice[]
  selectedVoiceId: number | null
  currentVoice: Voice | null
  isPlaying: boolean
  onRowClick: (voice: Voice, e: React.MouseEvent) => void
  isTruncated: boolean
  totalVoices: number
}) {
  return (
    <div className="flex-1 overflow-y-auto p-3">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-2">
        {voices.map((voice) => (
          <VoiceGridCard
            key={voice.id}
            voice={voice}
            isSelected={selectedVoiceId === voice.id}
            isPlaying={currentVoice?.id === voice.id && isPlaying}
            isCurrent={currentVoice?.id === voice.id}
            onClick={(e) => onRowClick(voice, e)}
          />
        ))}
      </div>
      {isTruncated && (
        <TruncatedNotice totalVoices={totalVoices} shown={voices.length} />
      )}
    </div>
  )
}

function VoiceGridCard({
  voice,
  isSelected,
  isPlaying,
  isCurrent,
  onClick
}: {
  voice: Voice
  isSelected: boolean
  isPlaying: boolean
  isCurrent: boolean
  onClick: (e: React.MouseEvent) => void
}) {
  const ext = voice.original_name.split('.').pop()?.toUpperCase() ?? '?'

  const handleDragStart = (e: React.DragEvent) => {
    e.preventDefault()
    window.api.startNativeDrag(voice.file_path)
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onClick={onClick}
      className={`p-3 rounded-lg border cursor-pointer transition-all ${
        isSelected || isCurrent
          ? 'bg-accent/10 border-accent/30'
          : 'bg-bg-card border-bg-border hover:bg-bg-elevated'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs px-1.5 py-0.5 rounded bg-bg-elevated text-txt-muted font-mono">
          {ext}
        </span>
        {isPlaying ? (
          <div className="playing-bars">
            <span />
            <span />
            <span />
          </div>
        ) : isCurrent ? (
          <div className="w-1.5 h-1.5 rounded-full bg-accent" />
        ) : (
          <Play className="w-3.5 h-3.5 text-txt-muted" />
        )}
      </div>

      <p className="text-xs text-txt-primary truncate" title={voice.original_name}>
        {voice.original_name}
      </p>

      {voice.character_name && (
        <p
          className="text-xs mt-1 truncate"
          style={{ color: voice.character_color || '#9d63f5' }}
        >
          {voice.character_name}
        </p>
      )}

      <p className="text-xs text-txt-muted mt-1">{formatDuration(voice.duration_sec)}</p>
    </div>
  )
}
