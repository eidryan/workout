import { Pause, Play, SkipForward, Plus, Minus } from 'lucide-react'
import { useRestTimer } from '@/hooks/RestTimerContext'
import { formatSeconds } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * Floating, non-modal rest timer. Sits above the bottom nav so the user
 * can keep logging while it counts down. Auto-hidden when no timer is active.
 */
export function RestTimerPill() {
  const { total, remaining, running, pause, resume, skip, adjust } = useRestTimer()

  if (total === 0) return null

  const done = remaining === 0
  const progress = total > 0 ? (total - remaining) / total : 0

  return (
    <div className="fixed inset-x-0 bottom-[68px] z-30 mx-auto flex max-w-md justify-center px-4">
      <div
        className={cn(
          'flex w-full max-w-sm items-center gap-3 rounded-full border bg-card/95 px-4 py-2.5 shadow-lg backdrop-blur transition-colors',
          done
            ? 'border-primary animate-pulse'
            : remaining <= 10
              ? 'border-primary/60'
              : 'border-border',
        )}
      >
        {/* Time */}
        <div className="flex min-w-[64px] flex-col">
          <span
            className={cn(
              'font-mono text-lg font-bold tabular-nums',
              done ? 'text-primary' : remaining <= 10 ? 'text-primary' : 'text-foreground',
            )}
          >
            {done ? 'Rest done' : formatSeconds(remaining)}
          </span>
          {total > 0 && !done && (
            <span className="text-[10px] text-muted-foreground">
              of {formatSeconds(total)}
            </span>
          )}
        </div>

        {/* Progress bar */}
        {!done && (
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-1000 ease-linear"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        )}

        {/* Controls */}
        <div className="flex shrink-0 items-center gap-0.5">
          <PillButton onClick={() => adjust(-15)} aria-label="Subtract 15 seconds">
            <Minus className="h-3.5 w-3.5" />
          </PillButton>
          {done || !running ? (
            <PillButton onClick={resume} variant="primary" aria-label="Resume">
              <Play className="h-4 w-4" />
            </PillButton>
          ) : (
            <PillButton onClick={pause} variant="primary" aria-label="Pause">
              <Pause className="h-4 w-4" />
            </PillButton>
          )}
          <PillButton onClick={() => adjust(15)} aria-label="Add 15 seconds">
            <Plus className="h-3.5 w-3.5" />
          </PillButton>
          <PillButton onClick={skip} aria-label="Skip rest">
            <SkipForward className="h-3.5 w-3.5" />
          </PillButton>
        </div>
      </div>
    </div>
  )
}

function PillButton({
  onClick,
  children,
  variant = 'ghost',
  ...rest
}: {
  onClick: () => void
  children: React.ReactNode
  variant?: 'ghost' | 'primary'
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-full transition-colors',
        variant === 'primary'
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
      {...rest}
    >
      {children}
    </button>
  )
}
