import path from 'path'
import fs from 'fs'
import { app } from 'electron'
import type SqlJs from 'sql.js'
import defaultCharactersData from './data/defaultCharacters.json'
import defaultSoftwaresData from './data/defaultSoftwares.json'

let db: SqlJs.Database
let SQL: SqlJs.SqlJsStatic
let dbPath: string
let saveTimer: ReturnType<typeof setTimeout> | null = null

function getDbPath(): string {
  if (!dbPath) {
    const dbDir = path.join(app.getPath('userData'), 'db')
    fs.mkdirSync(dbDir, { recursive: true })
    dbPath = path.join(dbDir, 'voice.db')
  }
  return dbPath
}

export async function initDb(): Promise<void> {
  const initSqlJs = require('sql.js') as (config?: object) => Promise<SqlJs.SqlJsStatic>
  const wasmPath = path.join(__dirname, '..', 'resources', 'sql-wasm.wasm')

  SQL = await initSqlJs({
    locateFile: (file: string) => {
      // Look in resources folder (bundled), fallback to node_modules
      const resourcesPath = path.join(process.resourcesPath ?? '', file)
      if (fs.existsSync(resourcesPath)) return resourcesPath
      // dev mode: from node_modules
      return path.join(
        __dirname,
        '..',
        '..',
        'node_modules',
        'sql.js',
        'dist',
        file
      )
    }
  })

  const p = getDbPath()
  if (fs.existsSync(p)) {
    const fileBuffer = fs.readFileSync(p)
    db = new SQL.Database(fileBuffer)
  } else {
    db = new SQL.Database()
  }

  createSchema()
  seedDefaultData()
  saveDb() // initial save to create the file
}

export function saveDb(): void {
  const data = db.export()
  fs.writeFileSync(getDbPath(), Buffer.from(data))
}

function scheduleSave(): void {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveDb()
    saveTimer = null
  }, 300)
}

// ─── Low-level helpers ────────────────────────────────────────────────────────

type Row = Record<string, string | number | null | Uint8Array>

function dbAll<T = Row>(sql: string, params?: (string | number | null)[]): T[] {
  const stmt = db.prepare(sql)
  if (params) stmt.bind(params)
  const results: T[] = []
  while (stmt.step()) {
    results.push(stmt.getAsObject() as unknown as T)
  }
  stmt.free()
  return results
}

function dbGet<T = Row>(sql: string, params?: (string | number | null)[]): T | undefined {
  const results = dbAll<T>(sql, params)
  return results[0]
}

function dbRun(sql: string, params?: (string | number | null)[]): { lastInsertRowid: number; changes: number } {
  db.run(sql, params ?? [])
  const lastId = (dbGet<{ id: number }>('SELECT last_insert_rowid() as id') as any)?.id ?? 0
  const changes = (dbGet<{ changes: number }>('SELECT changes() as changes') as any)?.changes ?? 0
  scheduleSave()
  return { lastInsertRowid: lastId, changes }
}

