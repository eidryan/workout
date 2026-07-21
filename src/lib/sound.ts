import type { SoundType, VibrationType } from '@/db/types'

/**
 * Audio + haptic + notification feedback for the rest timer.
 * Sounds are synthesised via the Web Audio API — no asset files required.
 * The AudioContext is created lazily on first use (must follow a user gesture).
 */
let ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext
    if (!Ctor) return null
    ctx = new Ctor()
  }
  return ctx
}

/** One tone. `offset` schedules it relative to now; `volume` is 0..1. */
function tone(
  c: AudioContext,
  freq: number,
  offset: number,
  duration: number,
  volume: number,
  type: OscillatorType = 'sine',
) {
  const now = c.currentTime
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = type
  osc.frequency.value = freq
  const peak = Math.max(0.0001, Math.min(1, volume))
  gain.gain.setValueAtTime(0.0001, now + offset)
  gain.gain.exponentialRampToValueAtTime(peak, now + offset + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + duration)
  osc.connect(gain)
  gain.connect(c.destination)
  osc.start(now + offset)
  osc.stop(now + offset + duration + 0.02)
}

/** Play the rest-end sound of the chosen type at the given volume (0..1). */
export function playSound(type: SoundType = 'beep', volume = 0.3): void {
  const c = getCtx()
  if (!c) return
  if (c.state === 'suspended') c.resume().catch(() => {})

  switch (type) {
    case 'chime':
      // Gentle ascending three-note arpeggio.
      tone(c, 660, 0, 0.18, volume)
      tone(c, 880, 0.16, 0.18, volume)
      tone(c, 1320, 0.32, 0.28, volume)
      break
    case 'buzz':
      // Low, insistent square-wave buzz.
      tone(c, 220, 0, 0.22, volume, 'square')
      tone(c, 220, 0.28, 0.22, volume, 'square')
      break
    case 'beep':
    default:
      // Two short sine beeps — distinct over music.
      tone(c, 880, 0, 0.14, volume)
      tone(c, 1100, 0.18, 0.14, volume)
      break
  }
}

const VIBRATION_PATTERNS: Record<VibrationType, number | number[]> = {
  short: 200,
  double: [200, 100, 200],
  long: [500],
}

/** Vibrates the device with the chosen pattern. Silently no-ops on desktop. */
export function vibrate(type: VibrationType = 'double'): void {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(VIBRATION_PATTERNS[type])
    } catch {
      // ignore — not all browsers honour it
    }
  }
}

/**
 * Request notification permission. Must be called from a user gesture
 * (e.g. toggling the setting). Returns true if granted.
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  try {
    return (await Notification.requestPermission()) === 'granted'
  } catch {
    return false
  }
}

/**
 * Fire a notification (used when rest ends while the app is backgrounded).
 * Prefers the service-worker registration — required on Android Chrome, where
 * the `Notification` constructor is unsupported — falling back to a plain
 * Notification on desktop.
 */
export async function fireNotification(title: string, body: string): Promise<void> {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission !== 'granted') return
  const options: NotificationOptions = {
    body,
    tag: 'rest-timer',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    // @ts-expect-error vibrate is valid on Android but missing from the DOM lib types
    vibrate: [200, 100, 200],
  }
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    if (reg) {
      await reg.showNotification(title, options)
    } else {
      new Notification(title, options)
    }
  } catch {
    // ignore — best effort
  }
}
