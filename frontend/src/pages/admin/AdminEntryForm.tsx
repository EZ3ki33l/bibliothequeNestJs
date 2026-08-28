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
  toast,
} from '@heroui/react';
import {
  createAdminEntry,
  updateAdminEntry,
  type AdminCategoryListItem,
  type CreateAdminEntryInput,
  type UpdateAdminEntryInput,
} from '../../lib/admin';
import { DIFFICULTY_LABEL, KIND_LABEL } from '../../lib/labels';
import { SANDPACK_TEMPLATES } from '../../lib/sandpack';
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
      initialKind: CreateAdminEntryInput['kind'];
      initialSummary: string;
      initialBodyMdx: string;
      initialDifficulty: NonNullable<CreateAdminEntryInput['difficulty']>;
      initialTags: string;
      initialPublished: boolean;
      initialTemplate: string;
      initialFiles: Record<string, string>;
      initialDependencies: Record<string, string>;
      onSuccess: () => void;
    };

export function AdminEntryForm(props: AdminEntryFormProps) {
  const { mode, onSuccess } = props;
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [files, setFiles] = useState<KeyValuePair[]>(() =>
    recordToPairs(mode === 'edit' ? props.initialFiles : undefined),
  );
  const [dependencies, setDependencies] = useState<KeyValuePair[]>(() =>
    recordToPairs(mode === 'edit' ? props.initialDependencies : undefined),
  );

  async function handleSubmit(form: HTMLFormElement) {
    setError(null);
    setPending(true);

    const filesResult = pairsToRecord(files, 'Chaque fichier doit avoir un chemin.');
    const dependenciesResult = pairsToRecord(
      dependencies,
      'Chaque dépendance doit avoir un nom de paquet.',
    );

    if (!filesResult.ok) {
      setError(filesResult.message);
      setPending(false);
      return;
    }
    if (!dependenciesResult.ok) {
      setError(dependenciesResult.message);
      setPending(false);
      return;
    }

    const data = new FormData(form);
    const tags = String(data.get('tags') ?? '')
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);

    const title = String(data.get('title') ?? '').trim();
    const kind = String(data.get('kind') ?? '').trim() as CreateAdminEntryInput['kind'];
    const summary = String(data.get('summary') ?? '').trim();
    const bodyMdx = String(data.get('bodyMdx') ?? '').trim();
    const difficulty = String(data.get('difficulty') ?? '').trim() as NonNullable<
      CreateAdminEntryInput['difficulty']
    >;
    const published = data.get('published') === 'on';
    const template = String(data.get('template') ?? '').trim();

    try {
      if (mode === 'create') {
        const payload: CreateAdminEntryInput = {
          categoryId: String(data.get('categoryId') ?? '').trim(),
          title,
          kind,
        };
        if (summary.length > 0) payload.summary = summary;
        if (bodyMdx.length > 0) payload.bodyMdx = bodyMdx;
        if (difficulty.length > 0) payload.difficulty = difficulty;
        if (tags.length > 0) payload.tags = tags;
        if (published) payload.published = true;
        if (template.length > 0) payload.template = template;
        if (Object.keys(filesResult.value).length > 0) payload.files = filesResult.value;
        if (Object.keys(dependenciesResult.value).length > 0) {
          payload.dependencies = dependenciesResult.value;
        }

        const result = await createAdminEntry(payload);
        if (!result.ok) {
          setError(result.message);
          return;
        }
      } else {
        const payload: UpdateAdminEntryInput = {
          title,
          kind,
          summary,
          bodyMdx,
          difficulty,
          tags,
          published,
          template,
          files: filesResult.value,
          dependencies: dependenciesResult.value,
        };

        const result = await updateAdminEntry(props.entryId, payload);
        if (!result.ok) {
          setError(result.message);
          return;
        }
      }
      toast.success(mode === 'edit' ? 'Fiche enregistrée' : 'Fiche créée');
      onSuccess();
    } catch {
      setError(
        mode === 'edit' ? 'Impossible de modifier la fiche' : 'Impossible de créer la fiche',
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Form
      className="flex max-w-2xl flex-col gap-4"
      validationBehavior="aria"
      onSubmit={(event) => {
        event.preventDefault();
        void handleSubmit(event.currentTarget);
      }}
    >
      {mode === 'create' ? (
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
        defaultValue={mode === 'edit' ? props.initialTitle : ''}
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
        defaultValue={mode === 'edit' ? props.initialKind : undefined}
        placeholder="Choisir un type"
        items={Object.entries(KIND_LABEL).map(([id, label]) => ({ id, label }))}
      />
      <TextField name="summary" defaultValue={mode === 'edit' ? props.initialSummary : ''}>
        <Label>Résumé (optionnel)</Label>
        <TextArea />
        <FieldError />
      </TextField>
      <TextField name="bodyMdx" defaultValue={mode === 'edit' ? props.initialBodyMdx : ''}>
        <Label>Corps (optionnel)</Label>
        <TextArea rows={8} />
        <FieldError />
      </TextField>
      <AdminSelect
        name="difficulty"
        label="Difficulté"
        defaultValue={mode === 'edit' ? props.initialDifficulty : 'BEGINNER'}
        items={Object.entries(DIFFICULTY_LABEL).map(([id, label]) => ({ id, label }))}
      />
      <TextField
        name="tags"
        defaultValue={mode === 'edit' ? props.initialTags : ''}
        autoComplete="off"
      >
        <Label>Étiquettes (optionnel, séparées par des virgules)</Label>
        <Input />
        <FieldError />
      </TextField>
      <Checkbox
        name="published"
        value="on"
        defaultSelected={mode === 'edit' ? props.initialPublished : false}
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
        defaultValue={mode === 'edit' ? props.initialTemplate || 'react-ts' : 'react-ts'}
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
          ? mode === 'edit'
            ? 'Enregistrement…'
            : 'Création…'
          : mode === 'edit'
            ? 'Enregistrer'
            : 'Créer la fiche'}
      </Button>
    </Form>
  );
}
