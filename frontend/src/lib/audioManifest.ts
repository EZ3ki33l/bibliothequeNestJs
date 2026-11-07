// Spec 020 : liste des fichiers de la synthèse vocale, produite au build par
// vite-plugins/piperAssets.ts (adresses versionnées et tailles avant compression).
// Sert au moteur (téléchargement, progression) et à la page (annonce du poids).

export type ManifestFile = { url: string; size: number };

export type AudioManifest = {
  version: string;
  /** Préfixe versionné du moteur : `/piper/<version>/`. */
  base: string;
  /** Runtime ONNX : le glue `.mjs` et le `.wasm`. */
  engine: ManifestFile[];
  /** Phonémiseur isolé (GPL-3) : récupéré par son propre worker. */
  phonemizer: ManifestFile[];
  voices: Record<string, { speakers: Record<string, number>; files: ManifestFile[] }>;
};

export const AUDIO_MANIFEST: AudioManifest = JSON.parse(
  import.meta.env.VITE_PIPER_MANIFEST as string,
) as AudioManifest;

/** Octets à télécharger au premier usage : moteur, phonémiseur et le modèle de voix. */
export function totalDownloadSize(voiceModel: string): number {
  const model = AUDIO_MANIFEST.voices[voiceModel];
  const files = [...AUDIO_MANIFEST.engine, ...AUDIO_MANIFEST.phonemizer, ...(model?.files ?? [])];
  return files.reduce((total, file) => total + file.size, 0);
}

/** Cache Storage des fichiers de la synthèse (le moteur écrit dedans, la page le consulte). */
export const AUDIO_CACHE_NAME = 'bibliotheque-audio-v1';

/**
 * Le modèle de voix est-il déjà sur cet appareil ? Sert à n'annoncer le téléchargement
 * que lorsqu'il aura lieu. En cas de doute (pas de Cache Storage, erreur), « non ».
 */
export async function isVoiceCached(voiceModel: string): Promise<boolean> {
  try {
    const model = AUDIO_MANIFEST.voices[voiceModel]?.files.find((file) =>
      file.url.endsWith('/model.onnx'),
    );
    if (model === undefined || typeof caches === 'undefined') return false;
    const cache = await caches.open(AUDIO_CACHE_NAME);
    return (await cache.match(model.url)) !== undefined;
  } catch {
    return false;
  }
}
