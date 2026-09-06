import { FieldError, Input, Label, TextField } from '@heroui/react';
import type { ComponentProps } from 'react';

type AuthFieldProps = {
  name: string;
  label: string;
  type?: ComponentProps<typeof Input>['type'];
  autoComplete?: string;
  isRequired?: boolean;
  minLength?: number;
};

/**
 * Champ des formulaires de connexion et d'inscription.
 *
 * Même composition que les formulaires admin (`TextField` + `Label` + `Input`) :
 * HeroUI pose les attributs d'accessibilité, `FieldError` affiche les
 * contraintes HTML (`required`, `minLength`, type email) sans bulle native
 * du navigateur — le `<Form>` parent utilise `validationBehavior="aria"`.
 */
export function AuthField({
  name,
  label,
  type = 'text',
  autoComplete,
  isRequired,
  minLength,
}: AuthFieldProps) {
  return (
    <TextField
      name={name}
      autoComplete={autoComplete}
      isRequired={isRequired}
      minLength={minLength}
    >
      <Label>{label}</Label>
      <Input type={type} />
      <FieldError />
    </TextField>
  );
}
