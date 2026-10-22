import { createContext, useContext } from 'react';

export type ConfirmOptions = {
  /** Titre court de la fenêtre (« Supprimer la note ? »). */
  title: string;
  /** Libellé du bouton qui accepte (« Supprimer », « Publier ») : jamais « OK ». */
  confirmLabel: string;
  /** Action destructrice : bouton et pictogramme Cherry. */
  danger?: boolean;
};

/** Résout `true` si l'action est acceptée, `false` sur « Annuler » ou Échap. */
export type Confirm = (message: string, options: ConfirmOptions) => Promise<boolean>;

export const ConfirmContext = createContext<Confirm | null>(null);

/**
 * Remplace `window.confirm` : la question s'affiche dans une fenêtre HeroUI aux
 * couleurs du site, pas dans une alerte du navigateur. À attendre :
 * `if (!(await confirm(question, options))) return;`.
 */
export function useConfirm(): Confirm {
  const confirm = useContext(ConfirmContext);
  if (confirm === null) {
    throw new Error('useConfirm() doit être appelé sous <ConfirmProvider>');
  }
  return confirm;
}
