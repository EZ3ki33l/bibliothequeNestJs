import { createElement, type HTMLAttributes, type ReactNode, type Ref } from 'react';
import { cn } from '@heroui/react';

export type TypoVariant = 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'lead' | 'small' | 'caption' | 'code';

type TypoTag = 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'span' | 'code';

type TypoProps = Omit<HTMLAttributes<HTMLElement>, 'className' | 'children'> & {
  /** Style du texte : taille, graisse, police et couleur. */
  variant: TypoVariant;
  /**
   * Balise rendue, quand elle diffère de celle de la variante : le niveau du
   * titre suit la structure de la page, pas la taille voulue.
   */
  as?: TypoTag;
  /** Classes de mise en page (marges, troncature) ; elles l'emportent sur la variante. */
  className?: string;
  children: ReactNode;
  ref?: Ref<HTMLElement>;
};

/**
 * Styles de la charte : Space Grotesk pour les titres, Inter pour le texte.
 *
 * Aucune marge ici : l'espacement appartient à la mise en page de l'appelant
 * (`gap`, `mt-*`), pas au texte. Les couleurs sont des tokens du thème, jamais
 * une valeur en dur. `h4` et `code` prennent le Blueberry clair : la teinte de
 * base ne contraste pas assez avec le fond pour du texte.
 */
const STYLES: Record<TypoVariant, string> = {
  h1: 'font-heading text-foreground text-4xl font-bold tracking-tight text-balance md:text-5xl',
  h2: 'font-heading text-foreground text-3xl font-bold tracking-tight text-balance md:text-4xl',
  h3: 'font-heading text-foreground text-2xl font-semibold tracking-tight',
  h4: 'font-heading text-blueberry-light text-xl font-semibold',
  p: 'font-body text-body text-base leading-relaxed',
  lead: 'font-body text-lead text-lg leading-relaxed',
  small: 'font-body text-muted text-sm',
  caption: 'font-body text-muted text-xs',
  code: 'bg-blacksea-dark text-blueberry-light rounded px-1.5 py-0.5 font-mono text-sm',
};

/** Balise par défaut de chaque variante, pour l'accessibilité. */
const TAGS: Record<TypoVariant, TypoTag> = {
  h1: 'h1',
  h2: 'h2',
  h3: 'h3',
  h4: 'h4',
  p: 'p',
  lead: 'p',
  small: 'span',
  caption: 'p',
  code: 'code',
};

/**
 * Texte du site : tout titre et tout paragraphe passe par ce composant, pour
 * que polices, tailles et couleurs se décident à un seul endroit.
 *
 * `variant` choisit l'apparence, `as` la balise : une section de page s'écrit
 * `<Typo as="h2" variant="h3">`, ce qui garde un seul `h1` par page sans
 * donner à chaque section la taille d'un titre de page.
 *
 * Les autres attributs (`id`, `role`, `aria-*`, `tabIndex`) et `ref` sont
 * transmis à la balise : un paragraphe d'état (`role="status"`) ou un titre
 * visé par `aria-labelledby` reste ce qu'il était.
 *
 * Exception : le corps d'une fiche est du HTML produit par le Markdown, il est
 * mis en forme par `.entry-mdx` (`index.css`) avec les mêmes choix.
 */
export function Typo({ variant, as, className, children, ref, ...rest }: TypoProps) {
  // `createElement` plutôt que du JSX : la balise est choisie à l'exécution, et
  // son type le plus précis commun à toutes les balises possibles est
  // `HTMLElement`, ce que le JSX d'une balise variable ne sait pas exprimer.
  return createElement(
    as ?? TAGS[variant],
    { ref, className: cn(STYLES[variant], className), ...rest },
    children,
  );
}
