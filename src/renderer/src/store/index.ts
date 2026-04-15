import { create } from 'zustand'
import {
  Voice,
  Character,
  Tag,
  Software,
  Settings,
  UserCategory,
  ImportFileInfo,
  parseVoiceTags,
  SortBy,
  SortOrder,
  ViewMode
} from '../types'

declare global {
  interface Window {
    api: {
      queryVoices: (filter: object) => Promise<{ rows: Voice[]; total: number }>
      getVoiceById: (id: number) => Promise<Voice | null>
      updateVoice: (id: number, data: object) => Promise<Voice>
      deleteVoice: (id: number) => Promise<void>
      incrementPlayCount: (id: number) => Promise<void>
      toggleFavorite: (id: number) => Promise<number>
      analyzeFiles: (
        paths: string[]
      ) => Promise<{
        files: Array<{
          sourcePath: string
          fileName: string
          suggestedCharacter: string | null
          size: number
          folderChain: string[]
          droppedRoot: string
        }>
        allFolderNames: string[]
      }>
      executeImport: (
        files: object[],
        category: string
      ) => Promise<{ success: number; errors: string[] }>
      getCharacters: () => Promise<Character[]>
      insertCharacter: (name: string, aliases?: string, color?: string) => Promise<Character[]>
      updateCharacter: (id: number, data: object) => Promise<Character[]>
      deleteCharacter: (id: number) => Promise<Character[]>
      getTags: () => Promise<Tag[]>
      insertTag: (name: string, color?: string) => Promise<Tag[]>
      updateTag: (id: number, data: object) => Promise<Tag[]>
      deleteTag: (id: number) => Promise<Tag[]>
      setVoiceTags: (voiceId: number, tagIds: number[]) => Promise<void>
      bulkAddTags: (voiceIds: number[], tagIds: number[]) => Promise<void>
      bulkSetFavorite: (voiceIds: number[], value: number) => Promise<void>
      bulkDeleteVoices: (voiceIds: number[]) => Promise<void>
      getUserCategories: () => Promise<UserCategory[]>
      insertUserCategory: (name: string, color?: string) => Promise<UserCategory[]>
      updateUserCategory: (id: number, data: object) => Promise<UserCategory[]>
      deleteUserCategory: (id: number) => Promise<UserCategory[]>
      getSoftwares: () => Promise<Software[]>
      getSettings: () => Promise<Settings>
      setSetting: (key: string, value: string) => Promise<void>
      setSettings: (data: Record<string, string>) => Promise<void>
      selectFolder: () => Promise<string | null>
      openInExplorer: (path: string) => Promise<void>
      getAbsolutePath: (relPath: string) => Promise<string>
      exportFiles: (ids: number[]) => Promise<{ success: number; errors: string[] }>
      getManagedFolder: () => Promise<string>
      startNativeDrag: (relPath: string) => void
      openExternal: (url: string) => Promise<void>
      getVersion: () => Promise<string>
      minimizeWindow: () => void
      maximizeWindow: () => void
      closeWindow: () => void
      onMaximizedChange: (cb: (v: boolean) => void) => () => void
    }
  }
}

interface AppState {
  // Data
  voices: Voice[]
  totalVoices: number
  characters: Character[]
  tags: Tag[]
  softwares: Software[]
  userCategories: UserCategory[]
  settings: Settings | null

  // Selection
  selectedVoiceId: number | null
  selectedVoiceIds: number[]

  // Filter
  filterCategory: string  // 'all' | 'commercial' | 'original' | custom category name
  filterCharacterIds: number[]
  filterTagIds: number[]
  filterTagMode: 'AND' | 'OR'
  filterFavoriteOnly: boolean
  searchQuery: string
  sortBy: SortBy
  sortOrder: SortOrder

  // UI
  viewMode: ViewMode
  showImportDialog: boolean
  showSettingsModal: boolean
  settingsInitialTab: 'general' | 'characters' | 'tags' | 'shortcuts' | null
  theme: 'dark' | 'light'
  importPendingFiles: ImportFileInfo[]
  importFolderNames: string[]
  isLoading: boolean
  isMaximized: boolean

  // Player
  currentVoice: Voice | null
  isPlaying: boolean
  currentTime: number
  playerDuration: number
  volume: number

  // Actions
  loadVoices: () => Promise<void>
  loadCharacters: () => Promise<void>
  loadTags: () => Promise<void>
  loadSoftwares: () => Promise<void>
  loadUserCategories: () => Promise<void>
  loadSettings: () => Promise<void>
  loadAll: () => Promise<void>

