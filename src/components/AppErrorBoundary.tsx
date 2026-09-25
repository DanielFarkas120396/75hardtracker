import { Component, type ErrorInfo, type ReactNode } from 'react'
import { exportAll } from '../db/exportImport'
import { downloadFile } from '../lib/backupFile'
import { todayISO } from '../lib/dates'
import { Mascot } from './mascot/Mascot'

interface AppErrorBoundaryProps {
  children: ReactNode
}

interface AppErrorBoundaryState {
  error: Error | null
  backupState: 'idle' | 'working' | 'done' | 'failed'
}

/**
 * Last line of defence for render errors (including database errors
 * rethrown by live queries). Offers a reload and — since the data only
 * lives on this device — a way to download a backup first.
 */
export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null, backupState: 'idle' }

  static getDerivedStateFromError(error: Error): Partial<AppErrorBoundaryState> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unhandled render error', error, info.componentStack)
  }

  downloadBackup = async () => {
    this.setState({ backupState: 'working' })
    try {
      const payload = await exportAll()
      downloadFile(
        new File([JSON.stringify(payload, null, 2)], `75hard-backup-${todayISO()}.json`, { type: 'application/json' }),
      )
      this.setState({ backupState: 'done' })
    } catch {
      this.setState({ backupState: 'failed' })
    }
  }

  render() {
    const { error, backupState } = this.state
    if (!error) return this.props.children

    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-canvas p-6 text-center">
        <Mascot state="sad" size={110} />
        <h1 className="font-rounded text-2xl font-extrabold text-ink">Something went wrong</h1>
        <p className="max-w-sm font-rounded text-ink-muted">
          The app hit an unexpected error. Your data is still saved on this device — reloading usually fixes it.
        </p>
        <p className="max-w-sm break-words font-mono text-xs text-ink-muted">
          {error.name}: {error.message}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="min-h-touch rounded-2xl border-b-4 border-green-dark bg-green px-6 py-3 font-rounded font-bold text-on-accent active:translate-y-1 active:border-b-0"
          >
            Reload
          </button>
          <button
            type="button"
            onClick={() => void this.downloadBackup()}
            disabled={backupState === 'working'}
            className="min-h-touch rounded-2xl border-b-4 border-ink/15 bg-surface px-6 py-3 font-rounded font-bold text-ink active:translate-y-1 active:border-b-0 disabled:opacity-50"
          >
            {backupState === 'working' ? 'Preparing…' : 'Download a backup'}
          </button>
        </div>
        {backupState === 'done' && <p className="text-sm text-ink-muted">Backup downloaded.</p>}
        {backupState === 'failed' && <p className="text-sm text-danger-ink">Couldn’t create a backup.</p>}
      </div>
    )
  }
}
