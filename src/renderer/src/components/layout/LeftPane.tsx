import { useState, useRef, useEffect } from 'react'
import { Users, Tag, ChevronDown, ChevronRight, Radio, Music, Plus, Check, X, Trash2, Pencil } from 'lucide-react'
import { useStore } from '../../store'
import { UserCategory } from '../../types'

type Section = 'characters' | 'tags'

export default function LeftPane() {
  const {
    characters,
    tags,
    userCategories,
    filterCategory,
    filterCharacterIds,
    filterTagIds,
    setFilterCategory,
    toggleCharacterFilter,
    toggleTagFilter,
    voices,
    loadUserCategories
  } = useStore()

  const [collapsed, setCollapsed] = useState<Record<Section, boolean>>({
    characters: false,
    tags: false
  })

  // New category input state
  const [showNewCatInput, setShowNewCatInput] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [newCatColor, setNewCatColor] = useState('#6366f1')
  const newCatInputRef = useRef<HTMLInputElement>(null)

  // Edit state
  const [editingCatId, setEditingCatId] = useState<number | null>(null)
  const [editCatName, setEditCatName] = useState('')
  const [editCatColor, setEditCatColor] = useState('')

  useEffect(() => {
    if (showNewCatInput) newCatInputRef.current?.focus()
  }, [showNewCatInput])

  const toggleSection = (section: Section) => {
    setCollapsed((s) => ({ ...s, [section]: !s[section] }))
  }

  const commercialCount = voices.filter((v) => v.category === 'commercial').length
  const originalCount = voices.filter((v) => v.category === 'original').length
  const categoryCount = (name: string) => voices.filter((v) => v.category === name).length

  const handleAddCategory = async () => {
    const name = newCatName.trim()
    if (!name) return
    await window.api.insertUserCategory(name, newCatColor)
    await loadUserCategories()
    setNewCatName('')
    setNewCatColor('#6366f1')
    setShowNewCatInput(false)
  }

  const handleDeleteCategory = async (id: number) => {
    await window.api.deleteUserCategory(id)
    await loadUserCategories()
    // If this category was active, reset to 'all'
    const cat = userCategories.find((c) => c.id === id)
    if (cat && filterCategory === cat.name) setFilterCategory('all')
  }

  const handleStartEdit = (cat: UserCategory) => {
    setEditingCatId(cat.id)
    setEditCatName(cat.name)
    setEditCatColor(cat.color)
  }

  const handleSaveEdit = async () => {
    if (editingCatId === null) return
    await window.api.updateUserCategory(editingCatId, { name: editCatName.trim(), color: editCatColor })
    await loadUserCategories()
    setEditingCatId(null)
  }

  return (
    <div className="flex flex-col h-full bg-bg-surface border-r border-bg-border w-52 shrink-0">
      {/* Category tabs */}
      <div className="p-2 border-b border-bg-border space-y-0.5">
        {/* Header row with + button */}
        <div className="flex items-center px-1 mb-1">
          <span className="flex-1 text-xs text-txt-muted font-medium uppercase tracking-wider">
            カテゴリ
          </span>
          <button
            onClick={() => setShowNewCatInput(!showNewCatInput)}
            className="p-0.5 rounded hover:bg-bg-elevated text-txt-muted hover:text-txt-primary transition-colors"
            title="カテゴリを追加"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* New category input */}
        {showNewCatInput && (
          <div className="flex items-center gap-1 px-1 pb-1">
            <input
              ref={newCatInputRef}
              type="text"
              placeholder="カテゴリ名..."
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddCategory()
                if (e.key === 'Escape') { setShowNewCatInput(false); setNewCatName('') }
              }}
              className="input flex-1 h-6 text-xs px-2"
            />
            <input
              type="color"
              value={newCatColor}
              onChange={(e) => setNewCatColor(e.target.value)}
              className="w-6 h-6 rounded cursor-pointer bg-transparent border border-bg-border shrink-0"
            />
            <button
              onClick={handleAddCategory}
              disabled={!newCatName.trim()}
              className="p-1 rounded hover:bg-bg-elevated text-txt-muted hover:text-success disabled:opacity-40"
            >
              <Check className="w-3 h-3" />
            </button>
            <button
              onClick={() => { setShowNewCatInput(false); setNewCatName('') }}
              className="p-1 rounded hover:bg-bg-elevated text-txt-muted hover:text-danger"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Built-in categories */}
        <CategoryItem
          label="すべて"
          count={voices.length}
          icon={<Music className="w-3.5 h-3.5" />}
          active={filterCategory === 'all'}
          onClick={() => setFilterCategory('all')}
          color="text-txt-secondary"
        />
        <CategoryItem
          label="音声素材製品"
          count={commercialCount}
          icon={<div className="w-2.5 h-2.5 rounded-full bg-commercial" />}
          active={filterCategory === 'commercial'}
          onClick={() => setFilterCategory('commercial')}
          color="text-commercial"
        />
        <CategoryItem
          label="自作音声"
          count={originalCount}
          icon={<div className="w-2.5 h-2.5 rounded-full bg-original" />}
          active={filterCategory === 'original'}
          onClick={() => setFilterCategory('original')}
          color="text-original"
        />

        {/* User-defined categories */}
        {userCategories.map((cat) => (
          <div key={cat.id} className="group/catrow relative">
            {editingCatId === cat.id ? (
              <div className="flex items-center gap-1 px-2 py-1">
                <input
                  autoFocus
                  type="text"
                  value={editCatName}
                  onChange={(e) => setEditCatName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveEdit()
                    if (e.key === 'Escape') setEditingCatId(null)
                  }}
                  className="input flex-1 h-5 text-xs px-1"
                />
                <input
                  type="color"
                  value={editCatColor}
                  onChange={(e) => setEditCatColor(e.target.value)}
                  className="w-5 h-5 rounded cursor-pointer bg-transparent border-0 shrink-0"
                />
                <button onClick={handleSaveEdit} className="p-0.5 text-success hover:opacity-80">
                  <Check className="w-3 h-3" />
                </button>
                <button onClick={() => setEditingCatId(null)} className="p-0.5 text-txt-muted hover:opacity-80">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <CategoryItem
                label={cat.name}
                count={categoryCount(cat.name)}
                icon={<div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />}
                active={filterCategory === cat.name}
                onClick={() => setFilterCategory(cat.name)}
                color=""
                activeColor={cat.color}
                actions={
                  <div className="hidden group-hover/catrow:flex items-center gap-0.5 ml-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleStartEdit(cat) }}
                      className="p-0.5 rounded text-txt-muted hover:text-txt-primary"
                    >
                      <Pencil className="w-2.5 h-2.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteCategory(cat.id) }}
                      className="p-0.5 rounded text-txt-muted hover:text-danger"
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  </div>
                }
              />
            )}
          </div>
        ))}
      </div>

      {/* Scrollable filter area */}
      <div className="flex-1 overflow-y-auto py-2 space-y-0.5">
        {/* Characters section */}
        <SectionHeader
          icon={<Users className="w-3.5 h-3.5" />}
          label="キャラクター"
          collapsed={collapsed.characters}
          onToggle={() => toggleSection('characters')}
          badge={filterCharacterIds.length || undefined}
        />

        {!collapsed.characters && (
          <div className="space-y-0.5 px-1">
            {characters.length === 0 ? (
              <p className="text-xs text-txt-muted px-3 py-1">キャラなし</p>
            ) : (
              characters
                .filter((c) => c.voice_count > 0 || filterCharacterIds.includes(c.id))
                .map((char) => (
                  <FilterItem
                    key={char.id}
                    label={char.name}
                    count={char.voice_count}
                    checked={filterCharacterIds.includes(char.id)}
                    color={char.color ?? '#6366f1'}
                    onChange={() => toggleCharacterFilter(char.id)}
                  />
                ))
            )}
          </div>
        )}

        <div className="h-px bg-bg-border mx-3 my-2" />

        {/* Tags section */}
        <SectionHeader
          icon={<Tag className="w-3.5 h-3.5" />}
          label="タグ"
          collapsed={collapsed.tags}
          onToggle={() => toggleSection('tags')}
          badge={filterTagIds.length || undefined}
        />

        {!collapsed.tags && (
          <div className="px-1 space-y-0.5">
            {tags.length === 0 ? (
              <p className="text-xs text-txt-muted px-3 py-1">タグなし</p>
            ) : (
              tags
                .filter((t) => t.use_count > 0)
                .map((tag) => (
                  <FilterItem
                    key={tag.id}
                    label={tag.name}
                    count={tag.use_count}
                    checked={filterTagIds.includes(tag.id)}
                    color={tag.color}
                    onChange={() => toggleTagFilter(tag.id)}
                  />
                ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function CategoryItem({
  label,
  count,
  icon,
  active,
  onClick,
  color,
  activeColor,
  actions
}: {
  label: string
  count: number
  icon: React.ReactNode
  active: boolean
  onClick: () => void
  color: string
  activeColor?: string
  actions?: React.ReactNode
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick() }}
      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm transition-all cursor-pointer ${
        active ? 'bg-accent/20 text-accent-light' : `text-txt-secondary hover:bg-bg-elevated hover:text-txt-primary`
      }`}
      style={active && activeColor ? { backgroundColor: `${activeColor}22`, color: activeColor } : {}}
    >
      <span className={active ? '' : color}>{icon}</span>
      <span className="flex-1 text-left text-xs truncate">{label}</span>
      {actions}
      <span className="text-xs text-txt-muted shrink-0">{count}</span>
    </div>
  )
}

function SectionHeader({
  icon,
  label,
  collapsed,
  onToggle,
  badge
}: {
  icon: React.ReactNode
  label: string
  collapsed: boolean
  onToggle: () => void
  badge?: number
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-1.5 px-3 py-1 text-xs text-txt-muted hover:text-txt-secondary transition-colors"
    >
      {icon}
      <span className="flex-1 text-left font-medium uppercase tracking-wider text-xs">{label}</span>
      {badge ? (
        <span className="px-1.5 py-0.5 rounded-full bg-accent/30 text-accent-light text-xs">
          {badge}
        </span>
      ) : null}
      {collapsed ? (
        <ChevronRight className="w-3 h-3" />
      ) : (
        <ChevronDown className="w-3 h-3" />
      )}
    </button>
  )
}

function FilterItem({
  label,
  count,
  checked,
  color,
  onChange
}: {
  label: string
  count: number
  checked: boolean
  color: string
  onChange: () => void
}) {
  return (
    <label className="relative flex items-center gap-2 px-2.5 py-1 rounded-md cursor-pointer hover:bg-bg-elevated group transition-colors">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="sr-only"
      />
      <div
        className={`w-3 h-3 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
          checked ? 'border-transparent' : 'border-bg-border'
        }`}
        style={checked ? { backgroundColor: color, borderColor: color } : {}}
      >
        {checked && (
          <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 12 12">
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <div
        className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: color }}
      />
      <span className="flex-1 text-xs text-txt-secondary group-hover:text-txt-primary truncate">
        {label}
      </span>
      <span className="text-xs text-txt-muted">{count}</span>
    </label>
  )
}
