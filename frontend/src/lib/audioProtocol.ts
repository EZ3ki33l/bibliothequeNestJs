// Spec 020 : messages entre la page et le worker du moteur de synthèse.
// Contrat : specs/020-entry-audio/contracts/engine-protocol.md.

export type EngineErrorCode = 'network' | 'unsupported' | 'memory' | 'synthesis';

/** Page → moteur. */
export type EngineRequest =
  /** Télécharge (ou lit en cache) le moteur et le modèle, crée la session. Une seule fois par visite. */
  | { type: 'load' }
  /** Phonémise puis synthétise un segment. */
  | { type: 'synthesize'; requestId: number; text: string; speakerId: number }
  /** Abandonne une demande, ou toutes. Une inférence déjà lancée finit, son résultat est jeté. */
  | { type: 'cancel'; requestId: number | 'all' }
  /** Libère la session et le phonémiseur. */
  | { type: 'dispose' };

/** Moteur → page. */
export type EngineResponse =
  /** Octets reçus du réseau. Jamais envoyé quand tout est déjà en cache. */
  | { type: 'progress'; loaded: number; total: number }
  | { type: 'ready'; sampleRate: number }
  | { type: 'audio'; requestId: number; pcm: Float32Array; sampleRate: number }
  | { type: 'failed'; requestId?: number; code: EngineErrorCode; message: string };

/** Moteur → phonémiseur (programme séparé, GPL-3 : frontend/phonemizer/worker.js). */
export type PhonemizerRequest = { type: 'phonemize'; id: number; text: string; voice: 'fr' };

/** Phonémiseur → moteur. */
export type PhonemizerResponse =
  | { type: 'phonemeIds'; id: number; phonemeIds: number[] }
  | { type: 'failed'; id: number; message: string };
