import {
  Button,
  Card,
  Checkbox,
  Description,
  Input,
  Label,
  ListBox,
  Select,
  TextArea,
  TextField,
} from '@heroui/react';
import { LightningIcon, StarIcon } from '@phosphor-icons/react';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  ApiError,
  confirmStudyMatchProposal,
  createStudyMatchRequest,
  getMyStudyMatchRequests,
  getStudyMatchRequest,
  listCatalogSubjects,
} from '../api';
import { FormError } from '../components/FormFeedback';
import { LoadError } from '../components/LoadError';
import { toFriendlyError, type FriendlyError } from '../errors';
import { formatCop, formatLongDate, formatTimeRange } from '../reservas/format';
import type { CatalogSubject, Modality } from '../types';
import type {
  StudyMatchProposal,
  StudyMatchRequest,
  StudyMatchRequestStatus,
  StudyMatchUrgency,
} from '../studymatch/types';

const MODALITIES: Array<{ value: Modality; label: string }> = [
  { value: 'VIRTUAL', label: 'Virtual' },
  { value: 'IN_PERSON', label: 'Presencial' },
  { value: 'HYBRID', label: 'Virtual o presencial' },
];

const URGENCIES: Array<{ value: StudyMatchUrgency; label: string }> = [
  { value: 'CRITICAL', label: 'Crítica (respuesta más rápida)' },
  { value: 'HIGH', label: 'Alta' },
  { value: 'MEDIUM', label: 'Media' },
  { value: 'LOW', label: 'Baja' },
];

const STATUS_LABEL: Record<StudyMatchRequestStatus, string> = {
  SEARCHING: 'Buscando tutor',
  PROPOSAL_SENT: 'Propuesta enviada al tutor',
  AWAITING_STUDENT: 'Tu confirmación es necesaria',
  CONFIRMED: 'Sesión confirmada',
  NO_TUTORS: 'Sin tutores disponibles',
  CANCELLED: 'Solicitud cancelada',
  EXPIRED: 'Solicitud expirada',
};

function toIso(localValue: string): string {
  return new Date(localValue).toISOString();
}

