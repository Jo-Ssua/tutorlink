import { Alert, Button, Spinner } from '@heroui/react';
import { CaretLeftIcon } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { initials } from '../format';

export function Avatar({ name, size = 'md' }: { name: string; size?: 'md' | 'lg' }) {
  const box = size === 'lg' ? 'size-16 text-xl' : 'size-11 text-sm';
  return (
    <div
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-full bg-accent-soft font-bold text-accent ${box}`}
    >
      {initials(name)}
    </div>
  );
}

/**
 * Encabezado de cada paso del flujo: vuelta atrás siempre visible y, cuando el
 * paso forma parte de la reserva, en qué punto va. El progreso se anuncia como
 * `progressbar` para que un lector de pantalla no dependa del color de las
 * barras.
 */
export function ScreenHeader({
  onBack,
  backLabel = 'Volver',
  step,
  title,
  lead,
}: {
  onBack?: () => void;
  backLabel?: string;
  step?: { current: number; total: number };
  title: string;
  lead?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3">
      {onBack && (
        <Button className="-ml-2 self-start" size="sm" variant="tertiary" onPress={onBack}>
          <CaretLeftIcon aria-hidden="true" />
          {backLabel}
        </Button>
      )}

      {step && (
        <div
          className="flex flex-col gap-1.5"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={step.total}
          aria-valuenow={step.current}
          aria-valuetext={`Paso ${step.current} de ${step.total} de la reserva`}
        >
          <p className="text-xs font-semibold tracking-wide text-accent uppercase">
            Paso {step.current} de {step.total} · Reserva
          </p>
          <div className="flex gap-1.5">
            {Array.from({ length: step.total }, (_, index) => (
              <span
                key={index}
                className={`h-1.5 w-10 rounded-full ${
                  index < step.current ? 'bg-accent' : 'bg-default'
                }`}
              />
            ))}
          </div>
        </div>
      )}

      <h1 className="text-2xl font-bold text-balance text-foreground sm:text-3xl">{title}</h1>
      {lead && <p className="max-w-2xl text-sm text-muted sm:text-base">{lead}</p>}
    </header>
  );
}

/**
 * Cierre de pantalla con la acción principal.
 *
 * No va fija al borde inferior: en móvil ese borde ya lo ocupan las pestañas
 * de navegación, y dos barras superpuestas se tapan entre sí.
 */
export function ActionBar({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm text-muted">{aside}</div>
      <div className="flex flex-col gap-2 sm:flex-row">{children}</div>
    </div>
  );
}

export function FlowAlert({
  status = 'danger',
  title,
  children,
  action,
}: {
  status?: 'danger' | 'warning' | 'accent' | 'success';
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div role={status === 'danger' ? 'alert' : 'status'}>
      <Alert status={status}>
        <Alert.Indicator />
        <Alert.Content>
          {title && <Alert.Title>{title}</Alert.Title>}
          {children && <Alert.Description>{children}</Alert.Description>}
        </Alert.Content>
        {action}
      </Alert>
    </div>
  );
}

export function Loading({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-10 text-sm text-muted" role="status">
      <Spinner size="sm" />
      {label}
    </div>
  );
}
