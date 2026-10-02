import { useRef } from 'react';
import { useNavigate } from 'react-router';
import { Button, FieldError, Form, Input, Label, TextArea, TextField } from '@heroui/react';
import { createAdminPath } from '../../lib/admin';
import { useAdminSubmit } from '../../components/admin/useAdminSubmit';
import { Breadcrumbs } from '../../components/ui/Breadcrumbs';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { PageHeader } from '../../components/ui/PageHeader';

/**
 * Création d'un parcours : nom et description seulement. Le parcours naît
 * brouillon ; modules et étapes se composent ensuite sur l'écran d'édition,
 * vers lequel la page redirige.
 */
export function AdminPathNewPage() {
  const navigate = useNavigate();
  // Id renvoyé par le serveur, lu dans `onSuccess` pour rediriger vers l'édition.
  const createdId = useRef<string | null>(null);

  const { error, pending, submit } = useAdminSubmit({
    success: 'Parcours créé',
    failure: 'Impossible de créer le parcours',
    onSuccess: () => {
      navigate(createdId.current ? `/admin/parcours/${createdId.current}/edit` : '/admin/parcours');
    },
  });

  function handleSubmit(form: HTMLFormElement) {
    const data = new FormData(form);
    const payload = {
      name: String(data.get('name') ?? '').trim(),
      description: String(data.get('description') ?? '').trim(),
    };

    void submit(async () => {
      const result = await createAdminPath(payload);
      if (result.ok) createdId.current = result.path.id;
      return result;
    });
  }

  return (
    <>
      <Breadcrumbs items={[{ label: 'Parcours', to: '/admin/parcours' }, { label: 'Nouveau' }]} />
      <PageHeader title="Nouveau parcours" />
      <Form
        className="flex max-w-md flex-col gap-4"
        validationBehavior="aria"
        onSubmit={(event) => {
          event.preventDefault();
          handleSubmit(event.currentTarget);
        }}
      >
        <TextField isRequired name="name" minLength={2} maxLength={120} autoComplete="off">
          <Label>Nom</Label>
          <Input placeholder="Développement web" />
          <FieldError />
        </TextField>
        <TextField name="description" maxLength={1000}>
          <Label>Description (optionnelle)</Label>
          <TextArea />
          <FieldError />
        </TextField>

        {error ? <ErrorMessage>{error}</ErrorMessage> : null}

        <Button type="submit" variant="primary" isDisabled={pending}>
          {pending ? 'Création…' : 'Créer le parcours'}
        </Button>
      </Form>
    </>
  );
}