function initialDateTime(hoursFromNow: number): string {
  const date = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function ProposalDetails({
  proposal,
  request,
  accepting,
  paymentAccepted,
  onPaymentAcceptedChange,
  onAccept,
  onReject,
}: {
  proposal: StudyMatchProposal;
  request: StudyMatchRequest;
  accepting: boolean;
  paymentAccepted: boolean;
  onPaymentAcceptedChange: (value: boolean) => void;
  onAccept: () => void;
  onReject: () => void;
}) {
  const price = proposal.estimatedPrice;
  const awaitingTutor = proposal.status === 'PENDING_TUTOR';
  const canConfirm = proposal.status === 'TUTOR_ACCEPTED';

  return (
    <Card>
      <Card.Header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-accent">Propuesta de StudyMatch</p>
          <Card.Title>{proposal.tutor.fullName}</Card.Title>
        </div>
        <span className="rounded-full bg-default px-3 py-1 text-xs font-semibold text-muted">
          {awaitingTutor ? 'Esperando respuesta del tutor' : 'Tutor disponible'}
        </span>
      </Card.Header>
      <Card.Content className="flex flex-col gap-5">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Calificación</dt>
            <dd className="mt-1 flex items-center gap-1 text-sm text-foreground">
              <StarIcon aria-hidden="true" className="text-warning" weight="fill" />
              {proposal.tutor.averageRating?.toFixed(1) ?? 'Sin calificaciones'}
              {proposal.tutor.reviewCount ? ` (${proposal.tutor.reviewCount})` : ''}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Materia</dt>
            <dd className="mt-1 text-sm text-foreground">
              {request.subject.code} · {request.subject.name}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Modalidad</dt>
            <dd className="mt-1 text-sm text-foreground">
              {MODALITIES.find((item) => item.value === proposal.slot.modality)?.label ??
                proposal.slot.modality}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Horario</dt>
            <dd className="mt-1 text-sm text-foreground">
              {formatLongDate(proposal.slot.startAt)}
              <br />
              {formatTimeRange(proposal.slot.startAt, proposal.slot.endAt)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Tarifa</dt>
            <dd className="mt-1 text-sm text-foreground">
              {price ? `${formatCop(price.total)} total` : 'No disponible'}
            </dd>
          </div>
          {price && (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Desglose</dt>
              <dd className="mt-1 text-sm text-foreground">
                {formatCop(price.hourlyRate)}/hora · {price.durationMinutes} min
              </dd>
            </div>
          )}
        </dl>

        {canConfirm && (
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-default p-4">
            <p className="text-sm text-foreground">
              Revisa las condiciones anteriores. El pago es simulado y no solicita datos
              bancarios reales.
            </p>
            <Checkbox
              isSelected={paymentAccepted}
              onChange={onPaymentAcceptedChange}
            >
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              <Checkbox.Content>
                <Label>Acepto la tutoría y confirmo el pago simulado.</Label>
              </Checkbox.Content>
            </Checkbox>
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row">
          {canConfirm && (
            <Button isDisabled={!paymentAccepted || accepting} onPress={onAccept}>
              {accepting ? 'Confirmando...' : 'Aceptar y confirmar pago simulado'}
            </Button>
          )}
          {canConfirm && (
            <Button variant="tertiary" isDisabled={accepting} onPress={onReject}>
              Rechazar y buscar otro tutor
            </Button>
          )}
        </div>
      </Card.Content>
    </Card>
  );
}

export function StudyMatchScreen() {
  const [subjects, setSubjects] = useState<CatalogSubject[]>([]);
  const [request, setRequest] = useState<StudyMatchRequest | null>(null);
  const [proposal, setProposal] = useState<StudyMatchProposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [paymentAccepted, setPaymentAccepted] = useState(false);
  const [error, setError] = useState<FriendlyError | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [subjectId, setSubjectId] = useState('');
  const [topic, setTopic] = useState('');
  const [description, setDescription] = useState('');
  const [urgency, setUrgency] = useState<StudyMatchUrgency>('HIGH');
  const [modality, setModality] = useState<Modality>('VIRTUAL');
  const [availableFrom, setAvailableFrom] = useState(initialDateTime(1));
  const [availableTo, setAvailableTo] = useState(initialDateTime(5));

  const loadActiveRequest = useCallback(async (requestId: string) => {
    const current = await getStudyMatchRequest(requestId);
    setRequest(current);
    const activeProposal = current.proposals.find((item) =>
      item.status === 'PENDING_TUTOR' || item.status === 'TUTOR_ACCEPTED',
    );
    setProposal(activeProposal ?? null);
    if (current.status !== 'AWAITING_STUDENT') setPaymentAccepted(false);
    return current;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [catalog, mine] = await Promise.all([
        listCatalogSubjects(''),
        getMyStudyMatchRequests(1, 1),
      ]);
      setSubjects(catalog);
      const current = mine.items[0];
      if (current && !['CONFIRMED', 'CANCELLED', 'EXPIRED'].includes(current.status)) {
        await loadActiveRequest(current.id);
      }
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'SESSION_EXPIRED') return;
      setError(toFriendlyError(caught));
    } finally {
      setLoading(false);
    }
  }, [loadActiveRequest]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!request || ['CONFIRMED', 'CANCELLED', 'EXPIRED'].includes(request.status)) return;
    const interval = window.setInterval(() => {
      void loadActiveRequest(request.id).catch((caught) => setError(toFriendlyError(caught)));
    }, 5000);
    return () => window.clearInterval(interval);
  }, [request, loadActiveRequest]);

  const active = Boolean(request);
  const selectedSubject = useMemo(
    () => subjects.find((subject) => subject.id === subjectId),
    [subjects, subjectId],
  );

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    if (!subjectId || topic.trim().length < 3) {
      setFormError('Selecciona una materia y describe tu necesidad con al menos 3 caracteres.');
      return;
    }
    if (new Date(availableFrom) >= new Date(availableTo)) {
      setFormError('La hora inicial debe ser anterior a la hora final.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await createStudyMatchRequest({
        subjectId,
        topic: topic.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
        urgency,
        modality,
        availableFrom: toIso(availableFrom),
        availableTo: toIso(availableTo),
      });
      setRequest(result.request);
      setProposal(result.proposal);
    } catch (caught) {
      setFormError(caught instanceof ApiError ? caught.message : 'No fue posible crear la solicitud.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleProposalAction(accept: boolean) {
    if (!proposal) return;
    setSubmitting(true);
    setError(null);
    try {
      await confirmStudyMatchProposal(
        proposal.id,
        accept
          ? { accept: true, simulatePayment: true }
          : { accept: false, rejectionReason: 'El estudiante busca otra opción.' },
      );
      await loadActiveRequest(proposal.requestId);
      setPaymentAccepted(false);
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'SESSION_EXPIRED') return;
      setError(toFriendlyError(caught));
    } finally {
      setSubmitting(false);
    }

  }

  function startNewRequest() {
    setRequest(null);
    setProposal(null);
    setPaymentAccepted(false);
    setFormError(null);
    setError(null);
    setSubjectId('');
    setTopic('');
    setDescription('');
    setAvailableFrom(initialDateTime(1));
    setAvailableTo(initialDateTime(5));
  }

  if (loading) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-8 sm:px-6">
        <div className="h-10 animate-pulse rounded-xl bg-default" />
        <div className="h-96 animate-pulse rounded-xl bg-default" />
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <section className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-accent">
          <LightningIcon aria-hidden="true" size={24} weight="fill" />
          <span className="text-sm font-semibold">StudyMatch</span>
        </div>
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
          Tutoría de emergencia
        </h1>
        <p className="text-sm text-muted sm:text-base">
          Cuéntanos qué necesitas y revisa todas las condiciones antes de reservar.
        </p>
      </section>

      {error && <LoadError error={error} onRetry={() => void load()} />}

      {active && request && (
        <>
          <Card>
            <Card.Content className="flex flex-col gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                Estado de tu solicitud
              </p>
              <p className="text-lg font-bold text-foreground">{STATUS_LABEL[request.status]}</p>
              <p className="text-sm text-muted">
                {request.subject.code} · {request.subject.name} · {request.topic}
              </p>
            </Card.Content>
          </Card>

          {proposal && (
            <ProposalDetails
              proposal={proposal}
              request={request}
              accepting={submitting}
              paymentAccepted={paymentAccepted}
              onPaymentAcceptedChange={setPaymentAccepted}
              onAccept={() => void handleProposalAction(true)}
              onReject={() => void handleProposalAction(false)}
            />
          )}

          {!proposal && request.status === 'SEARCHING' && (
            <Card>
              <Card.Content className="py-10 text-center">
                <h2 className="font-bold text-foreground">Buscando un tutor elegible...</h2>
                <p className="mt-2 text-sm text-muted">
                  Actualizamos esta pantalla automáticamente cuando haya una propuesta.
                </p>
              </Card.Content>
            </Card>
          )}

          {!proposal && request.status === 'NO_TUTORS' && (
            <Card>
              <Card.Content className="py-10 text-center">
                <h2 className="font-bold text-foreground">No encontramos tutores disponibles</h2>
                <p className="mt-2 text-sm text-muted">
                  Prueba otra materia, modalidad o ventana de horario.
                </p>
                <Button className="mt-4" onPress={startNewRequest}>
                  Crear otra solicitud
                </Button>
              </Card.Content>
            </Card>
          )}

          {request.booking?.status === 'CONFIRMED' && (
            <Card>
              <Card.Content className="py-8 text-center">
                <h2 className="text-lg font-bold text-success">Sesión reservada</h2>
                <p className="mt-2 text-sm text-muted">
                  El pago simulado fue aprobado y tu tutoría quedó confirmada.
                </p>
              </Card.Content>
            </Card>
          )}
        </>
      )}

      {!active && (
        <Card>
          <Card.Header>
            <Card.Title>Solicitar tutor ahora</Card.Title>
          </Card.Header>
          <Card.Content>
            <form className="flex flex-col gap-5" onSubmit={(event) => void handleCreate(event)}>
              {formError && <FormError error={{ message: formError, details: [] }} />}

              <Select value={subjectId} onChange={(value) => setSubjectId(String(value ?? ''))}>
                <Label>Materia</Label>
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {subjects.map((subject) => (
                      <ListBox.Item key={subject.id} id={subject.id} textValue={subject.name}>
                        {subject.code} · {subject.name}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>

              <TextField>
                <Label>Tema o necesidad</Label>
                <Input value={topic} onChange={(event) => setTopic(event.target.value)} />
                <Description>Describe brevemente qué necesitas estudiar.</Description>
              </TextField>

              <TextField>
                <Label>Detalles adicionales (opcional)</Label>
                <TextArea value={description} onChange={(event) => setDescription(event.target.value)} />
              </TextField>

              <div className="grid gap-5 sm:grid-cols-2">
                <Select value={urgency} onChange={(value) => setUrgency(String(value) as StudyMatchUrgency)}>
                  <Label>Urgencia</Label>
                  <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
                  <Select.Popover><ListBox>{URGENCIES.map((item) => (
                    <ListBox.Item key={item.value} id={item.value} textValue={item.label}>
                      {item.label}<ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}</ListBox></Select.Popover>
                </Select>
                <Select value={modality} onChange={(value) => setModality(String(value) as Modality)}>
                  <Label>Modalidad</Label>
                  <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
                  <Select.Popover><ListBox>{MODALITIES.map((item) => (
                    <ListBox.Item key={item.value} id={item.value} textValue={item.label}>
                      {item.label}<ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}</ListBox></Select.Popover>
                </Select>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <TextField>
                  <Label>Disponible desde</Label>
                  <Input type="datetime-local" value={availableFrom} onChange={(event) => setAvailableFrom(event.target.value)} />
                </TextField>
                <TextField>
                  <Label>Disponible hasta</Label>
                  <Input type="datetime-local" value={availableTo} onChange={(event) => setAvailableTo(event.target.value)} />
                </TextField>
              </div>

              {selectedSubject && (
                <p className="text-sm text-muted">
                  StudyMatch buscará un tutor verificado que enseñe {selectedSubject.name}.
                </p>
              )}
              <Button type="submit" isDisabled={submitting}>
                {submitting ? 'Buscando tutor...' : 'Buscar tutor de emergencia'}
              </Button>
            </form>
          </Card.Content>
        </Card>
      )}
    </main>
  );
}
