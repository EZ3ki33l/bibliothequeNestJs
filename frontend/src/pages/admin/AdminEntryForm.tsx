import { useState } from 'react';
import {
  Button,
  Checkbox,
  FieldError,
  Form,
  Input,
  Label,
  TextArea,
  TextField,
} from '@heroui/react';
import {
  createAdminEntry,
  updateAdminEntry,
  type AdminCategoryListItem,
  type AdminEntryDifficulty,
  type AdminEntryKind,
} from '../../lib/admin';
import { DIFFICULTY_LABEL, KIND_LABEL } from '../../lib/labels';
import { SANDPACK_TEMPLATES } from '../../lib/sandpack';
import { useAdminSubmit } from '../../components/admin/useAdminSubmit';
import { AdminSelect } from '../../components/admin/AdminSelect';
import { AdminKeyValueList } from '../../components/admin/AdminKeyValueList';
import {
  pairsToRecord,
  recordToPairs,
  type KeyValuePair,
} from '../../components/admin/keyValuePairs';
import { ErrorMessage } from '../../components/ui/ErrorMessage';

type AdminEntryFormProps =
  | {
      mode: 'create';
      categories: AdminCategoryListItem[];
      onSuccess: () => void;
    }
  | {
      mode: 'edit';
      entryId: string;
      categoryLabel: string;
      initialTitle: string;
      initialKind: AdminEntryKind;
      initialSummary: string;
      initialBodyMdx: string;
      initialDifficulty: AdminEntryDifficulty;
      initialTags: string;
      initialPublished: boolean;
      initialTemplate: string;
      initialFiles: Record<string, string>;
      initialDependencies: Record<string, string>;
      onSuccess: () => void;
    };

