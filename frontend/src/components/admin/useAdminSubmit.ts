import { useState } from 'react';
import { toast } from '@heroui/react';
import type { AdminWriteResult } from '../../lib/admin';

type UseAdminSubmitOptions = {
  /** Notification affichée quand l'enregistrement réussit. */
  success: string;
  /** Message affiché en cas d'échec imprévu (réseau, 500). */
  failure: string;
  /** Suite à donner après succès — en général une redirection. */
  onSuccess: () => void;
};

/**
 * Envoi d'un formulaire d'administration.
 *
 * Les trois formulaires (stack, catégorie, fiche) suivaient le même scénario :
 * désactiver le bouton, appeler l'API, afficher le message d'erreur métier
 * *dans* le formulaire, notifier le succès, réactiver le bouton. Seul le
 * contenu du payload changeait.
 *
 * Deux façons d'échouer, traitées différemment :
 * - `result.ok === false` : erreur attendue (saisie invalide, conflit) → le
 *   message du serveur s'affiche sous les champs ;
 * - exception : incident réseau ou serveur → message générique.
 *
 * `pending` sert à désactiver le bouton : sans lui, un double clic enverrait
 * deux créations.
 */
export function useAdminSubmit(options: UseAdminSubmitOptions) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(action: () => Promise<AdminWriteResult>) {
    setError(null);
    setPending(true);

    try {
      const result = await action();

      if (!result.ok) {
        setError(result.message);
        return;
      }

      toast.success(options.success);
      options.onSuccess();
    } catch {
      setError(options.failure);
    } finally {
      // `finally` : le bouton est réactivé même en cas d'erreur ou de `return`
      // anticipé, sinon le formulaire resterait bloqué.
      setPending(false);
    }
  }

  return { error, pending, setError, submit };
}
