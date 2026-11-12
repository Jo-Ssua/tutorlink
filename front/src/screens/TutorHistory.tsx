import { Button, Card, Chip, Input, Label, ListBox, Select, TextField } from '@heroui/react';
import { CaretDownIcon, CaretUpIcon } from '@phosphor-icons/react';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { ApiError } from '../api';
import { LoadError } from '../components/LoadError';
import { StarRating } from '../components/StarRating';
import { StatTile } from '../components/StatTile';
import { toFriendlyError, type FriendlyError } from '../errors';
import {
  getTutorHistory,
  getTutorHistoryDetail,
  getTutorHistorySummary,
} from '../historial/api';
import type {
  HistoryDetail,
  HistoryFilters,
  HistoryItem,
  HistoryList,
  HistorySummary,
} from '../historial/types';
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

const STATUSES = Object.keys(STATUS_LABEL) as BookingStatus[];

const MODALITY_LABEL: Record<Modality, string> = {
  IN_PERSON: 'Presencial',
  VIRTUAL: 'Virtual',
  HYBRID: 'Híbrida',
};

/** Valor del `Select` para "sin filtro": un `Select` no admite cadena vacía como id. */
const ALL = 'ALL';

const NO_FILTERS: HistoryFilters = { from: '', to: '', subjectId: '', status: '' };

function hasFilters(filters: HistoryFilters) {
  return Boolean(filters.from || filters.to || filters.subjectId || filters.status);
}

/** Un dato de la ficha: etiqueta arriba, valor abajo. */
function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</dt>
      <dd className="text-sm text-foreground">{children}</dd>
    </div>
  );
}

function ReviewBlock({ review }: { review: HistoryItem['review'] }) {
  if (!review) {
    return <p className="text-sm text-muted">Esta sesión aún no tiene reseña.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <StarRating value={review.rating} readOnly label="Calificación recibida" />
      {review.comment ? (
        <blockquote className="border-l-2 border-border pl-3 text-sm text-foreground">
          “{review.comment}”
        </blockquote>
      ) : (
        <p className="text-sm text-muted">El estudiante no dejó un comentario.</p>
      )}
    </div>
  );
}

