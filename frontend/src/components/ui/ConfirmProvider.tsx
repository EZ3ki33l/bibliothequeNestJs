import { useCallback, useRef, useState, type ReactNode } from 'react';
import { AlertDialog, Button } from '@heroui/react';
import { ConfirmContext, type Confirm, type ConfirmOptions } from '../../lib/confirm';
import { Typo } from './Typo';

type Question = { message: string; options: ConfirmOptions };

/**
 * Fenêtre de confirmation unique de l'application, ouverte par `useConfirm()`.
 *
 * `AlertDialog` de HeroUI (react-aria dessous) : le focus y est piégé, Échap
 * vaut « Annuler », et le focus revient à l'élément qui l'a ouverte. La
 * dernière question reste en mémoire après la fermeture, pour que le texte ne
 * disparaisse pas pendant l'animation de sortie.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [question, setQuestion] = useState<Question | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const resolver = useRef<((accepted: boolean) => void) | null>(null);

  const confirm = useCallback<Confirm>((message, options) => {
    // Une question encore ouverte est refusée : une seule à la fois.
    resolver.current?.(false);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setQuestion({ message, options });
      setIsOpen(true);
    });
  }, []);

  function answer(accepted: boolean) {
    resolver.current?.(accepted);
    resolver.current = null;
    setIsOpen(false);
  }

  const danger = question?.options.danger === true;

  return (
    <ConfirmContext value={confirm}>
      {children}
      <AlertDialog.Backdrop
        isOpen={isOpen}
        isKeyboardDismissDisabled={false}
        onOpenChange={(open) => {
          if (!open) answer(false);
        }}
      >
        <AlertDialog.Container size="sm">
          <AlertDialog.Dialog>
            <AlertDialog.Header>
              <AlertDialog.Icon status={danger ? 'danger' : 'accent'} />
              <AlertDialog.Heading>{question?.options.title}</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              {/* Les questions de publication listent les manques ligne à ligne. */}
              <Typo variant="p" className="whitespace-pre-line">
                {question?.message}
              </Typo>
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button variant="tertiary" onPress={() => answer(false)}>
                Annuler
              </Button>
              <Button variant={danger ? 'danger' : 'primary'} onPress={() => answer(true)}>
                {question?.options.confirmLabel}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </ConfirmContext>
  );
}
