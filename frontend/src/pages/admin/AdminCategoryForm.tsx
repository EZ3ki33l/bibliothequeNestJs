import { useState } from 'react';
import { Button, FieldError, Form, Input, Label, TextArea, TextField, toast } from '@heroui/react';
import { createAdminCategory, updateAdminCategory, type AdminStackListItem } from '../../lib/admin';
import { AdminSelect } from '../../components/admin/AdminSelect';
import { ErrorMessage } from '../../components/ui/ErrorMessage';

type AdminCategoryFormProps =
  | {
      mode: 'create';
      stacks: AdminStackListItem[];
      onSuccess: () => void;
    }
  | {
      mode: 'edit';
      categoryId: string;
      stackName: string;
      initialName: string;
      initialDescription: string;
      onSuccess: () => void;
    };

export function AdminCategoryForm(props: AdminCategoryFormProps) {
  const { mode, onSuccess } = props;
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(form: HTMLFormElement) {
    setError(null);
    setPending(true);

    const data = new FormData(form);
    const name = String(data.get('name') ?? '').trim();
    const description = String(data.get('description') ?? '').trim();

    try {
      const result =
        mode === 'edit'
          ? await updateAdminCategory(props.categoryId, {
              name,
              ...(description.length > 0 ? { description } : { description: '' }),
            })
          : await createAdminCategory({
              stackId: String(data.get('stackId') ?? '').trim(),
              name,
              ...(description.length > 0 ? { description } : {}),
            });

      if (!result.ok) {
        setError(result.message);
        return;
      }
      toast.success(mode === 'edit' ? 'Catégorie enregistrée' : 'Catégorie créée');
      onSuccess();
    } catch {
      setError(
        mode === 'edit'
          ? 'Impossible de modifier la catégorie'
          : 'Impossible de créer la catégorie',
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Form
      className="flex max-w-md flex-col gap-4"
      validationBehavior="aria"
      onSubmit={(event) => {
        event.preventDefault();
        void handleSubmit(event.currentTarget);
      }}
    >
      {mode === 'create' ? (
        <AdminSelect
          name="stackId"
          label="Stack parent"
          isRequired
          placeholder="Choisir un stack"
          items={props.stacks.map((stack) => ({ id: stack.id, label: stack.name }))}
        />
      ) : (
        <p className="text-muted text-sm">Stack parent : {props.stackName}</p>
      )}
      <TextField
        isRequired
        name="name"
        defaultValue={mode === 'edit' ? props.initialName : ''}
        minLength={2}
        autoComplete="off"
      >
        <Label>Nom</Label>
        <Input />
        <FieldError />
      </TextField>
      <TextField name="description" defaultValue={mode === 'edit' ? props.initialDescription : ''}>
        <Label>Description (optionnelle)</Label>
        <TextArea />
        <FieldError />
      </TextField>
      {error ? <ErrorMessage>{error}</ErrorMessage> : null}
      <Button type="submit" variant="primary" isDisabled={pending}>
        {pending
          ? mode === 'edit'
            ? 'Enregistrement…'
            : 'Création…'
          : mode === 'edit'
            ? 'Enregistrer'
            : 'Créer la catégorie'}
      </Button>
    </Form>
  );
}
