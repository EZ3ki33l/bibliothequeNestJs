type HeartIconProps = {
  /** Plein (favori) ou à contour (pas favori). */
  filled?: boolean;
  className?: string;
};

/**
 * Cœur en SVG inline plutôt qu'une dépendance à une librairie d'icônes
 * (aucune n'est installée dans ce projet) : un seul tracé, réutilisable pour
 * le bouton « favori » de la fiche comme, plus tard, de la liste `/favoris`.
 */
export function HeartIcon({ filled = false, className }: HeartIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 1.8}
      aria-hidden="true"
    >
      <path d="M12 20.5c-.3 0-.6-.1-.8-.3C7.4 17 3 13 3 8.7 3 5.9 5.2 3.7 8 3.7c1.6 0 3.1.8 4 2.1.9-1.3 2.4-2.1 4-2.1 2.8 0 5 2.2 5 5 0 4.3-4.4 8.3-8.2 11.5-.2.2-.5.3-.8.3Z" />
    </svg>
  );
}
