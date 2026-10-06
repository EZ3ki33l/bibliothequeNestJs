import { useState, type ComponentProps } from 'react';
import { EyeIcon, EyeSlashIcon } from '@phosphor-icons/react';
import { Button, FieldError, Input, Label, TextField } from '@heroui/react';

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
 *
 * Un champ `type="password"` reçoit un bouton Afficher / Masquer. Il est placé
 * sur la ligne du libellé, pas dans le champ : les gestionnaires de mots de
 * passe (Bitwarden, 1Password…) posent leur propre icône à l'intérieur, à
 * droite, et les deux se chevaucheraient.
 */
export function AuthField({
  name,
  label,
  type = 'text',
  autoComplete,
  isRequired,
  minLength,
}: AuthFieldProps) {
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === 'password';

  return (
    <TextField
      name={name}
      autoComplete={autoComplete}
      isRequired={isRequired}
      minLength={minLength}
    >
      <div className="flex items-center justify-between gap-2">
        <Label>{label}</Label>
        {isPassword ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted h-7 min-h-0 gap-1.5 px-2 text-xs"
            aria-label={revealed ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            onPress={() => setRevealed((current) => !current)}
          >
            {revealed ? <EyeSlashIcon className="size-4" /> : <EyeIcon className="size-4" />}
            {revealed ? 'Masquer' : 'Afficher'}
          </Button>
        ) : null}
      </div>
      <Input type={isPassword && revealed ? 'text' : type} />
      <FieldError />
    </TextField>
  );
}
