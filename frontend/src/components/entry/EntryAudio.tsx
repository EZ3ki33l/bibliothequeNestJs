import { useState } from 'react';
import { Button, Label, ListBox, ProgressBar, Select } from '@heroui/react';
import { GearIcon, PauseIcon, PlayIcon, SpeakerHighIcon, StopIcon } from '@phosphor-icons/react';
import { totalDownloadSize } from '../../lib/audioManifest';
import type { AudioFailure } from '../../lib/audioController';
import { formatBytes } from '../../lib/entryImages';
import type { EntryAudioState } from '../../lib/useEntryAudio';
import { SPEEDS, VOICES, VOICE_MODEL_ID, speedLabel, type VoiceId } from '../../lib/audioVoices';
import { ErrorMessage } from '../ui/ErrorMessage';
import { Typo } from '../ui/Typo';

const FAILURE_MESSAGES: Record<AudioFailure['code'], string> = {
  unsupported: 'L’écoute n’est pas disponible dans ce navigateur.',
  network: 'La voix n’a pas pu être téléchargée. Vérifier la connexion, puis réessayer.',
  memory: 'L’appareil manque de mémoire pour produire la voix.',
  synthesis: 'La voix n’a pas pu être produite.',
  empty: 'Cette fiche n’a rien à lire à voix haute.',
};

/** Ce qui n'a aucune chance de réussir au second essai n'offre pas « Réessayer ». */
const RETRYABLE: ReadonlySet<AudioFailure['code']> = new Set(['network', 'memory', 'synthesis']);

/** Phrase de la zone d'état. Constante pendant le téléchargement : la progression, elle, n'est pas annoncée. */
function statusText(audio: EntryAudioState): string {
  switch (audio.status) {
    case 'downloading':
      return `Téléchargement de la voix en cours (une seule fois, environ ${formatBytes(totalDownloadSize(VOICE_MODEL_ID))}).`;
    case 'preparing':
      return 'Préparation…';
    case 'playing':
      return 'Lecture en cours.';
    case 'paused':
      return 'Lecture en pause.';
    case 'ended':
      return 'Lecture terminée.';
    default:
      return '';
  }
}

/** Liste déroulante à étiquette visible : la valeur courante est toujours lisible en texte. */
function AudioSelect({
  label,
  value,
  items,
  onChange,
}: {
  label: string;
  value: string;
  items: { id: string; label: string }[];
  onChange: (id: string) => void;
}) {
  return (
    <Select
      value={value}
      onChange={(key) => {
        if (key !== null) onChange(String(key));
      }}
      className="min-w-44"
    >
      <Label>{label}</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {items.map((item) => (
            <ListBox.Item key={item.id} id={item.id} textValue={item.label}>
              {item.label}
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

/**
 * Lecteur audio d'une fiche (spec 020) : bouton « Écouter » et commandes.
 *
 * Composant d'**affichage** : tout l'état vient de `useEntryAudio` (une seule
 * instance par fiche). Il ne charge rien, ne connaît ni la session ni le texte
 * lu. Le premier clic sur « Écouter » est ce qui déclenche tout téléchargement.
 *
 * Aucun bouton n'est en couleur d'appel (`cta`) : l'action principale de
 * l'écran reste ailleurs (examen, formulaire).
 */
export function EntryAudio({ audio }: { audio: EntryAudioState }) {
  const { status, failure, progress } = audio;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const idle = status === 'idle' || status === 'ended';
  const busy = status === 'downloading' || status === 'preparing' || status === 'playing';

  return (
    <div className="mt-4 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {/* Une erreur sans issue (navigateur incapable, rien à lire) n'invite pas à recommencer. */}
        {idle || (status === 'error' && failure !== null && RETRYABLE.has(failure.code)) ? (
          <Button type="button" variant="secondary" onPress={audio.start}>
            <SpeakerHighIcon weight="bold" className="size-4" aria-hidden="true" />
            {status === 'error' ? 'Réessayer' : 'Écouter'}
          </Button>
        ) : null}
        {busy ? (
          <Button type="button" variant="secondary" onPress={audio.pause}>
            <PauseIcon weight="bold" className="size-4" aria-hidden="true" />
            Pause
          </Button>
        ) : null}
        {status === 'paused' ? (
          <Button type="button" variant="secondary" onPress={audio.resume}>
            <PlayIcon weight="bold" className="size-4" aria-hidden="true" />
            Reprendre
          </Button>
        ) : null}
        {busy || status === 'paused' ? (
          <Button type="button" variant="ghost" onPress={audio.stop}>
            <StopIcon weight="bold" className="size-4" aria-hidden="true" />
            Arrêter
          </Button>
        ) : null}
        {/* Le panneau des réglages s'ouvre et se referme à la demande : l'en-tête reste compact. */}
        <Button
          type="button"
          variant="ghost"
          aria-expanded={settingsOpen}
          onPress={() => setSettingsOpen((open) => !open)}
        >
          <GearIcon weight="bold" className="size-4" aria-hidden="true" />
          Réglages
        </Button>
      </div>

      {settingsOpen ? (
        <div className="flex flex-wrap gap-4">
          <AudioSelect
            label="Voix"
            value={audio.voiceId}
            items={VOICES.map((voice) => ({ id: voice.id, label: voice.label }))}
            onChange={(id) => {
              const voice = VOICES.find((candidate) => candidate.id === id);
              if (voice) audio.setVoice(voice.id as VoiceId);
            }}
          />
          <AudioSelect
            label="Vitesse"
            value={String(audio.speed)}
            items={SPEEDS.map((speed) => ({ id: String(speed), label: speedLabel(speed) }))}
            onChange={(id) => {
              const speed = SPEEDS.find((candidate) => String(candidate) === id);
              if (speed !== undefined) audio.setSpeed(speed);
            }}
          />
        </div>
      ) : null}

      {status === 'downloading' && progress !== null ? (
        <ProgressBar
          value={Math.min(progress.loaded, progress.total)}
          minValue={0}
          maxValue={progress.total}
          valueLabel={`${formatBytes(progress.loaded)} sur ${formatBytes(progress.total)}`}
        >
          <Label>Téléchargement de la voix</Label>
          <ProgressBar.Output />
          <ProgressBar.Track>
            <ProgressBar.Fill />
          </ProgressBar.Track>
        </ProgressBar>
      ) : null}

      {/* Avant le premier clic : dit ce que ce clic va faire (sur un réseau mobile, 100 Mo comptent). */}
      {status === 'idle' && audio.voiceCached === false ? (
        <Typo variant="caption">
          La voix est produite dans le navigateur, sans rien envoyer. La première écoute télécharge
          la voix depuis le site (environ {formatBytes(totalDownloadSize(VOICE_MODEL_ID))}), une
          seule fois.
        </Typo>
      ) : null}

      {/* Toujours dans la page, même vide : un lecteur d'écran annonce ainsi les changements d'état. */}
      <Typo variant="caption" role="status">
        {statusText(audio)}
      </Typo>

      {status === 'error' && failure !== null ? (
        <ErrorMessage>{FAILURE_MESSAGES[failure.code]}</ErrorMessage>
      ) : null}
    </div>
  );
}