function createSchema(): void {
  db.run(`PRAGMA foreign_keys = ON`)

  db.run(`
    CREATE TABLE IF NOT EXISTS characters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      aliases TEXT,
      color TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    )
  `)

  // Migration: add is_default column if it doesn't exist
  const hasIsDefault = dbAll<{ name: string }>(
    `PRAGMA table_info(characters)`
  ).some((col) => col.name === 'is_default')
  if (!hasIsDefault) {
    db.run(`ALTER TABLE characters ADD COLUMN is_default INTEGER NOT NULL DEFAULT 0`)
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS softwares (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS voices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_path TEXT NOT NULL,
      original_name TEXT NOT NULL,
      category TEXT NOT NULL,
      character_id INTEGER REFERENCES characters(id) ON DELETE SET NULL,
      software_id INTEGER REFERENCES softwares(id) ON DELETE SET NULL,
      duration_sec REAL,
      sample_rate INTEGER,
      bit_depth INTEGER,
      file_size INTEGER,
      memo TEXT DEFAULT '',
      is_favorite INTEGER NOT NULL DEFAULT 0,
      play_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    )
  `)

  db.run(`CREATE INDEX IF NOT EXISTS idx_voices_category ON voices(category)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_voices_character ON voices(character_id)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_voices_created ON voices(created_at DESC)`)

  db.run(`
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT DEFAULT '#6366f1',
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS voice_tags (
      voice_id INTEGER NOT NULL REFERENCES voices(id) ON DELETE CASCADE,
      tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (voice_id, tag_id)
    )
  `)

  db.run(`CREATE INDEX IF NOT EXISTS idx_voice_tags_tag ON voice_tags(tag_id)`)

  db.run(`
    CREATE TABLE IF NOT EXISTS user_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT DEFAULT '#6366f1',
      sort_order INTEGER NOT NULL DEFAULT 0
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS play_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      voice_id INTEGER NOT NULL REFERENCES voices(id) ON DELETE CASCADE,
      played_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    )
  `)
}

function seedDefaultData(): void {
  const defaultNames = defaultCharactersData.map((c) => c.name)

  // Upsert each JSON character: insert if new, update aliases/color/is_default if exists
  for (const c of defaultCharactersData) {
    const existing = dbGet<{ id: number }>('SELECT id FROM characters WHERE name = ?', [c.name])
    if (existing) {
      db.run(
        'UPDATE characters SET aliases = ?, color = ?, is_default = 1 WHERE id = ?',
        [JSON.stringify(c.aliases), c.color, existing.id]
      )
    } else {
      db.run(
        'INSERT INTO characters (name, aliases, color, is_default) VALUES (?, ?, ?, 1)',
        [c.name, JSON.stringify(c.aliases), c.color]
      )
    }
  }

  // Remove old default characters not in JSON that have no voices assigned
  const placeholders = defaultNames.map(() => '?').join(',')
  db.run(
    `DELETE FROM characters
     WHERE is_default = 1
       AND name NOT IN (${placeholders})
       AND id NOT IN (SELECT DISTINCT character_id FROM voices WHERE character_id IS NOT NULL)`,
    defaultNames
  )


  for (const s of defaultSoftwaresData) {
    db.run('INSERT OR IGNORE INTO softwares (name) VALUES (?)', [s])
  }

  const defaultSettings: Record<string, string> = {
    managedFolder: '',
    theme: 'dark',
    autoExtractCharacter: 'true',
    delimiters: '_- ',
    continuousPlay: 'false',
    volume: '0.8'
  }
  for (const [key, value] of Object.entries(defaultSettings)) {
    db.run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', [key, value])
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type VoiceRow = {
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
}

export type VoiceFilter = {
  query?: string
  category?: string
  characterIds?: number[]
  tagIds?: string
  tagMode?: 'AND' | 'OR'
  isFavorite?: boolean
  sortBy?: string
  sortOrder?: 'ASC' | 'DESC'
  limit?: number
  offset?: number
}

// ─── Voices ───────────────────────────────────────────────────────────────────

export function queryVoices(filter: VoiceFilter = {}): { rows: VoiceRow[]; total: number } {
  const {
    query,
    category,
    characterIds,
    tagIds,
    tagMode = 'OR',
    isFavorite,
    sortBy = 'created_at',
    sortOrder = 'DESC',
    limit = 500,
    offset = 0
  } = filter

  const tagIdList = tagIds
    ? tagIds.split(',').map((s) => parseInt(s)).filter((n) => !isNaN(n))
    : []

  const whereParts: string[] = []
  const params: (string | number | null)[] = []

  if (category && category !== 'all') {
    whereParts.push('v.category = ?')
    params.push(category)
  }
  if (characterIds && characterIds.length > 0) {
    whereParts.push(`v.character_id IN (${characterIds.map(() => '?').join(',')})`)
    params.push(...characterIds)
  }
  if (isFavorite) {
    whereParts.push('v.is_favorite = 1')
  }
  if (query && query.trim()) {
    const q = `%${query.trim()}%`
    whereParts.push('(v.original_name LIKE ? OR v.memo LIKE ?)')
    params.push(q, q)
  }
  if (tagIdList.length > 0) {
    if (tagMode === 'AND') {
      whereParts.push(`(
        SELECT COUNT(DISTINCT tag_id) FROM voice_tags
        WHERE voice_id = v.id AND tag_id IN (${tagIdList.map(() => '?').join(',')})
      ) = ${tagIdList.length}`)
      params.push(...tagIdList)
    } else {
      whereParts.push(`EXISTS (
        SELECT 1 FROM voice_tags WHERE voice_id = v.id
        AND tag_id IN (${tagIdList.map(() => '?').join(',')})
      )`)
      params.push(...tagIdList)
    }
  }

  const where = whereParts.length > 0 ? 'WHERE ' + whereParts.join(' AND ') : ''

  const validSortCols: Record<string, string> = {
    created_at: 'v.created_at',
    original_name: 'v.original_name',
    play_count: 'v.play_count',
    duration_sec: 'v.duration_sec'
  }
  const sortCol = validSortCols[sortBy ?? ''] ?? 'v.created_at'
  const order = sortOrder === 'ASC' ? 'ASC' : 'DESC'

  const total = (dbGet<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM voices v ${where}`, params) as any)?.cnt ?? 0

  const rows = dbAll<VoiceRow>(
    `SELECT v.*,
      c.name as character_name, c.color as character_color,
      s.name as software_name,
      GROUP_CONCAT(t.id || ':' || t.name || ':' || COALESCE(t.color,'#6366f1'), '|') as tags
    FROM voices v
    LEFT JOIN characters c ON c.id = v.character_id
    LEFT JOIN softwares s ON s.id = v.software_id
    LEFT JOIN voice_tags vt ON vt.voice_id = v.id
    LEFT JOIN tags t ON t.id = vt.tag_id
    ${where}
    GROUP BY v.id
    ORDER BY ${sortCol} ${order}
    LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  )

  return { rows, total }
}

export function getVoiceById(id: number): VoiceRow | null {
  return dbGet<VoiceRow>(
    `SELECT v.*,
      c.name as character_name, c.color as character_color,
      s.name as software_name,
      GROUP_CONCAT(t.id || ':' || t.name || ':' || COALESCE(t.color,'#6366f1'), '|') as tags
    FROM voices v
    LEFT JOIN characters c ON c.id = v.character_id
    LEFT JOIN softwares s ON s.id = v.software_id
    LEFT JOIN voice_tags vt ON vt.voice_id = v.id
    LEFT JOIN tags t ON t.id = vt.tag_id
    WHERE v.id = ?
    GROUP BY v.id`,
    [id]
  ) ?? null
}

export function insertVoice(data: {
  file_path: string
  original_name: string
  category: string
  character_id?: number | null
  software_id?: number | null
  duration_sec?: number | null
  sample_rate?: number | null
  bit_depth?: number | null
  file_size?: number | null
}): number {
  const result = dbRun(
    `INSERT INTO voices (file_path, original_name, category, character_id, software_id,
     duration_sec, sample_rate, bit_depth, file_size)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.file_path,
      data.original_name,
      data.category,
      data.character_id ?? null,
      data.software_id ?? null,
      data.duration_sec ?? null,
      data.sample_rate ?? null,
      data.bit_depth ?? null,
      data.file_size ?? null
    ]
  )
  return result.lastInsertRowid
}

