import { appBackground } from './styles'
import { DelayedLoading } from './components/DelayedLoading'

export function StartupScreen({ text }: { text: string }) {
  return <div className={`flex min-h-screen flex-col items-center justify-center ${appBackground}`}>
    <div className="min-h-14"><DelayedLoading>{text}</DelayedLoading></div>
  </div>
}
