// Spec 020 : découpe du texte lu en segments de synthèse.
//
// Un segment est une phrase (ou un morceau de phrase trop longue). La voix
// démarre vite parce que le premier segment est court, et « section suivante »
// reste utile. Fonctions pures, sans DOM.

/** Longueur maximale d'un segment (recherche R10). */
export const MAX_CHUNK_LENGTH = 280;

/** Espaces insécables et caractères de largeur nulle : lus comme des espaces, jamais conservés. */
const ODD_SPACES = /[   ​-‍﻿]/g;

export function normalizeSpeechText(text: string): string {
  return text.replace(ODD_SPACES, ' ').replace(/\s+/g, ' ').trim();
}

function sentencesOf(text: string): string[] {
  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    const segmenter = new Intl.Segmenter('fr', { granularity: 'sentence' });
    return Array.from(segmenter.segment(text), (part) => part.segment.trim()).filter(Boolean);
  }
  // shortcut: coupe aux points sans connaître les abréviations ; navigateur sans Intl.Segmenter seulement.
  return text.split(/(?<=[.!?…])\s+/).filter(Boolean);
}

/** Coupe une phrase trop longue à la dernière ponctuation ou au dernier espace avant `max`. */
function splitLongSentence(sentence: string, max: number): string[] {
  const parts: string[] = [];
  let rest = sentence;
  while (rest.length > max) {
    const window = rest.slice(0, max + 1);
    const atPunctuation = Math.max(
      window.lastIndexOf(', '),
      window.lastIndexOf('; '),
      window.lastIndexOf(': '),
    );
    // La ponctuation reste dans le morceau qui la porte ; à défaut, dernier espace ; à défaut, coupe franche.
    const cut = atPunctuation > max / 3 ? atPunctuation + 1 : window.lastIndexOf(' ');
    const at = cut > 0 ? cut : max;
    parts.push(rest.slice(0, at).trim());
    rest = rest.slice(at).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}

/** Texte → segments d'au plus `max` caractères, aux limites des phrases. */
export function splitIntoChunks(text: string, max: number = MAX_CHUNK_LENGTH): string[] {
  const normalized = normalizeSpeechText(text);
  if (normalized === '') return [];
  return sentencesOf(normalized).flatMap((sentence) =>
    sentence.length <= max ? [sentence] : splitLongSentence(sentence, max),
  );
}
