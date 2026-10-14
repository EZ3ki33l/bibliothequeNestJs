/**
 * Couleurs des schémas Mermaid, aux couleurs de la charte (spec 016).
 *
 * Mermaid calcule ses teintes dérivées (survols, bordures, fonds de notes) à
 * partir de couleurs **littérales** : il ne lit pas les variables CSS. Les
 * valeurs de `index.css` sont donc recopiées ici, comme dans `SANDPACK_THEME`
 * (`lib/sandpack.ts`) : ce sont les deux seuls endroits où les couleurs de la
 * charte sont écrites en dur.
 *
 * Fond Black Sea, nœuds un ton plus sombre, traits Black Sea clair, texte
 * gris clair (contraste AA sur ces fonds), accent Blueberry clair. Pas de
 * Cherry : il est réservé à l'action principale et aux alertes.
 */
export const DIAGRAM_THEME_VARIABLES = {
  darkMode: true,
  background: '#1e242b',
  primaryColor: '#0f1216',
  primaryTextColor: '#d1d5db',
  primaryBorderColor: '#8f9af0',
  secondaryColor: '#3d4551',
  secondaryTextColor: '#d1d5db',
  secondaryBorderColor: '#8f9af0',
  tertiaryColor: '#1e242b',
  tertiaryTextColor: '#d1d5db',
  tertiaryBorderColor: '#3d4551',
  lineColor: '#9ca3af',
  textColor: '#d1d5db',
  mainBkg: '#0f1216',
  nodeBorder: '#8f9af0',
  clusterBkg: '#1e242b',
  clusterBorder: '#3d4551',
  edgeLabelBackground: '#1e242b',
  noteBkgColor: '#3d4551',
  noteTextColor: '#f5f7fa',
  noteBorderColor: '#8f9af0',
  actorBkg: '#0f1216',
  actorBorder: '#8f9af0',
  actorTextColor: '#d1d5db',
  signalColor: '#d1d5db',
  signalTextColor: '#d1d5db',
  labelBoxBkgColor: '#0f1216',
  labelBoxBorderColor: '#8f9af0',
  labelTextColor: '#d1d5db',
  fontFamily: "'Inter Variable', system-ui, sans-serif",
  fontSize: '14px',
} as const;