export function updateVoice(
  id: number,
  data: Partial<{
    file_path: string
    character_id: number | null
    software_id: number | null
    memo: string
    is_favorite: number
  }>
): void {
  if (Object.keys(data).length === 0) return
  const fields = Object.keys(data).map((k) => `${k} = ?`).join(', ')
  const values = [...Object.values(data), new Date().toISOString(), id]
  dbRun(`UPDATE voices SET ${fields}, updated_at = ? WHERE id = ?`, values as (string | number | null)[])
}

export function deleteVoice(id: number): void {
  dbRun('DELETE FROM voice_tags WHERE voice_id = ?', [id])
  dbRun('DELETE FROM voices WHERE id = ?', [id])
}

export function incrementPlayCount(id: number): void {
  dbRun(
    `UPDATE voices SET play_count = play_count + 1, updated_at = datetime('now','localtime') WHERE id = ?`,
    [id]
  )
  dbRun('INSERT INTO play_history (voice_id) VALUES (?)', [id])
}

export function toggleFavorite(id: number): number {
  dbRun(
    `UPDATE voices SET is_favorite = CASE WHEN is_favorite=1 THEN 0 ELSE 1 END,
    updated_at = datetime('now','localtime') WHERE id = ?`,
    [id]
  )
  const row = dbGet<{ is_favorite: number }>('SELECT is_favorite FROM voices WHERE id = ?', [id])
  return row?.is_favorite ?? 0
}

