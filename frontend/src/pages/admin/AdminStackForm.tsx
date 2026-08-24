import { useState, type SubmitEvent } from 'react';
import { createAdminStack, updateAdminStack } from '../../lib/admin';

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

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') ?? '').trim();
    const description = String(form.get('description') ?? '').trim();
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
    <form onSubmit={onSubmit}>
      <p>
        <label htmlFor="name">Nom</label>
        <input
          id="name"
          name="name"
          type="text"
          required
          minLength={2}
          autoComplete="off"
          defaultValue={initialName}
        />
      </p>
      <p>
        <label htmlFor="description">Description (optionnelle)</label>
        <textarea id="description" name="description" rows={4} defaultValue={initialDescription} />
      </p>
      {error ? <p>{error}</p> : null}
      <button type="submit" disabled={pending}>
        {pending
          ? mode === 'edit'
            ? 'Enregistrement…'
            : 'Création…'
          : mode === 'edit'
            ? 'Enregistrer'
            : 'Créer'}
      </button>
    </form>
  );
}
