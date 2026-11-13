import { Button, Card, Chip, Label, TextArea, TextField } from '@heroui/react';
import { CaretDownIcon, CaretUpIcon } from '@phosphor-icons/react';
import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../api';
import { FormError, FormNotice } from '../components/FormFeedback';
import { LoadError } from '../components/LoadError';
import { StatTile } from '../components/StatTile';
import { toFriendlyError, type FriendlyError } from '../errors';
import { acceptRequest, getRequestsDashboard, rejectRequest } from '../solicitudes/api';
import type { RequestItem, RequestsDashboard } from '../solicitudes/types';
import type { BookingStatus, Modality } from '../types';

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

const MODALITY_LABEL: Record<Modality, string> = {
  IN_PERSON: 'Presencial',
  VIRTUAL: 'Virtual',
  HYBRID: 'Híbrida',
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

function When({ value }: { value: string }) {
  return <time dateTime={value}>{dateTimeFormatter.format(new Date(value))}</time>;
}

function RequestHeader({ item }: { item: RequestItem }) {
  return (
    <Card.Header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex flex-col gap-1">
        <p className="text-xs font-semibold tracking-wide text-muted uppercase">
          {item.subject.code} · {item.subject.name}
        </p>
        <Card.Title>{item.topic}</Card.Title>
      </div>
      <div className="flex flex-wrap gap-2 self-start">
        {item.isEmergency && (
          <Chip size="sm" variant="soft" color="danger">
            Urgente
          </Chip>
        )}
        <Chip size="sm" variant="soft" color={STATUS_COLOR[item.status]}>
          {STATUS_LABEL[item.status]}
        </Chip>
      </div>
    </Card.Header>
  );
}

/** Tarjeta de solo lectura para lo que ya no necesita una respuesta del tutor. */
function RequestSummaryCard({ item }: { item: RequestItem }) {
  return (
    <Card>
      <RequestHeader item={item} />
      <Card.Content className="gap-3">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Meta label="Fecha">
            <When value={item.startAt} />
          </Meta>
          <Meta label="Estudiante">{item.studentAlias}</Meta>
          <Meta label="Modalidad">{MODALITY_LABEL[item.modality]}</Meta>
          <Meta label="Tarifa">
            <span className="tabular-nums">{copFormatter.format(item.rate)}/h</span>
          </Meta>
        </dl>
        {item.status === 'REJECTED' && item.cancellationReason && (
          <p className="text-sm text-muted">Motivo: {item.cancellationReason}</p>
        )}
        {item.status === 'ACCEPTED' && (
          <p className="text-sm text-muted">
            El estudiante debe confirmar el pago simulado para dejar la sesión confirmada.
          </p>
        )}
      </Card.Content>
    </Card>
  );
}

function Block({
  id,
  title,
  total,
  items,
  empty,
}: {
  id: string;
  title: string;
  total: number;
  items: RequestItem[];
  empty: string;
}) {
  return (
    <section className="flex flex-col gap-4" aria-labelledby={id}>
      <div className="flex items-center gap-2">
        <h2 id={id} className="text-lg font-bold text-foreground">
          {title}
        </h2>
        <Chip size="sm" variant="soft">
          {total}
        </Chip>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {items.map((item) => (
            <li key={item.id}>
              <RequestSummaryCard item={item} />
            </li>
          ))}
        </ul>
      )}
      {total > items.length && (
        <p className="text-xs text-muted">
          Mostrando {items.length} de {total}.
        </p>
      )}
    </section>
  );
}

type PendingAction = { id: string; kind: 'accept' | 'reject' };

/**
 * Panel de solicitudes del tutor: lo que está por responder, lo ya
 * respondido y las próximas sesiones.
 *
 * Aceptar y rechazar piden una confirmación explícita y no cambian nada hasta
 * que el tutor la da. El aviso al estudiante lo genera la API al responder.
 */