// ─── Characters ───────────────────────────────────────────────────────────────

export function getCharacters(): {
  id: number
  name: string
  aliases: string | null
  color: string | null
  voice_count: number
}[] {
  return dbAll(
    `SELECT c.*, COUNT(v.id) as voice_count
     FROM characters c
     LEFT JOIN voices v ON v.character_id = c.id
     GROUP BY c.id
     ORDER BY c.name`
  ) as ReturnType<typeof getCharacters>
}

export function insertCharacter(name: string, aliases?: string, color?: string): number {
  const result = dbRun(
    'INSERT INTO characters (name, aliases, color) VALUES (?, ?, ?)',
    [name, aliases ?? null, color ?? null]
  )
  return result.lastInsertRowid
}

export function updateCharacter(
  id: number,
  data: { name?: string; aliases?: string; color?: string }
): void {
  if (Object.keys(data).length === 0) return
  const fields = Object.keys(data).map((k) => `${k} = ?`).join(', ')
  dbRun(`UPDATE characters SET ${fields} WHERE id = ?`, [...Object.values(data), id] as (string | number | null)[])
}

export function deleteCharacter(id: number): void {
  dbRun('UPDATE voices SET character_id = NULL WHERE character_id = ?', [id])
  dbRun('DELETE FROM characters WHERE id = ?', [id])
}

// ─── Tags ─────────────────────────────────────────────────────────────────────

export function getTags(): { id: number; name: string; color: string; use_count: number }[] {
  return dbAll(
    `SELECT t.id, t.name, t.color, COUNT(vt.voice_id) as use_count
     FROM tags t
     LEFT JOIN voice_tags vt ON vt.tag_id = t.id
     GROUP BY t.id
     ORDER BY use_count DESC, t.name`
  ) as ReturnType<typeof getTags>
}

export function insertTag(name: string, color?: string): number {
  const result = dbRun('INSERT INTO tags (name, color) VALUES (?, ?)', [name, color ?? '#6366f1'])
  return result.lastInsertRowid
}

export function updateTag(id: number, data: { name?: string; color?: string }): void {
  if (Object.keys(data).length === 0) return
  const fields = Object.keys(data).map((k) => `${k} = ?`).join(', ')
  dbRun(`UPDATE tags SET ${fields} WHERE id = ?`, [...Object.values(data), id] as (string | number | null)[])
}

export function deleteTag(id: number): void {
  dbRun('DELETE FROM tags WHERE id = ?', [id])
}

export function setVoiceTags(voiceId: number, tagIds: number[]): void {
  dbRun('DELETE FROM voice_tags WHERE voice_id = ?', [voiceId])
  for (const tagId of tagIds) {
    dbRun('INSERT OR IGNORE INTO voice_tags (voice_id, tag_id) VALUES (?, ?)', [voiceId, tagId])
  }
}

