// Spec 020 : les deux voix de l'écoute audio, les vitesses et la préférence du
// lecteur. Décisions pures (aucun composant) : la page ne fait que les afficher.
//
// Les deux voix sont deux locuteurs d'un MÊME modèle (`upmc-medium`) : changer de
// voix ne télécharge rien, seul le locuteur passé à la synthèse change. Les
// quatre voix « posée / dynamique » d'origine sont reportées (recherche R17 et R18).

/** Identifiant du modèle de voix, celui de voices.lock.json. */
export const VOICE_MODEL_ID = 'upmc-medium';

export type VoiceId = 'masculine' | 'feminine';

export type Voice = {
  id: VoiceId;
  /** Libellé affiché : le genre seulement, jamais un prénom ni un nom de fichier. */
  label: string;
  /** Identifiant du locuteur dans le modèle (« jessica » = 0, « pierre » = 1). */
  speakerId: number;
};

export const VOICES: readonly Voice[] = [
  { id: 'masculine', label: 'Voix masculine', speakerId: 1 },
  { id: 'feminine', label: 'Voix féminine', speakerId: 0 },
];

/** La masculine : celle jugée la meilleure à l'écoute (FR-014). */
export const DEFAULT_VOICE_ID: VoiceId = 'masculine';

export const SPEEDS = [0.75, 1, 1.25, 1.5] as const;
export type Speed = (typeof SPEEDS)[number];
export const DEFAULT_SPEED: Speed = 1;

export type AudioPreference = { voice: VoiceId; speed: Speed };

export const DEFAULT_PREFERENCE: AudioPreference = {
  voice: DEFAULT_VOICE_ID,
  speed: DEFAULT_SPEED,
};

export function voiceById(id: VoiceId): Voice {
  // VOICES contient chaque VoiceId : le repli ne sert qu'à satisfaire le compilateur.
  return VOICES.find((voice) => voice.id === id) ?? VOICES[0];
}

/** Libellé de vitesse lu par tous (« ×1,25 ») ; la virgule est celle du français. */
export function speedLabel(speed: Speed): string {
  return `×${String(speed).replace('.', ',')}`;
}

const PREFERENCE_KEY = 'ecoute-preference';

/**
 * Lit une préférence enregistrée. Liste fermée : toute valeur inconnue (ancienne
 * version, stockage modifié à la main) est ignorée champ par champ, jamais
 * recopiée telle quelle.
 */
export function parsePreference(raw: string | null): AudioPreference {
  if (raw === null) return DEFAULT_PREFERENCE;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return DEFAULT_PREFERENCE;
  }
  if (typeof data !== 'object' || data === null) return DEFAULT_PREFERENCE;
  const { voix, vitesse } = data as { voix?: unknown; vitesse?: unknown };
  const voice = VOICES.find((candidate) => candidate.id === voix)?.id ?? DEFAULT_VOICE_ID;
  const speed = SPEEDS.find((candidate) => candidate === vitesse) ?? DEFAULT_SPEED;
  return { voice, speed };
}

/** Le stockage peut manquer ou lever (navigation privée, données bloquées) : valeurs par défaut. */
export function loadPreference(): AudioPreference {
  try {
    return parsePreference(localStorage.getItem(PREFERENCE_KEY));
  } catch {
    return DEFAULT_PREFERENCE;
  }
}

/** Jamais d'erreur visible : sans stockage, le choix vaut pour la visite en cours seulement. */
export function savePreference(preference: AudioPreference): void {
  try {
    localStorage.setItem(
      PREFERENCE_KEY,
      JSON.stringify({ voix: preference.voice, vitesse: preference.speed }),
    );
  } catch {
    // Rien à faire : le choix reste en mémoire dans le lecteur.
  }
}
