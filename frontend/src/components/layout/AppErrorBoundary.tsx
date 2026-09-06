import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ErrorPage } from '../../pages/ErrorPage';

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
};

/**
 * Limite d’erreur de l’application (research.md §2).
 *
 * React n’autorise cet usage que sur une classe : une fonction ne peut pas
 * implémenter `getDerivedStateFromError`. Pas de paquet `react-error-boundary`
 * (YAGNI) : cette classe locale suffit.
 *
 * `hasError` est un booléen volontairement pauvre : on ne garde pas l’objet
 * `Error`, pour ne jamais le rendre dans l’UI par accident.
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('AppErrorBoundary', error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return <ErrorPage />;
    }

    return this.props.children;
  }
}