function SessionDetail({
  detail,
  loading,
  error,
  onRetry,
}: {
  detail: HistoryDetail | undefined;
  loading: boolean;
  error: FriendlyError | null;
  onRetry: () => void;
}) {
  if (error) return <LoadError error={error} onRetry={onRetry} />;

  if (loading || !detail) {
    return (
      <div aria-busy="true" aria-live="polite">
        <span className="sr-only">Cargando detalle...</span>
        <div className="h-24 animate-pulse rounded-xl bg-default" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Meta label="Modalidad">{MODALITY_LABEL[detail.modality]}</Meta>
        <Meta label="Duración">{detail.durationMinutes} min</Meta>
        <Meta label="Tus ingresos">
          <span className="tabular-nums">{copFormatter.format(detail.tutorEarnings)}</span>
        </Meta>
        <Meta label="Comisión">
          <span className="tabular-nums">{copFormatter.format(detail.platformFee)}</span>
        </Meta>
        {detail.description && (
          <div className="col-span-2 sm:col-span-4">
            <Meta label="Descripción">{detail.description}</Meta>
          </div>
        )}
        {detail.cancellationReason && (
          <div className="col-span-2 sm:col-span-4">
            <Meta label="Motivo de cancelación">{detail.cancellationReason}</Meta>
          </div>
        )}
      </dl>

      <div className="flex flex-col gap-2">
        <h4 className="text-xs font-semibold tracking-wide text-muted uppercase">
          Calificación y comentario
        </h4>
        <ReviewBlock review={detail.review} />
      </div>
    </div>
  );
}

/**
 * Historial de tutorías y calificaciones del tutor.
 *
 * Es de solo lectura: los filtros se aplican al enviar el formulario y solo
 * cambian qué filas se consultan, nunca los datos. El nombre del estudiante
 * llega anonimizado desde la API.
 */
export function TutorHistory() {
  const [summary, setSummary] = useState<HistorySummary | null>(null);
  const [list, setList] = useState<HistoryList | null>(null);
  const [draft, setDraft] = useState<HistoryFilters>(NO_FILTERS);
  const [applied, setApplied] = useState<HistoryFilters>(NO_FILTERS);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FriendlyError | null>(null);
  const [filterError, setFilterError] = useState<string | null>(null);

  const [openId, setOpenId] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, HistoryDetail>>({});
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<FriendlyError | null>(null);

  // Una consulta lenta no debe pisar a otra más reciente.
  const latestRequest = useRef(0);

  const load = useCallback(async (filters: HistoryFilters, targetPage: number) => {
    const requestId = ++latestRequest.current;
    setLoading(true);
    setError(null);

    try {
      const result = await getTutorHistory(filters, targetPage);
      if (requestId !== latestRequest.current) return;
      setList(result);
    } catch (caught) {
      if (requestId !== latestRequest.current) return;
      if (caught instanceof ApiError && caught.code === 'SESSION_EXPIRED') return;
      setError(toFriendlyError(caught));
    } finally {
      if (requestId === latestRequest.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(applied, page);
  }, [load, applied, page]);

  // El resumen no depende de los filtros: es la trayectoria completa.
  useEffect(() => {
    getTutorHistorySummary()
      .then(setSummary)
      .catch(() => {
        // Sin resumen la pantalla sigue sirviendo; el listado muestra su propio error.
      });
  }, []);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (draft.from && draft.to && draft.from > draft.to) {
      setFilterError('La fecha inicial no puede ser posterior a la fecha final.');
      return;
    }

    setFilterError(null);
    setOpenId(null);
    setPage(1);
    setApplied(draft);
  }

  function clearFilters() {
    setFilterError(null);
    setOpenId(null);
    setDraft(NO_FILTERS);
    setPage(1);
    setApplied(NO_FILTERS);
  }

  async function loadDetail(id: string) {
    setDetailLoading(true);
    setDetailError(null);

    try {
      const detail = await getTutorHistoryDetail(id);
      setDetails((current) => ({ ...current, [id]: detail }));
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'SESSION_EXPIRED') return;
      setDetailError(toFriendlyError(caught));
    } finally {
      setDetailLoading(false);
    }
  }

  function toggleDetail(id: string) {
    if (openId === id) {
      setOpenId(null);
      return;
    }

    setOpenId(id);
    setDetailError(null);
    if (!details[id]) void loadDetail(id);
  }

  const items = list?.items ?? [];
  const pagination = list?.pagination;
  const filtering = hasFilters(applied);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <section className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold text-balance text-foreground sm:text-3xl">
            Historial de tutorías
          </h1>
          <p className="max-w-2xl text-sm text-muted sm:text-base">
            Revisa tus sesiones y las calificaciones que recibiste para evaluar tu desempeño. El
            nombre del estudiante siempre se muestra anonimizado.
          </p>
        </div>
        <div
          className="grid grid-cols-3 gap-2 sm:gap-3 lg:w-auto lg:shrink-0"
          aria-label="Resumen de tu trayectoria"
        >
          <StatTile value={summary?.totalSessions ?? '–'} label="Sesiones" />
          <StatTile value={summary?.completedSessions ?? '–'} label="Completadas" />
          <StatTile
            value={summary ? (summary.reviewCount > 0 ? summary.averageRating.toFixed(1) : '–') : '–'}
            label={
              summary && summary.reviewCount > 0
                ? `Calificación (${summary.reviewCount})`
                : 'Calificación'
            }
            accent
          />
        </div>
      </section>

      <Card>
        <Card.Header>
          <Card.Title>Filtrar historial</Card.Title>
        </Card.Header>
        <Card.Content>
          <form className="flex flex-col gap-4" onSubmit={applyFilters} noValidate>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <TextField
                fullWidth
                value={draft.from}
                onChange={(from) => setDraft((current) => ({ ...current, from }))}
              >
                <Label>Desde</Label>
                <Input type="date" />
              </TextField>

              <TextField
                fullWidth
                value={draft.to}
                onChange={(to) => setDraft((current) => ({ ...current, to }))}
              >
                <Label>Hasta</Label>
                <Input type="date" />
              </TextField>

              <Select
                fullWidth
                value={draft.subjectId || ALL}
                onChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    subjectId: value === ALL ? '' : String(value),
                  }))
                }
              >
                <Label>Materia</Label>
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    <ListBox.Item id={ALL} textValue="Todas las materias">
                      Todas las materias
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                    {(summary?.subjects ?? []).map((subject) => (
                      <ListBox.Item
                        key={subject.id}
                        id={subject.id}
                        textValue={`${subject.code} ${subject.name}`}
                      >
                        {subject.code} · {subject.name}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>

              <Select
                fullWidth
                value={draft.status || ALL}
                onChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    status: value === ALL ? '' : (String(value) as BookingStatus),
                  }))
                }
              >
                <Label>Estado</Label>
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    <ListBox.Item id={ALL} textValue="Todos los estados">
                      Todos los estados
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                    {STATUSES.map((status) => (
                      <ListBox.Item key={status} id={status} textValue={STATUS_LABEL[status]}>
                        {STATUS_LABEL[status]}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
            </div>

            {filterError && (
              <p role="alert" className="text-sm text-danger">
                {filterError}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit">Aplicar filtros</Button>
              <Button
                type="button"
                variant="tertiary"
                isDisabled={!hasFilters(draft) && !filtering}
                onPress={clearFilters}
              >
                Limpiar filtros
              </Button>
            </div>
          </form>
        </Card.Content>
      </Card>

      {error && <LoadError error={error} onRetry={() => void load(applied, page)} />}

      {loading && (
        <div className="flex flex-col gap-4" aria-live="polite" aria-busy="true">
          <span className="sr-only">Cargando historial...</span>
          <div className="h-32 animate-pulse rounded-xl bg-default" />
          <div className="h-32 animate-pulse rounded-xl bg-default" />
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <Card>
          <Card.Content className="flex flex-col items-center gap-2 py-10 text-center">
            <h2 className="text-lg font-bold text-foreground">
              {filtering ? 'Ninguna sesión coincide con los filtros' : 'Todavía no tienes sesiones'}
            </h2>
            <p className="max-w-md text-sm text-muted">
              {filtering
                ? 'Prueba con otro rango de fechas, materia o estado. Tu historial no cambió: solo se está filtrando la vista.'
                : 'Cuando tengas sesiones con estudiantes, aparecerán aquí junto con sus calificaciones.'}
            </p>
            {filtering && (
              <Button variant="tertiary" onPress={clearFilters}>
                Limpiar filtros
              </Button>
            )}
          </Card.Content>
        </Card>
      )}

      {!loading && !error && items.length > 0 && pagination && (
        <section className="flex flex-col gap-4" aria-labelledby="tutor-history-title">
          <div className="flex items-center gap-2">
            <h2 id="tutor-history-title" className="text-lg font-bold text-foreground">
              Sesiones
            </h2>
            <Chip size="sm" variant="soft">
              {pagination.total}
            </Chip>
          </div>

          <ul className="flex flex-col gap-4">
            {items.map((item) => {
              const open = openId === item.id;
              const panelId = `history-detail-${item.id}`;

              return (
                <li key={item.id}>
                  <Card>
                    <Card.Header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex flex-col gap-1">
                        <p className="text-xs font-semibold tracking-wide text-muted uppercase">
                          {item.subject.code} · {item.subject.name}
                        </p>
                        <Card.Title>{item.topic}</Card.Title>
                      </div>
                      <Chip
                        className="self-start"
                        size="sm"
                        variant="soft"
                        color={STATUS_COLOR[item.status]}
                      >
                        {STATUS_LABEL[item.status]}
                      </Chip>
                    </Card.Header>

                    <Card.Content className="gap-4">
                      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                        <Meta label="Fecha">
                          <time dateTime={item.startAt}>
                            {dateTimeFormatter.format(new Date(item.startAt))}
                          </time>
                        </Meta>
                        <Meta label="Estudiante">{item.studentAlias}</Meta>
                        <Meta label="Tarifa">
                          <span className="tabular-nums">{copFormatter.format(item.rate)}/h</span>
                        </Meta>
                        <Meta label="Calificación">
                          {item.review ? (
                            <StarRating
                              value={item.review.rating}
                              readOnly
                              label="Calificación recibida"
                            />
                          ) : (
                            <span className="text-muted">Sin reseña</span>
                          )}
                        </Meta>
                      </dl>

                      <div>
                        <Button
                          size="sm"
                          variant="tertiary"
                          aria-expanded={open}
                          aria-controls={panelId}
                          onPress={() => toggleDetail(item.id)}
                        >
                          {open ? 'Ocultar detalle' : 'Ver detalle'}
                          {open ? <CaretUpIcon /> : <CaretDownIcon />}
                        </Button>
                      </div>

                      {open && (
                        <div
                          id={panelId}
                          className="border-t border-border pt-4"
                          aria-label={`Detalle de ${item.topic}`}
                        >
                          <SessionDetail
                            detail={details[item.id]}
                            loading={detailLoading}
                            error={detailError}
                            onRetry={() => void loadDetail(item.id)}
                          />
                        </div>
                      )}
                    </Card.Content>
                  </Card>
                </li>
              );
            })}
          </ul>

          {pagination.totalPages > 1 && (
            <nav
              className="flex items-center justify-between gap-3"
              aria-label="Paginación del historial"
            >
              <Button
                variant="tertiary"
                isDisabled={!pagination.hasPreviousPage}
                onPress={() => {
                  setOpenId(null);
                  setPage((current) => current - 1);
                }}
              >
                Anterior
              </Button>
              <span className="text-sm text-muted">
                Página {pagination.page} de {pagination.totalPages}
              </span>
              <Button
                variant="tertiary"
                isDisabled={!pagination.hasNextPage}
                onPress={() => {
                  setOpenId(null);
                  setPage((current) => current + 1);
                }}
              >
                Siguiente
              </Button>
            </nav>
          )}
        </section>
      )}
    </main>
  );
}
