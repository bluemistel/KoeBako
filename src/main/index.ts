import { app, BrowserWindow, protocol, net } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { initDb } from './db'
import { registerIpcHandlers } from './ipc'

// Register custom protocol for serving local audio files
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'koebako-file',
    privileges: {
      secure: true,
      supportFetchAPI: true,
      stream: true,
      bypassCSP: true
    }
  }
])

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#09090f',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // Custom titlebar events
  mainWindow.webContents.ipc.on('window:minimize', () => mainWindow.minimize())
  mainWindow.webContents.ipc.on('window:maximize', () => {
    if (mainWindow.isMaximized()) mainWindow.unmaximize()
    else mainWindow.maximize()
  })
  mainWindow.webContents.ipc.on('window:close', () => mainWindow.close())

  mainWindow.on('maximize', () =>
    mainWindow.webContents.send('window:maximized-change', true)
  )
  mainWindow.on('unmaximize', () =>
    mainWindow.webContents.send('window:maximized-change', false)
  )

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.koebako')

  // Handle custom file protocol
  protocol.handle('koebako-file', (request) => {
    const url = new URL(request.url)
    // Reconstruct the path from hostname + pathname (for Windows drive letters)
    let filePath = decodeURIComponent(url.pathname)
    // On Windows, path starts with /C:/... so remove leading slash
    if (filePath.startsWith('/') && filePath[2] === ':') {
      filePath = filePath.slice(1)
    }
    return net.fetch(pathToFileURL(filePath).toString())
  })

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  await initDb()
  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
