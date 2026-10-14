import { useState } from 'react';
import { Button } from '@heroui/react';
import { downloadLabArchive } from '../../lib/labArchive';
import { buildFileTree, type LabTreeNode } from '../../lib/labFiles';
import { LAB_HOST_LABEL, LAB_TOOL_LABEL } from '../../lib/labels';
import type { EntryLab as EntryLabData } from '../../lib/stacks';
import { Typo } from '../ui/Typo';
import { EntryMdx } from './EntryMdx';
import { LabFileViewer } from './LabFileViewer';
import { LabWarning } from './LabWarning';

type EntryLabProps = { slug: string; title: string; lab: EntryLabData };

/** Un dossier et ses enfants, un fichier par `Disclosure`. */
function Tree({ nodes }: { nodes: LabTreeNode[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {nodes.map((node) =>
        node.children ? (
          <li key={node.path}>
            <Typo variant="small" className="text-muted font-mono">
              {node.name}/
            </Typo>
            <div className="border-border mt-1 ml-2 border-l pl-3">
              <Tree nodes={node.children} />
            </div>
          </li>
        ) : (
          <li key={node.path}>
            <LabFileViewer path={node.path} content={node.content ?? ''} />
          </li>
        ),
      )}
    </ul>
  );
}

/**
 * Section « Laboratoire » d'une fiche (spec 018) : prérequis, avertissement
 * fixe, fichiers lisibles, archive produite dans le navigateur, étapes de
 * lancement puis d'arrêt. Composant de présentation, rendu par `EntryArticle`
 * (page publique et aperçu identiques). Le bouton est `primary` **sans**
 * `cta` : la fiche garde un seul appel principal, l'examen.
 */
export function EntryLab({ slug, title, lab }: EntryLabProps) {
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function download() {
    setPending(true);
    setError('');
    const result = await downloadLabArchive(slug, title, lab);
    setPending(false);
    if (!result.ok) setError(result.message);
  }

  return (
    <section
      aria-labelledby="entry-lab-title"
      className="border-border flex flex-col gap-5 border-t pt-6"
    >
      <Typo as="h2" variant="h3" id="entry-lab-title">
        Laboratoire
      </Typo>

      <dl className="text-muted grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt>Outil</dt>
        <dd className="text-foreground">{LAB_TOOL_LABEL[lab.tool]}</dd>
        {lab.software ? (
          <>
            <dt>Logiciels</dt>
            <dd className="text-foreground wrap-break-word">{lab.software}</dd>
          </>
        ) : null}
        <dt>Mémoire</dt>
        <dd className="text-foreground">{lab.ramGb} Go</dd>
        <dt>Disque</dt>
        <dd className="text-foreground">{lab.diskGb} Go</dd>
        <dt>Systèmes hôtes</dt>
        <dd className="text-foreground">
          {lab.hosts.map((host) => LAB_HOST_LABEL[host]).join(', ')}
        </dd>
      </dl>

      <LabWarning securityLab={lab.securityLab} />

      <div>
        <Typo as="h3" variant="h4" className="mb-2">
          Fichiers
        </Typo>
        <Tree nodes={buildFileTree(lab.files)} />
      </div>

      <div className="flex flex-col items-start gap-2">
        <Button
          type="button"
          variant="primary"
          isDisabled={pending}
          onPress={() => void download()}
        >
          {pending ? 'Préparation…' : 'Télécharger le laboratoire'}
        </Button>
        <p role="status" className="text-danger-soft-foreground text-sm empty:hidden">
          {error}
        </p>
      </div>

      {lab.setupMd.trim() ? (
        <div>
          <Typo as="h3" variant="h4" className="mb-2">
            Lancement
          </Typo>
          <EntryMdx source={lab.setupMd} />
        </div>
      ) : null}
      {lab.teardownMd.trim() ? (
        <div>
          <Typo as="h3" variant="h4" className="mb-2">
            Arrêt et destruction
          </Typo>
          <EntryMdx source={lab.teardownMd} />
        </div>
      ) : null}
    </section>
  );
}