export function AdminEntryForm(props: AdminEntryFormProps) {
  const { mode, onSuccess } = props;
  const isEdit = mode === 'edit';
  const { error, pending, setError, submit } = useAdminSubmit({
    success: isEdit ? 'Fiche enregistrée' : 'Fiche créée',
    failure: isEdit ? 'Impossible de modifier la fiche' : 'Impossible de créer la fiche',
    onSuccess,
  });

  /**
   * Fichiers du playground et dépendances npm sont des listes modifiables :
   * elles ne peuvent pas venir de `FormData`, d'où un `useState` pour ces deux
   * champs seulement (le reste du formulaire est non contrôlé).
   */
  const [files, setFiles] = useState<KeyValuePair[]>(() =>
    recordToPairs(props.mode === 'edit' ? props.initialFiles : undefined),
  );
  const [dependencies, setDependencies] = useState<KeyValuePair[]>(() =>
    recordToPairs(props.mode === 'edit' ? props.initialDependencies : undefined),
  );

  function handleSubmit(form: HTMLFormElement) {
    // Validation locale avant tout appel réseau : une paire sans clé est une
    // erreur de saisie, inutile de la faire voyager jusqu'au serveur.
    const filesResult = pairsToRecord(files, 'Chaque fichier doit avoir un chemin.');
    if (!filesResult.ok) {
      setError(filesResult.message);
      return;
    }

    const dependenciesResult = pairsToRecord(
      dependencies,
      'Chaque dépendance doit avoir un nom de paquet.',
    );
    if (!dependenciesResult.ok) {
      setError(dependenciesResult.message);
      return;
    }

    const data = new FormData(form);

    /**
     * Payload complet, sans tri des champs vides : c'est `lib/admin.ts` qui
     * décide quoi envoyer selon le verbe HTTP (à la création les champs vides
     * sont retirés pour laisser jouer les défauts du serveur ; à la
     * modification ils sont conservés pour pouvoir effacer une valeur).
     */
    const fields = {
      title: String(data.get('title') ?? '').trim(),
      kind: String(data.get('kind') ?? '').trim() as AdminEntryKind,
      summary: String(data.get('summary') ?? '').trim(),
      bodyMdx: String(data.get('bodyMdx') ?? '').trim(),
      difficulty: String(data.get('difficulty') ?? '').trim() as AdminEntryDifficulty,
      // Une case cochée envoie `on` ; décochée, elle n'envoie rien.
      published: data.get('published') === 'on',
      template: String(data.get('template') ?? '').trim(),
      // « react, hooks , » → ['react', 'hooks']
      tags: String(data.get('tags') ?? '')
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0),
      files: filesResult.value,
      dependencies: dependenciesResult.value,
    };

    void submit(() =>
      props.mode === 'edit'
        ? updateAdminEntry(props.entryId, fields)
        : createAdminEntry({
            categoryId: String(data.get('categoryId') ?? '').trim(),
            ...fields,
          }),
    );
  }

  return (
    <Form
      className="flex max-w-2xl flex-col gap-4"
      validationBehavior="aria"
      onSubmit={(event) => {
        event.preventDefault();
        handleSubmit(event.currentTarget);
      }}
    >
      {props.mode === 'create' ? (
        <AdminSelect
          name="categoryId"
          label="Catégorie parente"
          isRequired
          placeholder="Choisir une catégorie"
          items={props.categories.map((category) => ({
            id: category.id,
            label: `${category.stack.name} / ${category.name}`,
          }))}
        />
      ) : (
        <p className="text-muted text-sm">Catégorie parente : {props.categoryLabel}</p>
      )}
      <TextField
        isRequired
        name="title"
        defaultValue={props.mode === 'edit' ? props.initialTitle : ''}
        minLength={2}
        autoComplete="off"
      >
        <Label>Titre</Label>
        <Input />
        <FieldError />
      </TextField>
      <AdminSelect
        name="kind"
        label="Type"
        isRequired
        defaultValue={props.mode === 'edit' ? props.initialKind : undefined}
        placeholder="Choisir un type"
        items={Object.entries(KIND_LABEL).map(([id, label]) => ({ id, label }))}
      />
      <TextField name="summary" defaultValue={props.mode === 'edit' ? props.initialSummary : ''}>
        <Label>Résumé (optionnel)</Label>
        <TextArea />
        <FieldError />
      </TextField>
      <TextField name="bodyMdx" defaultValue={props.mode === 'edit' ? props.initialBodyMdx : ''}>
        <Label>Corps (optionnel)</Label>
        <TextArea rows={8} />
        <FieldError />
      </TextField>
      <AdminSelect
        name="difficulty"
        label="Difficulté"
        defaultValue={props.mode === 'edit' ? props.initialDifficulty : 'BEGINNER'}
        items={Object.entries(DIFFICULTY_LABEL).map(([id, label]) => ({ id, label }))}
      />
      <TextField
        name="tags"
        defaultValue={props.mode === 'edit' ? props.initialTags : ''}
        autoComplete="off"
      >
        <Label>Étiquettes (optionnel, séparées par des virgules)</Label>
        <Input />
        <FieldError />
      </TextField>
      <Checkbox
        name="published"
        value="on"
        defaultSelected={props.mode === 'edit' ? props.initialPublished : false}
      >
        <Checkbox.Content>
          <Checkbox.Control>
            <Checkbox.Indicator />
          </Checkbox.Control>
          <Label>Publié</Label>
        </Checkbox.Content>
      </Checkbox>
      <AdminSelect
        name="template"
        label="Modèle Sandpack"
        defaultValue={props.mode === 'edit' ? props.initialTemplate || 'react-ts' : 'react-ts'}
        items={SANDPACK_TEMPLATES.map((id) => ({ id, label: id }))}
      />
      <AdminKeyValueList
        title="Fichiers du playground"
        description="Un fichier = un chemin et son code, sans JSON."
        addLabel="Ajouter un fichier"
        emptyLabel="Aucun fichier. Le playground n’apparaîtra pas sur la fiche."
        keyLabel="Chemin"
        keyPlaceholder="/App.tsx"
        valueLabel="Code"
        valuePlaceholder={'import { useState } from "react";\n'}
        valueRows={12}
        pairs={files}
        onChange={setFiles}
      />
      <AdminKeyValueList
        title="Dépendances npm"
        description="Paquet et version, comme dans package.json."
        addLabel="Ajouter une dépendance"
        emptyLabel="Aucune dépendance supplémentaire."
        keyLabel="Paquet"
        keyPlaceholder="react"
        valueLabel="Version"
        valuePlaceholder="^19.0.0"
        compact
        pairs={dependencies}
        onChange={setDependencies}
      />

      {error ? <ErrorMessage>{error}</ErrorMessage> : null}

      <Button type="submit" variant="primary" isDisabled={pending}>
        {pending
          ? isEdit
            ? 'Enregistrement…'
            : 'Création…'
          : isEdit
            ? 'Enregistrer'
            : 'Créer la fiche'}
      </Button>
    </Form>
  );
}