export function TutorRequests() {
  const [dashboard, setDashboard] = useState<RequestsDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<FriendlyError | null>(null);

  const [openId, setOpenId] = useState<string | null>(null);
  const [action, setAction] = useState<PendingAction | null>(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<FriendlyError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setDashboard(await getRequestsDashboard());
      setLoadError(null);
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'SESSION_EXPIRED') return;
      setLoadError(toFriendlyError(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function toggle(id: string) {
    setAction(null);
    setActionError(null);
    setReason('');
    setOpenId((current) => (current === id ? null : id));
  }

  function startAction(next: PendingAction) {
    setActionError(null);
    setReason('');
    setAction(next);
  }

  function cancelAction() {
    setAction(null);
    setActionError(null);
    setReason('');
  }

  async function confirmAction() {
    if (!action) return;

    setSaving(true);
    setActionError(null);
    setNotice(null);

    try {
      if (action.kind === 'accept') {
        await acceptRequest(action.id);
        setNotice(
          'Solicitud aceptada. El estudiante fue notificado y debe confirmar el pago simulado.',
        );
      } else {
        await rejectRequest(action.id, reason);
        setNotice('Solicitud rechazada. El estudiante fue notificado y la franja quedó libre.');
      }

      setAction(null);
      setOpenId(null);
      setReason('');
      await load();
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'SESSION_EXPIRED') return;
      setActionError(toFriendlyError(caught));
      // Si la solicitud ya cambió de estado, lo que se ve está desactualizado.
      if (caught instanceof ApiError && caught.status === 409) void load();
    } finally {
      setSaving(false);
    }
  }

  const counts = dashboard?.counts;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <section className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold text-balance text-foreground sm:text-3xl">
            Solicitudes de tutoría
          </h1>
          <p className="max-w-2xl text-sm text-muted sm:text-base">
            Responde a los estudiantes interesados en tus horarios. Su nombre llega anonimizado y
            recibirán un aviso cuando aceptes o rechaces.
          </p>
        </div>
        <div
          className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3 lg:w-auto lg:shrink-0"
          aria-label="Resumen de solicitudes"
        >
          <StatTile value={counts?.pending ?? '–'} label="Pendientes" accent />
          <StatTile value={counts?.accepted ?? '–'} label="Aceptadas" />
          <StatTile value={counts?.rejected ?? '–'} label="Rechazadas" />
          <StatTile value={counts?.upcoming ?? '–'} label="Próximas sesiones" />
        </div>
      </section>

      {notice && <FormNotice>{notice}</FormNotice>}

      {loadError && <LoadError error={loadError} onRetry={() => void load()} />}

      {loading && (
        <div className="flex flex-col gap-4" aria-live="polite" aria-busy="true">
          <span className="sr-only">Cargando solicitudes...</span>
          <div className="h-32 animate-pulse rounded-xl bg-default" />
          <div className="h-32 animate-pulse rounded-xl bg-default" />
        </div>
      )}

      {dashboard && (
        <>
          <section className="flex flex-col gap-4" aria-labelledby="requests-pending-title">
            <div className="flex items-center gap-2">
              <h2 id="requests-pending-title" className="text-lg font-bold text-foreground">
                Pendientes
              </h2>
              <Chip size="sm" variant="soft" color="warning">
                {dashboard.counts.pending}
              </Chip>
            </div>

            {dashboard.pending.length === 0 ? (
              <Card>
                <Card.Content className="flex flex-col items-center gap-2 py-10 text-center">
                  <h3 className="text-lg font-bold text-foreground">No tienes solicitudes por responder</h3>
                  <p className="max-w-md text-sm text-muted">
                    Cuando un estudiante reserve uno de tus horarios, aparecerá aquí para que lo
                    aceptes o lo rechaces.
                  </p>
                </Card.Content>
              </Card>
            ) : (
              <ul className="flex flex-col gap-4">
                {dashboard.pending.map((item) => {
                  const open = openId === item.id;
                  const panelId = `request-detail-${item.id}`;
                  const confirming = open && action?.id === item.id ? action.kind : null;

                  return (
                    <li key={item.id}>
                      <Card>
                        <RequestHeader item={item} />
                        <Card.Content className="gap-4">
                          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                            <Meta label="Fecha">
                              <When value={item.startAt} />
                            </Meta>
                            <Meta label="Estudiante">{item.studentAlias}</Meta>
                            <Meta label="Tarifa">
                              <span className="tabular-nums">
                                {copFormatter.format(item.rate)}/h
                              </span>
                            </Meta>
                          </dl>

                          <div>
                            <Button
                              size="sm"
                              variant="tertiary"
                              aria-expanded={open}
                              aria-controls={panelId}
                              onPress={() => toggle(item.id)}
                            >
                              {open ? 'Cerrar solicitud' : 'Revisar solicitud'}
                              {open ? <CaretUpIcon /> : <CaretDownIcon />}
                            </Button>
                          </div>

                          {open && (
                            <div
                              id={panelId}
                              role="group"
                              aria-label={`Solicitud de ${item.topic}`}
                              className="flex flex-col gap-4 border-t border-border pt-4"
                            >
                              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                                <Meta label="Materia">
                                  {item.subject.code} · {item.subject.name}
                                </Meta>
                                <Meta label="Tema">{item.topic}</Meta>
                                <Meta label="Fecha y hora">
                                  <When value={item.startAt} />
                                </Meta>
                                <Meta label="Duración">{item.durationMinutes} min</Meta>
                                <Meta label="Modalidad">{MODALITY_LABEL[item.modality]}</Meta>
                                <Meta label="Tarifa por hora">
                                  <span className="tabular-nums">
                                    {copFormatter.format(item.rate)}
                                  </span>
                                </Meta>
                                <Meta label="Tus ingresos">
                                  <span className="tabular-nums">
                                    {copFormatter.format(item.subtotal)}
                                  </span>
                                </Meta>
                                <Meta label="Solicitada">
                                  <When value={item.createdAt} />
                                </Meta>
                                {item.description && (
                                  <div className="col-span-2 sm:col-span-4">
                                    <Meta label="Descripción">{item.description}</Meta>
                                  </div>
                                )}
                              </dl>

                              {!item.canRespond && (
                                <p className="text-sm text-muted">
                                  La hora de esta solicitud ya pasó, así que no se puede aceptar.
                                  Puedes rechazarla para liberar la franja.
                                </p>
                              )}

                              {!confirming && (
                                <div className="flex flex-wrap items-center gap-2">
                                  <Button
                                    isDisabled={!item.canRespond || saving}
                                    onPress={() => startAction({ id: item.id, kind: 'accept' })}
                                  >
                                    Aceptar
                                  </Button>
                                  <Button
                                    variant="danger-soft"
                                    isDisabled={saving}
                                    onPress={() => startAction({ id: item.id, kind: 'reject' })}
                                  >
                                    Rechazar
                                  </Button>
                                </div>
                              )}

                              {confirming === 'accept' && (
                                <div
                                  role="group"
                                  aria-label="Confirmar aceptación"
                                  className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4"
                                >
                                  <p className="text-sm text-foreground">
                                    ¿Aceptar esta solicitud? El estudiante recibirá la
                                    actualización y deberá confirmar el pago simulado.
                                  </p>
                                  <FormError error={actionError} />
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Button isDisabled={saving} onPress={() => void confirmAction()}>
                                      {saving ? 'Aceptando…' : 'Confirmar aceptación'}
                                    </Button>
                                    <Button
                                      variant="tertiary"
                                      isDisabled={saving}
                                      onPress={cancelAction}
                                    >
                                      Cancelar
                                    </Button>
                                  </div>
                                </div>
                              )}

                              {confirming === 'reject' && (
                                <div
                                  role="group"
                                  aria-label="Confirmar rechazo"
                                  className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4"
                                >
                                  <p className="text-sm text-foreground">
                                    ¿Rechazar esta solicitud? La franja quedará libre y el
                                    estudiante recibirá la actualización.
                                  </p>
                                  <TextField fullWidth value={reason} onChange={setReason}>
                                    <Label>Motivo (opcional)</Label>
                                    <TextArea rows={3} maxLength={500} />
                                  </TextField>
                                  <FormError error={actionError} />
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Button
                                      variant="danger"
                                      isDisabled={saving}
                                      onPress={() => void confirmAction()}
                                    >
                                      {saving ? 'Rechazando…' : 'Confirmar rechazo'}
                                    </Button>
                                    <Button
                                      variant="tertiary"
                                      isDisabled={saving}
                                      onPress={cancelAction}
                                    >
                                      Cancelar
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </Card.Content>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <Block
            id="requests-upcoming-title"
            title="Próximas sesiones"
            total={dashboard.counts.upcoming}
            items={dashboard.upcoming}
            empty="No tienes sesiones confirmadas por venir."
          />
          <Block
            id="requests-accepted-title"
            title="Aceptadas"
            total={dashboard.counts.accepted}
            items={dashboard.accepted}
            empty="No tienes solicitudes aceptadas esperando pago."
          />
          <Block
            id="requests-rejected-title"
            title="Rechazadas"
            total={dashboard.counts.rejected}
            items={dashboard.rejected}
            empty="Aún no has rechazado solicitudes."
          />
        </>
      )}
    </main>
  );
}
