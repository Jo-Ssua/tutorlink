import { Alert, Button } from '@heroui/react';
import type { FriendlyError } from '../errors';

/**
 * Error al cargar los datos de una pantalla, con reintento.
 *
 * A diferencia de `FormError` no se lleva el foco: el usuario no acaba de
 * enviar nada, así que robarle el foco interrumpiría lo que esté haciendo.
 */
export function LoadError({ error, onRetry }: { error: FriendlyError; onRetry: () => void }) {
  return (
    <div role="alert">
      <Alert status="danger">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>{error.message}</Alert.Title>
          {error.details.length > 0 && (
            <Alert.Description>
              <ul className="mt-1 list-inside list-disc space-y-1">
                {error.details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            </Alert.Description>
          )}
        </Alert.Content>
        <Button size="sm" variant="tertiary" onPress={onRetry}>
          Reintentar
        </Button>
      </Alert>
    </div>
  );
}
