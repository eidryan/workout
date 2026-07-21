import { useState } from 'react'
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
type PermState = NotificationPermission | 'unsupported'

function currentPermission(): PermState {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  return Notification.permission
}

export function AlertsSettings() {
  const appState = useAppState()
  const [permission, setPermission] = useState<PermState>(currentPermission)
  const notifSupported = permission !== 'unsupported'

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
    if (!notifSupported) {
      setPermission('unsupported')
      return
    }
    // Must be called from this click — browsers only show the prompt in
    // response to a user gesture.
    const granted = await ensureNotificationPermission()
    setPermission(Notification.permission)
    await updateAppState({ notificationsEnabled: granted })
  }

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
          permission === 'unsupported'
            ? 'Not supported by this browser. On iPhone, add the app to your Home Screen first.'
            : permission === 'denied'
              ? 'Blocked. Allow notifications for this site in your browser settings, then try again.'
              : permission === 'default'
                ? 'Turn on to allow notifications — your browser will ask for permission.'
                : 'Alerts you when a rest ends and the app is in the background.'
        }
      >
        <Toggle
          on={notificationsEnabled && permission === 'granted'}
          onChange={toggleNotifications}
          disabled={permission === 'denied' || permission === 'unsupported'}
        />
      </Row>
      {permission === 'denied' && (
        <div className="px-4 pb-3">
          <button
            onClick={() => setPermission(currentPermission())}
            className="text-xs font-medium text-primary underline-offset-2 hover:underline"
          >
            I&apos;ve allowed it — re-check
          </button>
        </div>
      )}

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
        // p-0/border-0 matter: a bare <button> has UA padding+border, which
        // shifts the knob's static position and pushes it outside the track.
        'relative h-6 w-11 shrink-0 rounded-full border-0 p-0 transition-colors',
        on ? 'bg-primary' : 'bg-muted',
        disabled && 'opacity-40',
      )}
    >
      <span
        className={cn(
          'absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform',
          // track 44 − knob 20 − inset 2 = 20px of travel
          on ? 'translate-x-5' : 'translate-x-0',
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