  setSelectedVoice: (id: number | null) => void
  toggleVoiceSelection: (id: number) => void
  setRangeSelection: (ids: number[]) => void
  clearSelection: () => void

  setFilterCategory: (cat: string) => void
  toggleCharacterFilter: (id: number) => void
  toggleTagFilter: (id: number) => void
  setSearchQuery: (q: string) => void
  setSortBy: (s: SortBy) => void
  setSortOrder: (o: SortOrder) => void
  setFilterFavoriteOnly: (v: boolean) => void
  clearFilters: () => void

  setViewMode: (m: ViewMode) => void
  setShowImportDialog: (v: boolean) => void
  setShowSettingsModal: (v: boolean) => void
  openSettingsOnTab: (tab: 'general' | 'characters' | 'tags' | 'shortcuts') => void
  setTheme: (t: 'dark' | 'light') => void
  setImportPendingFiles: (files: ImportFileInfo[], folderNames?: string[]) => void

  playVoice: (voice: Voice) => void
  setIsPlaying: (v: boolean) => void
  setCurrentTime: (t: number) => void
  setPlayerDuration: (d: number) => void
  setVolume: (v: number) => void
  playNext: () => void
  playPrev: () => void

  updateVoiceInList: (id: number, updates: Partial<Voice>) => void
  removeVoiceFromList: (id: number) => void

  setIsMaximized: (v: boolean) => void
}

