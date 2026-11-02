import { BottomBar } from '../components/ui';
import {
  CHOSEN_MODALITY_LABEL,
  formatCop,
  formatLongDate,
  formatTimeRange,
} from '../format';
import type { ChosenModality, CreatedBooking } from '../types';

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendiente de respuesta',
  CONFIRMED: 'Confirmada',
};

export function DoneScreen({
  result,
  onHome,
}: {
  result: CreatedBooking;
  onHome: () => void;
}) {
  const { booking } = result;

  return (
    <>
      <div className="done">
        <div className="done__icon" aria-hidden="true">
          ✓
        </div>
        <h1>¡Solicitud enviada!</h1>
        <p className="lead">
          Tu tutoría de <b>{booking.subject.name}</b> con <b>{booking.tutor?.fullName}</b> fue
          registrada.
        </p>
        <span className={`status status--${booking.status.toLowerCase()}`}>
          {STATUS_LABEL[booking.status] ?? booking.status}
        </span>
      </div>

      <section className="card summary">
        <dl>
          <div>
            <dt>Fecha</dt>
            <dd>{formatLongDate(booking.startAt)}</dd>
          </div>
          <div>
            <dt>Hora</dt>
            <dd>{formatTimeRange(booking.startAt, booking.endAt)}</dd>
          </div>
          <div>
            <dt>Modalidad</dt>
            <dd>{CHOSEN_MODALITY_LABEL[booking.modality as ChosenModality] ?? booking.modality}</dd>
          </div>
          <div>
            <dt>Tema</dt>
            <dd>{booking.topic}</dd>
          </div>
          <div>
            <dt>Total estimado</dt>
            <dd>{formatCop(booking.price.total)} COP</dd>
          </div>
        </dl>
      </section>

      <div className="r-alert r-alert--info" role="status">
        El tutor revisará tu solicitud. Cuando la acepte podrás confirmar el pago simulado.
      </div>

      <BottomBar>
        <button type="button" className="btn btn--primary" onClick={onHome}>
          Volver al inicio
        </button>
      </BottomBar>
    </>
  );
}
