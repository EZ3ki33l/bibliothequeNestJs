# Phonémiseur de l'écoute audio : sources et licence

Ce dossier est un **programme séparé** du reste du site (spec 020, recherche R1). Il est distribué sous la **GNU General Public License version 3** (texte complet dans [LICENSE](./LICENSE)). Le reste du frontend n'est pas couvert par cette licence.

## Ce que fait ce programme

Il transforme une phrase de français en suite d'identifiants de phonèmes, pour la voix de synthèse. Il ne reçoit que du **texte** par `postMessage` et ne renvoie que des **identifiants entiers**. Il n'importe rien du reste du site et n'est importé par rien : le moteur de synthèse le contacte par messages, comme on contacte un autre programme.

## Fichiers

| Fichier                | Origine                                                                                           | Licence                   |
| ---------------------- | ------------------------------------------------------------------------------------------------- | ------------------------- |
| `worker.js`            | écrit pour ce site (lisible tel quel : c'est son propre source)                                   | GPL-3.0 (ce dossier)      |
| `piper_phonemize.js`   | code de liaison Emscripten, paquet npm `@diffusionstudio/piper-wasm` 1.0.0                        | MIT (étiquette du paquet) |
| `piper_phonemize.wasm` | `piper-phonemize` et `espeak-ng` compilés en WebAssembly (même paquet)                            | GPL-3.0 (`espeak-ng`)     |
| `piper_phonemize.data` | données d'`espeak-ng` (`espeak-ng-data`, toutes langues) empaquetées par Emscripten (même paquet) | GPL-3.0 (`espeak-ng`)     |

## Code source correspondant

- **eSpeak NG** : https://github.com/rhasspy/espeak-ng (copie de https://github.com/espeak-ng/espeak-ng)
- **piper-phonemize** : https://github.com/wide-video/piper-phonemize (dérivé de https://github.com/rhasspy/piper-phonemize)
- **Recette de compilation** (Emscripten 3.1.47, `espeak-ng`, `piper-phonemize`, options de compilation) : le fichier README du paquet https://www.npmjs.com/package/@diffusionstudio/piper-wasm et son dépôt https://github.com/diffusion-studio/piper-wasm
- **Ce site** : le dépôt public https://github.com/EZ3ki33l/bibliothequeNestJs contient `worker.js`, le plugin de copie (`frontend/vite-plugins/piperAssets.ts`) et la version des paquets (`frontend/pnpm-lock.yaml`).

## Limite à connaître

La recette du paquet clone ces dépôts « en dernier état » (`git clone --depth 1`, juin 2024) et **n'enregistre pas les numéros de commit exacts** utilisés pour compiler les fichiers `.wasm` et `.data` ci-dessus. Les liens ci-dessus donnent donc le code source de ces projets, pas une révision certifiée identique à ces binaires. Toute personne qui souhaite la révision exacte, ou une recompilation, peut la demander par le formulaire de contact du site : une réponse sera cherchée auprès du mainteneur du paquet.

## Nom du programme et version

`@diffusionstudio/piper-wasm` **1.0.0**, copié par le build depuis `node_modules` (voir `frontend/vite-plugins/piperAssets.ts`).
