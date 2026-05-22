import { useEffect, useRef, useState, useCallback } from 'react'
import WaveSurfer from 'wavesurfer.js'
import {
  Heart,
  FolderOpen,
  Trash2,
  Pencil,
  Check,
  X,
  Plus,
  Music,
  Clock,
  HardDrive,
  Activity,
  Loader,
  Users
} from 'lucide-react'
import { useStore } from '../../store'
import { Voice, Tag, parseVoiceTags, formatDuration, formatFileSize } from '../../types'

export default function RightPane() {
  const {
    voices,
    selectedVoiceId,
    selectedVoiceIds,
    currentVoice,
    isPlaying,
    currentTime,
    tags,
    characters,
    softwares,
    userCategories,
    loadVoices,
    loadTags,
    loadCharacters,
    updateVoiceInList,
    removeVoiceFromList,
    clearSelection,
    setSelectedVoice
  } = useStore()

  const voice = voices.find((v) => v.id === selectedVoiceId) ?? null
  const wavesurferRef = useRef<WaveSurfer | null>(null)
  const [wsReady, setWsReady] = useState(false)

  // ref コールバック: div が DOM に現れたとき初期化、消えたとき破棄
  const waveformRef = useCallback((el: HTMLDivElement | null) => {
    if (!el) {
      wavesurferRef.current?.destroy()
      wavesurferRef.current = null
      setWsReady(false)
      return
    }
    const ws = WaveSurfer.create({
      container: el,
      waveColor: '#2a2a3e',
      progressColor: '#7c3aed',
      cursorColor: '#9d63f5',
      height: 56,
      barWidth: 2,
      barGap: 1,
      barRadius: 1,
      normalize: true,
      interact: false,
    })
    wavesurferRef.current = ws
    setWsReady(true)
  }, [])

  const [editingMemo, setEditingMemo] = useState(false)
  const [memoValue, setMemoValue] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [showTagInput, setShowTagInput] = useState(false)
  const [tagSuggestions, setTagSuggestions] = useState<Tag[]>([])
  const [isSaving, setIsSaving] = useState(false)

  // Bulk edit state (for multi-selection)
  const [bulkCharacterId, setBulkCharacterId] = useState('')
  const [bulkSoftwareId, setBulkSoftwareId] = useState('')
  const [bulkTagIds, setBulkTagIds] = useState<number[]>([])
  const [bulkTagInput, setBulkTagInput] = useState('')
  const [bulkTagSuggestions, setBulkTagSuggestions] = useState<Tag[]>([])
  const [bulkMemo, setBulkMemo] = useState('')
  const [isBulkSaving, setIsBulkSaving] = useState(false)

  // Reset bulk state when selection count changes
  useEffect(() => {
    setBulkCharacterId('')
    setBulkSoftwareId('')
    setBulkTagIds([])
    setBulkTagInput('')
    setBulkMemo('')
  }, [selectedVoiceIds.length])

  // 波形ロード: WaveSurfer が準備完了したとき、または選択音声が変わったとき
  useEffect(() => {
    const ws = wavesurferRef.current
    if (!ws || !voice) return

    const load = async () => {
      try {
        const absPath = await window.api.getAbsolutePath(voice.file_path)
        const fileUrl = absPathToKoebakoUrl(absPath)
        await ws.load(fileUrl)
      } catch (e) {
        console.error('Waveform load error:', e)
      }
    }
    load()
  }, [voice?.id, wsReady])

  // カーソル位置を PlayerBar の再生位置に追従（音は出さない）
  useEffect(() => {
    const ws = wavesurferRef.current
    if (!ws || currentVoice?.id !== voice?.id) return
    const duration = ws.getDuration()
    if (duration > 0) {
      ws.seekTo(Math.min(currentTime / duration, 1))
    }
  }, [currentTime, currentVoice?.id, voice?.id])

  // Memo editing
  useEffect(() => {
    if (voice) setMemoValue(voice.memo || '')
  }, [voice?.id])

  const saveMemo = async () => {
    if (!voice) return
    setIsSaving(true)
    await window.api.updateVoice(voice.id, { memo: memoValue })
    updateVoiceInList(voice.id, { memo: memoValue })
    setEditingMemo(false)
    setIsSaving(false)
  }

  const toggleFavorite = async () => {
    if (!voice) return
    const newVal = await window.api.toggleFavorite(voice.id)
    updateVoiceInList(voice.id, { is_favorite: newVal })
  }

  const handleDeleteVoice = async () => {
    if (!voice) return
    if (!confirm(`「${voice.original_name}」を削除しますか？\nファイルも削除されます。`)) return
    await window.api.deleteVoice(voice.id)
    removeVoiceFromList(voice.id)
    setSelectedVoice(null)
    loadCharacters()
    loadTags()
  }

  const openInExplorer = async () => {
    if (!voice) return
    const absPath = await window.api.getAbsolutePath(voice.file_path)
    await window.api.openInExplorer(absPath)
  }

  // Tag management
  const voiceTags = voice ? (voice.parsedTags ?? parseVoiceTags(voice.tags)) : []

  const handleTagInputChange = (val: string) => {
    setTagInput(val)
    if (val.trim()) {
      const q = val.toLowerCase()
      setTagSuggestions(
        tags
          .filter((t) => t.name.toLowerCase().includes(q) && !voiceTags.some((vt) => vt.id === t.id))
          .slice(0, 5)
      )
    } else {
      setTagSuggestions([])
    }
  }

  const addTagToVoice = async (tagId: number) => {
    if (!voice) return
    const newIds = [...voiceTags.map((t) => t.id), tagId]
    await window.api.setVoiceTags(voice.id, newIds)
    const updatedVoice = await window.api.getVoiceById(voice.id)
    if (updatedVoice) {
      updateVoiceInList(voice.id, { tags: updatedVoice.tags })
    }
    setTagInput('')
    setTagSuggestions([])
    loadTags()
  }

  const addNewTag = async () => {
    if (!voice || !tagInput.trim()) return
    const newTags = await window.api.insertTag(tagInput.trim())
    const newTag = newTags.find((t) => t.name === tagInput.trim())
    if (newTag) {
      await addTagToVoice(newTag.id)
    }
    loadTags()
  }

  const removeTagFromVoice = async (tagId: number) => {
    if (!voice) return
    const newIds = voiceTags.filter((t) => t.id !== tagId).map((t) => t.id)
    await window.api.setVoiceTags(voice.id, newIds)
    const updatedVoice = await window.api.getVoiceById(voice.id)
    if (updatedVoice) {
      updateVoiceInList(voice.id, { tags: updatedVoice.tags })
    }
    loadTags()
  }

  const updateCharacter = async (charId: number | null) => {
    if (!voice) return
    await window.api.updateVoice(voice.id, { character_id: charId })
    const updated = await window.api.getVoiceById(voice.id)
    if (updated) {
      updateVoiceInList(voice.id, {
        character_id: updated.character_id,
        character_name: updated.character_name,
        character_color: updated.character_color
      })
    }
    loadCharacters()
    loadVoices()
  }

  // Bulk edit handlers
  const handleBulkTagInput = (val: string) => {
    setBulkTagInput(val)
    if (val.trim()) {
      const q = val.toLowerCase()
      setBulkTagSuggestions(
        tags
          .filter((t) => t.name.toLowerCase().includes(q) && !bulkTagIds.includes(t.id))
          .slice(0, 5)
      )
    } else {
      setBulkTagSuggestions([])
    }
  }

  const addBulkTag = (tagId: number) => {
    if (!bulkTagIds.includes(tagId)) setBulkTagIds((prev) => [...prev, tagId])
    setBulkTagInput('')
    setBulkTagSuggestions([])
  }

  const addBulkNewTag = async () => {
    if (!bulkTagInput.trim()) return
    const existing = tags.find((t) => t.name.toLowerCase() === bulkTagInput.trim().toLowerCase())
    if (existing) {
      addBulkTag(existing.id)
      return
    }
    const newTags = await window.api.insertTag(bulkTagInput.trim())
    await loadTags()
    const created = newTags.find((t) => t.name === bulkTagInput.trim())
    if (created) addBulkTag(created.id)
  }

  const applyBulkEdit = async () => {
    if (selectedVoiceIds.length === 0) return
    setIsBulkSaving(true)
    try {
      // Character
      if (bulkCharacterId !== '') {
        const charId = bulkCharacterId === '0' ? null : parseInt(bulkCharacterId)
        for (const id of selectedVoiceIds) {
          await window.api.updateVoice(id, { character_id: charId })
        }
      }
      // Software
      if (bulkSoftwareId !== '') {
        const swId = bulkSoftwareId === '0' ? null : parseInt(bulkSoftwareId)
        for (const id of selectedVoiceIds) {
          await window.api.updateVoice(id, { software_id: swId })
        }
      }
      // Tags (add to existing)
      if (bulkTagIds.length > 0) {
        await window.api.bulkAddTags(selectedVoiceIds, bulkTagIds)
      }
      // Memo (overwrite)
      if (bulkMemo.trim()) {
        for (const id of selectedVoiceIds) {
          await window.api.updateVoice(id, { memo: bulkMemo.trim() })
        }
      }
      await loadVoices()
      await loadCharacters()
      await loadTags()
      // Reset
      setBulkCharacterId('')
      setBulkSoftwareId('')
      setBulkTagIds([])
      setBulkMemo('')
    } finally {
      setIsBulkSaving(false)
    }
  }

  // Multi-select panel
  if (selectedVoiceIds.length > 1) {
    const hasChanges =
      bulkCharacterId !== '' ||
      bulkSoftwareId !== '' ||
      bulkTagIds.length > 0 ||
      bulkMemo.trim() !== ''

    return (
      <div className="w-64 shrink-0 bg-bg-surface border-l border-bg-border flex flex-col">
        {/* Header */}
        <div className="p-3 border-b border-bg-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
              <Users className="w-4 h-4 text-accent-light" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-txt-primary">
                {selectedVoiceIds.length} 件を選択中
              </h3>
              <p className="text-xs text-txt-muted">まとめてメタ情報を編集</p>
            </div>
          </div>
          {/* Favorite bulk actions */}
          <div className="flex gap-1.5 mt-2.5">
            <button
              onClick={async () => {
                await window.api.bulkSetFavorite(selectedVoiceIds, 1)
                await loadVoices()
              }}
              className="flex-1 btn-ghost text-xs gap-1 border border-bg-border hover:border-warning/50 hover:text-warning"
            >
              <Heart className="w-3 h-3" />
              お気に入りに追加
            </button>
            <button
              onClick={async () => {
                await window.api.bulkSetFavorite(selectedVoiceIds, 0)
                await loadVoices()
              }}
              className="flex-1 btn-ghost text-xs gap-1 border border-bg-border hover:border-danger/50 hover:text-danger"
            >
              <Heart className="w-3 h-3" />
              お気に入りを解除
            </button>
          </div>
        </div>

        {/* Fields */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {/* Character */}
          <div>
            <label className="text-xs text-txt-muted uppercase tracking-wider block mb-1.5">
              キャラクター
            </label>
            <select
              value={bulkCharacterId}
              onChange={(e) => setBulkCharacterId(e.target.value)}
              className="input text-xs h-8"
            >
              <option value="">変更しない</option>
              <option value="0">未設定に変更</option>
              {characters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Software */}
          <div>
            <label className="text-xs text-txt-muted uppercase tracking-wider block mb-1.5">
              音声ソフト
            </label>
            <select
              value={bulkSoftwareId}
              onChange={(e) => setBulkSoftwareId(e.target.value)}
              className="input text-xs h-8"
            >
              <option value="">変更しない</option>
              <option value="0">未設定に変更</option>
              {softwares.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Tags */}
          <div>
            <label className="text-xs text-txt-muted uppercase tracking-wider block mb-1.5">
              タグを追加
            </label>
            {bulkTagIds.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {bulkTagIds.map((id) => {
                  const tag = tags.find((t) => t.id === id)
                  if (!tag) return null
                  return (
                    <span
                      key={id}
                      className="tag-chip pr-1"
                      style={{ backgroundColor: `${tag.color}22`, color: tag.color }}
                    >
                      {tag.name}
                      <button
                        onClick={() => setBulkTagIds((prev) => prev.filter((i) => i !== id))}
                        className="ml-0.5 hover:opacity-70"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  )
                })}
              </div>
            )}
            <div className="relative">
              <input
                type="text"
                placeholder="タグ名を入力..."
                value={bulkTagInput}
                onChange={(e) => handleBulkTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addBulkNewTag()
                  if (e.key === 'Escape') {
                    setBulkTagInput('')
                    setBulkTagSuggestions([])
                  }
                }}
                className="input text-xs h-8"
              />
              {bulkTagSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-bg-card border border-bg-border rounded-md shadow-lg z-10">
                  {bulkTagSuggestions.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => addBulkTag(t.id)}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs hover:bg-bg-elevated text-left transition-colors"
                    >
                      <div
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: t.color }}
                      />
                      {t.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Memo */}
          <div>
            <label className="text-xs text-txt-muted uppercase tracking-wider block mb-1.5">
              メモ（全ファイルを上書き）
            </label>
            <textarea
              value={bulkMemo}
              onChange={(e) => setBulkMemo(e.target.value)}
              className="input text-xs min-h-[60px] resize-none"
              placeholder="未入力の場合は変更しません"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-bg-border space-y-2">
          <button
            onClick={applyBulkEdit}
            disabled={isBulkSaving || !hasChanges}
            className="btn-primary w-full text-xs"
          >
            {isBulkSaving ? (
              <Loader className="w-3 h-3 animate-spin" />
            ) : (
              <Check className="w-3 h-3" />
            )}
            {selectedVoiceIds.length} 件に適用
          </button>
          <button
            onClick={async () => {
              if (!confirm(`選択した ${selectedVoiceIds.length} 件を削除しますか？\nファイルも削除されます。`)) return
              await window.api.bulkDeleteVoices(selectedVoiceIds)
              for (const id of selectedVoiceIds) removeVoiceFromList(id)
              clearSelection()
              loadCharacters()
              loadTags()
            }}
            className="btn-danger w-full text-xs"
          >
            <Trash2 className="w-3 h-3" />
            {selectedVoiceIds.length} 件を削除
          </button>
          <button onClick={clearSelection} className="btn-ghost text-xs w-full">
            選択を解除
          </button>
        </div>
      </div>
    )
  }

  if (!voice) {
    return (
      <div className="w-64 shrink-0 bg-bg-surface border-l border-bg-border flex flex-col items-center justify-center gap-3 text-center p-6">
        <div className="w-14 h-14 rounded-2xl bg-bg-elevated flex items-center justify-center">
          <Music className="w-7 h-7 text-txt-muted" />
        </div>
        <p className="text-sm text-txt-muted">ファイルを選択すると<br />詳細が表示されます</p>
      </div>
    )
  }

  return (
    <div className="w-64 shrink-0 bg-bg-surface border-l border-bg-border flex flex-col overflow-hidden animate-slide-in-right">
      {/* Waveform */}
      <div className="p-3 border-b border-bg-border">
        <div
          ref={waveformRef}
          className="waveform-container w-full rounded overflow-hidden bg-bg-card"
          style={{ minHeight: 56 }}
        />
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-3 space-y-4">
          {/* File name + actions */}
          <div>
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-medium text-txt-primary break-all leading-snug flex-1">
                {voice.original_name}
              </h3>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={toggleFavorite}
                  className={`p-1 rounded hover:bg-bg-elevated transition-colors ${
                    voice.is_favorite ? 'text-warning' : 'text-txt-muted'
                  }`}
                  title="お気に入り"
                >
                  <Heart className={`w-4 h-4 ${voice.is_favorite ? 'fill-warning' : ''}`} />
                </button>
                <button
                  onClick={openInExplorer}
                  className="p-1 rounded hover:bg-bg-elevated text-txt-muted hover:text-txt-primary transition-colors"
                  title="エクスプローラーで開く"
                >
                  <FolderOpen className="w-4 h-4" />
                </button>
                <button
                  onClick={handleDeleteVoice}
                  className="p-1 rounded hover:bg-danger/20 text-txt-muted hover:text-danger transition-colors"
                  title="削除"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Category badge */}
            <div className="mt-1.5">
              {(() => {
                if (voice.category === 'commercial') {
                  return (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-commercial/20 text-commercial">
                      音声素材製品
                    </span>
                  )
                }
                if (voice.category === 'original') {
                  return (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-original/20 text-original">
                      自作音声
                    </span>
                  )
                }
                const userCat = userCategories.find((c) => c.name === voice.category)
                return (
                  <span
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={userCat
                      ? { backgroundColor: `${userCat.color}22`, color: userCat.color }
                      : { backgroundColor: 'rgba(100,116,139,0.15)', color: '#94a3b8' }}
                  >
                    {voice.category}
                  </span>
                )
              })()}
            </div>
          </div>

          {/* File stats */}
          <div className="grid grid-cols-2 gap-2">
            <StatItem icon={<Clock className="w-3 h-3" />} label="再生時間" value={formatDuration(voice.duration_sec)} />
            <StatItem icon={<HardDrive className="w-3 h-3" />} label="サイズ" value={formatFileSize(voice.file_size)} />
            <StatItem icon={<Activity className="w-3 h-3" />} label="サンプルレート" value={voice.sample_rate ? `${(voice.sample_rate / 1000).toFixed(1)}kHz` : '-'} />
            <StatItem icon={<Activity className="w-3 h-3" />} label="ビット深度" value={voice.bit_depth ? `${voice.bit_depth}bit` : '-'} />
          </div>

          {/* Character */}
          <div>
            <label className="text-xs text-txt-muted uppercase tracking-wider block mb-1.5">
              キャラクター
            </label>
            <select
              value={voice.character_id ?? ''}
              onChange={(e) => updateCharacter(e.target.value ? parseInt(e.target.value) : null)}
              className="input text-xs h-8"
            >
              <option value="">未設定</option>
              {characters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Software */}
          <div>
            <label className="text-xs text-txt-muted uppercase tracking-wider block mb-1.5">
              音声ソフト
            </label>
            <select
              value={voice.software_id ?? ''}
              onChange={async (e) => {
                const softwareId = e.target.value ? parseInt(e.target.value) : null
                await window.api.updateVoice(voice.id, { software_id: softwareId })
                updateVoiceInList(voice.id, { software_id: softwareId })
              }}
              className="input text-xs h-8"
            >
              <option value="">未設定</option>
              {softwares.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Tags */}
          <div>
            <label className="text-xs text-txt-muted uppercase tracking-wider block mb-1.5">
              タグ
            </label>
            <div className="flex flex-wrap gap-1 mb-2">
              {voiceTags.map((tag) => (
                <span
                  key={tag.id}
                  className="tag-chip pr-1"
                  style={{
                    backgroundColor: `${tag.color}22`,
                    color: tag.color
                  }}
                >
                  {tag.name}
                  <button
                    onClick={() => removeTagFromVoice(tag.id)}
                    className="ml-0.5 hover:opacity-70"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}
            </div>

            {showTagInput ? (
              <div className="relative">
                <input
                  autoFocus
                  type="text"
                  placeholder="タグ名を入力..."
                  value={tagInput}
                  onChange={(e) => handleTagInputChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') addNewTag()
                    if (e.key === 'Escape') {
                      setShowTagInput(false)
                      setTagInput('')
                    }
                  }}
                  className="input text-xs h-7 pr-16"
                />
                <div className="absolute right-1 top-0.5 flex gap-0.5">
                  <button onClick={addNewTag} className="p-1 rounded hover:bg-bg-elevated text-txt-muted hover:text-success">
                    <Check className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => {
                      setShowTagInput(false)
                      setTagInput('')
                    }}
                    className="p-1 rounded hover:bg-bg-elevated text-txt-muted hover:text-danger"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>

                {tagSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-bg-card border border-bg-border rounded-md shadow-lg z-10">
                    {tagSuggestions.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => addTagToVoice(t.id)}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs hover:bg-bg-elevated text-left transition-colors"
                      >
                        <div
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: t.color }}
                        />
                        {t.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => setShowTagInput(true)}
                className="btn-ghost text-xs gap-1 w-full justify-center border border-dashed border-bg-border hover:border-accent/40"
              >
                <Plus className="w-3 h-3" />
                タグを追加
              </button>
            )}
          </div>

          {/* Memo */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-txt-muted uppercase tracking-wider">メモ</label>
              {!editingMemo && (
                <button
                  onClick={() => setEditingMemo(true)}
                  className="p-0.5 rounded hover:bg-bg-elevated text-txt-muted hover:text-txt-primary transition-colors"
                >
                  <Pencil className="w-3 h-3" />
                </button>
              )}
            </div>

            {editingMemo ? (
              <div>
                <textarea
                  autoFocus
                  value={memoValue}
                  onChange={(e) => setMemoValue(e.target.value)}
                  className="input text-xs min-h-[80px] resize-none"
                  placeholder="メモを入力..."
                />
                <div className="flex gap-1 mt-1">
                  <button onClick={saveMemo} disabled={isSaving} className="btn-primary text-xs flex-1">
                    <Check className="w-3 h-3" />
                    保存
                  </button>
                  <button
                    onClick={() => {
                      setEditingMemo(false)
                      setMemoValue(voice.memo || '')
                    }}
                    className="btn-secondary text-xs"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => setEditingMemo(true)}
                className="text-xs text-txt-secondary bg-bg-card rounded-md p-2 min-h-[40px] cursor-text hover:bg-bg-elevated transition-colors"
              >
                {voice.memo ? voice.memo : <span className="text-txt-muted italic">メモなし</span>}
              </div>
            )}
          </div>

          {/* Play count */}
          <div className="text-xs text-txt-muted text-right pb-2">
            再生回数: {voice.play_count} 回
          </div>
        </div>
      </div>
    </div>
  )
}

function StatItem({
  icon,
  label,
  value
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="bg-bg-card rounded-md p-2">
      <div className="flex items-center gap-1 text-txt-muted mb-0.5">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <div className="text-xs font-medium text-txt-secondary">{value}</div>
    </div>
  )
}

function absPathToKoebakoUrl(absolutePath: string): string {
  const normalized = absolutePath.replace(/\\/g, '/')
  return `koebako-file:///${encodeURIComponent(normalized).replace(/%2F/g, '/').replace(/%3A/g, ':')}`
}
