import { useAppStore } from '@/store/appStore'
import { formatDate } from '@/utils/format'

function formatUploadTime(iso: string | null | undefined): string {
  if (!iso) return '\u2014'
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export default function Footer() {
  const { snapshots, activeSnapshotId } = useAppStore()
  const snap = snapshots.find((s: any) => s.id === activeSnapshotId) ?? snapshots[0]

  if (!snap) return null

  const files = [snap.source_file_summary, snap.source_file_comparison, snap.last_week_source]
    .filter(Boolean)
    .join(', ')

  return (
    <footer className="flex-shrink-0 border-t border-[var(--border-subtle)] px-6 py-2 text-[10px] text-[var(--text-muted)] flex items-center gap-2 flex-wrap">
      <span>
        Data from: <strong className="font-semibold text-[var(--text-secondary)]">{files || 'no files uploaded'}</strong>
      </span>
      <span className="text-[var(--border)]">\u00b7</span>
      <span>
        Snapshot: <strong className="font-semibold text-[var(--text-secondary)]">{formatDate(snap.snapshot_date)}</strong>
      </span>
      <span className="text-[var(--border)]">\u00b7</span>
      <span>
        Uploaded: <strong className="font-semibold text-[var(--text-secondary)]">{formatUploadTime(snap.uploaded_at)}</strong>
      </span>
    </footer>
  )
}
