import { Sandpack } from '@codesandbox/sandpack-react';
import { resolveSandpackTemplate } from '../../lib/sandpack';
import type { SandpackFiles } from '../../lib/stacks';

type PlaygroundProps = {
  files: SandpackFiles;
  template?: string;
  dependencies?: SandpackFiles;
};

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
