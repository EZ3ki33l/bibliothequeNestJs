import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** Retire les espaces autour d'une saisie ; laisse passer ce qui n'est pas du texte (rejeté ensuite par `@IsString`). */
const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/**
 * Corps de `POST /contact`.
 *
 * Toutes les longueurs sont bornées : c'est un endpoint public, donc chaque
 * champ non borné est un moyen de saturer la boîte de l'éditeur.
 */
export class ContactDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @Transform(trim)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @Transform(trim)
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  message!: string;

  /**
   * Champ piège (« honeypot »). Le formulaire le cache aux humains ; un robot
   * qui remplit tout ce qu'il trouve le renseigne. Il est déclaré ici parce que
   * `forbidNonWhitelisted` rejetterait sinon la requête en 400, ce qui
   * préviendrait le robot que le piège existe. Son nom évite les mots que le
   * remplissage automatique des navigateurs reconnaît (`website`, `url`…), pour
   * ne pas écarter un vrai message.
   */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  alias?: string;
}
