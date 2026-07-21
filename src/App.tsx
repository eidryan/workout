import { Routes, Route, NavLink } from 'react-router-dom'
import { Dumbbell, Settings, History } from 'lucide-react'
import { cn } from '@/lib/utils'
import TodayPage from '@/routes/TodayPage'
import SettingsPage from '@/routes/SettingsPage'
import HistoryPage from '@/routes/HistoryPage'
import { RestTimerProvider } from '@/hooks/RestTimerContext'
import { RestTimerPill } from '@/components/RestTimerPill'

export default function App() {
  return (
    <RestTimerProvider>
      <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-background">
        <main className="flex-1 overflow-y-auto pb-24">
          <Routes>
            <Route path="/" element={<TodayPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/history" element={<HistoryPage />} />
          </Routes>
        </main>

        {/* Floating, non-modal rest timer */}
        <RestTimerPill />

        <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="grid grid-cols-3">
            <NavItem to="/" label="Today" icon={<Dumbbell className="h-5 w-5" />} />
            <NavItem to="/history" label="History" icon={<History className="h-5 w-5" />} />
            <NavItem to="/settings" label="Settings" icon={<Settings className="h-5 w-5" />} />
          </div>
        </nav>
      </div>
    </RestTimerProvider>
  )
}

function NavItem({ to, label, icon }: { to: string; label: string; icon: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        cn(
          'flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors',
          isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
        )
      }
    >
      {icon}
      {label}
    </NavLink>
  )
}
