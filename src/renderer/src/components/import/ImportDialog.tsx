import { useState, useCallback, useRef, useMemo } from 'react'
import {
  X,
  Upload,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Check,
  AlertCircle,
  Loader,
  FileAudio,
  FolderOpen,
  FolderTree,
  Tag,
  Users,
  Pencil,
  UserPlus
} from 'lucide-react'
import { useStore } from '../../store'
import { ImportFileInfo, formatFileSize } from '../../types'

type Step = 1 | 2 | 3
type Category = string

// Files grouped by their top-level subfolder under the dropped root
type FileGroup = {
  groupKey: string      // display name (folder name or "ルート")
  files: ImportFileInfo[]
  characterOverride: string | null  // null = "use per-file detection"
  groupTagNames: string[]           // folder tag names to apply to this group only
}

/** 先頭の連番＋区切り文字を除去する (例: "10_残念" → "残念") */
function stripSerial(name: string): string {
  return name.replace(/^\d+[_\-\s]+/, '')
}

export default function ImportDialog() {
  const {
    importPendingFiles,
    importFolderNames,
    setImportPendingFiles,
    setShowImportDialog,
    characters,
    tags,
    softwares,
    userCategories,
    loadVoices,
    loadCharacters,
    loadTags
  } = useStore()

  const [step, setStep] = useState<Step>(1)
  const [category, setCategory] = useState<Category>('commercial')

  // Step 2 state
  const [globalCharacter, setGlobalCharacter] = useState<string>('') // '' = auto per-file
  const [selectedFolderTags, setSelectedFolderTags] = useState<Set<string>>(new Set()) // default OFF
  const [folderTagRenames, setFolderTagRenames] = useState<Map<string, string>>(new Map())
  const [editingFolderTag, setEditingFolderTag] = useState<string | null>(null)
  const [editingTagValue, setEditingTagValue] = useState('')
  const [stripLeadingNumbers, setStripLeadingNumbers] = useState(true)
  const [globalSoftware, setGlobalSoftware] = useState('')
  const [additionalTagIds, setAdditionalTagIds] = useState<number[]>([])
  const [groups, setGroups] = useState<FileGroup[]>([])
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [fileSkips, setFileSkips] = useState<Set<string>>(new Set()) // sourcePaths to skip

  // New character creation (global)
  const [isAddingChar, setIsAddingChar] = useState(false)
  const [newCharName, setNewCharName] = useState('')

  // Step 3 state
  const [isImporting, setIsImporting] = useState(false)
  const [result, setResult] = useState<{ success: number; errors: string[] } | null>(null)

  const isDragging = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDraggingOver, setIsDraggingOver] = useState(false)

  /** フォルダ名の表示名を返す（手動リネーム → 連番除去 → そのまま の優先順） */
  const getDisplayName = (originalName: string): string => {
    const renamed = folderTagRenames.get(originalName)
    if (renamed !== undefined) return renamed
    return stripLeadingNumbers ? stripSerial(originalName) : originalName
  }

  const handleClose = useCallback(() => {
    setShowImportDialog(false)
    setImportPendingFiles([])
    setStep(1)
    setResult(null)
  }, [])

  const handleFileInputChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const paths = Array.from(e.target.files ?? []).map((f) => f.path)
    if (!paths.length) return
    const { files, allFolderNames } = await window.api.analyzeFiles(paths)
    setImportPendingFiles(files, allFolderNames)
    setSelectedFolderTags(new Set()) // default OFF
    setFolderTagRenames(new Map())
    e.target.value = ''
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDraggingOver(false)
    const paths = Array.from(e.dataTransfer.files).map((f) => f.path)
    if (!paths.length) return
    const { files, allFolderNames } = await window.api.analyzeFiles(paths)
    setImportPendingFiles(files, allFolderNames)
    setSelectedFolderTags(new Set()) // default OFF
    setFolderTagRenames(new Map())
  }, [])

  // Build file groups from importPendingFiles (group by first folder in chain)
  const buildGroups = useCallback((): FileGroup[] => {
    const map = new Map<string, ImportFileInfo[]>()

    for (const f of importPendingFiles) {
      const key = f.folderChain.length > 0 ? f.folderChain[0] : 'ルート'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push({ ...f, characterName: f.suggestedCharacter ?? '', softwareName: '' })
    }

    return Array.from(map.entries()).map(([groupKey, files]) => ({
      groupKey,
      files,
      characterOverride: null,  // null = use per-file detection
      groupTagNames: []
    }))
  }, [importPendingFiles])

  const proceedToStep2 = useCallback(() => {
    const g = buildGroups()
    setGroups(g)
    setSelectedFolderTags(new Set())
    setFolderTagRenames(new Map())
    // If only one group and it has a dominant character suggestion, pre-set global
    const allSuggested = importPendingFiles.map((f) => f.suggestedCharacter).filter(Boolean)
    const dominant = allSuggested.length > 0
      ? allSuggested.sort((a, b) =>
          allSuggested.filter(v => v === b).length - allSuggested.filter(v => v === a).length
        )[0]!
      : ''
    setGlobalCharacter(dominant)
    setStep(2)
  }, [importPendingFiles, buildGroups])

  const toggleGroupExpand = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const setGroupCharacter = (groupKey: string, char: string | null) => {
    setGroups((prev) =>
      prev.map((g) => g.groupKey === groupKey ? { ...g, characterOverride: char } : g)
    )
  }

  const toggleGroupTag = (groupKey: string, tagName: string) => {
    setGroups((prev) =>
      prev.map((g) => {
        if (g.groupKey !== groupKey) return g
        const has = g.groupTagNames.includes(tagName)
        return {
          ...g,
          groupTagNames: has
            ? g.groupTagNames.filter((n) => n !== tagName)
            : [...g.groupTagNames, tagName]
        }
      })
    )
  }

  const saveTagRename = (originalName: string) => {
    const trimmed = editingTagValue.trim()
    const defaultName = stripLeadingNumbers ? stripSerial(originalName) : originalName
    if (trimmed && trimmed !== defaultName) {
      setFolderTagRenames((prev) => new Map(prev).set(originalName, trimmed))
    } else {
      setFolderTagRenames((prev) => {
        const next = new Map(prev)
        next.delete(originalName)
        return next
      })
    }
    setEditingFolderTag(null)
  }

  const toggleFileSkip = (sourcePath: string) => {
    setFileSkips((prev) => {
      const next = new Set(prev)
      next.has(sourcePath) ? next.delete(sourcePath) : next.add(sourcePath)
      return next
    })
  }

  const toggleFolderTag = (name: string) => {
    setSelectedFolderTags((prev) => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }

  const activeCount = useMemo(
    () => importPendingFiles.filter((f) => !fileSkips.has(f.sourcePath)).length,
    [importPendingFiles, fileSkips]
  )

  // Resolve final character for a file
  // '__none__' means explicitly no character (not auto-detect)
  const resolveCharacter = (file: ImportFileInfo, group: FileGroup): string | null => {
    if (globalCharacter === '__none__') return null
    if (globalCharacter) return globalCharacter
    if (group.characterOverride === '__none__') return null
    if (group.characterOverride !== null) return group.characterOverride
    return file.suggestedCharacter ?? null
  }

  /** 新規キャラクターを追加してグローバル選択に反映 */
  const handleAddCharacter = async () => {
    const trimmed = newCharName.trim()
    if (!trimmed) return
    await window.api.insertCharacter(trimmed)
    await loadCharacters()
    setGlobalCharacter(trimmed)
    setIsAddingChar(false)
    setNewCharName('')
  }

  /** FileGroupRow から呼ばれるキャラクター追加コールバック */
  const handleAddGroupCharacter = useCallback(async (name: string) => {
    await window.api.insertCharacter(name)
    await loadCharacters()
  }, [loadCharacters])

  const executeImport = async () => {
    setIsImporting(true)
    try {
      // Helper: resolve or create tag IDs (uses strip option and renames)
      const resolveTagIds = async (names: Iterable<string>): Promise<number[]> => {
        const ids: number[] = []
        for (const originalName of names) {
          const displayName = folderTagRenames.get(originalName) ??
            (stripLeadingNumbers ? stripSerial(originalName) : originalName)
          const existing = useStore.getState().tags.find((t) => t.name === displayName)
          if (existing) {
            ids.push(existing.id)
          } else {
            const newTags = await window.api.insertTag(displayName)
            const created = newTags.find((t) => t.name === displayName)
            if (created) ids.push(created.id)
          }
        }
        return ids
      }

      // Global folder tag IDs (apply to ALL files)
      const globalFolderTagIds = await resolveTagIds(selectedFolderTags)
      await loadTags()

      // Build final file list (per-group tags are merged per file)
      const toImport: Array<{
        sourcePath: string
        fileName: string
        characterName: string | null
        softwareName: string | null
        tagIds: number[]
      }> = []

      for (const group of groups) {
        const groupTagIds = await resolveTagIds(group.groupTagNames)
        for (const f of group.files) {
          if (fileSkips.has(f.sourcePath)) continue
          const tagIdSet = new Set([...globalFolderTagIds, ...additionalTagIds, ...groupTagIds])
          toImport.push({
            sourcePath: f.sourcePath,
            fileName: f.fileName,
            characterName: resolveCharacter(f, group),
            softwareName: globalSoftware || null,
            tagIds: Array.from(tagIdSet)
          })
        }
      }

      const res = await window.api.executeImport(toImport, category)
      setResult(res)
      setStep(3)
      await loadVoices()
      await loadCharacters()
      await loadTags()
    } finally {
      setIsImporting(false)
    }
  }

  const hasFolderFiles = importPendingFiles.some((f) => f.folderChain.length > 0)
  const folderNames = importFolderNames

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-bg-card border border-bg-border rounded-xl w-full max-w-2xl flex flex-col max-h-[88vh] shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-bg-border shrink-0">
          <div>
            <h2 className="text-base font-semibold text-txt-primary">音声ファイルの取り込み</h2>
            {step < 3 && (
              <div className="flex items-center gap-1.5 mt-1">
                {([1, 2] as const).map((s) => (
                  <div key={s} className="flex items-center gap-1">
                    <div className={`w-1.5 h-1.5 rounded-full transition-colors ${s <= step ? 'bg-accent' : 'bg-bg-border'}`} />
                    {s < 2 && <div className="w-5 h-px bg-bg-border" />}
                  </div>
                ))}
                <span className="text-xs text-txt-muted ml-1">
                  {step === 1 && 'ファイル選択・カテゴリ'}
                  {step === 2 && 'キャラクター・タグ設定'}
                </span>
              </div>
            )}
          </div>
          <button onClick={handleClose} className="btn-ghost p-1.5">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Step 1: Drop zone + Category ── */}
          {step === 1 && (
            <div className="p-5 space-y-5">
              {importPendingFiles.length === 0 ? (
                <div
                  className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer ${
                    isDraggingOver ? 'border-accent bg-accent/10' : 'border-bg-border hover:border-accent/40'
                  }`}
                  onDrop={handleDrop}
                  onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true) }}
                  onDragLeave={() => setIsDraggingOver(false)}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <FolderTree className="w-12 h-12 text-txt-muted mx-auto mb-3" />
                  <p className="text-sm text-txt-secondary mb-1">
                    フォルダ・ファイルをここにドラッグ＆ドロップ
                  </p>
                  <p className="text-xs text-txt-muted mb-1">サブフォルダも再帰的にスキャンします</p>
                  <p className="text-xs text-txt-muted mb-4">WAV / MP3 / OGG / FLAC / M4A</p>
                  <button
                    className="btn-secondary"
                    onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click() }}
                  >
                    <FolderOpen className="w-4 h-4" />
                    ファイルを選択
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".wav,.mp3,.ogg,.flac,.m4a,.aac"
                    className="sr-only"
                    onChange={handleFileInputChange}
                  />
                </div>
              ) : (
                <DetectedFilesSummary
                  files={importPendingFiles}
                  folderNames={folderNames}
                  onClear={() => { setImportPendingFiles([]) }}
                />
              )}

              {/* Category */}
              <div>
                <label className="text-sm font-medium text-txt-secondary block mb-3">
                  カテゴリを選択
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <CategoryCard
                    label="音声素材製品"
                    desc="exVOICE・購入ボイス素材"
                    color="#f59e0b"
                    selected={category === 'commercial'}
                    onClick={() => setCategory('commercial')}
                  />
                  <CategoryCard
                    label="自作音声"
                    desc="合成・録音した音声"
                    color="#10b981"
                    selected={category === 'original'}
                    onClick={() => setCategory('original')}
                  />
                  {userCategories.map((cat) => (
                    <CategoryCard
                      key={cat.id}
                      label={cat.name}
                      desc="ユーザー定義カテゴリ"
                      color={cat.color}
                      selected={category === cat.name}
                      onClick={() => setCategory(cat.name)}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 2: Character + Folder tag configuration ── */}
          {step === 2 && (
            <div className="p-5 space-y-5">

              {/* Global character */}
              <div>
                <label className="flex items-center gap-1.5 text-sm font-medium text-txt-secondary mb-2">
                  <Users className="w-4 h-4" />
                  キャラクター（全ファイルに一括適用）
                </label>
                <select
                  value={globalCharacter}
                  onChange={(e) => setGlobalCharacter(e.target.value)}
                  className="input"
                >
                  <option value="">ファイル名・フォルダ名から自動判定</option>
                  <option value="__none__">未設定（キャラクターなし）</option>
                  {characters.map((c) => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
                {!globalCharacter && !isAddingChar && (
                  <p className="text-xs text-txt-muted mt-1">
                    未設定の場合、ファイル名・フォルダ名からキャラクターを判定します
                  </p>
                )}

                {/* Inline new character creation */}
                {!isAddingChar ? (
                  <button
                    onClick={() => setIsAddingChar(true)}
                    className="flex items-center gap-1 mt-2 text-xs text-txt-muted hover:text-accent-light transition-colors"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    新しいキャラクターを追加
                  </button>
                ) : (
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      autoFocus
                      type="text"
                      value={newCharName}
                      onChange={(e) => setNewCharName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddCharacter()
                        if (e.key === 'Escape') { setIsAddingChar(false); setNewCharName('') }
                      }}
                      placeholder="キャラクター名を入力"
                      className="input flex-1 text-sm h-8"
                    />
                    <button
                      onClick={handleAddCharacter}
                      disabled={!newCharName.trim()}
                      className="btn-primary text-xs h-8 px-3"
                    >
                      追加
                    </button>
                    <button
                      onClick={() => { setIsAddingChar(false); setNewCharName('') }}
                      className="btn-ghost text-xs h-8 px-2"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Folder name tag suggestions */}
              {folderNames.length > 0 && (
                <div>
                  <label className="flex items-center gap-1.5 text-sm font-medium text-txt-secondary mb-1">
                    <Tag className="w-4 h-4" />
                    フォルダ名をタグとして追加（全ファイル共通）
                  </label>
                  <p className="text-xs text-txt-muted mb-2">
                    チェックしたフォルダ名がタグとして全ファイルに付与されます。鉛筆アイコンで名称変更できます。
                  </p>

                  {/* Strip leading numbers option */}
                  <label className="flex items-center gap-1.5 mb-2.5 cursor-pointer w-fit">
                    <input
                      type="checkbox"
                      checked={stripLeadingNumbers}
                      onChange={(e) => setStripLeadingNumbers(e.target.checked)}
                      className="w-3.5 h-3.5 accent-violet-500"
                    />
                    <span className="text-xs text-txt-secondary">
                      先頭の連番を除いた名前をタグ名にする
                      <span className="text-txt-muted ml-1">（例: 10_残念 → 残念）</span>
                    </span>
                  </label>

                  <div className="flex flex-wrap gap-1.5">
                    {folderNames.map((name) => {
                      const displayName = getDisplayName(name)
                      const checked = selectedFolderTags.has(name)
                      const isEditing = editingFolderTag === name
                      if (isEditing) {
                        return (
                          <div key={name} className="flex items-center gap-1">
                            <input
                              autoFocus
                              type="text"
                              value={editingTagValue}
                              onChange={(e) => setEditingTagValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveTagRename(name)
                                if (e.key === 'Escape') setEditingFolderTag(null)
                              }}
                              onBlur={() => saveTagRename(name)}
                              className="input text-xs h-7 w-28 px-2"
                            />
                          </div>
                        )
                      }
                      return (
                        <div key={name} className="flex items-center gap-0.5 group/tag">
                          <button
                            onClick={() => toggleFolderTag(name)}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-all ${
                              checked
                                ? 'bg-accent/20 border-accent/50 text-accent-light'
                                : 'bg-transparent border-bg-border text-txt-muted hover:border-bg-hover hover:text-txt-secondary'
                            }`}
                          >
                            {checked ? (
                              <Check className="w-3 h-3" />
                            ) : (
                              <div className="w-3 h-3 rounded-full border border-current opacity-50" />
                            )}
                            {displayName}
                          </button>
                          <button
                            onClick={() => {
                              setEditingFolderTag(name)
                              setEditingTagValue(displayName)
                            }}
                            className="opacity-0 group-hover/tag:opacity-100 p-0.5 rounded hover:bg-bg-elevated text-txt-muted hover:text-txt-primary transition-all"
                            title="タグ名を変更"
                          >
                            <Pencil className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Software */}
              <div>
                <label className="text-sm font-medium text-txt-secondary block mb-2">
                  音声ソフト（全ファイルに適用）
                </label>
                <select
                  value={globalSoftware}
                  onChange={(e) => setGlobalSoftware(e.target.value)}
                  className="input"
                >
                  <option value="">未設定</option>
                  {softwares.map((s) => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>

              {/* Additional tags */}
              {tags.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-txt-secondary block mb-2">
                    追加タグ（任意）
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((tag) => {
                      const selected = additionalTagIds.includes(tag.id)
                      return (
                        <button
                          key={tag.id}
                          onClick={() =>
                            setAdditionalTagIds((prev) =>
                              prev.includes(tag.id)
                                ? prev.filter((id) => id !== tag.id)
                                : [...prev, tag.id]
                            )
                          }
                          className="tag-chip border transition-colors"
                          style={
                            selected
                              ? { backgroundColor: `${tag.color}33`, color: tag.color, borderColor: 'transparent' }
                              : { color: '#94a3b8', borderColor: '#2a2a3e' }
                          }
                        >
                          {tag.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* File groups (collapsible) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-txt-secondary">
                    ファイルグループ（{activeCount} / {importPendingFiles.length} 件）
                  </label>
                  {groups.length > 1 && (
                    <span className="text-xs text-txt-muted">{groups.length} グループ</span>
                  )}
                </div>

                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {groups.map((group) => (
                    <FileGroupRow
                      key={group.groupKey}
                      group={group}
                      globalCharacter={globalCharacter}
                      characters={characters}
                      fileSkips={fileSkips}
                      folderNames={folderNames}
                      getDisplayName={getDisplayName}
                      expanded={expandedGroups.has(group.groupKey)}
                      onToggleExpand={() => toggleGroupExpand(group.groupKey)}
                      onSetGroupCharacter={(char) => setGroupCharacter(group.groupKey, char)}
                      onToggleFileSkip={toggleFileSkip}
                      onToggleGroupTag={(tagName) => toggleGroupTag(group.groupKey, tagName)}
                      onAddCharacter={handleAddGroupCharacter}
                    />
                  ))}
                </div>
              </div>

              {/* Summary */}
              <div className="bg-bg-elevated rounded-lg p-3 space-y-1 text-sm">
                <div className="flex justify-between text-txt-secondary">
                  <span>取り込みファイル数</span>
                  <span className="font-medium text-txt-primary">{activeCount} 件</span>
                </div>
                <div className="flex justify-between text-txt-secondary">
                  <span>カテゴリ</span>
                  <span className="font-medium" style={{
                    color: category === 'commercial' ? 'rgb(var(--color-commercial))'
                         : category === 'original'   ? 'rgb(var(--color-original))'
                         : (userCategories.find(c => c.name === category)?.color ?? 'inherit')
                  }}>
                    {category === 'commercial' ? '音声素材製品'
                   : category === 'original'   ? '自作音声'
                   : category}
                  </span>
                </div>
                {selectedFolderTags.size > 0 && (
                  <div className="flex justify-between text-txt-secondary">
                    <span>付与タグ</span>
                    <span className="font-medium text-accent-light text-right max-w-[60%] truncate">
                      {Array.from(selectedFolderTags).map(getDisplayName).join(', ')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Step 3: Result ── */}
          {step === 3 && result && (
            <div className="p-5 space-y-4">
              <div className="text-center py-4">
                {result.success > 0 ? (
                  <>
                    <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-3">
                      <Check className="w-8 h-8 text-success" />
                    </div>
                    <h3 className="text-lg font-semibold text-txt-primary">取り込み完了</h3>
                    <p className="text-sm text-txt-secondary mt-1">
                      {result.success} ファイルを取り込みました
                    </p>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 rounded-full bg-danger/20 flex items-center justify-center mx-auto mb-3">
                      <AlertCircle className="w-8 h-8 text-danger" />
                    </div>
                    <h3 className="text-lg font-semibold text-txt-primary">取り込み失敗</h3>
                  </>
                )}
              </div>
              {result.errors.length > 0 && (
                <div className="bg-danger/10 border border-danger/20 rounded-lg p-3">
                  <p className="text-xs font-medium text-danger mb-1">
                    エラー ({result.errors.length})
                  </p>
                  <div className="space-y-0.5 max-h-32 overflow-y-auto">
                    {result.errors.map((e, i) => (
                      <p key={i} className="text-xs text-danger/80">{e}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-bg-border shrink-0">
          <button
            onClick={step === 1 ? handleClose : () => setStep((s) => Math.max(1, s - 1) as Step)}
            className="btn-secondary"
            disabled={isImporting || step === 3}
          >
            {step === 1 ? <><X className="w-4 h-4" />キャンセル</> : <><ChevronLeft className="w-4 h-4" />戻る</>}
          </button>

          {step === 3 ? (
            <button onClick={handleClose} className="btn-primary">
              <Check className="w-4 h-4" />閉じる
            </button>
          ) : step === 1 ? (
            <button
              onClick={proceedToStep2}
              disabled={importPendingFiles.length === 0}
              className="btn-primary"
            >
              次へ <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={executeImport}
              disabled={isImporting || activeCount === 0}
              className="btn-primary"
            >
              {isImporting ? (
                <><Loader className="w-4 h-4 animate-spin" />取り込み中...</>
              ) : (
                <><Upload className="w-4 h-4" />{activeCount} ファイルを取り込む</>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function DetectedFilesSummary({
  files,
  folderNames,
  onClear
}: {
  files: ImportFileInfo[]
  folderNames: string[]
  onClear: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const totalSize = files.reduce((sum, f) => sum + f.size, 0)
  const uniqueFolders = new Set(files.map((f) => f.droppedRoot)).size

  return (
    <div className="border border-bg-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-bg-elevated">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-accent/20 flex items-center justify-center">
            <FolderTree className="w-5 h-5 text-accent-light" />
          </div>
          <div>
            <p className="text-sm font-medium text-txt-primary">
              {files.length} ファイルを検出
            </p>
            <p className="text-xs text-txt-muted">
              {uniqueFolders > 1 ? `${uniqueFolders} フォルダ • ` : ''}
              {formatFileSize(totalSize)}
              {folderNames.length > 0 && ` • フォルダ名 ${folderNames.length} 件をタグ候補として検出`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-txt-muted hover:text-txt-secondary flex items-center gap-0.5"
          >
            {expanded ? 'collapse' : '一覧'}
            <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
          <button onClick={onClear} className="text-xs text-danger/60 hover:text-danger">
            クリア
          </button>
        </div>
      </div>

      {expanded && (
        <div className="max-h-52 overflow-y-auto divide-y divide-bg-border">
          {files.slice(0, 100).map((f, i) => (
            <div key={i} className="flex items-center gap-2 px-4 py-1.5 text-xs">
              <FileAudio className="w-3 h-3 text-txt-muted shrink-0" />
              <span className="flex-1 text-txt-secondary truncate" title={f.sourcePath}>
                {f.folderChain.length > 0
                  ? <><span className="text-txt-muted">{f.folderChain.join(' / ')} / </span>{f.fileName}</>
                  : f.fileName
                }
              </span>
              {f.suggestedCharacter && (
                <span className="text-accent-light shrink-0">{f.suggestedCharacter}</span>
              )}
              <span className="text-txt-muted shrink-0">{formatFileSize(f.size)}</span>
            </div>
          ))}
          {files.length > 100 && (
            <p className="text-xs text-txt-muted text-center py-2">
              ...他 {files.length - 100} ファイル
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function FileGroupRow({
  group,
  globalCharacter,
  characters,
  fileSkips,
  folderNames,
  getDisplayName,
  expanded,
  onToggleExpand,
  onSetGroupCharacter,
  onToggleFileSkip,
  onToggleGroupTag,
  onAddCharacter
}: {
  group: FileGroup
  globalCharacter: string
  characters: { id: number; name: string; color: string | null }[]
  fileSkips: Set<string>
  folderNames: string[]
  getDisplayName: (name: string) => string
  expanded: boolean
  onToggleExpand: () => void
  onSetGroupCharacter: (char: string | null) => void
  onToggleFileSkip: (path: string) => void
  onToggleGroupTag: (tagName: string) => void
  onAddCharacter: (name: string) => Promise<void>
}) {
  const activeInGroup = group.files.filter((f) => !fileSkips.has(f.sourcePath)).length
  const [isAddingChar, setIsAddingChar] = useState(false)
  const [newCharName, setNewCharName] = useState('')

  const handleAddCharacter = async () => {
    const trimmed = newCharName.trim()
    if (!trimmed) return
    await onAddCharacter(trimmed)
    onSetGroupCharacter(trimmed)
    setIsAddingChar(false)
    setNewCharName('')
  }

  return (
    <div className="border border-bg-border rounded-lg overflow-hidden">
      {/* Group header */}
      <div
        className="flex items-center gap-2 px-3 py-2 bg-bg-elevated cursor-pointer hover:bg-bg-hover transition-colors"
        onClick={onToggleExpand}
      >
        <ChevronDown className={`w-3.5 h-3.5 text-txt-muted transition-transform shrink-0 ${expanded ? '' : '-rotate-90'}`} />
        <FolderOpen className="w-3.5 h-3.5 text-txt-muted shrink-0" />
        <span className="flex-1 text-sm text-txt-secondary font-medium truncate">
          {group.groupKey}
        </span>
        <span className="text-xs text-txt-muted shrink-0">
          {activeInGroup} / {group.files.length} 件
        </span>

        {/* Per-group character override (only shown when no global) */}
        {!globalCharacter && !isAddingChar && (
          <select
            value={group.characterOverride ?? ''}
            onChange={(e) => { e.stopPropagation(); onSetGroupCharacter(e.target.value || null) }}
            onClick={(e) => e.stopPropagation()}
            className="input text-xs h-8 w-36 shrink-0"
          >
            <option value="">自動判定</option>
            <option value="__none__">未設定</option>
            {characters.map((c) => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
        )}

        {/* Per-group new character button */}
        {!globalCharacter && !isAddingChar && (
          <button
            onClick={(e) => { e.stopPropagation(); setIsAddingChar(true) }}
            className="shrink-0 p-1 rounded hover:bg-bg-hover text-txt-muted hover:text-accent-light transition-colors"
            title="新しいキャラクターを追加"
          >
            <UserPlus className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Per-group inline character creation */}
      {!globalCharacter && isAddingChar && (
        <div
          className="px-3 py-2 bg-bg-base border-t border-bg-border flex items-center gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            autoFocus
            type="text"
            value={newCharName}
            onChange={(e) => setNewCharName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddCharacter()
              if (e.key === 'Escape') { setIsAddingChar(false); setNewCharName('') }
            }}
            placeholder="キャラクター名を入力"
            className="input flex-1 text-xs h-7"
          />
          <button
            onClick={handleAddCharacter}
            disabled={!newCharName.trim()}
            className="btn-primary text-xs h-7 px-2.5"
          >
            追加
          </button>
          <button
            onClick={() => { setIsAddingChar(false); setNewCharName('') }}
            className="btn-ghost text-xs h-7 px-1.5"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Per-group folder tag assignment */}
      {folderNames.length > 0 && (
        <div
          className="px-3 py-1.5 bg-bg-base border-t border-bg-border flex flex-wrap gap-1 items-center"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="text-xs text-txt-muted shrink-0 mr-0.5">このグループのタグ:</span>
          {folderNames.map((name) => {
            const displayName = getDisplayName(name)
            const isSelected = group.groupTagNames.includes(name)
            return (
              <button
                key={name}
                onClick={() => onToggleGroupTag(name)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-all ${
                  isSelected
                    ? 'bg-accent/20 border-accent/50 text-accent-light'
                    : 'bg-transparent border-bg-border text-txt-muted hover:border-bg-hover hover:text-txt-secondary'
                }`}
              >
                {isSelected && <Check className="w-2.5 h-2.5" />}
                {displayName}
              </button>
            )
          })}
        </div>
      )}

      {/* Expanded file list */}
      {expanded && (
        <div className="divide-y divide-bg-border max-h-48 overflow-y-auto">
          {group.files.map((file, i) => {
            const skipped = fileSkips.has(file.sourcePath)
            return (
              <div
                key={i}
                className={`flex items-center gap-2 px-4 py-1.5 text-xs transition-opacity ${skipped ? 'opacity-40' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={!skipped}
                  onChange={() => onToggleFileSkip(file.sourcePath)}
                  className="w-3.5 h-3.5 accent-violet-500 shrink-0"
                />
                <FileAudio className="w-3 h-3 text-txt-muted shrink-0" />
                <span className="flex-1 text-txt-secondary truncate">{file.fileName}</span>
                {file.suggestedCharacter && !globalCharacter && !group.characterOverride && (
                  <span className="text-accent-light shrink-0 text-xs">{file.suggestedCharacter}</span>
                )}
                <span className="text-txt-muted shrink-0">{formatFileSize(file.size)}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function CategoryCard({
  label,
  desc,
  color,
  selected,
  onClick
}: {
  label: string
  desc: string
  color: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="p-4 rounded-xl border-2 text-left transition-all"
      style={
        selected
          ? { borderColor: color, backgroundColor: `${color}15` }
          : { borderColor: 'rgb(var(--color-bg-border))' }
      }
    >
      <div className="w-3 h-3 rounded-full mb-2" style={{ backgroundColor: color }} />
      <p className="text-sm font-semibold text-txt-primary">{label}</p>
      <p className="text-xs text-txt-muted mt-0.5">{desc}</p>
    </button>
  )
}
