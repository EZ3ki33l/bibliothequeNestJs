// Spec 020 : le hook de l'écoute audio d'une fiche. Il tient tout l'état de lecture
// à UN seul endroit ; les commandes (en-tête, colonne latérale) ne font que
// l'afficher. La logique est dans `audioController` (sans React).
import { useEffect, useState, type RefObject } from 'react';
import { isVoiceCached } from './audioManifest';
import {
  createAudioController,
  type AudioFailure,
  type AudioProgress,
  type AudioStatus,
} from './audioController';
import {
  VOICE_MODEL_ID,
  loadPreference,
  savePreference,
  voiceById,
  type AudioPreference,
  type Speed,
  type VoiceId,
} from './audioVoices';

export type EntryAudioState = {
  status: AudioStatus;
  failure: AudioFailure | null;
  /** Octets reçus pendant le téléchargement de la voix ; `null` sinon. */
  progress: AudioProgress | null;
  /** Section lue, `null` à l'arrêt. */
  sectionIndex: number | null;
  sectionCount: number;
  /** `false` : la voix n'est pas encore sur l'appareil (le premier clic la télécharge) ; `null` : pas encore su. */
  voiceCached: boolean | null;
  voiceId: VoiceId;
  speed: Speed;
  /** Change de voix : la section en cours reprend à son début avec la nouvelle voix. */
  setVoice(id: VoiceId): void;
  /** Change la vitesse : appliquée tout de suite, sans resynthèse. */
  setSpeed(speed: Speed): void;
  start(): void;
  pause(): void;
  resume(): void;
  stop(): void;
};

/**
 * @param rootRef élément qui contient le titre, le résumé et le corps rendus de la fiche
 * @param resetKey change quand le contenu change (aperçu de l'administration) : la lecture s'arrête
 * @param enabled faux pour une fiche verrouillée : aucun accès au cache de fichiers, aucun worker
 */
export function useEntryAudio(
  rootRef: RefObject<HTMLElement | null>,
  resetKey: string,
  enabled = true,
): EntryAudioState {
  const [status, setStatus] = useState<AudioStatus>('idle');
  const [failure, setFailure] = useState<AudioFailure | null>(null);
  const [progress, setProgress] = useState<AudioProgress | null>(null);
  const [sectionIndex, setSectionIndex] = useState<number | null>(null);
  const [sectionCount, setSectionCount] = useState(0);
  const [voiceCached, setVoiceCached] = useState<boolean | null>(null);
  // Les setters d'état sont stables : le contrôleur est créé une seule fois.
  const [controller] = useState(() =>
    createAudioController({
      status: (next) => {
        setStatus(next);
        // Une fois la voix reçue et jouée, plus rien à annoncer avant le prochain clic.
        if (next === 'playing') setVoiceCached(true);
      },
      failure: setFailure,
      progress: setProgress,
      section: (index, count) => {
        setSectionIndex(index);
        setSectionCount(count);
      },
    }),
  );
  const [preference, setPreference] = useState(loadPreference);
  // Le choix vaut pour la visite même si le stockage du navigateur est refusé (savePreference ne lève jamais).
  const choose = (next: AudioPreference) => {
    setPreference(next);
    savePreference(next);
  };

  // Démontage (changement de page, fermeture de l'aperçu) : le son s'arrête et tout est libéré.
  useEffect(() => () => controller.dispose(), [controller]);
  // Contenu modifié : la lecture en cours porte sur un texte périmé.
  useEffect(() => {
    controller.stop();
  }, [controller, resetKey]);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    void isVoiceCached(VOICE_MODEL_ID).then((cached) => {
      if (alive) setVoiceCached(cached);
    });
    return () => {
      alive = false;
    };
  }, [enabled]);

  return {
    status,
    failure,
    progress,
    sectionIndex,
    sectionCount,
    voiceCached,
    voiceId: preference.voice,
    speed: preference.speed,
    setVoice: (voice) => {
      choose({ ...preference, voice });
      controller.changeVoice(voiceById(voice).speakerId);
    },
    setSpeed: (speed) => {
      choose({ ...preference, speed });
      controller.setSpeed(speed);
    },
    start: () => {
      const root = rootRef.current;
      if (root === null) return;
      void controller.start(root, {
        speakerId: voiceById(preference.voice).speakerId,
        speed: preference.speed,
      });
    },
    pause: () => controller.pause(),
    resume: () => controller.resume(),
    stop: () => controller.stop(),
  };
}
