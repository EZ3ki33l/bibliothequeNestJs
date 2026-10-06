/**
 * Retire les espaces autour d'une saisie avant validation : « Web » et
 * «  Web  » ne doivent pas produire deux noms différents, ni passer
 * `@MinLength(2)` avec deux espaces. Ce qui n'est pas du texte passe tel quel
 * et sera rejeté par `@IsString`.
 */
export const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;
