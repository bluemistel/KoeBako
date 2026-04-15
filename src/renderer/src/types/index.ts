export type Category = string  // 'commercial' | 'original' | user-defined name

export interface UserCategory {
  id: number
  name: string
  color: string
}

export interface VoiceTag {
  id: number
  name: string
  color: string
}

export interface Voice {
  id: number
  file_path: string
  original_name: string
  category: string
  character_id: number | null
  character_name: string | null
  character_color: string | null
  software_id: number | null
  software_name: string | null
  duration_sec: number | null
  sample_rate: number | null
  bit_depth: number | null
  file_size: number | null
  memo: string
  is_favorite: number
  play_count: number
  created_at: string
  updated_at: string
  tags: string | null
  parsedTags?: VoiceTag[]
}

export interface Character {
  id: number
  name: string
  aliases: string | null
  color: string | null
  voice_count: number
}

export interface Tag {
  id: number
  name: string
  color: string
  use_count: number
}

export interface Software {
  id: number
  name: string
}

export interface Settings {
  managedFolder: string
  theme: string
  autoExtractCharacter: string
  delimiters: string
  continuousPlay: string
  volume: string
  [key: string]: string
}

export interface ImportFileInfo {
  sourcePath: string
  fileName: string
  suggestedCharacter: string | null
  size: number
  folderChain: string[]   // folder names between the drop root and this file
  droppedRoot: string     // which dropped path this file is under
  // User decisions
  characterName?: string | null
  softwareName?: string | null
  tagIds?: number[]
  skip?: boolean
}

export interface PlayerState {
  currentVoice: Voice | null
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
}

export type SortBy = 'created_at' | 'original_name' | 'play_count' | 'duration_sec'
export type SortOrder = 'ASC' | 'DESC'
export type ViewMode = 'list' | 'grid'

export function parseVoiceTags(tagsStr: string | null | undefined): VoiceTag[] {
  if (!tagsStr) return []
  return tagsStr.split('|').map((t) => {
    const [id, name, color] = t.split(':')
    return { id: parseInt(id), name, color: color || '#6366f1' }
  })
}

export function formatDuration(sec: number | null | undefined): string {
  if (sec == null || !isFinite(sec) || isNaN(sec)) return '--:--'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
