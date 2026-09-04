import { Button, FieldError, Form, Input, Label, TextArea, TextField } from '@heroui/react';
import { createAdminCategory, updateAdminCategory, type AdminStackListItem } from '../../lib/admin';
import { useAdminSubmit } from '../../components/admin/useAdminSubmit';
import { AdminSelect } from '../../components/admin/AdminSelect';
import { ErrorMessage } from '../../components/ui/ErrorMessage';

/**
 * Les deux modes n'ont pas les mêmes champs, d'où une union de types plutôt
 * qu'un objet aux propriétés toutes optionnelles : à la création il faut
 * choisir un stack parent, à la modification il est figé et seulement affiché.
 * TypeScript garantit alors qu'on ne lit `props.stacks` que dans le bon mode.
 */
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
  const isEdit = mode === 'edit';
  const { error, pending, submit } = useAdminSubmit({
    success: isEdit ? 'Catégorie enregistrée' : 'Catégorie créée',
    failure: isEdit ? 'Impossible de modifier la catégorie' : 'Impossible de créer la catégorie',
    onSuccess,
  });

  function handleSubmit(form: HTMLFormElement) {
    const data = new FormData(form);
    const fields = {
      name: String(data.get('name') ?? '').trim(),
      description: String(data.get('description') ?? '').trim(),
    };

    void submit(() =>
      props.mode === 'edit'
        ? updateAdminCategory(props.categoryId, fields)
        : createAdminCategory({
            stackId: String(data.get('stackId') ?? '').trim(),
            ...fields,
          }),
    );
  }

  return (
    <Form
      className="flex max-w-md flex-col gap-4"
      validationBehavior="aria"
      onSubmit={(event) => {
        event.preventDefault();
        handleSubmit(event.currentTarget);
      }}
    >
      {props.mode === 'create' ? (
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
        defaultValue={props.mode === 'edit' ? props.initialName : ''}
        minLength={2}
        autoComplete="off"
      >
        <Label>Nom</Label>
        <Input />
        <FieldError />
      </TextField>
      <TextField
        name="description"
        defaultValue={props.mode === 'edit' ? props.initialDescription : ''}
      >
        <Label>Description (optionnelle)</Label>
        <TextArea />
        <FieldError />
      </TextField>

      {error ? <ErrorMessage>{error}</ErrorMessage> : null}

      <Button type="submit" variant="primary" isDisabled={pending}>
        {pending
          ? isEdit
            ? 'Enregistrement…'
            : 'Création…'
          : isEdit
            ? 'Enregistrer'
            : 'Créer la catégorie'}
      </Button>
    </Form>
  );
}
