import { useEffect } from 'react'
import { useStore } from './store'
import Toolbar from './components/layout/Toolbar'
import LeftPane from './components/layout/LeftPane'
import CenterPane from './components/layout/CenterPane'
import RightPane from './components/layout/RightPane'
import PlayerBar from './components/layout/PlayerBar'
import ImportDialog from './components/import/ImportDialog'
import SettingsModal from './components/settings/SettingsModal'

export default function App() {
  const {
    showImportDialog,
    showSettingsModal,
    theme,
    loadAll,
    setIsMaximized
  } = useStore()

  // Apply/remove .light class on <html> for CSS variable theming
  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light')
    } else {
      document.documentElement.classList.remove('light')
    }
  }, [theme])

  useEffect(() => {
    loadAll()

    // Window maximize state listener
    const cleanup = window.api.onMaximizedChange((isMax) => {
      setIsMaximized(isMax)
    })

    // Global keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT'
      if (isInput) return

      if (e.code === 'Space') {
        e.preventDefault()
        useStore.getState().setIsPlaying(!useStore.getState().isPlaying)
        return
      }

      if (e.code === 'ArrowRight') {
        e.preventDefault()
        useStore.getState().playNext()
        return
      }

      if (e.code === 'ArrowLeft') {
        e.preventDefault()
        useStore.getState().playPrev()
        return
      }

      if (e.code === 'Delete') {
        e.preventDefault()
        const state = useStore.getState()
        const voice = state.voices.find((v) => v.id === state.selectedVoiceId)
        if (voice && confirm(`「${voice.original_name}」を削除しますか？\nファイルも削除されます。`)) {
          window.api.deleteVoice(voice.id).then(() => {
            useStore.getState().removeVoiceFromList(voice.id)
            useStore.getState().setSelectedVoice(null)
            useStore.getState().loadCharacters()
            useStore.getState().loadTags()
          })
        }
        return
      }

      if (e.ctrlKey && e.code === 'KeyB') {
        e.preventDefault()
        const state = useStore.getState()
        if (state.selectedVoiceId != null) {
          window.api.toggleFavorite(state.selectedVoiceId).then((newVal) => {
            useStore.getState().updateVoiceInList(state.selectedVoiceId!, { is_favorite: newVal })
          })
        }
        return
      }

      if (e.code === 'Escape') {
        e.preventDefault()
        const state = useStore.getState()
        state.clearSelection()
        state.setSelectedVoice(null)
        return
      }

      if (e.ctrlKey && e.code === 'KeyA') {
        e.preventDefault()
        const state = useStore.getState()
        state.setRangeSelection(state.voices.map((v) => v.id))
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      cleanup()
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  return (
    <div className="fixed inset-0 flex flex-col bg-bg-base overflow-hidden">
      {/* Custom titlebar / toolbar */}
      <Toolbar />

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        <LeftPane />
        <CenterPane />
        <RightPane />
      </div>

      {/* Player bar */}
      <PlayerBar />

      {/* Modals */}
      {showImportDialog && <ImportDialog />}
      {showSettingsModal && <SettingsModal />}
    </div>
  )
}
