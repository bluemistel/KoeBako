import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

export type VoiceFilter = {
  query?: string
  category?: 'all' | 'commercial' | 'original'
  characterIds?: number[]
  tagIds?: string
  tagMode?: 'AND' | 'OR'
  isFavorite?: boolean
  sortBy?: string
  sortOrder?: 'ASC' | 'DESC'
  limit?: number
  offset?: number
}

const api = {
  // Voices
  queryVoices: (filter: VoiceFilter) => ipcRenderer.invoke('voices:query', filter),
  getVoiceById: (id: number) => ipcRenderer.invoke('voices:getById', id),
  updateVoice: (id: number, data: object) => ipcRenderer.invoke('voices:update', id, data),
  deleteVoice: (id: number) => ipcRenderer.invoke('voices:delete', id),
  incrementPlayCount: (id: number) => ipcRenderer.invoke('voices:incrementPlayCount', id),
  toggleFavorite: (id: number) => ipcRenderer.invoke('voices:toggleFavorite', id),

  // Import
  analyzeFiles: (filePaths: string[]) => ipcRenderer.invoke('import:analyzeFiles', filePaths),
  executeImport: (
    files: object[],
    category: string
  ) => ipcRenderer.invoke('import:execute', files, category),

  // Characters
  getCharacters: () => ipcRenderer.invoke('characters:getAll'),
  insertCharacter: (name: string, aliases?: string, color?: string) =>
    ipcRenderer.invoke('characters:insert', name, aliases, color),
  updateCharacter: (id: number, data: object) =>
    ipcRenderer.invoke('characters:update', id, data),
  deleteCharacter: (id: number) => ipcRenderer.invoke('characters:delete', id),

  // Tags
  getTags: () => ipcRenderer.invoke('tags:getAll'),
  insertTag: (name: string, color?: string) => ipcRenderer.invoke('tags:insert', name, color),
  updateTag: (id: number, data: object) => ipcRenderer.invoke('tags:update', id, data),
  deleteTag: (id: number) => ipcRenderer.invoke('tags:delete', id),
  setVoiceTags: (voiceId: number, tagIds: number[]) =>
    ipcRenderer.invoke('tags:setVoiceTags', voiceId, tagIds),
  bulkAddTags: (voiceIds: number[], tagIds: number[]) =>
    ipcRenderer.invoke('tags:bulkAdd', voiceIds, tagIds),
  bulkSetFavorite: (voiceIds: number[], value: number) =>
    ipcRenderer.invoke('voices:bulkSetFavorite', voiceIds, value),
  bulkDeleteVoices: (voiceIds: number[]) =>
    ipcRenderer.invoke('voices:bulkDelete', voiceIds),

  // User Categories
  getUserCategories: () => ipcRenderer.invoke('userCategories:getAll'),
  insertUserCategory: (name: string, color?: string) =>
    ipcRenderer.invoke('userCategories:insert', name, color),
  updateUserCategory: (id: number, data: object) =>
    ipcRenderer.invoke('userCategories:update', id, data),
  deleteUserCategory: (id: number) => ipcRenderer.invoke('userCategories:delete', id),

  // Softwares
  getSoftwares: () => ipcRenderer.invoke('softwares:getAll'),

  // Settings
  getSettings: () => ipcRenderer.invoke('settings:getAll'),
  setSetting: (key: string, value: string) => ipcRenderer.invoke('settings:set', key, value),
  setSettings: (data: Record<string, string>) =>
    ipcRenderer.invoke('settings:setMultiple', data),

  // File system
  selectFolder: () => ipcRenderer.invoke('fs:selectFolder'),
  openInExplorer: (filePath: string) => ipcRenderer.invoke('fs:openInExplorer', filePath),
  getAbsolutePath: (relPath: string) => ipcRenderer.invoke('fs:getAbsolutePath', relPath),
  exportFiles: (voiceIds: number[]) => ipcRenderer.invoke('fs:exportFiles', voiceIds),
  getManagedFolder: () => ipcRenderer.invoke('fs:getManagedFolder'),
  moveManagedFolder: (oldFolder: string, newFolder: string) =>
    ipcRenderer.invoke('fs:moveManagedFolder', oldFolder, newFolder),
  countManagedFiles: (folder: string) => ipcRenderer.invoke('fs:countManagedFiles', folder),
  onMoveProgress: (cb: (progress: { done: number; total: number }) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, progress: { done: number; total: number }) => cb(progress)
    ipcRenderer.on('fs:moveProgress', handler)
    return () => ipcRenderer.removeListener('fs:moveProgress', handler)
  },

  // Native drag — sendSync ensures startDrag is called within the OS drag-event window
  startNativeDrag: (relPath: string) => ipcRenderer.sendSync('nativeDrag:start', relPath),

  // Shell
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),

  // App
  getVersion: () => ipcRenderer.invoke('app:getVersion'),

  // Window controls
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),
  onMaximizedChange: (callback: (isMaximized: boolean) => void) => {
    ipcRenderer.on('window:maximized-change', (_e, val) => callback(val))
    return () => ipcRenderer.removeAllListeners('window:maximized-change')
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore
  window.electron = electronAPI
  // @ts-ignore
  window.api = api
}

export type API = typeof api
