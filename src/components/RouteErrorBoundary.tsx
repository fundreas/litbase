import { Component, type ErrorInfo, type ReactNode } from 'react'

import { Button } from '@/components/ui/Button'
import { ErrorState } from '@/components/ui/States'
import { env } from '@/lib/env'

interface State {
  error: Error | null
}

/**
 * Keeps a crashing page from taking down the whole shell — the header and
 * navigation stay usable so the user can go somewhere else.
 *
 * Class component because `componentDidCatch` has no hook equivalent.
 */
export class RouteErrorBoundary extends Component<
  { children: ReactNode },
  State
> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (env.isDev) {
      console.error('Route crashed:', error, info.componentStack)
    }
  }

  private readonly reset = () => {
    this.setState({ error: null })
  }

  render(): ReactNode {
    const { error } = this.state
    if (error === null) return this.props.children

    return (
      <div className="flex flex-col items-center">
        <ErrorState error={error} />
        <Button variant="secondary" size="sm" onClick={this.reset}>
          Seite neu aufbauen
        </Button>
      </div>
    )
  }
}
