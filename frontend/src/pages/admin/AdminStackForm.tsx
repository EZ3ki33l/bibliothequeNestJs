import { Button, FieldError, Form, Input, Label, TextArea, TextField } from '@heroui/react';
import { createAdminStack, updateAdminStack } from '../../lib/admin';
import { useAdminSubmit } from '../../components/admin/useAdminSubmit';
import { ErrorMessage } from '../../components/ui/ErrorMessage';

type AdminStackFormProps = {
  mode: 'create' | 'edit';
  stackId?: string;
  initialName?: string;
  initialDescription?: string;
  onSuccess: () => void;
};

/** Formulaire de création et de modification d'un stack. */
export function AdminStackForm({
  mode,
  stackId,
  initialName = '',
  initialDescription = '',
  onSuccess,
}: AdminStackFormProps) {
  const isEdit = mode === 'edit';
  const { error, pending, submit } = useAdminSubmit({
    success: isEdit ? 'Stack enregistré' : 'Stack créé',
    failure: isEdit ? 'Impossible de modifier le stack' : 'Impossible de créer le stack',
    onSuccess,
  });

  function handleSubmit(form: HTMLFormElement) {
    // `FormData` lit les champs par leur attribut `name` : le formulaire n'a
    // donc pas besoin d'un `useState` par champ (formulaire « non contrôlé »).
    const data = new FormData(form);
    const payload = {
      name: String(data.get('name') ?? '').trim(),
      description: String(data.get('description') ?? '').trim(),
    };

    // En création, `createAdminStack` retire les champs vides ; en modification,
    // une description vide est envoyée telle quelle, ce qui l'efface.
    void submit(() =>
      isEdit && stackId ? updateAdminStack(stackId, payload) : createAdminStack(payload),
    );
  }

  return (
    <Form
      className="flex max-w-md flex-col gap-4"
      validationBehavior="aria"
      onSubmit={(event) => {
        // Sans ça, le navigateur rechargerait la page : on veut envoyer en fetch.
        event.preventDefault();
        handleSubmit(event.currentTarget);
      }}
    >
      <TextField isRequired name="name" defaultValue={initialName} minLength={2} autoComplete="off">
        <Label>Nom</Label>
        <Input />
        <FieldError />
      </TextField>
      <TextField name="description" defaultValue={initialDescription}>
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
            : 'Créer le stack'}
      </Button>
    </Form>
  );
}
