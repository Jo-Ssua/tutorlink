import { Button, Card, Chip } from '@heroui/react';
import { CheckCircleIcon, ShieldCheckIcon } from '@phosphor-icons/react';
import { useCallback, useEffect, useState } from 'react';
import { ApiError, confirmSimulatedPayment, getMyBookings } from '../api';
import { FormError, FormNotice } from '../components/FormFeedback';
import { LoadError } from '../components/LoadError';
import { toFriendlyError, type FriendlyError } from '../errors';
import { MODALITY_LABEL, formatCop, formatDuration, formatLongDate, formatTimeRange } from '../reservas/format';
import type { Booking } from '../types';

/** Una línea del desglose: concepto a la izquierda, monto a la derecha. */
function PriceRow({
  label,
  hint,
  amount,
  emphasis = false,
}: {
  label: string;
  hint?: string;
  amount: number;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`flex items-start justify-between gap-4 ${
        emphasis ? 'border-t border-border pt-3' : ''
      }`}
    >
      <span className="flex flex-col text-sm text-foreground">
        {label}
        {hint && <small className="text-muted">{hint}</small>}
      </span>
      <strong className={`tabular-nums ${emphasis ? 'text-lg' : ''}`}>
        {formatCop(amount)}
      </strong>
    </div>
  );
}

/** Desglose completo del costo: nada de lo que se cobra queda fuera de aquí. */
function PriceBreakdown({ booking }: { booking: Booking }) {
  const { price } = booking;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <p className="text-xs font-semibold tracking-wide text-muted uppercase">
        Desglose del costo
      </p>
      <PriceRow
        label="Valor de la sesión"
        hint={`${formatDuration(price.durationMinutes)} × ${formatCop(price.hourlyRate)} / hora`}
        amount={price.subtotal}
      />
      <PriceRow
        label="Tarifa de servicio TutorLink"
        hint={`${price.platformFeePercent}% de comisión simulada`}
        amount={price.platformFee}
      />
      <PriceRow label="Total a pagar" amount={price.total} emphasis />
    </div>
  );
}

