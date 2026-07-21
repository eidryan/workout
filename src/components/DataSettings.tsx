import { useRef, useState } from 'react'
import { Download, Upload, ShieldCheck } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { exportData, parseBackup, importData, backupSummary } from '@/db/backup'

/** Export / import the full local database as a JSON file. */
export function DataSettings() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [pending, setPending] = useState<{
    payload: Awaited<ReturnType<typeof parseBackup>>
    summary: { sessions: number; sets: number }
  } | null>(null)

  const handleExport = async () => {
    setStatus(null)
    try {
      await exportData()
      setStatus('Backup downloaded.')
    } catch {
      setStatus('Export failed.')
    }
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file later
    if (!file) return
    setStatus(null)
    try {
      const payload = await parseBackup(file)
      setPending({ payload, summary: backupSummary(payload) })
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Could not read that file.')
    }
  }

  const confirmImport = async () => {
    if (!pending) return
    try {
      await importData(pending.payload)
      setPending(null)
      setStatus('Backup restored. Reloading…')
      setTimeout(() => window.location.reload(), 600)
    } catch {
      setStatus('Restore failed — nothing was changed.')
      setPending(null)
    }
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start gap-2">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          Your data lives only in this browser. Export a backup to keep it safe, or import one to
          move it to another device.
        </p>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={handleExport}>
          <Download className="h-4 w-4" /> Export
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="h-4 w-4" /> Import
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={handleFile}
        />
      </div>

      {pending && (
        <div className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
          <p className="text-xs text-foreground">
            Restore this backup ({pending.summary.sessions} sessions, {pending.summary.sets} sets)?
            This <strong>replaces</strong> all data currently on this device.
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" className="flex-1" onClick={confirmImport}>
              Replace &amp; restore
            </Button>
            <Button size="sm" variant="ghost" className="flex-1" onClick={() => setPending(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {status && <p className="text-xs text-muted-foreground">{status}</p>}
    </Card>
  )
}
