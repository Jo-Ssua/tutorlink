import { Alert } from '@heroui/react';
import { useEffect, useRef, type ReactNode } from 'react';
import type { FriendlyError } from '../errors';

/**
 * Resumen de error de un formulario.
 *
 * Recibe el foco en cuanto aparece: tras un envío fallido el usuario puede
 * estar al final del formulario, con el motivo del rechazo fuera de la
 * pantalla, y en lector de pantalla no hay nada que anuncie el cambio si el
 * foco se queda donde estaba.
 */
export function FormError({ error }: { error: FriendlyError | null }) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (error) container.current?.focus();
  }, [error]);

  if (!error) return null;

  return (
    <div ref={container} role="alert" tabIndex={-1} className="scroll-mt-6 outline-none">
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
      </Alert>
    </div>
  );
}

/** Aviso que no interrumpe: se anuncia cuando el lector termine lo que dice. */
export function FormNotice({
  children,
  status = 'success',
}: {
  children: ReactNode;
  status?: 'success' | 'accent';
}) {
  return (
    <div role="status">
      <Alert status={status}>
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>{children}</Alert.Title>
        </Alert.Content>
      </Alert>
    </div>
  );
}
