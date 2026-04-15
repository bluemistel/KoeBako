import { useState, useEffect } from 'react'
import {
  X,
  FolderOpen,
  Plus,
  Trash2,
  Check,
  Download,
  Upload,
  Save,
  ExternalLink,
  Bug
} from 'lucide-react'
import { useStore } from '../../store'
import { Character, Tag } from '../../types'

type SettingsTab = 'general' | 'characters' | 'tags' | 'shortcuts' | 'bugreport'

export default function SettingsModal() {
  const {
    settings,
    characters,
    tags,
    settingsInitialTab,
    setShowSettingsModal,
    loadSettings,
    loadCharacters,
    loadTags
  } = useStore()

  const [activeTab, setActiveTab] = useState<SettingsTab>((settingsInitialTab as SettingsTab) ?? 'general')
  const [managedFolder, setManagedFolder] = useState(settings?.managedFolder ?? '')
  const [continuousPlay, setContinuousPlay] = useState(settings?.continuousPlay === 'true')
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Character editing
  const [editingCharId, setEditingCharId] = useState<number | null>(null)
  const [newCharName, setNewCharName] = useState('')
  const [newCharAliases, setNewCharAliases] = useState('')
  const [newCharColor, setNewCharColor] = useState('#9d63f5')
  const [charEditValues, setCharEditValues] = useState<Record<number, { name: string; color: string }>>({})

  // Tag editing
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#6366f1')
  const [tagEditValues, setTagEditValues] = useState<Record<number, { name: string; color: string }>>({})

  useEffect(() => {
    if (settings) {
      setManagedFolder(settings.managedFolder ?? '')
      setContinuousPlay(settings.continuousPlay === 'true')
    }
  }, [settings])

  const handleSelectFolder = async () => {
    const path = await window.api.selectFolder()
    if (path) setManagedFolder(path)
  }

  const handleSaveGeneral = async () => {
    setIsSaving(true)
    await window.api.setSettings({
      managedFolder,
      continuousPlay: String(continuousPlay)
    })
    await loadSettings()
    setIsSaving(false)
    setSaveSuccess(true)
    setTimeout(() => setSaveSuccess(false), 2000)
  }

  // Characters
  const handleAddCharacter = async () => {
    if (!newCharName.trim()) return
    const aliases = newCharAliases.trim()
      ? JSON.stringify(newCharAliases.split(/[,\s]+/).filter(Boolean))
      : undefined
    await window.api.insertCharacter(newCharName.trim(), aliases, newCharColor)
    await loadCharacters()
    setNewCharName('')
    setNewCharAliases('')
    setNewCharColor('#9d63f5')
  }

  const handleDeleteCharacter = async (id: number) => {
    if (!confirm('このキャラクターを削除しますか？\n関連するファイルのキャラクター設定が解除されます。')) return
    await window.api.deleteCharacter(id)
    await loadCharacters()
  }

  const handleUpdateCharacter = async (id: number) => {
    const vals = charEditValues[id]
    if (!vals) return
    await window.api.updateCharacter(id, vals)
    await loadCharacters()
    setEditingCharId(null)
  }

  // Tags
  const handleAddTag = async () => {
    if (!newTagName.trim()) return
    await window.api.insertTag(newTagName.trim(), newTagColor)
    await loadTags()
    setNewTagName('')
    setNewTagColor('#6366f1')
  }

  const handleDeleteTag = async (id: number) => {
    await window.api.deleteTag(id)
    await loadTags()
  }

  const handleUpdateTag = async (id: number) => {
    const vals = tagEditValues[id]
    if (!vals) return
    await window.api.updateTag(id, vals)
    await loadTags()
    setTagEditValues((p) => {
      const next = { ...p }
      delete next[id]
      return next
    })
  }

  const tabs: { key: SettingsTab; label: string }[] = [
    { key: 'general', label: '全般' },
    { key: 'characters', label: 'キャラクター辞書' },
    { key: 'tags', label: 'タグ管理' },
    { key: 'shortcuts', label: 'ショートカット' },
    { key: 'bugreport', label: 'バグ報告' }
  ]

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-bg-card border border-bg-border rounded-xl w-full max-w-2xl flex flex-col max-h-[85vh] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-bg-border shrink-0">
          <h2 className="text-base font-semibold text-txt-primary">設定</h2>
          <button onClick={() => setShowSettingsModal(false)} className="btn-ghost p-1.5">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-40 border-r border-bg-border py-2 shrink-0">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`sidebar-item w-full ${activeTab === tab.key ? 'active' : ''}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-5">
            {/* General */}
            {activeTab === 'general' && (
              <div className="space-y-5">
                <div>
                  <label className="text-sm font-medium text-txt-secondary block mb-2">
                    管理フォルダ
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={managedFolder}
                      onChange={(e) => setManagedFolder(e.target.value)}
                      placeholder="例: C:\Users\user\Documents\VoiceManager"
                      className="input flex-1 text-sm"
                    />
                    <button onClick={handleSelectFolder} className="btn-secondary shrink-0">
                      <FolderOpen className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs text-txt-muted mt-1">
                    音声ファイルをコピーして管理するフォルダです。変更後は再起動が必要な場合があります。
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-txt-secondary block mb-2">
                    再生設定
                  </label>
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <div
                      onClick={() => setContinuousPlay(!continuousPlay)}
                      className={`w-10 h-5.5 rounded-full relative transition-colors ${
                        continuousPlay ? 'bg-accent' : 'bg-bg-border'
                      }`}
                      style={{ height: 22 }}
                    >
                      <div
                        className={`absolute top-0.5 w-4.5 h-4.5 rounded-full bg-white shadow-sm transition-transform ${
                          continuousPlay ? 'translate-x-5' : 'translate-x-0.5'
                        }`}
                        style={{ width: 18, height: 18 }}
                      />
                    </div>
                    <span className="text-sm text-txt-secondary">連続再生</span>
                  </label>
                </div>

                <div className="pt-2">
                  <button
                    onClick={handleSaveGeneral}
                    disabled={isSaving}
                    className="btn-primary"
                  >
                    {saveSuccess ? (
                      <>
                        <Check className="w-4 h-4" />
                        保存しました
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        {isSaving ? '保存中...' : '設定を保存'}
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Characters */}
            {activeTab === 'characters' && (
              <div className="space-y-4">
                <p className="text-sm text-txt-muted">
                  キャラクター辞書を編集します。ファイル取り込み時の自動判定に使用されます。
                </p>

                {/* Add new */}
                <div className="bg-bg-elevated rounded-lg p-3 space-y-2">
                  <p className="text-xs font-medium text-txt-muted uppercase tracking-wider">
                    新規追加
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="キャラクター名"
                      value={newCharName}
                      onChange={(e) => setNewCharName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddCharacter()}
                      className="input flex-1 text-sm"
                    />
                    <input
                      type="color"
                      value={newCharColor}
                      onChange={(e) => setNewCharColor(e.target.value)}
                      className="w-9 h-9 rounded cursor-pointer bg-transparent border border-bg-border"
                    />
                    <button onClick={handleAddCharacter} className="btn-primary px-3">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="別名（カンマ区切り例: ゆかり, yukari）"
                    value={newCharAliases}
                    onChange={(e) => setNewCharAliases(e.target.value)}
                    className="input text-sm"
                  />
                </div>

                {/* List */}
                <div className="space-y-1">
                  {characters.map((char) => (
                    <CharacterRow
                      key={char.id}
                      char={char}
                      isEditing={editingCharId === char.id}
                      editValues={charEditValues[char.id]}
                      onStartEdit={() => {
                        setEditingCharId(char.id)
                        setCharEditValues((p) => ({
                          ...p,
                          [char.id]: { name: char.name, color: char.color ?? '#9d63f5' }
                        }))
                      }}
                      onChangeEdit={(vals) =>
                        setCharEditValues((p) => ({ ...p, [char.id]: vals }))
                      }
                      onSaveEdit={() => handleUpdateCharacter(char.id)}
                      onCancelEdit={() => setEditingCharId(null)}
                      onDelete={() => handleDeleteCharacter(char.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Shortcuts */}
            {activeTab === 'shortcuts' && (
              <div className="space-y-4">
                <p className="text-sm text-txt-muted">
                  キーボードショートカットの一覧です。入力フィールドにフォーカスがある場合は動作しません。
                </p>
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-bg-border">
                      <th className="text-left text-xs text-txt-muted uppercase tracking-wider pb-2 pr-4">キー</th>
                      <th className="text-left text-xs text-txt-muted uppercase tracking-wider pb-2">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-bg-border">
                    {[
                      { key: 'Space', desc: '再生 / 停止' },
                      { key: '←', desc: '前のファイルへ' },
                      { key: '→', desc: '次のファイルへ' },
                      { key: 'Del', desc: '選択ファイルを削除' },
                      { key: 'Ctrl + A', desc: '表示中のファイルをすべて選択' },
                      { key: 'Ctrl + B', desc: 'お気に入り登録 / 解除' },
                      { key: 'Esc', desc: '選択を解除' },
                    ].map(({ key, desc }) => (
                      <tr key={key} className="group hover:bg-bg-elevated transition-colors">
                        <td className="py-2 pr-4">
                          <kbd className="inline-flex items-center px-2 py-0.5 rounded bg-bg-elevated border border-bg-border text-xs font-mono text-txt-secondary">
                            {key}
                          </kbd>
                        </td>
                        <td className="py-2 text-txt-secondary">{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Bug Report */}
            {activeTab === 'bugreport' && (
              <div className="space-y-5">
                <div className="flex items-center gap-2">
                  <Bug className="w-5 h-5 text-txt-muted" />
                  <h3 className="text-sm font-medium text-txt-primary">バグ報告・フィードバック</h3>
                </div>
                <p className="text-sm text-txt-muted leading-relaxed">
                  不具合や改善要望は以下のフォームからご報告ください。
                  皆さまのフィードバックが VOICELab. の改善に役立ちます。
                </p>
                <div className="bg-bg-elevated rounded-lg p-4 space-y-3">
                  <p className="text-xs text-txt-muted">報告フォーム（Notion）</p>
                  <p className="text-xs text-txt-secondary break-all font-mono">
                    https://ionian-gallimimus-e47.notion.site/32b8c5bf8aa481978f37e470a25e1e01
                  </p>
                  <button
                    onClick={() => window.api.openExternal('https://ionian-gallimimus-e47.notion.site/32b8c5bf8aa481978f37e470a25e1e01')}
                    className="btn-primary gap-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    フォームを開く
                  </button>
                </div>
                <div className="bg-bg-elevated rounded-lg p-4 space-y-2">
                  <p className="text-xs font-medium text-txt-muted uppercase tracking-wider">報告時のお願い</p>
                  <ul className="text-sm text-txt-secondary space-y-1 list-disc list-inside">
                    <li>発生状況・手順をできるだけ詳しく記載してください</li>
                    <li>スクリーンショットがあると助かります</li>
                    <li>OSのバージョンや環境もご記入ください</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Tags */}
            {activeTab === 'tags' && (
              <div className="space-y-4">
                {/* Add new */}
                <div className="bg-bg-elevated rounded-lg p-3 space-y-2">
                  <p className="text-xs font-medium text-txt-muted uppercase tracking-wider">
                    新規タグ
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="タグ名"
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                      className="input flex-1 text-sm"
                    />
                    <input
                      type="color"
                      value={newTagColor}
                      onChange={(e) => setNewTagColor(e.target.value)}
                      className="w-9 h-9 rounded cursor-pointer bg-transparent border border-bg-border"
                    />
                    <button onClick={handleAddTag} className="btn-primary px-3">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* List */}
                <div className="space-y-1">
                  {tags.map((tag) => (
                    <div
                      key={tag.id}
                      className="flex items-center gap-2 p-2 rounded-lg hover:bg-bg-elevated transition-colors"
                    >
                      {tagEditValues[tag.id] ? (
                        <>
                          <input
                            type="color"
                            value={tagEditValues[tag.id].color}
                            onChange={(e) =>
                              setTagEditValues((p) => ({
                                ...p,
                                [tag.id]: { ...p[tag.id], color: e.target.value }
                              }))
                            }
                            className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
                          />
                          <input
                            type="text"
                            value={tagEditValues[tag.id].name}
                            onChange={(e) =>
                              setTagEditValues((p) => ({
                                ...p,
                                [tag.id]: { ...p[tag.id], name: e.target.value }
                              }))
                            }
                            className="input flex-1 text-sm h-7"
                          />
                          <button onClick={() => handleUpdateTag(tag.id)} className="btn-ghost p-1 text-success">
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() =>
                              setTagEditValues((p) => {
                                const n = { ...p }; delete n[tag.id]; return n
                              })
                            }
                            className="btn-ghost p-1 text-txt-muted"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <>
                          <div
                            className="w-3 h-3 rounded-full shrink-0 cursor-pointer"
                            style={{ backgroundColor: tag.color }}
                            onClick={() =>
                              setTagEditValues((p) => ({
                                ...p,
                                [tag.id]: { name: tag.name, color: tag.color }
                              }))
                            }
                          />
                          <span className="flex-1 text-sm text-txt-secondary">{tag.name}</span>
                          <span className="text-xs text-txt-muted">{tag.use_count} 件</span>
                          <button
                            onClick={() =>
                              setTagEditValues((p) => ({
                                ...p,
                                [tag.id]: { name: tag.name, color: tag.color }
                              }))
                            }
                            className="btn-ghost p-1 text-txt-muted opacity-0 group-hover:opacity-100"
                          >
                          </button>
                          <button
                            onClick={() => handleDeleteTag(tag.id)}
                            className="btn-ghost p-1 text-txt-muted hover:text-danger"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function CharacterRow({
  char,
  isEditing,
  editValues,
  onStartEdit,
  onChangeEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete
}: {
  char: Character
  isEditing: boolean
  editValues?: { name: string; color: string }
  onStartEdit: () => void
  onChangeEdit: (vals: { name: string; color: string }) => void
  onSaveEdit: () => void
  onCancelEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-bg-elevated group transition-colors">
      {isEditing && editValues ? (
        <>
          <input
            type="color"
            value={editValues.color}
            onChange={(e) => onChangeEdit({ ...editValues, color: e.target.value })}
            className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
          />
          <input
            type="text"
            value={editValues.name}
            onChange={(e) => onChangeEdit({ ...editValues, name: e.target.value })}
            className="input flex-1 text-sm h-7"
          />
          <button onClick={onSaveEdit} className="btn-ghost p-1 text-success">
            <Check className="w-3.5 h-3.5" />
          </button>
          <button onClick={onCancelEdit} className="btn-ghost p-1 text-txt-muted">
            <X className="w-3.5 h-3.5" />
          </button>
        </>
      ) : (
        <>
          <div
            className="w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: char.color ?? '#9d63f5' }}
          />
          <span
            className="flex-1 text-sm text-txt-secondary cursor-pointer hover:text-txt-primary"
            onClick={onStartEdit}
          >
            {char.name}
          </span>
          <span className="text-xs text-txt-muted">{char.voice_count} 件</span>
          <button
            onClick={onDelete}
            className="btn-ghost p-1 text-txt-muted hover:text-danger opacity-0 group-hover:opacity-100"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </>
      )}
    </div>
  )
}
