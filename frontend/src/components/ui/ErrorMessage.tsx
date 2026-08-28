import { Alert } from '@heroui/react';

export function ErrorMessage({ children }: { children: string }) {
  return (
    <Alert status="danger">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{children}</Alert.Title>
      </Alert.Content>
    </Alert>
  );
}
