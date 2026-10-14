import { Alert } from '@heroui/react';
import { LAB_SECURITY_LINES, LAB_WARNING_LINES, LAB_WARNING_TITLE } from '../../lib/labWarning';

/**
 * Avertissement fixe d'un laboratoire. Le texte ne se rédige pas : il vient de
 * `lib/labWarning.ts`, comme le `LISEZMOI.txt` de l'archive.
 */
export function LabWarning({ securityLab }: { securityLab: boolean }) {
  const lines = securityLab ? [...LAB_WARNING_LINES, ...LAB_SECURITY_LINES] : LAB_WARNING_LINES;

  return (
    <Alert status="warning">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{LAB_WARNING_TITLE}</Alert.Title>
        <Alert.Description>
          <ul className="mt-1 list-disc pl-5">
            {lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </Alert.Description>
      </Alert.Content>
    </Alert>
  );
}
