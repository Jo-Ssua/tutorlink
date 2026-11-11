import { Button, Card, Chip } from '@heroui/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ApiError,
  getPendingStudyMatchProposals,
  getTutorBookings,
  respondToStudyMatchProposal,
} from '../api';
import { useAuth } from '../auth/AuthContext';
import { LoadError } from '../components/LoadError';
import { StatTile } from '../components/StatTile';
import { toFriendlyError, type FriendlyError } from '../errors';
import type { Booking, BookingStatus } from '../types';
import type { StudyMatchTutorProposal } from '../studymatch/types';
import { formatLongDate, formatTimeRange, MODALITY_LABEL } from '../reservas/format';

const dateTimeFormatter = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const copFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

const STATUS_LABEL: Record<BookingStatus, string> = {
  PENDING: 'Por responder',
  ACCEPTED: 'Esperando pago',
  CONFIRMED: 'Confirmada',
  COMPLETED: 'Completada',
  REJECTED: 'Rechazada',
  CANCELLED: 'Cancelada',
};

const STATUS_COLOR: Record<BookingStatus, 'default' | 'warning' | 'success' | 'danger'> = {
  PENDING: 'warning',
  ACCEPTED: 'warning',
  CONFIRMED: 'success',
  COMPLETED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'default',
};

/** Un dato de la ficha: etiqueta arriba, valor abajo. */
function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</dt>
      <dd className="text-sm text-foreground">{children}</dd>
    </div>
  );
}

function EmergencyProposalCard({
  proposal,
  submitting,
  onRespond,
}: {
  proposal: StudyMatchTutorProposal;
  submitting: boolean;
  onRespond: (proposal: StudyMatchTutorProposal, action: 'ACCEPT' | 'REJECT') => void;
}) {
  return (
    <Card>
      <Card.Header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold tracking-wide text-accent uppercase">
            Tutoría de emergencia · {proposal.request.urgency}
          </p>
          <Card.Title>
            {proposal.request.subject.code} · {proposal.request.subject.name}
          </Card.Title>
        </div>
        <Chip size="sm" variant="soft" color="warning">
          Requiere respuesta
        </Chip>
      </Card.Header>
      <Card.Content className="flex flex-col gap-4">
        <p className="text-sm text-muted">
          Estudiante: <strong className="text-foreground">{proposal.studentAlias}</strong>
        </p>
        <p className="text-sm text-foreground">{proposal.request.topic}</p>
        {proposal.request.description && (
          <p className="text-sm text-muted">{proposal.request.description}</p>
        )}
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Meta label="Fecha">{formatLongDate(proposal.slot.startAt)}</Meta>
          <Meta label="Horario">
            {formatTimeRange(proposal.slot.startAt, proposal.slot.endAt)}
          </Meta>
          <Meta label="Modalidad">{MODALITY_LABEL[proposal.slot.modality]}</Meta>
          <Meta label="Duración">{proposal.slot.durationMinutes} min</Meta>
        </dl>
        <p className="text-xs text-muted">
          Responde antes de {dateTimeFormatter.format(new Date(proposal.expiresAt))}.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            isDisabled={submitting}
            onPress={() => onRespond(proposal, 'ACCEPT')}
          >
            Aceptar solicitud
          </Button>
          <Button
            variant="tertiary"
            isDisabled={submitting}
            onPress={() => onRespond(proposal, 'REJECT')}
          >
            Rechazar y buscar otro tutor
          </Button>
        </div>
      </Card.Content>
    </Card>
  );
}

/**
 * Pantalla inicial del tutor. Antes el rol TUTOR se quedaba sin destino tras
 * iniciar sesión: caía en un panel de "solo para estudiantes".
 *
 * Además de sus reservas, muestra y permite responder las propuestas urgentes
 * de StudyMatch que el tutor tiene pendientes.
 */
