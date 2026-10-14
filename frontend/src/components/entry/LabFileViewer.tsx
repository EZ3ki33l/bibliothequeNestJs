import { useState } from 'react';
import { Button, Disclosure } from '@heroui/react';
import { downloadLabFile } from '../../lib/labArchive';
import { fencedCode, labFileLanguage } from '../../lib/labFiles';
import { EntryMdx } from './EntryMdx';

/**
 * Un fichier du laboratoire, lisible avant tout téléchargement. Le contenu
 * passe par `EntryMdx` dans un bloc de code clôturé (`fencedCode`) : coloration
 * et règles d'affichage du corps, aucun HTML brut.
 */
export function LabFileViewer({ path, content }: { path: string; content: string }) {
  const [status, setStatus] = useState('');

  async function copy() {
    try {
      await navigator.clipboard.writeText(content);
      setStatus(`Fichier ${path} copié.`);
    } catch {
      setStatus(`Le fichier ${path} n’a pas pu être copié.`);
    }
  }

  function download() {
    const result = downloadLabFile(path, content);
    setStatus(result.ok ? `Fichier ${path} téléchargé.` : result.message);
  }

  return (
    <Disclosure>
      <Disclosure.Heading>
        <Disclosure.Trigger className="font-mono text-sm">
          {path}
          <Disclosure.Indicator />
        </Disclosure.Trigger>
      </Disclosure.Heading>
      <Disclosure.Content>
        <Disclosure.Body>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              aria-label={`Copier le fichier ${path}`}
              onPress={() => void copy()}
            >
              Copier
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              aria-label={`Télécharger le fichier ${path} seul`}
              onPress={download}
            >
              Télécharger ce fichier
            </Button>
          </div>
          <p role="status" className="text-muted text-sm empty:hidden">
            {status}
          </p>
          <EntryMdx source={fencedCode(content, labFileLanguage(path))} />
        </Disclosure.Body>
      </Disclosure.Content>
    </Disclosure>
  );
}
