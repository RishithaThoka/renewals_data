import React from 'react'
import { FolderSearch } from 'lucide-react'
import clsx from 'clsx'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
    variant?: 'primary' | 'secondary'
  }
  className?: string
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={clsx(
        'flex flex-col items-center justify-center p-8 text-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--bg-secondary)]/30',
        className
      )}
    >
      <div className="w-14 h-14 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center mb-3.5 shadow-sm border border-teal-500/20">
        {icon || <FolderSearch className="w-7 h-7" />}
      </div>
      <h4 className="font-display font-bold text-base text-[var(--text-primary)]">
        {title}
      </h4>
      {description && (
        <p className="text-xs text-[var(--text-muted)] max-w-sm mt-1 leading-relaxed">
          {description}
        </p>
      )}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className={clsx(
            'mt-4 px-4 py-2 rounded-xl text-xs font-semibold transition-all focus:outline-none shadow-sm',
            action.variant === 'secondary'
              ? 'bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border)] hover:bg-[var(--bg-secondary)]'
              : 'bg-gradient-to-r from-teal-500 to-teal-600 text-white hover:from-teal-600 hover:to-teal-700 shadow-teal-500/20'
          )}
        >
          {action.label}
        </button>
      )}
    </div>
  )
}

export default EmptyState