export function TutorHome() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [proposals, setProposals] = useState<StudyMatchTutorProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(false);
  const [error, setError] = useState<FriendlyError | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [result, pending] = await Promise.all([
        getTutorBookings(),
        getPendingStudyMatchProposals(),
      ]);
      setBookings(result.items);
      setProposals(pending.items);
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'SESSION_EXPIRED') {
        return;
      }
      setError(toFriendlyError(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void getPendingStudyMatchProposals()
        .then((result) => setProposals(result.items))
        .catch((caught) => {
          if (caught instanceof ApiError && caught.code === 'SESSION_EXPIRED') return;
          setError(toFriendlyError(caught));
        });
    }, 5000);

    return () => window.clearInterval(interval);
  }, []);

  async function handleProposalResponse(
    proposal: StudyMatchTutorProposal,
    action: 'ACCEPT' | 'REJECT',
  ) {
    setResponding(true);
    setError(null);
    try {
      await respondToStudyMatchProposal(proposal.id, {
        action,
        ...(action === 'REJECT' ? { reason: 'No puedo atender esta solicitud.' } : {}),
      });
      setProposals((current) => current.filter((item) => item.id !== proposal.id));
      if (action === 'ACCEPT') {
        await load();
      }
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'SESSION_EXPIRED') return;
      setError(toFriendlyError(caught));
    } finally {
      setResponding(false);
    }
  }

  const counts = useMemo(() => {
    const upcoming = bookings.filter(
      (booking) =>
        (booking.status === 'CONFIRMED' || booking.status === 'ACCEPTED') &&
        new Date(booking.startAt) > new Date(),
    ).length;

    return {
      pending: bookings.filter((booking) => booking.status === 'PENDING').length,
      upcoming,
      completed: bookings.filter((booking) => booking.status === 'COMPLETED').length,
    };
  }, [bookings]);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <section className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold text-balance text-foreground sm:text-3xl">
            Hola, {user?.fullName.split(/\s+/)[0]}
          </h1>
          <p className="max-w-2xl text-sm text-muted sm:text-base">
            Estas son las reservas que han hecho sobre tus horarios. El nombre del estudiante llega
            anonimizado hasta que la sesión se confirma.
          </p>
        </div>
        <div
          className="grid grid-cols-3 gap-2 sm:gap-3 lg:w-auto lg:shrink-0"
          aria-label="Resumen de reservas"
        >
          <StatTile value={counts.pending} label="Por responder" accent />
          <StatTile value={counts.upcoming} label="Próximas" />
          <StatTile value={counts.completed} label="Completadas" />
        </div>
      </section>

      {error && <LoadError error={error} onRetry={() => void load()} />}

      {!loading && proposals.length > 0 && (
        <section className="flex flex-col gap-4" aria-labelledby="emergency-proposals-title">
          <div className="flex items-center gap-2">
            <h2 id="emergency-proposals-title" className="text-lg font-bold text-foreground">
              Solicitudes de emergencia
            </h2>
            <Chip size="sm" variant="soft" color="warning">
              {proposals.length}
            </Chip>
          </div>
          <div className="flex flex-col gap-4">
            {proposals.map((proposal) => (
              <EmergencyProposalCard
                key={proposal.id}
                proposal={proposal}
                submitting={responding}
                onRespond={(item, action) => void handleProposalResponse(item, action)}
              />
            ))}
          </div>
        </section>
      )}

      {loading && (
        <div className="flex flex-col gap-4" aria-live="polite" aria-busy="true">
          <span className="sr-only">Cargando reservas...</span>
          <div className="h-32 animate-pulse rounded-xl bg-default" />
          <div className="h-32 animate-pulse rounded-xl bg-default" />
        </div>
      )}

      {!loading && !error && bookings.length === 0 && (
        <Card>
          <Card.Content className="flex flex-col items-center gap-2 py-10 text-center">
            <h2 className="text-lg font-bold text-foreground">Todavía no tienes reservas</h2>
            <p className="max-w-md text-sm text-muted">
              Cuando alguien reserve uno de tus horarios aparecerá aquí. Publica tu disponibilidad
              desde <code>POST /tutor/availability</code> mientras la pantalla de agenda esté en
              construcción.
            </p>
          </Card.Content>
        </Card>
      )}

      {!loading && bookings.length > 0 && (
        <section className="flex flex-col gap-4" aria-labelledby="tutor-bookings-title">
          <div className="flex items-center gap-2">
            <h2 id="tutor-bookings-title" className="text-lg font-bold text-foreground">
              Reservas recibidas
            </h2>
            <Chip size="sm" variant="soft">
              {bookings.length}
            </Chip>
          </div>

          <div className="flex flex-col gap-4">
            {bookings.map((booking) => (
              <Card key={booking.id}>
                <Card.Header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex flex-col gap-1">
                    <p className="text-xs font-semibold tracking-wide text-muted uppercase">
                      {booking.subject.code} · {booking.subject.name}
                    </p>
                    <Card.Title>{booking.topic}</Card.Title>
                  </div>
                  <Chip
                    className="self-start"
                    size="sm"
                    variant="soft"
                    color={STATUS_COLOR[booking.status]}
                  >
                    {STATUS_LABEL[booking.status]}
                  </Chip>
                </Card.Header>

                <Card.Content>
                  <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                    <Meta label="Cuándo">
                      <time dateTime={booking.startAt}>
                        {dateTimeFormatter.format(new Date(booking.startAt))}
                      </time>
                    </Meta>
                    <Meta label="Estudiante">{booking.student?.alias ?? 'Anónimo'}</Meta>
                    <Meta label="Tus ingresos">
                      <span className="tabular-nums">
                        {copFormatter.format(booking.price.subtotal - booking.price.platformFee)}
                      </span>
                    </Meta>
                  </dl>
                </Card.Content>
              </Card>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
