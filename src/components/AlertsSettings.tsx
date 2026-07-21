import { Bell, Volume2, Vibrate, Play } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { useAppState, updateAppState } from '@/hooks/useDb'
import {
  playSound,
  vibrate,
  ensureNotificationPermission,
} from '@/lib/sound'
import type { SoundType, VibrationType } from '@/db/types'
import { cn } from '@/lib/utils'

const SOUND_TYPES: SoundType[] = ['beep', 'chime', 'buzz']
const VIBRATION_TYPES: VibrationType[] = ['short', 'double', 'long']

/** Rest-timer alert settings: sound, vibration, notifications, rest length. */
export function AlertsSettings() {
  const appState = useAppState()
  if (!appState) return null

  const volume = appState.volume ?? 0.3
  const soundType = appState.soundType ?? 'beep'
  const vibrationType = appState.vibrationType ?? 'double'
  const notificationsEnabled = appState.notificationsEnabled ?? false

  const toggleNotifications = async () => {
    if (notificationsEnabled) {
      await updateAppState({ notificationsEnabled: false })
      return
    }
    const granted = await ensureNotificationPermission()
    await updateAppState({ notificationsEnabled: granted })
  }

  const notifBlocked =
    typeof Notification !== 'undefined' && Notification.permission === 'denied'

  return (
    <Card className="divide-y divide-border">
      {/* Sound */}
      <Row icon={<Volume2 className="h-4 w-4" />} title="Sound">
        <Toggle
          on={appState.soundEnabled}
          onChange={(on) => updateAppState({ soundEnabled: on })}
        />
      </Row>
      {appState.soundEnabled && (
        <div className="space-y-3 px-4 py-3">
          <Segmented
            options={SOUND_TYPES}
            value={soundType}
            onChange={(v) => {
              updateAppState({ soundType: v })
              playSound(v, volume)
            }}
            onTest={() => playSound(soundType, volume)}
          />
          <div className="flex items-center gap-3">
            <span className="w-14 text-xs text-muted-foreground">Volume</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => updateAppState({ volume: Number(e.target.value) })}
              onMouseUp={() => playSound(soundType, volume)}
              onTouchEnd={() => playSound(soundType, volume)}
              className="flex-1 accent-primary"
              aria-label="Volume"
            />
            <span className="w-8 text-right text-xs tabular-nums text-muted-foreground">
              {Math.round(volume * 100)}
            </span>
          </div>
        </div>
      )}

      {/* Vibration */}
      <Row icon={<Vibrate className="h-4 w-4" />} title="Vibration">
        <Toggle
          on={appState.vibrationEnabled}
          onChange={(on) => updateAppState({ vibrationEnabled: on })}
        />
      </Row>
      {appState.vibrationEnabled && (
        <div className="px-4 py-3">
          <Segmented
            options={VIBRATION_TYPES}
            value={vibrationType}
            onChange={(v) => {
              updateAppState({ vibrationType: v })
              vibrate(v)
            }}
            onTest={() => vibrate(vibrationType)}
          />
        </div>
      )}

      {/* Notifications */}
      <Row
        icon={<Bell className="h-4 w-4" />}
        title="Rest-end notification"
        subtitle={
          notifBlocked
            ? 'Blocked in browser settings — enable there first'
            : 'Alerts you when a rest ends and the app is in the background'
        }
      >
        <Toggle on={notificationsEnabled} onChange={toggleNotifications} disabled={notifBlocked} />
      </Row>

      {/* Default rest length */}
      <Row title="Default rest" subtitle="Used when an exercise has no rest set">
        <div className="flex items-center gap-1">
          <StepButton
            label="−15s"
            onClick={() =>
              updateAppState({
                globalDefaultRestSeconds: Math.max(15, appState.globalDefaultRestSeconds - 15),
              })
            }
          />
          <span className="w-12 text-center text-sm font-medium tabular-nums">
            {appState.globalDefaultRestSeconds}s
          </span>
          <StepButton
            label="+15s"
            onClick={() =>
              updateAppState({
                globalDefaultRestSeconds: appState.globalDefaultRestSeconds + 15,
              })
            }
          />
        </div>
      </Row>
    </Card>
  )
}

function Row({
  icon,
  title,
  subtitle,
  children,
}: {
  icon?: React.ReactNode
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      {icon && <span className="shrink-0 text-muted-foreground">{icon}</span>}
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{title}</div>
        {subtitle && <div className="mt-0.5 text-xs text-muted-foreground">{subtitle}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function Toggle({
  on,
  onChange,
  disabled,
}: {
  on: boolean
  onChange: (on: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cn(
        'relative h-6 w-11 rounded-full transition-colors',
        on ? 'bg-primary' : 'bg-muted',
        disabled && 'opacity-40',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform',
          on ? 'translate-x-[22px]' : 'translate-x-0.5',
        )}
      />
    </button>
  )
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
  onTest,
}: {
  options: T[]
  value: T
  onChange: (v: T) => void
  onTest: () => void
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex flex-1 rounded-lg border border-border p-0.5">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={cn(
              'flex-1 rounded-md py-1.5 text-xs font-medium capitalize transition-colors',
              value === opt ? 'bg-primary text-primary-foreground' : 'text-muted-foreground',
            )}
          >
            {opt}
          </button>
        ))}
      </div>
      <button
        onClick={onTest}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground"
        aria-label="Test"
      >
        <Play className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

function StepButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-md border border-border px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
    >
      {label}
    </button>
  )
}
