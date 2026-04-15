import { useRef, useCallback } from 'react'
import {
  Search,
  Upload,
  Settings,
  Minus,
  Square,
  X,
  RotateCcw,
  Star,
  Grid,
  List,
  Users,
  Sun,
  Moon
} from 'lucide-react'
import { useStore } from '../../store'

export default function Toolbar() {
  const {
    searchQuery,
    setSearchQuery,
    filterFavoriteOnly,
    setFilterFavoriteOnly,
    viewMode,
    setViewMode,
    setShowImportDialog,
    setShowSettingsModal,
    openSettingsOnTab,
    theme,
    setTheme,
    isMaximized,
    filterCharacterIds,
    filterTagIds,
    clearFilters,
    voices,
    isLoading
  } = useStore()

  const searchInputRef = useRef<HTMLInputElement>(null)
  const hasActiveFilters = filterCharacterIds.length > 0 || filterTagIds.length > 0 || filterFavoriteOnly

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      const paths = Array.from(e.dataTransfer.files).map((f) => f.path)
      if (paths.length === 0) return

      const { files, allFolderNames } = await window.api.analyzeFiles(paths)
      if (files.length === 0) return

      useStore.getState().setImportPendingFiles(files, allFolderNames)
      setShowImportDialog(true)
    },
    []
  )

  const handleImportClick = useCallback(async () => {
    setShowImportDialog(true)
  }, [])

  return (
    <div
      className="flex items-center h-11 bg-bg-surface border-b border-bg-border px-3 gap-2"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* App title */}
      <div className="flex items-center gap-2 mr-2" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <div className="w-6 h-6 rounded bg-accent flex items-center justify-center">
          <span className="text-white text-xs font-bold">V</span>
        </div>
        <span className="text-sm font-semibold text-txt-primary tracking-wide">VOICELab.</span>
      </div>

      {/* Search bar */}
      <div
        className="flex-1 max-w-md relative"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-txt-muted pointer-events-none" />
        <input
          ref={searchInputRef}
          type="text"
          placeholder="ファイル名・メモで検索..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input pl-8 pr-3 h-7 text-xs"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-txt-muted hover:text-txt-primary"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* File count */}
      <div className="text-xs text-txt-muted px-2">
        {isLoading ? (
          <span className="animate-pulse">読込中...</span>
        ) : (
          <span>{voices.length.toLocaleString()} 件</span>
        )}
      </div>

      {/* Filter indicator */}
      {hasActiveFilters && (
        <button
          onClick={clearFilters}
          className="btn-ghost text-xs gap-1 text-warning"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <RotateCcw className="w-3 h-3" />
          フィルター解除
        </button>
      )}

      <div className="flex-1" />

      {/* Controls */}
      <div
        className="flex items-center gap-1"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button
          onClick={() => setFilterFavoriteOnly(!filterFavoriteOnly)}
          className={`btn-ghost px-2 py-1 ${filterFavoriteOnly ? 'text-warning' : ''}`}
          title="お気に入りのみ表示"
        >
          <Star className={`w-4 h-4 ${filterFavoriteOnly ? 'fill-warning' : ''}`} />
        </button>

        <button
          onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
          className="btn-ghost px-2 py-1"
          title="表示切替"
        >
          {viewMode === 'list' ? <Grid className="w-4 h-4" /> : <List className="w-4 h-4" />}
        </button>

        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="btn-ghost px-2 py-1"
          title={theme === 'dark' ? 'ライトモードに切り替え' : 'ダークモードに切り替え'}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <div className="w-px h-5 bg-bg-border mx-1" />

        <button
          onClick={handleImportClick}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="btn-primary text-xs px-3 py-1.5 h-7"
        >
          <Upload className="w-3.5 h-3.5" />
          取り込み
        </button>

        <button
          onClick={() => openSettingsOnTab('characters')}
          className="btn-ghost px-2 py-1"
          title="キャラクター辞書"
        >
          <Users className="w-4 h-4" />
        </button>

        <button
          onClick={() => setShowSettingsModal(true)}
          className="btn-ghost px-2 py-1"
          title="設定"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* Window controls */}
        <div className="flex items-center ml-2 gap-0.5">
          <button
            onClick={() => window.api.minimizeWindow()}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-bg-hover transition-colors text-txt-muted hover:text-txt-primary"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => window.api.maximizeWindow()}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-bg-hover transition-colors text-txt-muted hover:text-txt-primary"
          >
            <Square className="w-3 h-3" />
          </button>
          <button
            onClick={() => window.api.closeWindow()}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-danger transition-colors text-txt-muted hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
