import { Checkbox, FieldError, Input, Label, TextArea, TextField } from '@heroui/react';
import { LAB_HOST_LABEL, LAB_TOOL_LABEL } from '../../lib/labels';
import { labFilesRefusal } from '../../lib/labFiles';
import type { EntryLab, LabHost } from '../../lib/stacks';
import { Typo } from '../ui/Typo';
import { AdminKeyValueList } from './AdminKeyValueList';
import { AdminSelect } from './AdminSelect';
import { pairsToRecord, type KeyValuePair } from './keyValuePairs';

type AdminLabEditorProps = {
  /** Valeurs de départ (fiche existante ou copie) ; `null` : aucun laboratoire. */
  initial: EntryLab | null;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  files: KeyValuePair[];
  onFilesChange: (files: KeyValuePair[]) => void;
};

/** Message immédiat sur les fichiers saisis, avant même l'enregistrement. */
function filesHint(files: KeyValuePair[]): string | null {
  const record = pairsToRecord(files);
  return record.ok ? labFilesRefusal(record.value) : record.message;
}

/**
 * Bloc « Laboratoire » du formulaire de fiche (spec 018).
 *
 * Le formulaire est non contrôlé : les champs sont **cachés, jamais démontés**
 * quand la case est décochée, sans quoi la saisie serait perdue. Les champs
 * portent un `name` (lus par `readEntryFields`), sauf la liste de fichiers,
 * état React comme celle du playground.
 */
export function AdminLabEditor({
  initial,
  enabled,
  onEnabledChange,
  files,
  onFilesChange,
}: AdminLabEditorProps) {
  const hint = enabled ? filesHint(files) : null;
  const hosts: LabHost[] = Object.keys(LAB_HOST_LABEL) as LabHost[];

  return (
    <section className="border-border flex flex-col gap-4 rounded-xl border p-4">
      <Checkbox
        name="labEnabled"
        value="on"
        defaultSelected={initial !== null}
        onChange={onEnabledChange}
      >
        <Checkbox.Content>
          <Checkbox.Control>
            <Checkbox.Indicator />
          </Checkbox.Control>
          <Label>Cette fiche a un laboratoire</Label>
        </Checkbox.Content>
      </Checkbox>

      <div className={enabled ? 'flex flex-col gap-4' : 'hidden'}>
        <Typo variant="caption">
          Aucun mot de passe réel : un laboratoire est téléchargeable par tous ceux qui lisent la
          fiche. Son contenu s’exécute chez l’apprenant, il se relit avant publication.
        </Typo>
        <AdminSelect
          name="labTool"
          label="Outil"
          defaultValue={initial?.tool}
          placeholder="Choisir un outil"
          items={Object.entries(LAB_TOOL_LABEL).map(([id, label]) => ({ id, label }))}
        />
        <Checkbox name="labSecurity" value="on" defaultSelected={initial?.securityLab ?? false}>
          <Checkbox.Content>
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
            <Label>
              Laboratoire de sécurité (ajoute l’avertissement d’isolement et de cadre légal)
            </Label>
          </Checkbox.Content>
        </Checkbox>
        <TextField
          name="labSoftware"
          defaultValue={initial?.software ?? ''}
          maxLength={300}
          autoComplete="off"
        >
          <Label>Logiciels requis</Label>
          <Input placeholder="VirtualBox 7.1, Vagrant 2.4" />
          <FieldError />
        </TextField>
        <div className="flex flex-col gap-4 sm:flex-row">
          <TextField name="labRamGb" type="number" defaultValue={String(initial?.ramGb ?? 4)}>
            <Label>Mémoire (Go)</Label>
            <Input min={1} max={128} />
            <FieldError />
          </TextField>
          <TextField name="labDiskGb" type="number" defaultValue={String(initial?.diskGb ?? 10)}>
            <Label>Disque (Go)</Label>
            <Input min={1} max={500} />
            <FieldError />
          </TextField>
        </div>
        <fieldset className="flex flex-wrap gap-4">
          <legend className="text-sm font-medium">Systèmes hôtes</legend>
          {hosts.map((host) => (
            <Checkbox
              key={host}
              name="labHost"
              value={host}
              defaultSelected={initial ? initial.hosts.includes(host) : host === 'LINUX'}
            >
              <Checkbox.Content>
                <Checkbox.Control>
                  <Checkbox.Indicator />
                </Checkbox.Control>
                <Label>{LAB_HOST_LABEL[host]}</Label>
              </Checkbox.Content>
            </Checkbox>
          ))}
        </fieldset>
        <TextField name="labSetupMd" defaultValue={initial?.setupMd ?? ''} maxLength={5000}>
          <Label>Étapes de lancement (Markdown)</Label>
          <TextArea rows={5} />
          <FieldError />
        </TextField>
        <TextField name="labTeardownMd" defaultValue={initial?.teardownMd ?? ''} maxLength={3000}>
          <Label>Étapes d’arrêt et de destruction (Markdown)</Label>
          <TextArea rows={4} />
          <FieldError />
        </TextField>
        <AdminKeyValueList
          title="Fichiers du laboratoire"
          description="Un fichier = un chemin relatif et son contenu texte. 30 fichiers, 200 000 caractères au plus."
          addLabel="Ajouter un fichier"
          emptyLabel="Aucun fichier."
          keyLabel="Chemin"
          keyPlaceholder="provision/serveur.sh"
          valueLabel="Contenu"
          valueRows={10}
          pairs={files}
          onChange={onFilesChange}
        />
        <p role="status" className="text-danger-soft-foreground text-sm empty:hidden">
          {hint}
        </p>
      </div>
    </section>
  );
}
