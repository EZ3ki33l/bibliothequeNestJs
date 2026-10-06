import { useState } from 'react';
import { Link } from 'react-router';
import { Alert, Button, FieldError, Form, Input, Label, TextArea, TextField } from '@heroui/react';
import { ErrorMessage } from '../components/ui/ErrorMessage';
import { PageHeader } from '../components/ui/PageHeader';
import { sendContactMessage, type ContactResult } from '../lib/contact';

const ERROR_MESSAGES: Record<Exclude<ContactResult, 'sent'>, string> = {
  invalid:
    'Certains champs sont invalides : vérifier le courriel et la longueur du message (10 à 2000 caractères).',
  rate_limited: 'Trop de messages envoyés. Réessayer plus tard.',
  unavailable: 'L’envoi est momentanément indisponible. Réessayer plus tard.',
};

/**
 * Contact.
 *
 * Aucune adresse n’est publiée : le formulaire poste vers l’API, qui relaie le
 * message (Resend) vers la boîte de l’éditeur. Le navigateur ne voit jamais le
 * destinataire, donc aucun robot ne peut l’aspirer dans le bundle.
 *
 * Le champ `alias` est un piège : caché aux humains, il attire les robots qui
 * remplissent tout. Ce n’est pas un captcha tiers, volontairement — il
 * déposerait des traceurs et ramènerait un bandeau cookies.
 */
export function ContactPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(form: HTMLFormElement) {
    setError(null);
    setPending(true);
    const data = new FormData(form);

    try {
      const result = await sendContactMessage({
        name: String(data.get('name') ?? '').trim(),
        email: String(data.get('email') ?? '').trim(),
        message: String(data.get('message') ?? '').trim(),
        alias: String(data.get('alias') ?? ''),
      });

      if (result === 'sent') {
        setSent(true);
      } else {
        setError(ERROR_MESSAGES[result]);
      }
    } catch {
      // Réseau coupé : `fetch` rejette, sans réponse HTTP à interpréter.
      setError(ERROR_MESSAGES.unavailable);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Contact"
        description="Une question, une remarque ou une demande relative aux données personnelles."
      />

      {sent ? (
        <Alert status="success">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Message envoyé</Alert.Title>
            <Alert.Description>
              Le message a bien été transmis. Une réponse sera envoyée au courriel indiqué.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      ) : (
        <Form
          className="flex max-w-xl flex-col gap-4"
          validationBehavior="aria"
          onSubmit={(event) => {
            // Sans ça, le navigateur rechargerait la page : on veut envoyer en fetch.
            event.preventDefault();
            void handleSubmit(event.currentTarget);
          }}
        >
          <TextField isRequired name="name" maxLength={100} autoComplete="name">
            <Label>Nom</Label>
            <Input />
            <FieldError />
          </TextField>
          <TextField isRequired name="email" type="email" maxLength={254} autoComplete="email">
            <Label>Courriel</Label>
            <Input />
            <FieldError />
          </TextField>
          <TextField isRequired name="message" minLength={10} maxLength={2000}>
            <Label>Message</Label>
            <TextArea rows={6} />
            <FieldError />
          </TextField>

          {/* Piège à robots : hors écran, ignoré au clavier et des lecteurs d’écran. */}
          <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
            <label>
              Ne pas remplir
              <input type="text" name="alias" tabIndex={-1} autoComplete="off" />
            </label>
          </div>

          {error ? <ErrorMessage>{error}</ErrorMessage> : null}

          <Button type="submit" variant="primary" isDisabled={pending}>
            {pending ? 'Envoi…' : 'Envoyer le message'}
          </Button>

          <p className="text-muted text-xs">
            Les données saisies servent uniquement à répondre. Détails dans la{' '}
            <Link
              to="/confidentialite"
              className="text-foreground hover:text-foreground no-underline transition-colors duration-150"
            >
              politique de confidentialité
            </Link>{' '}
            ; l’identité de l’éditeur figure aux{' '}
            <Link
              to="/mentions-legales"
              className="text-foreground hover:text-foreground no-underline transition-colors duration-150"
            >
              mentions légales
            </Link>
            .
          </p>
        </Form>
      )}
    </>
  );
}
