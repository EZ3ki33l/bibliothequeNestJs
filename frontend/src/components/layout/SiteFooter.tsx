import { Link } from 'react-router';

const LEGAL_LINKS = [
  { to: '/mentions-legales', label: 'Mentions légales' },
  { to: '/cgu', label: 'Conditions d’utilisation' },
  { to: '/confidentialite', label: 'Confidentialité' },
  { to: '/contact', label: 'Contact' },
] as const;

const linkClass =
  'text-muted hover:text-foreground text-sm no-underline transition-colors duration-150';

/**
 * Pied de page du shell public (US4 / FR-009).
 *
 * Présentation (« À propos ») et légal : ce n’est pas le catalogue.
 * L’écart au-dessus du trait vient du `gap-16` d’`AppLayout`, pas d’une
 * marge ici : `mt-auto` ne crée un trou que si la page est plus courte que
 * l’écran — sous un atelier Sandpack, il ne faisait rien.
 */
export function SiteFooter() {
  return (
    <footer className="border-border border-t pt-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-baseline sm:justify-between sm:gap-x-6">
        <nav aria-label="Découvrir">
          <Link to="/a-propos" className={linkClass}>
            À propos
          </Link>
        </nav>
        <nav aria-label="Informations légales">
          <ul className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-6 sm:gap-y-2">
            {LEGAL_LINKS.map((item) => (
              <li key={item.to}>
                <Link to={item.to} className={linkClass}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
