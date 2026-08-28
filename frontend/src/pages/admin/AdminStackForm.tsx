import { useState } from 'react';
import { Button, FieldError, Form, Input, Label, TextArea, TextField, toast } from '@heroui/react';
import { createAdminStack, updateAdminStack } from '../../lib/admin';
import { ErrorMessage } from '../../components/ui/ErrorMessage';

type AdminStackFormProps = {
  mode: 'create' | 'edit';
  stackId?: string;
  initialName?: string;
  initialDescription?: string;
  onSuccess: () => void;
};

export function AdminStackForm({
  mode,
  stackId,
  initialName = '',
  initialDescription = '',
  onSuccess,
}: AdminStackFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(form: HTMLFormElement) {
    setError(null);
    setPending(true);

    const data = new FormData(form);
    const name = String(data.get('name') ?? '').trim();
    const description = String(data.get('description') ?? '').trim();
    const payload = {
      name,
      ...(description.length > 0 ? { description } : mode === 'edit' ? { description: '' } : {}),
    };

    try {
      const result =
        mode === 'edit' && stackId
          ? await updateAdminStack(stackId, payload)
          : await createAdminStack(payload);

      if (!result.ok) {
        setError(result.message);
        return;
      }
      toast.success(mode === 'edit' ? 'Stack enregistré' : 'Stack créé');
      onSuccess();
    } catch {
      setError(
        mode === 'edit' ? 'Impossible de modifier le stack' : 'Impossible de créer le stack',
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
          ? mode === 'edit'
            ? 'Enregistrement…'
            : 'Création…'
          : mode === 'edit'
            ? 'Enregistrer'
            : 'Créer le stack'}
      </Button>
    </Form>
  );
}
