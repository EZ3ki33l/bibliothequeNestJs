/*
 * Phonémiseur de l'écoute audio (spec 020, recherche R1).
 *
 * Programme SÉPARÉ du reste du site, distribué sous GPL-3 avec eSpeak NG (voir
 * LICENSE et SOURCE.md dans ce dossier). Il ne fait qu'une chose : transformer
 * une phrase de français en identifiants de phonèmes. Il ne reçoit que du texte
 * et ne renvoie que des entiers ; il n'importe rien du reste du site.
 *
 * Messages (contrat : specs/020-entry-audio/contracts/engine-protocol.md)
 *   reçu    { type: 'phonemize', id, text, voice }
 *   envoyé  { type: 'phonemeIds', id, phonemeIds }  ou  { type: 'failed', id, message }
 *
 * Le moteur d'eSpeak NG cesse de répondre après une centaine d'appels (spike du
 * 2026-11-07) : le moteur de synthèse termine et recrée ce worker tous les 50
 * appels. Par sécurité, ce worker refuse lui-même au-delà de 90 appels plutôt
 * que de rester muet.
 */
importScripts('./piper_phonemize.js'); // définit createPiperPhonemize

const MAX_CALLS = 90;
const MAX_TEXT_LENGTH = 2000;

let modulePromise = null;
let calls = 0;
let outLines = [];

// Le module est créé une fois (≈ 50 à 110 ms) puis réutilisé jusqu'à MAX_CALLS.
function getModule() {
  modulePromise ??= createPiperPhonemize({
    print: (line) => outLines.push(line),
    printErr: () => {},
    // Les fichiers .wasm et .data sont à côté de ce worker, jamais ailleurs.
    locateFile: (name) => new URL(name, self.location.href).href,
  });
  return modulePromise;
}

function fail(id, message) {
  postMessage({ type: 'failed', id, message });
}

onmessage = async (event) => {
  const { type, id, text, voice } = event.data ?? {};
  if (type !== 'phonemize') return;
  // Frontière entre deux programmes : on ne fait confiance à aucun champ reçu.
  if (typeof text !== 'string' || text.length === 0 || text.length > MAX_TEXT_LENGTH) {
    return fail(id, 'texte invalide');
  }
  if (voice !== 'fr') return fail(id, 'langue non prise en charge');
  if (calls >= MAX_CALLS) return fail(id, 'worker épuisé : à recréer');
  calls += 1;

  try {
    const module = await getModule();
    outLines = [];
    module.callMain([
      '-l',
      voice,
      '--input',
      JSON.stringify([{ text }]),
      '--espeak_data',
      '/espeak-ng-data',
    ]);
    const result = JSON.parse(outLines[0] ?? 'null');
    const ids = result?.phoneme_ids;
    if (!Array.isArray(ids) || ids.length === 0 || !ids.every(Number.isInteger)) {
      return fail(id, 'aucun phonème produit');
    }
    postMessage({ type: 'phonemeIds', id, phonemeIds: ids });
  } catch (error) {
    fail(id, String(error?.message ?? error).slice(0, 200));
  }
};
