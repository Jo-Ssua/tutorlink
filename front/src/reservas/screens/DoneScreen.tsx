import { Button, Card, Chip } from '@heroui/react';
import { CheckCircleIcon } from '@phosphor-icons/react';
import { ActionBar, FlowAlert } from '../components/ui';
import { CHOSEN_MODALITY_LABEL, formatCop, formatLongDate, formatTimeRange } from '../format';
import type { ChosenModality, CreatedBooking } from '../types';

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendiente de respuesta',
  CONFIRMED: 'Confirmada',
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-separator pb-2 last:border-0 last:pb-0">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-right text-sm font-medium text-foreground">{children}</dd>
    </div>
  );
}

export function DoneScreen({ result, onHome }: { result: CreatedBooking; onHome: () => void }) {
  const { booking } = result;

  return (
    <>
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <CheckCircleIcon aria-hidden="true" size={56} weight="fill" className="text-success" />
        <h1 className="text-2xl font-bold text-balance text-foreground sm:text-3xl">
          ¡Solicitud enviada!
        </h1>
        <p className="max-w-md text-sm text-muted sm:text-base">
          Tu tutoría de <b className="text-foreground">{booking.subject.name}</b> con{' '}
          <b className="text-foreground">{booking.tutor?.fullName}</b> fue registrada.
        </p>
        <Chip variant="soft" color={booking.status === 'CONFIRMED' ? 'success' : 'warning'}>
          {STATUS_LABEL[booking.status] ?? booking.status}
        </Chip>
      </div>

      <Card>
        <Card.Content>
          <dl className="flex flex-col gap-2">
            <Row label="Fecha">{formatLongDate(booking.startAt)}</Row>
            <Row label="Hora">{formatTimeRange(booking.startAt, booking.endAt)}</Row>
            <Row label="Modalidad">
              {CHOSEN_MODALITY_LABEL[booking.modality as ChosenModality] ?? booking.modality}
            </Row>
            <Row label="Tema">{booking.topic}</Row>
            <Row label="Total estimado">
              <span className="tabular-nums">{formatCop(booking.price.total)} COP</span>
            </Row>
          </dl>
        </Card.Content>
      </Card>

      <FlowAlert status="accent">
        El tutor revisará tu solicitud. Cuando la acepte podrás confirmar el pago simulado.
      </FlowAlert>

      <ActionBar>
        <Button onPress={onHome}>Volver al inicio</Button>
      </ActionBar>
    </>
  );
}
