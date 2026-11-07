// Spec 020 : collecte du texte à lire dans le RENDU de la page (recherche R10).
//
// Le texte lu est celui qui s'affiche : on parcourt le DOM déjà rendu au lieu de
// relire le Markdown. « Lu = affiché » est alors vrai par construction, et
// chaque section est déjà liée à son élément (pour le repérer à l'écran).
//
// Ce que les composants déclarent, par attributs :
//   data-audio-title / data-audio-summary   titre et résumé de la fiche
//   data-audio-announce="…"                 bloc non lu à voix haute, annoncé (code, schéma, tableau)
//   data-audio-image="<texte alternatif>"   image : lue par son texte alternatif
//   data-audio-skip                         contenu provisoire (chargement) : jamais lu
import { normalizeSpeechText, splitIntoChunks } from './audioText';

export type AudioSectionKind = 'title' | 'summary' | 'text' | 'announce' | 'image';

export type AudioSection = {
  /** Rang dans la lecture. */
  index: number;
  kind: AudioSectionKind;
  /** Élément de la page que la section repère. */
  element: HTMLElement;
  /** Texte entier de la section, tel qu'il est dit. */
  text: string;
  /** `text` découpé en segments de synthèse (phrases). */
  chunks: string[];
};

export type CollectedSections = {
  sections: AudioSection[];
  /** Vrai si du contenu provisoire (« Chargement… ») est encore à l'écran : le texte n'est pas complet. */
  pending: boolean;
};

/** Balises du corps d'une fiche qui forment une section. */
const BODY_SECTION_TAGS = new Set(['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'LI']);

/** Balises en ligne : leur texte fait partie de la section qui les contient. */
const INLINE_TAGS = new Set([
  'A',
  'ABBR',
  'B',
  'BDI',
  'BDO',
  'CITE',
  'CODE',
  'DATA',
  'DEL',
  'DFN',
  'EM',
  'I',
  'INS',
  'KBD',
  'MARK',
  'Q',
  'S',
  'SAMP',
  'SMALL',
  'SPAN',
  'STRONG',
  'SUB',
  'SUP',
  'TIME',
  'U',
  'VAR',
]);

function isHidden(element: Element): boolean {
  if (element instanceof HTMLElement && element.hidden) return true;
  if (element.getAttribute('aria-hidden') === 'true') return true;
  // Un élément sans boîte (display: none) n'est pas affiché, donc pas lu. Navigateur sans
  // checkVisibility : tout élément rendu est lu.
  return typeof element.checkVisibility === 'function' && !element.checkVisibility();
}

function isMarked(element: Element): boolean {
  return element.hasAttribute('data-audio-announce') || element.hasAttribute('data-audio-image');
}

/** Texte propre d'un élément : ses textes et ses balises en ligne, sans les sections qu'il contient. */
function ownText(element: Element): string {
  let text = '';
  for (const node of element.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent ?? '';
    } else if (node instanceof Element) {
      if (node.tagName === 'BR') text += ' ';
      else if (INLINE_TAGS.has(node.tagName) && !isMarked(node) && !isHidden(node)) {
        text += ownText(node);
      }
    }
  }
  return normalizeSpeechText(text);
}

export function collectSections(root: Element): CollectedSections {
  const sections: AudioSection[] = [];
  let pending = false;

  const push = (kind: AudioSectionKind, element: HTMLElement, text: string) => {
    const clean = normalizeSpeechText(text);
    if (clean === '') return;
    // Annonces et images sont courtes : un seul segment.
    const chunks = kind === 'announce' || kind === 'image' ? [clean] : splitIntoChunks(clean);
    sections.push({ index: sections.length, kind, element, text: clean, chunks });
  };

  const visit = (element: Element) => {
    if (!(element instanceof HTMLElement)) return;
    if (element.hasAttribute('data-audio-skip')) {
      pending = true;
      return;
    }
    if (isHidden(element)) return;

    const announce = element.getAttribute('data-audio-announce');
    if (announce !== null) {
      push('announce', element, announce);
      return; // le contenu d'un bloc annoncé n'est jamais lu
    }
    const alt = element.getAttribute('data-audio-image');
    if (alt !== null) {
      // Une image sans texte alternatif est sautée sans annonce.
      if (alt.trim() !== '') push('image', element, `Image : ${alt.trim()}`);
      return;
    }

    if (element.hasAttribute('data-audio-title')) push('title', element, ownText(element));
    else if (element.hasAttribute('data-audio-summary')) push('summary', element, ownText(element));
    else if (BODY_SECTION_TAGS.has(element.tagName) && element.closest('.entry-mdx') !== null) {
      push('text', element, ownText(element));
    }

    for (const child of element.children) visit(child);
  };

  visit(root);
  return { sections, pending };
}
