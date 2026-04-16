import fs from 'fs'
import path from 'path'
import os from 'os'
import { getAllCharacterNames } from './db'

export const SUPPORTED_EXTENSIONS = new Set(['.wav', '.mp3', '.ogg', '.flac', '.m4a', '.aac'])

export function getDefaultManagedFolder(): string {
  return path.join(os.homedir(), 'Documents', 'KoeBako')
}

export function ensureManagedFolderStructure(managedFolder: string): void {
  for (const sub of ['commercial', 'original']) {
    fs.mkdirSync(path.join(managedFolder, sub), { recursive: true })
  }
}

export function isAudioFile(filePath: string): boolean {
  return SUPPORTED_EXTENSIONS.has(path.extname(filePath).toLowerCase())
}

export function collectAudioFiles(inputPaths: string[]): string[] {
  const results: string[] = []

  function walk(p: string): void {
    const stat = fs.statSync(p)
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(p)) {
        walk(path.join(p, entry))
      }
    } else if (stat.isFile() && isAudioFile(p)) {
      results.push(p)
    }
  }

  for (const p of inputPaths) {
    try {
      walk(p)
    } catch {
      // skip inaccessible paths
    }
  }

  return results
}

// ─── Character extraction ─────────────────────────────────────────────────────

const DELIMITERS = /[_\-\s　]+/

export function extractCharacterFromPath(
  filePath: string,
  delimiters?: string
): string | null {
  // Build regex: escape special chars and move '-' to end to avoid range interpretation
  const delimRegex = delimiters
    ? new RegExp(
        `[${delimiters
          .replace(/\\/g, '\\\\')
          .replace(/]/g, '\\]')
          .replace(/\^/g, '\\^')
          .replace(/-/g, '')
          .concat(delimiters.includes('-') ? '\\-' : '')}]+`
      )
    : DELIMITERS
  const characters = getAllCharacterNames()

  // Priority 1: parent folder name
  const parentFolder = path.basename(path.dirname(filePath))
  if (parentFolder && parentFolder !== '.' && parentFolder !== '') {
    const match = matchCharacter(parentFolder, characters)
    if (match) return match.name
  }

  const basename = path.basename(filePath, path.extname(filePath))
  const parts = basename.split(delimRegex).filter(Boolean)

  // Priority 2: filename prefix (first part)
  if (parts.length > 1) {
    const match = matchCharacter(parts[0], characters)
    if (match) return match.name
  }

  // Priority 3: filename suffix (last part)
  if (parts.length > 1) {
    const match = matchCharacter(parts[parts.length - 1], characters)
    if (match) return match.name
  }

  // Priority 4: partial match anywhere in filename
  for (const char of characters) {
    if (basename.includes(char.name)) return char.name
    if (char.aliases) {
      try {
        const aliases: string[] = JSON.parse(char.aliases)
        if (aliases.some((a) => basename.includes(a))) return char.name
      } catch {
        // ignore parse errors
      }
    }
  }

  return null
}

function matchCharacter(
  text: string,
  characters: { id: number; name: string; aliases: string | null }[]
): { id: number; name: string } | null {
  for (const char of characters) {
    if (char.name === text) return char
    if (char.aliases) {
      try {
        const aliases: string[] = JSON.parse(char.aliases)
        if (aliases.some((a) => a === text)) return char
      } catch {
        // ignore
      }
    }
  }
  return null
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// ─── File copy with deduplication ────────────────────────────────────────────

export function copyToManagedFolder(
  sourcePath: string,
  managedFolder: string,
  category: string,
  characterName?: string | null
): string {
  const subDir = characterName ? characterName : '_未分類'
  const destDir = path.join(managedFolder, category, subDir)
  fs.mkdirSync(destDir, { recursive: true })

  const ext = path.extname(sourcePath)
  const baseName = path.basename(sourcePath, ext)
  let destPath = path.join(destDir, path.basename(sourcePath))

  // Handle filename collision
  let counter = 1
  while (fs.existsSync(destPath)) {
    const paddedNum = String(counter).padStart(3, '0')
    destPath = path.join(destDir, `${baseName}_${paddedNum}${ext}`)
    counter++
  }

  fs.copyFileSync(sourcePath, destPath)
  return destPath
}

export function getRelativePath(absolutePath: string, managedFolder: string): string {
  return path.relative(managedFolder, absolutePath).replace(/\\/g, '/')
}

// ─── Audio metadata ───────────────────────────────────────────────────────────

export type AudioMeta = {
  duration_sec: number | null
  sample_rate: number | null
  bit_depth: number | null
  file_size: number
}

export async function extractAudioMeta(filePath: string): Promise<AudioMeta> {
  const stat = fs.statSync(filePath)
  const file_size = stat.size

  const ext = path.extname(filePath).toLowerCase()

  // For WAV, parse header directly (fast, no dependency)
  if (ext === '.wav') {
    try {
      const meta = parseWavHeader(filePath, file_size)
      return { ...meta, file_size }
    } catch {
      // fall through
    }
  }

  // For other formats, use music-metadata (v7 CJS)
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mm = require('music-metadata') as typeof import('music-metadata')
    const meta = await mm.parseFile(filePath, { duration: true })
    return {
      duration_sec: meta.format.duration ?? null,
      sample_rate: meta.format.sampleRate ?? null,
      bit_depth: meta.format.bitsPerSample ?? null,
      file_size
    }
  } catch {
    return { duration_sec: null, sample_rate: null, bit_depth: null, file_size }
  }
}

function parseWavHeader(filePath: string, fileSize: number): {
  duration_sec: number | null
  sample_rate: number | null
  bit_depth: number | null
} {
  // Read first 512 bytes (header)
  const fd = fs.openSync(filePath, 'r')
  const buf = Buffer.alloc(512)
  fs.readSync(fd, buf, 0, 512, 0)
  fs.closeSync(fd)

  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('Not a valid WAV file')
  }

  let offset = 12
  let sampleRate: number | null = null
  let bitDepth: number | null = null
  let channels: number | null = null
  let duration: number | null = null

  while (offset + 8 <= buf.length) {
    const chunkId = buf.toString('ascii', offset, offset + 4)
    const chunkSize = buf.readUInt32LE(offset + 4)

    if (chunkId === 'fmt ') {
      channels = buf.readUInt16LE(offset + 10)
      sampleRate = buf.readUInt32LE(offset + 12)
      bitDepth = buf.readUInt16LE(offset + 22)
    } else if (chunkId === 'data') {
      if (sampleRate && channels && bitDepth) {
        // 0xFFFFFFFF means streaming/unknown size — compute actual size from file size
        const dataBytes = (chunkSize === 0xFFFFFFFF || chunkSize === 0)
          ? fileSize - (offset + 8)
          : chunkSize
        if (dataBytes > 0) {
          duration = dataBytes / (sampleRate * channels * (bitDepth / 8))
        }
      }
      break
    }

    offset += 8 + chunkSize
    if (offset % 2 !== 0) offset++ // word alignment
  }

  // data chunk not found in first 512 bytes (large file with extended header)
  // — estimate duration from file size
  if (duration === null && sampleRate && channels && bitDepth) {
    const headerEstimate = Math.max(offset, 44)
    const estimatedDataBytes = fileSize - headerEstimate
    if (estimatedDataBytes > 0) {
      duration = estimatedDataBytes / (sampleRate * channels * (bitDepth / 8))
    }
  }

  return { duration_sec: duration, sample_rate: sampleRate, bit_depth: bitDepth }
}