export const useStore = create<AppState>((set, get) => ({
  voices: [],
  totalVoices: 0,
  characters: [],
  tags: [],
  softwares: [],
  userCategories: [],
  settings: null,

  selectedVoiceId: null,
  selectedVoiceIds: [],

  filterCategory: 'all',
  filterCharacterIds: [],
  filterTagIds: [],
  filterTagMode: 'OR',
  filterFavoriteOnly: false,
  searchQuery: '',
  sortBy: 'created_at',
  sortOrder: 'DESC',

  viewMode: 'list',
  showImportDialog: false,
  showSettingsModal: false,
  settingsInitialTab: null,
  theme: 'dark',
  importPendingFiles: [],
  importFolderNames: [],
  isLoading: false,
  isMaximized: false,

  currentVoice: null,
  isPlaying: false,
  currentTime: 0,
  playerDuration: 0,
  volume: 0.8,

  loadVoices: async () => {
    const s = get()
    set({ isLoading: true })
    try {
      const filter = {
        query: s.searchQuery || undefined,
        category: s.filterCategory === 'all' ? undefined : s.filterCategory,
        characterIds: s.filterCharacterIds.length ? s.filterCharacterIds : undefined,
        tagIds: s.filterTagIds.length ? s.filterTagIds.join(',') : undefined,
        tagMode: s.filterTagMode,
        isFavorite: s.filterFavoriteOnly || undefined,
        sortBy: s.sortBy,
        sortOrder: s.sortOrder,
        limit: 500
      }
      const { rows, total } = await window.api.queryVoices(filter)
      const voices = rows.map((v) => ({ ...v, parsedTags: parseVoiceTags(v.tags) }))
      set({ voices, totalVoices: total })
    } finally {
      set({ isLoading: false })
    }
  },

  loadCharacters: async () => {
    const chars = await window.api.getCharacters()
    set({ characters: chars })
  },

  loadTags: async () => {
    const tags = await window.api.getTags()
    // use_count が 0 になったタグをフィルターから除外
    const zeroIds = new Set(tags.filter((t) => t.use_count === 0).map((t) => t.id))
    const prevFilterTagIds = get().filterTagIds
    const newFilterTagIds = prevFilterTagIds.filter((id) => !zeroIds.has(id))
    const filterChanged = newFilterTagIds.length !== prevFilterTagIds.length
    set({ tags, filterTagIds: newFilterTagIds })
    if (filterChanged) {
      setTimeout(() => get().loadVoices(), 0)
    }
  },

  loadSoftwares: async () => {
    const softwares = await window.api.getSoftwares()
    set({ softwares })
  },

  loadUserCategories: async () => {
    const userCategories = await window.api.getUserCategories()
    set({ userCategories })
  },

  loadSettings: async () => {
    const settings = await window.api.getSettings()
    const theme = (settings.theme === 'light' ? 'light' : 'dark') as 'dark' | 'light'
    set({ settings, volume: parseFloat(settings.volume || '0.8'), theme })
  },

  loadAll: async () => {
    await Promise.all([
      get().loadSettings(),
      get().loadCharacters(),
      get().loadTags(),
      get().loadSoftwares(),
      get().loadUserCategories()
    ])
    await get().loadVoices()
  },

  setSelectedVoice: (id) => set({ selectedVoiceId: id }),

  toggleVoiceSelection: (id) => {
    const ids = get().selectedVoiceIds
    if (ids.includes(id)) {
      set({ selectedVoiceIds: ids.filter((i) => i !== id) })
    } else {
      set({ selectedVoiceIds: [...ids, id] })
    }
  },

  setRangeSelection: (ids) => set({ selectedVoiceIds: ids }),

  clearSelection: () => set({ selectedVoiceIds: [] }),

  setFilterCategory: (cat) => {
    set({ filterCategory: cat, filterCharacterIds: [], filterTagIds: [] })
    setTimeout(() => get().loadVoices(), 0)
  },

  toggleCharacterFilter: (id) => {
    const ids = get().filterCharacterIds
    const next = ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id]
    set({ filterCharacterIds: next })
    setTimeout(() => get().loadVoices(), 0)
  },

  toggleTagFilter: (id) => {
    const ids = get().filterTagIds
    const next = ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id]
    set({ filterTagIds: next })
    setTimeout(() => get().loadVoices(), 0)
  },

  setSearchQuery: (q) => {
    set({ searchQuery: q })
    setTimeout(() => get().loadVoices(), 0)
  },

  setSortBy: (s) => {
    set({ sortBy: s })
    setTimeout(() => get().loadVoices(), 0)
  },

  setSortOrder: (o) => {
    set({ sortOrder: o })
    setTimeout(() => get().loadVoices(), 0)
  },

  setFilterFavoriteOnly: (v) => {
    set({ filterFavoriteOnly: v })
    setTimeout(() => get().loadVoices(), 0)
  },

  clearFilters: () => {
    set({
      filterCharacterIds: [],
      filterTagIds: [],
      filterFavoriteOnly: false,
      searchQuery: ''
    })
    setTimeout(() => get().loadVoices(), 0)
  },

  setViewMode: (m) => set({ viewMode: m }),
  setShowImportDialog: (v) => set({ showImportDialog: v }),
  setShowSettingsModal: (v) => set({ showSettingsModal: v, settingsInitialTab: null }),
  openSettingsOnTab: (tab: 'general' | 'characters' | 'tags' | 'shortcuts') => set({ showSettingsModal: true, settingsInitialTab: tab }),
  setTheme: (t) => {
    set({ theme: t })
    window.api.setSetting('theme', t)
  },
  setImportPendingFiles: (files, folderNames = []) =>
    set({ importPendingFiles: files, importFolderNames: folderNames }),

  playVoice: (voice) => {
    set({ currentVoice: voice, isPlaying: true, currentTime: 0 })
    window.api.incrementPlayCount(voice.id)
  },

  setIsPlaying: (v) => set({ isPlaying: v }),
  setCurrentTime: (t) => set({ currentTime: t }),
  setPlayerDuration: (d) => set({ playerDuration: d }),

  setVolume: (v) => {
    set({ volume: v })
    window.api.setSetting('volume', String(v))
  },

  playNext: () => {
    const { voices, currentVoice } = get()
    if (!currentVoice || voices.length === 0) return
    const idx = voices.findIndex((v) => v.id === currentVoice.id)
    const next = voices[idx + 1]
    if (next) get().playVoice(next)
  },

  playPrev: () => {
    const { voices, currentVoice } = get()
    if (!currentVoice || voices.length === 0) return
    const idx = voices.findIndex((v) => v.id === currentVoice.id)
    const prev = voices[idx - 1]
    if (prev) get().playVoice(prev)
  },

  updateVoiceInList: (id, updates) => {
    set((s) => ({
      voices: s.voices.map((v) =>
        v.id === id ? { ...v, ...updates, parsedTags: parseVoiceTags(updates.tags ?? v.tags) } : v
      ),
      currentVoice:
        s.currentVoice?.id === id ? { ...s.currentVoice, ...updates } : s.currentVoice
    }))
  },

  removeVoiceFromList: (id) => {
    set((s) => ({
      voices: s.voices.filter((v) => v.id !== id),
      selectedVoiceId: s.selectedVoiceId === id ? null : s.selectedVoiceId,
      currentVoice: s.currentVoice?.id === id ? null : s.currentVoice
    }))
  },

  setIsMaximized: (v) => set({ isMaximized: v })
}))
