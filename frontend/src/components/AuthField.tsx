import type { ComponentProps } from 'react';

type AuthFieldProps = ComponentProps<'input'> & {
  label: string;
  error?: string;
};

export function AuthField({ label, error, id, name, ...props }: AuthFieldProps) {
  const fieldId = id ?? name;

  return (
    <div>
      <label htmlFor={fieldId}>{label}</label>
      <input id={fieldId} name={name} {...props} />
      {error ? <p>{error}</p> : null}
    </div>
  );
}
