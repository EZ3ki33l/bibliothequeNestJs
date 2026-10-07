import { useEffect, useRef, type SubmitEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { MagnifyingGlassIcon } from '@phosphor-icons/react';
import { MAX_SEARCH_LENGTH, headerSearchHref, headerSearchValue } from '../../lib/headerSearch';

/**
 * Vrai quand la frappe vise déjà une zone de saisie : un champ, une liste, ou
 * l'éditeur de code d'une fiche (zone `contenteditable`). Le raccourci « / »
 * ne doit alors rien intercepter.
 */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return target.closest('input, textarea, select, [role="textbox"]') !== null;
}

/**
 * En-tête du site : la recherche, toujours à portée.
 *
 * Il reste en haut de l'écran sans `position: sticky` : `AppLayout` le place
 * au-dessus de la zone qui défile, pas dedans. Une ancre ou un focus ne peut
 * donc pas se retrouver caché dessous.
 *
 * Le champ n'appelle pas l'API et ne lit pas la session : il mène à
 * `/recherche` (`headerSearchHref`), qui garde seule la logique de recherche.
 * Il est non contrôlé ; `key` le fait repartir de l'URL après une navigation.
 *
 * Raccourci clavier : « / » place le focus dans le champ.
 */
export function AppHeader() {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const current = headerSearchValue(pathname, search);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;

      event.preventDefault();
      inputRef.current?.focus();
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = String(new FormData(event.currentTarget).get('q') ?? '');
    void navigate(headerSearchHref(pathname, search, q));
  }

  return (
    <header className="bg-background-secondary relative z-10 shrink-0 shadow-[0_12px_24px_-18px_var(--color-blacksea-dark)]">
      <div className="page-container flex items-center gap-4 py-3">
        <Link
          to="/"
          className="font-heading text-foreground text-base font-bold tracking-tight no-underline lg:hidden"
        >
          Bibliothèque
        </Link>

        <form role="search" onSubmit={onSubmit} className="relative min-w-0 flex-1 lg:max-w-2xl">
          <label htmlFor="header-search" className="sr-only">
            Rechercher une fiche
          </label>
          <MagnifyingGlassIcon
            aria-hidden="true"
            className="text-muted pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          />
          <input
            key={current}
            ref={inputRef}
            id="header-search"
            name="q"
            type="search"
            defaultValue={current}
            maxLength={MAX_SEARCH_LENGTH}
            placeholder="Rechercher une fiche…"
            autoComplete="off"
            enterKeyHint="search"
            className="bg-blacksea text-foreground placeholder:text-muted focus-visible:border-blueberry-light focus-visible:ring-blueberry-light/40 h-10 w-full rounded-lg border border-(--field-border) pr-3 pl-9 text-sm outline-none focus-visible:ring-2 sm:pr-10 [&::-webkit-search-cancel-button]:hidden"
          />
          <kbd
            aria-hidden="true"
            className="border-border text-muted pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded border px-1.5 font-mono text-xs sm:block"
          >
            /
          </kbd>
        </form>
      </div>
    </header>
  );
}
