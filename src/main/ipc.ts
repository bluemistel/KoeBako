import { ipcMain, dialog, shell, app, nativeImage } from 'electron'
import path from 'path'
import fs from 'fs'
import {
  queryVoices,
  getVoiceById,
  insertVoice,
  updateVoice,
  deleteVoice,
  incrementPlayCount,
  toggleFavorite,
  getCharacters,
  insertCharacter,
  updateCharacter,
  deleteCharacter,
  getTags,
  insertTag,
  updateTag,
  deleteTag,
  setVoiceTags,
  bulkAddTags,
  bulkSetFavorite,
  bulkDeleteVoices,
  getSoftwares,
  insertSoftware,
  getSettings,
  setSetting,
  findCharacterByName,
  findCharacterById,
  getUserCategories,
  insertUserCategory,
  updateUserCategory,
  deleteUserCategory,
  VoiceFilter
} from './db'
import {
  collectAudioFiles,
  copyToManagedFolder,
  getRelativePath,
  extractAudioMeta,
  extractCharacterFromPath,
  ensureManagedFolderStructure,
  getDefaultManagedFolder,
  SUPPORTED_EXTENSIONS
} from './fileManager'

// ─── Drag icon (generated once, cached) ─────────────────────────────────────

let _dragIcon: ReturnType<typeof nativeImage.createFromBuffer> | null = null

function getDragIcon(): ReturnType<typeof nativeImage.createFromBuffer> {
  if (_dragIcon) return _dragIcon
  try {
    const zlib = require('zlib') as typeof import('zlib')

    // CRC32 for PNG chunks
    const crcTable: number[] = []
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
      crcTable[n] = c
    }
    const crc32 = (buf: Buffer): number => {
      let crc = 0xffffffff
      for (let i = 0; i < buf.length; i++) crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
      return (crc ^ 0xffffffff) >>> 0
    }
    const chunk = (type: string, data: Buffer): Buffer => {
      const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
      const tb = Buffer.from(type, 'ascii')
      const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc32(Buffer.concat([tb, data])))
      return Buffer.concat([len, tb, data, crcBuf])
    }

    // 24x24 RGBA image — solid purple (#7c3aed) with 80% alpha
    const W = 24, H = 24
    const raw = Buffer.alloc(H * (1 + W * 4))
    for (let y = 0; y < H; y++) {
      const base = y * (1 + W * 4)
      raw[base] = 0 // filter: None
      for (let x = 0; x < W; x++) {
        const p = base + 1 + x * 4
        raw[p] = 0x7c; raw[p + 1] = 0x3a; raw[p + 2] = 0xed; raw[p + 3] = 0xcc
      }
    }
    const ihdr = Buffer.alloc(13)
    ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4)
    ihdr[8] = 8; ihdr[9] = 6 // bit depth=8, color type=RGBA

    const png = Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk('IHDR', ihdr),
      chunk('IDAT', zlib.deflateSync(raw)),
      chunk('IEND', Buffer.alloc(0))
    ])
    _dragIcon = nativeImage.createFromBuffer(png)
  } catch {
    _dragIcon = nativeImage.createEmpty()
  }
  return _dragIcon
}