function SessionMeta({ booking }: { booking: Booking }) {
  return (
    <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {[
        { label: 'Tutor', value: booking.tutor?.fullName ?? 'Tutor' },
        { label: 'Fecha', value: formatLongDate(booking.startAt) },
        { label: 'Hora', value: formatTimeRange(booking.startAt, booking.endAt) },
        { label: 'Modalidad', value: MODALITY_LABEL[booking.modality] ?? booking.modality },
      ].map((item) => (
        <div key={item.label} className="flex flex-col gap-0.5">
          <dt className="text-xs font-semibold tracking-wide text-muted uppercase">
            {item.label}
          </dt>
          <dd className="text-sm text-foreground">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Pagos del estudiante (HU de transparencia de tarifa y pago simulado).
 *
 * Una reserva aceptada por el tutor muestra el desglose completo antes de
 * cobrar nada: tarifa, duración, comisión simulada y total. Confirmar registra
 * la transacción como pago simulado aprobado; cancelar no envía nada, así que
 * no se genera cobro. El MVP no pide ni procesa datos bancarios reales.
 */
export function StudentPayments() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<FriendlyError | null>(null);

  /** Reserva cuyo pago se está confirmando, ya con el aviso a la vista. */
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<FriendlyError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setListError(null);

    try {
      const result = await getMyBookings({ limit: 50 });
      setBookings(result.items);
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'SESSION_EXPIRED') return;
      setListError(toFriendlyError(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleConfirm(booking: Booking) {
    setSubmitting(true);
    setActionError(null);

    try {
      const result = await confirmSimulatedPayment(booking.id);
      setBookings((current) =>
        current.map((item) => (item.id === booking.id ? result.booking : item)),
      );
      setNotice(
        `Pago simulado aprobado · referencia ${result.payment.reference}. La sesión quedó confirmada y no se realizó ningún cobro real.`,
      );
      setConfirmingId(null);
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'SESSION_EXPIRED') return;
      setActionError(toFriendlyError(caught));
    } finally {
      setSubmitting(false);
    }
  }

  const toPay = bookings.filter((booking) => booking.status === 'ACCEPTED');
  const waitingTutor = bookings.filter((booking) => booking.status === 'PENDING');
  const paid = bookings.filter(
    (booking) =>
      booking.payment !== null &&
      (booking.status === 'CONFIRMED' || booking.status === 'COMPLETED'),
  );

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <section className="flex flex-col gap-2">
        <p className="text-xs font-semibold tracking-wide text-muted uppercase">Pagos</p>
        <h1 className="text-2xl font-bold text-balance text-foreground sm:text-3xl">
          Tarifas y pagos simulados
        </h1>
        <p className="max-w-2xl text-sm text-muted sm:text-base">
          Antes de confirmar ves el valor completo: tarifa por sesión, duración, comisión simulada
          y total. TutorLink no solicita ni procesa datos bancarios reales.
        </p>
      </section>

      {notice && <FormNotice>{notice}</FormNotice>}
      {listError && <LoadError error={listError} onRetry={() => void load()} />}

      {loading && (
        <div className="flex flex-col gap-4" aria-live="polite" aria-busy="true">
          <span className="sr-only">Cargando tus reservas...</span>
          <div className="h-48 animate-pulse rounded-xl bg-default" />
          <div className="h-48 animate-pulse rounded-xl bg-default" />
        </div>
      )}

      {!loading && !listError && (
        <section className="flex flex-col gap-4" aria-labelledby="payments-pending-title">
          <div className="flex items-center gap-2">
            <h2 id="payments-pending-title" className="text-lg font-bold text-foreground">
              Esperando tu pago simulado
            </h2>
            <Chip size="sm" variant="soft" color="warning">
              {toPay.length}
            </Chip>
          </div>

          {toPay.length === 0 ? (
            <Card>
              <Card.Content className="flex flex-col items-center gap-2 py-10 text-center">
                <h3 className="text-lg font-bold text-foreground">No tienes pagos pendientes</h3>
                <p className="max-w-md text-sm text-muted">
                  Cuando un tutor acepte tu solicitud, aquí verás el resumen del valor para
                  confirmar el pago simulado.
                </p>
              </Card.Content>
            </Card>
          ) : (
            toPay.map((booking) => {
              const isConfirming = confirmingId === booking.id;

              return (
                <Card key={booking.id}>
                  <Card.Header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 flex-col gap-1">
                      <p className="text-xs font-semibold tracking-wide text-muted uppercase">
                        {booking.subject.code}
                      </p>
                      <Card.Title>{booking.subject.name}</Card.Title>
                      <Card.Description>{booking.topic}</Card.Description>
                    </div>
                    <Chip className="self-start" size="sm" variant="soft" color="warning">
                      Aceptada · sin pagar
                    </Chip>
                  </Card.Header>

                  <Card.Content className="flex flex-col gap-4">
                    <SessionMeta booking={booking} />
                    <PriceBreakdown booking={booking} />

                    <ul className="flex flex-col gap-2 text-sm text-muted">
                      <li className="flex items-start gap-2">
                        <ShieldCheckIcon
                          aria-hidden="true"
                          className="mt-0.5 shrink-0 text-success"
                        />
                        <span>
                          Pago simulado del MVP: no se piden datos de tarjeta, cuenta ni banco.
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircleIcon
                          aria-hidden="true"
                          className="mt-0.5 shrink-0 text-success"
                        />
                        <span>Sin cargos ocultos: el total es el del desglose.</span>
                      </li>
                    </ul>

                    {isConfirming && actionError && <FormError error={actionError} />}

                    {isConfirming ? (
                      <div
                        className="flex flex-col gap-3 rounded-lg border border-border p-4"
                        role="group"
                        aria-label={`Confirmar el pago simulado de ${booking.subject.name}`}
                      >
                        <p className="text-sm text-foreground">
                          Vas a registrar un pago simulado de{' '}
                          <b className="tabular-nums">{formatCop(booking.price.total)}</b>. La
                          reserva queda confirmada y no se mueve dinero real.
                        </p>
                        <div className="flex flex-col gap-3 sm:flex-row">
                          <Button
                            isDisabled={submitting}
                            onPress={() => void handleConfirm(booking)}
                          >
                            {submitting ? 'Registrando pago...' : 'Confirmar pago simulado'}
                          </Button>
                          <Button
                            variant="tertiary"
                            isDisabled={submitting}
                            onPress={() => {
                              setConfirmingId(null);
                              setActionError(null);
                            }}
                          >
                            Cancelar
                          </Button>
                        </div>
                        <p className="text-xs text-muted">
                          Si cancelas, la reserva sigue aceptada y sin ningún cobro.
                        </p>
                      </div>
                    ) : (
                      <Button
                        className="self-start"
                        onPress={() => {
                          setNotice(null);
                          setActionError(null);
                          setConfirmingId(booking.id);
                        }}
                      >
                        Pagar {formatCop(booking.price.total)}
                      </Button>
                    )}
                  </Card.Content>
                </Card>
              );
            })
          )}
        </section>
      )}

      {!loading && !listError && waitingTutor.length > 0 && (
        <section className="flex flex-col gap-4" aria-labelledby="payments-waiting-title">
          <h2 id="payments-waiting-title" className="text-lg font-bold text-foreground">
            Esperando respuesta del tutor
          </h2>
          {waitingTutor.map((booking) => (
            <Card key={booking.id}>
              <Card.Header className="flex flex-col gap-1">
                <p className="text-xs font-semibold tracking-wide text-muted uppercase">
                  {booking.subject.code}
                </p>
                <Card.Title>{booking.subject.name}</Card.Title>
              </Card.Header>
              <Card.Content className="flex flex-col gap-3">
                <SessionMeta booking={booking} />
                <p className="text-sm text-muted">
                  Solicitud sin cobro: el total estimado es{' '}
                  <b className="text-foreground tabular-nums">{formatCop(booking.price.total)}</b>{' '}
                  y solo se cobra (de forma simulada) cuando el tutor acepte y tú confirmes.
                </p>
              </Card.Content>
            </Card>
          ))}
        </section>
      )}

      {!loading && !listError && paid.length > 0 && (
        <section className="flex flex-col gap-4" aria-labelledby="payments-done-title">
          <h2 id="payments-done-title" className="text-lg font-bold text-foreground">
            Pagos simulados registrados
          </h2>
          {paid.map((booking) => (
            <Card key={booking.id}>
              <Card.Header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="text-xs font-semibold tracking-wide text-muted uppercase">
                    {booking.subject.code}
                  </p>
                  <Card.Title>{booking.subject.name}</Card.Title>
                </div>
                <Chip className="self-start" size="sm" variant="soft" color="success">
                  Pago simulado aprobado
                </Chip>
              </Card.Header>
              <Card.Content className="flex flex-col gap-3">
                <SessionMeta booking={booking} />
                <PriceBreakdown booking={booking} />
                {booking.payment && (
                  <p className="text-sm text-muted">
                    Referencia{' '}
                    <b className="text-foreground">{booking.payment.reference}</b> ·{' '}
                    {formatCop(booking.payment.amount)} · pago simulado, sin cobro real.
                  </p>
                )}
              </Card.Content>
            </Card>
          ))}
        </section>
      )}
    </main>
  );
}