export function bulkAddTags(voiceIds: number[], tagIds: number[]): void {
  for (const voiceId of voiceIds) {
    for (const tagId of tagIds) {
      dbRun('INSERT OR IGNORE INTO voice_tags (voice_id, tag_id) VALUES (?, ?)', [voiceId, tagId])
    }
  }
}

// ─── Softwares ────────────────────────────────────────────────────────────────

export function getSoftwares(): { id: number; name: string }[] {
  return dbAll('SELECT id, name FROM softwares ORDER BY name') as { id: number; name: string }[]
}

export function insertSoftware(name: string): number {
  const existing = dbGet<{ id: number }>('SELECT id FROM softwares WHERE name = ?', [name])
  if (existing) return existing.id
  const result = dbRun('INSERT INTO softwares (name) VALUES (?)', [name])
  return result.lastInsertRowid
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export function getSettings(): Record<string, string> {
  const rows = dbAll<{ key: string; value: string }>('SELECT key, value FROM settings')
  return Object.fromEntries(rows.map((r) => [r.key, r.value]))
}

export function setSetting(key: string, value: string): void {
  dbRun('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value])
}

// ─── Character helpers ────────────────────────────────────────────────────────

export function findCharacterById(id: number): { id: number; name: string } | null {
  const row = dbGet<{ id: number; name: string }>('SELECT id, name FROM characters WHERE id = ?', [id])
  return row ?? null
}

export function findCharacterByName(name: string): { id: number; name: string } | null {
  const row = dbGet<{ id: number; name: string }>(
    `SELECT id, name FROM characters WHERE name = ? OR aliases LIKE ? LIMIT 1`,
    [name, `%${name}%`]
  )
  return row ?? null
}

export function getAllCharacterNames(): { id: number; name: string; aliases: string | null }[] {
  return dbAll('SELECT id, name, aliases FROM characters') as ReturnType<typeof getAllCharacterNames>
}

// ─── User Categories ──────────────────────────────────────────────────────────

export function getUserCategories(): { id: number; name: string; color: string }[] {
  return dbAll(
    'SELECT id, name, color FROM user_categories ORDER BY sort_order, id'
  ) as { id: number; name: string; color: string }[]
}

export function insertUserCategory(name: string, color?: string): number {
  const result = dbRun(
    'INSERT INTO user_categories (name, color) VALUES (?, ?)',
    [name, color ?? '#6366f1']
  )
  return result.lastInsertRowid
}

export function updateUserCategory(
  id: number,
  data: { name?: string; color?: string }
): void {
  if (Object.keys(data).length === 0) return
  const fields = Object.keys(data).map((k) => `${k} = ?`).join(', ')
  dbRun(
    `UPDATE user_categories SET ${fields} WHERE id = ?`,
    [...Object.values(data), id] as (string | number | null)[]
  )
}

export function deleteUserCategory(id: number): void {
  dbRun('DELETE FROM user_categories WHERE id = ?', [id])
}

// ─── Bulk operations ──────────────────────────────────────────────────────────

export function bulkSetFavorite(voiceIds: number[], value: number): void {
  for (const id of voiceIds) {
    dbRun(
      `UPDATE voices SET is_favorite = ?, updated_at = datetime('now','localtime') WHERE id = ?`,
      [value, id]
    )
  }
}

export function bulkDeleteVoices(ids: number[]): void {
  for (const id of ids) {
    dbRun('DELETE FROM voice_tags WHERE voice_id = ?', [id])
    dbRun('DELETE FROM voices WHERE id = ?', [id])
  }
}

// ─── Folder migration ─────────────────────────────────────────────────────────

export function getAllVoiceFilePaths(): { id: number; file_path: string }[] {
  return dbAll<{ id: number; file_path: string }>('SELECT id, file_path FROM voices')
}

export function updateVoiceFilePath(id: number, newFilePath: string): void {
  dbRun('UPDATE voices SET file_path = ? WHERE id = ?', [newFilePath, id])
}
