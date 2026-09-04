import { Sandpack } from '@codesandbox/sandpack-react';
import { resolveSandpackTemplate } from '../../lib/sandpack';
import type { SandpackFiles } from '../../lib/stacks';

type PlaygroundProps = {
  files: SandpackFiles;
  template?: string;
  dependencies?: SandpackFiles;
};

/**
 * Éditeur de code exécutable d'une fiche.
 *
 * Deux points à ne pas « corriger » :
 * - aucun import de feuille de style : Sandpack 2 injecte son CSS via Stitches,
 *   importer `@codesandbox/sandpack-react/dist/index.css` casse le build ;
 * - `customSetup` vaut `undefined` (et non `{}`) sans dépendances, sinon
 *   Sandpack relance une installation à chaque rendu.
 *
 * Le code s'exécute dans une iframe bac à sable côté CodeSandbox, pas dans notre
 * page : le contenu d'une fiche ne peut donc pas lire nos cookies de session.
 */
export function Playground({ files, template = 'react-ts', dependencies }: PlaygroundProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/8">
      <Sandpack
        template={resolveSandpackTemplate(template)}
        files={files}
        theme="dark"
        customSetup={dependencies ? { dependencies } : undefined}
        options={{
          showLineNumbers: true,
          editorHeight: 360,
          wrapContent: true,
        }}
      />
    </div>
  );
}