export function registerIpcHandlers(): void {
  // ─── Voices ───────────────────────────────────────────────────────────────

  ipcMain.handle('voices:query', (_e, filter: VoiceFilter) => {
    return queryVoices(filter)
  })

  ipcMain.handle('voices:getById', (_e, id: number) => {
    return getVoiceById(id)
  })

  ipcMain.handle('voices:update', (_e, id: number, data: Parameters<typeof updateVoice>[1]) => {
    // If character_id is changing, move the file to the appropriate folder
    if ('character_id' in data) {
      const currentVoice = getVoiceById(id)
      if (currentVoice) {
        const settings = getSettings()
        const managedFolder = settings.managedFolder || getDefaultManagedFolder()
        const oldAbsPath = path.join(managedFolder, currentVoice.file_path)

        let newCharName: string | null = null
        if (data.character_id != null) {
          const char = findCharacterById(data.character_id as number)
          newCharName = char?.name ?? null
        }

        const newSubDir = newCharName || '_未分類'
        const newDestDir = path.join(managedFolder, currentVoice.category, newSubDir)
        const fileName = path.basename(oldAbsPath)
        const newAbsPath = path.join(newDestDir, fileName)

        if (oldAbsPath !== newAbsPath && fs.existsSync(oldAbsPath)) {
          try {
            fs.mkdirSync(newDestDir, { recursive: true })
            fs.renameSync(oldAbsPath, newAbsPath)
            const newRelPath = getRelativePath(newAbsPath, managedFolder)
            ;(data as any).file_path = newRelPath
          } catch (err) {
            console.error('Failed to move file during character change:', err)
          }
        }
      }
    }
    updateVoice(id, data)
    return getVoiceById(id)
  })

  ipcMain.handle('voices:bulkDelete', (_e, ids: number[]) => {
    const settings = getSettings()
    const managedFolder = settings.managedFolder || getDefaultManagedFolder()
    for (const id of ids) {
      const voice = getVoiceById(id)
      if (!voice) continue
      const absPath = path.join(managedFolder, voice.file_path)
      try { fs.unlinkSync(absPath) } catch { /* already gone */ }
    }
    bulkDeleteVoices(ids)
  })

  ipcMain.handle('voices:delete', (_e, id: number) => {
    const voice = getVoiceById(id)
    if (!voice) return
    const settings = getSettings()
    const managedFolder = settings.managedFolder || getDefaultManagedFolder()
    const absPath = path.join(managedFolder, voice.file_path)
    try {
      fs.unlinkSync(absPath)
    } catch {
      // file might already be gone
    }
    deleteVoice(id)
  })

  ipcMain.handle('voices:incrementPlayCount', (_e, id: number) => {
    incrementPlayCount(id)
  })

  ipcMain.handle('voices:toggleFavorite', (_e, id: number) => {
    return toggleFavorite(id)
  })

  // ─── Import ───────────────────────────────────────────────────────────────

  ipcMain.handle(
    'import:analyzeFiles',
    async (
      _e,
      filePaths: string[]
    ): Promise<{
      files: Array<{
        sourcePath: string
        fileName: string
        suggestedCharacter: string | null
        size: number
        folderChain: string[]
        droppedRoot: string
      }>
      allFolderNames: string[]
    }> => {
      const settings = getSettings()
      const delimiters = settings.delimiters || '_- '
      const audioFiles = collectAudioFiles(filePaths)

      // Determine which dropped root each file belongs to
      const droppedDirs = filePaths.filter((p) => {
        try { return fs.statSync(p).isDirectory() } catch { return false }
      })

      const files = audioFiles.map((p) => {
        // Find the dropped root this file is under
        const droppedRoot =
          filePaths.find((root) => p.startsWith(root + path.sep) || p === root) ??
          path.dirname(p)

        // Build folder chain: folder names between the droppedRoot and the file
        const relPath = path.relative(droppedRoot, p)
        const parts = relPath.split(path.sep)
        const folderChain = parts.slice(0, -1).filter(Boolean)

        // Also include the dropped root folder name itself if it was a directory
        const rootName = droppedDirs.includes(droppedRoot) ? path.basename(droppedRoot) : null

        return {
          sourcePath: p,
          fileName: path.basename(p),
          suggestedCharacter: extractCharacterFromPath(p, delimiters),
          size: (() => { try { return fs.statSync(p).size } catch { return 0 } })(),
          folderChain,
          droppedRoot,
          rootFolderName: rootName
        }
      })

      // Collect all unique folder names across all file paths for tag suggestions
      const allFolderNames = new Set<string>()
      for (const f of files) {
        // Include the root folder name
        if ((f as any).rootFolderName) allFolderNames.add((f as any).rootFolderName)
        // Include each folder in the chain
        for (const name of f.folderChain) {
          if (name) allFolderNames.add(name)
        }
      }

      return {
        files: files.map(({ rootFolderName: _, ...rest }) => rest),
        allFolderNames: Array.from(allFolderNames)
      }
    }
  )

  ipcMain.handle(
    'import:execute',
    async (
      _e,
      files: Array<{
        sourcePath: string
        fileName: string
        characterName?: string | null
        softwareName?: string | null
        tagIds?: number[]
      }>,
      category: string
    ): Promise<{ success: number; errors: string[] }> => {
      const settings = getSettings()
      const managedFolder = settings.managedFolder || getDefaultManagedFolder()
      ensureManagedFolderStructure(managedFolder)

      let success = 0
      const errors: string[] = []

      for (const file of files) {
        try {
          const destPath = copyToManagedFolder(
            file.sourcePath,
            managedFolder,
            category,
            file.characterName
          )

          const relPath = getRelativePath(destPath, managedFolder)
          const meta = await extractAudioMeta(destPath)

          let characterId: number | null = null
          if (file.characterName) {
            const found = findCharacterByName(file.characterName)
            if (found) {
              characterId = found.id
            } else {
              characterId = insertCharacter(file.characterName)
            }
          }

          let softwareId: number | null = null
          if (file.softwareName) {
            softwareId = insertSoftware(file.softwareName)
          }

          const voiceId = insertVoice({
            file_path: relPath,
            original_name: file.fileName,
            category,
            character_id: characterId,
            software_id: softwareId,
            duration_sec: meta.duration_sec,
            sample_rate: meta.sample_rate,
            bit_depth: meta.bit_depth,
            file_size: meta.file_size
          })

          if (file.tagIds && file.tagIds.length > 0) {
            setVoiceTags(voiceId, file.tagIds)
          }

          success++
        } catch (err) {
          errors.push(`${file.fileName}: ${err instanceof Error ? err.message : String(err)}`)
        }
      }

      return { success, errors }
    }
  )

  // ─── Characters ────────────────────────────────────────────────────────────

  ipcMain.handle('characters:getAll', () => getCharacters())
  ipcMain.handle('characters:insert', (_e, name: string, aliases?: string, color?: string) => {
    const id = insertCharacter(name, aliases, color)
    return getCharacters()
  })
  ipcMain.handle(
    'characters:update',
    (_e, id: number, data: Parameters<typeof updateCharacter>[1]) => {
      updateCharacter(id, data)
      return getCharacters()
    }
  )
  ipcMain.handle('characters:delete', (_e, id: number) => {
    deleteCharacter(id)
    return getCharacters()
  })

  // ─── Tags ──────────────────────────────────────────────────────────────────

  ipcMain.handle('tags:getAll', () => getTags())
  ipcMain.handle('tags:insert', (_e, name: string, color?: string) => {
    insertTag(name, color)
    return getTags()
  })
  ipcMain.handle('tags:update', (_e, id: number, data: Parameters<typeof updateTag>[1]) => {
    updateTag(id, data)
    return getTags()
  })
  ipcMain.handle('tags:delete', (_e, id: number) => {
    deleteTag(id)
    return getTags()
  })
  ipcMain.handle('tags:setVoiceTags', (_e, voiceId: number, tagIds: number[]) => {
    setVoiceTags(voiceId, tagIds)
  })
  ipcMain.handle('tags:bulkAdd', (_e, voiceIds: number[], tagIds: number[]) => {
    bulkAddTags(voiceIds, tagIds)
  })
  ipcMain.handle('voices:bulkSetFavorite', (_e, voiceIds: number[], value: number) => {
    bulkSetFavorite(voiceIds, value)
  })

  // ─── User Categories ────────────────────────────────────────────────────────

  ipcMain.handle('userCategories:getAll', () => getUserCategories())
  ipcMain.handle('userCategories:insert', (_e, name: string, color?: string) => {
    insertUserCategory(name, color)
    return getUserCategories()
  })
  ipcMain.handle('userCategories:update', (_e, id: number, data: object) => {
    updateUserCategory(id, data as { name?: string; color?: string })
    return getUserCategories()
  })
  ipcMain.handle('userCategories:delete', (_e, id: number) => {
    deleteUserCategory(id)
    return getUserCategories()
  })

  // ─── Softwares ──────────────────────────────────────────────────────────────

  ipcMain.handle('softwares:getAll', () => getSoftwares())

  // ─── Settings ──────────────────────────────────────────────────────────────

  ipcMain.handle('settings:getAll', () => {
    const s = getSettings()
    if (!s.managedFolder) {
      s.managedFolder = getDefaultManagedFolder()
    }
    return s
  })

  ipcMain.handle('settings:set', (_e, key: string, value: string) => {
    setSetting(key, value)
  })

  ipcMain.handle('settings:setMultiple', (_e, data: Record<string, string>) => {
    for (const [key, value] of Object.entries(data)) {
      setSetting(key, value)
    }
  })

  // ─── File System ────────────────────────────────────────────────────────────

  ipcMain.handle('fs:selectFolder', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle('fs:openInExplorer', (_e, filePath: string) => {
    shell.showItemInFolder(filePath)
  })

  ipcMain.handle('fs:getAbsolutePath', (_e, relPath: string) => {
    const settings = getSettings()
    const managedFolder = settings.managedFolder || getDefaultManagedFolder()
    return path.join(managedFolder, relPath)
  })

  ipcMain.handle('fs:exportFiles', async (_e, voiceIds: number[]) => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    if (result.canceled || result.filePaths.length === 0) return { success: 0, errors: [] }

    const destDir = result.filePaths[0]
    const settings = getSettings()
    const managedFolder = settings.managedFolder || getDefaultManagedFolder()
    let success = 0
    const errors: string[] = []

    for (const id of voiceIds) {
      const voice = getVoiceById(id)
      if (!voice) continue
      const srcPath = path.join(managedFolder, voice.file_path)
      const destPath = path.join(destDir, path.basename(voice.file_path))
      try {
        fs.copyFileSync(srcPath, destPath)
        success++
      } catch (err) {
        errors.push(`${voice.original_name}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    return { success, errors }
  })

  ipcMain.handle('fs:getManagedFolder', () => {
    const settings = getSettings()
    return settings.managedFolder || getDefaultManagedFolder()
  })

  ipcMain.handle('shell:openExternal', (_e, url: string) => {
    shell.openExternal(url)
  })

  ipcMain.handle('app:getVersion', () => app.getVersion())

  ipcMain.handle('app:getSupportedExtensions', () => Array.from(SUPPORTED_EXTENSIONS))

  // ─── Native drag-out (drag file to other apps) ──────────────────────────────
  // Uses sendSync so startDrag is called within the OS drag-event window

  ipcMain.on('nativeDrag:start', (event, relPath: string) => {
    try {
      const settings = getSettings()
      const managedFolder = settings.managedFolder || getDefaultManagedFolder()
      const absPath = path.join(managedFolder, relPath)
      if (fs.existsSync(absPath)) {
        event.sender.startDrag({ file: absPath, icon: getDragIcon() })
      }
    } catch (err) {
      console.error('startDrag error:', err)
    }
    event.returnValue = null // required for ipcRenderer.sendSync
  })
}
