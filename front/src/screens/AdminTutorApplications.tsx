import {
  Button,
  Card,
  Chip,
  Description,
  FieldError,
  Input,
  Label,
  ListBox,
  Select,
  TextArea,
  TextField,
} from '@heroui/react';
import { useCallback, useEffect, useState } from 'react';
import {
  ApiError,
  approveTutorApplication,
  getTutorApplications,
  rejectTutorApplication,
} from '../api';
import { FormError, FormNotice } from '../components/FormFeedback';
import { LoadError } from '../components/LoadError';
import { toFriendlyError, type FriendlyError } from '../errors';
import { MODALITY_LABEL } from '../reservas/format';
import type { Modality, TutorApplication, VerificationStatus } from '../types';

const copFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' });

const STATUS_FILTERS: Array<{ value: VerificationStatus; label: string }> = [
  { value: 'PENDING', label: 'Pendientes' },
  { value: 'VERIFIED', label: 'Aprobadas' },
  { value: 'REJECTED', label: 'Rechazadas' },
];

const STATUS_LABEL: Record<VerificationStatus, string> = {
  PENDING: 'Pendiente',
  VERIFIED: 'Verificada',
  REJECTED: 'Rechazada',
};

const STATUS_COLOR: Record<VerificationStatus, 'warning' | 'success' | 'danger'> = {
  PENDING: 'warning',
  VERIFIED: 'success',
  REJECTED: 'danger',
};

/** Mismo rango que `RejectTutorApplicationDto` en el backend. */
const REASON_MIN = 3;
const REASON_MAX = 1000;

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</dt>
      <dd className="text-sm text-foreground">{children}</dd>
    </div>
  );
}

function modalityList(modalities: Modality[]): string {
  return modalities.length > 0
    ? modalities.map((modality) => MODALITY_LABEL[modality]).join(' · ')
    : 'Sin definir';
}

/** Soportes de una materia declarada: evidencia, nota y semestre aprobado. */
function SubjectEvidence({ subject }: { subject: TutorApplication['subjects'][number] }) {
  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-sm font-semibold text-foreground">
          {subject.subject.code} · {subject.subject.name}
        </p>
        <p className="text-xs text-muted">
          {subject.grade === null ? 'Sin nota declarada' : `Nota ${subject.grade}`}
          {' · '}
          {subject.approvedSemester === null
            ? 'Sin semestre declarado'
            : `Semestre ${subject.approvedSemester}`}
        </p>
        {subject.rejectionReason && (
          <p className="text-xs text-danger">Motivo anterior: {subject.rejectionReason}</p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Chip size="sm" variant="soft" color={STATUS_COLOR[subject.status]}>
          {STATUS_LABEL[subject.status]}
        </Chip>
        {subject.evidenceUrl ? (
          <a
            className="text-sm font-semibold text-accent underline"
            href={subject.evidenceUrl}
            target="_blank"
            rel="noreferrer noopener"
          >
            Ver soporte
          </a>
        ) : (
          <span className="text-sm text-muted">Sin soporte</span>
        )}
      </div>
    </li>
  );
}

type PendingAction = { id: string; kind: 'approve' | 'reject' } | null;

/**
 * Revisión de postulaciones de tutor (HU de aprobación de tutor).
 *
 * Reúne lo que el administrador necesita para decidir: correo institucional,
 * materias declaradas y el soporte de cada una. Aprobar le da al usuario el rol
 * de tutor verificado; rechazar exige un motivo, que el solicitante ve en su
 * propia pantalla de postulación.
 */
export function AdminTutorApplications() {
  const [status, setStatus] = useState<VerificationStatus>('PENDING');
  const [search, setSearch] = useState('');
  /** Texto ya enviado: la búsqueda filtra en el servidor, no mientras se teclea. */
  const [appliedSearch, setAppliedSearch] = useState('');

  const [applications, setApplications] = useState<TutorApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<FriendlyError | null>(null);

  const [pending, setPending] = useState<PendingAction>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<FriendlyError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setListError(null);

    try {
      const result = await getTutorApplications({ status, search: appliedSearch });
      setApplications(result.items);
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'SESSION_EXPIRED') return;
      setListError(toFriendlyError(caught));
    } finally {
      setLoading(false);
    }
  }, [status, appliedSearch]);

  useEffect(() => {
    void load();
  }, [load]);

  function closeAction() {
    setPending(null);
    setReason('');
    setReasonError(null);
    setActionError(null);
  }

  /** Saca la ficha de la lista: ya no pertenece al estado que se está viendo. */
  function removeFromList(applicationId: string) {
    setApplications((current) => current.filter((item) => item.id !== applicationId));
  }

  async function handleApprove(application: TutorApplication) {
    setSubmitting(true);
    setActionError(null);

    try {
      await approveTutorApplication(application.id);
      removeFromList(application.id);
      setNotice(
        `${application.fullName} quedó con el rol de tutor verificado y sus materias aprobadas.`,
      );
      closeAction();
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'SESSION_EXPIRED') return;
      setActionError(toFriendlyError(caught));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReject(application: TutorApplication) {
    const trimmed = reason.trim();

    if (trimmed.length < REASON_MIN) {
      setReasonError(
        `Escribe el motivo del rechazo (al menos ${REASON_MIN} caracteres). El solicitante lo va a leer.`,
      );
      return;
    }

    setSubmitting(true);
    setActionError(null);
    setReasonError(null);

    try {
      await rejectTutorApplication(application.id, trimmed);
      removeFromList(application.id);
      setNotice(
        `Postulación de ${application.fullName} rechazada. El motivo ya es visible para el solicitante.`,
      );
      closeAction();
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'SESSION_EXPIRED') return;
      setActionError(toFriendlyError(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <section className="flex flex-col gap-2">
        <p className="text-xs font-semibold tracking-wide text-muted uppercase">
          Aprobación de tutores
        </p>
        <h1 className="text-2xl font-bold text-balance text-foreground sm:text-3xl">
          Revisión de postulaciones
        </h1>
        <p className="max-w-2xl text-sm text-muted sm:text-base">
          Revisa el correo institucional, las materias declaradas y el soporte de cada una. Solo
          los perfiles con evidencia válida quedan habilitados para ofrecer tutorías.
        </p>
      </section>

      <form
        className="flex flex-col gap-4 sm:flex-row sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          setAppliedSearch(search);
        }}
      >
        <Select
          className="sm:w-56"
          value={status}
          onChange={(value) => {
            closeAction();
            setStatus(String(value) as VerificationStatus);
          }}
        >
          <Label>Estado</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {STATUS_FILTERS.map((filter) => (
                <ListBox.Item key={filter.value} id={filter.value} textValue={filter.label}>
                  {filter.label}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>

        <TextField className="flex-1" value={search} onChange={setSearch}>
          <Label>Buscar por nombre o correo</Label>
          <Input maxLength={100} placeholder="Ej. ana.torres@universidad.edu.co" />
        </TextField>

        <Button type="submit" variant="tertiary">
          Buscar
        </Button>
      </form>

      {notice && <FormNotice>{notice}</FormNotice>}
      {listError && <LoadError error={listError} onRetry={() => void load()} />}

      {loading && (
        <div className="flex flex-col gap-4" aria-live="polite" aria-busy="true">
          <span className="sr-only">Cargando postulaciones...</span>
          <div className="h-40 animate-pulse rounded-xl bg-default" />
          <div className="h-40 animate-pulse rounded-xl bg-default" />
        </div>
      )}

      {!loading && !listError && applications.length === 0 && (
        <Card>
          <Card.Content className="flex flex-col items-center gap-2 py-10 text-center">
            <h2 className="text-lg font-bold text-foreground">
              No hay postulaciones en este estado
            </h2>
            <p className="max-w-md text-sm text-muted">
              {status === 'PENDING'
                ? 'Cuando un estudiante se postule como tutor aparecerá aquí para revisión.'
                : 'Cambia el filtro de estado para ver otras postulaciones.'}
            </p>
          </Card.Content>
        </Card>
      )}

      {!loading &&
        applications.map((application) => {
          const isActing = pending?.id === application.id;

          return (
            <Card key={application.id} aria-labelledby={`application-${application.id}`}>
              <Card.Header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="truncate text-xs font-semibold tracking-wide text-muted uppercase">
                    {application.institutionalEmail}
                  </p>
                  <Card.Title id={`application-${application.id}`}>
                    {application.fullName}
                  </Card.Title>
                </div>
                <Chip
                  className="self-start"
                  size="sm"
                  variant="soft"
                  color={STATUS_COLOR[application.verificationStatus]}
                >
                  {STATUS_LABEL[application.verificationStatus]}
                </Chip>
              </Card.Header>

              <Card.Content className="flex flex-col gap-5">
                <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <Meta label="Postulación">
                    {dateFormatter.format(new Date(application.createdAt))}
                  </Meta>
                  <Meta label="Tarifa">
                    <span className="tabular-nums">
                      {copFormatter.format(application.hourlyRate)}
                    </span>{' '}
                    / hora
                  </Meta>
                  <Meta label="Experiencia">{application.experienceYears} años</Meta>
                  <Meta label="Correo institucional">
                    {application.emailVerifiedAt ? 'Verificado' : 'Sin verificar'}
                  </Meta>
                  <Meta label="Modalidades">{modalityList(application.modalities)}</Meta>
                  <Meta label="Cuenta">{application.userStatus}</Meta>
                  <Meta label="Rol actual">{application.role}</Meta>
                  <Meta label="Profesores">
                    {application.professors.length > 0
                      ? application.professors.map((professor) => professor.fullName).join(', ')
                      : 'Sin profesores declarados'}
                  </Meta>
                </dl>

                {application.bio && <p className="text-sm text-muted">{application.bio}</p>}

                {application.rejectionReason && (
                  <p className="text-sm text-danger">
                    Motivo del rechazo anterior: {application.rejectionReason}
                  </p>
                )}

                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-bold text-foreground">
                    Materias declaradas ({application.subjects.length})
                  </h3>
                  {application.subjects.length === 0 ? (
                    <p className="text-sm text-muted">
                      Sin materias declaradas. Una postulación así no se puede aprobar.
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {application.subjects.map((subject) => (
                        <SubjectEvidence key={subject.id} subject={subject} />
                      ))}
                    </ul>
                  )}
                </div>

                {isActing && actionError && <FormError error={actionError} />}

                {application.verificationStatus !== 'VERIFIED' && (
                  <div className="flex flex-col gap-3">
                    {!isActing && (
                      <div className="flex flex-col gap-3 sm:flex-row">
                        <Button
                          isDisabled={submitting}
                          onPress={() => {
                            closeAction();
                            setNotice(null);
                            setPending({ id: application.id, kind: 'approve' });
                          }}
                        >
                          Aprobar postulación
                        </Button>
                        <Button
                          variant="tertiary"
                          isDisabled={submitting}
                          onPress={() => {
                            closeAction();
                            setNotice(null);
                            setPending({ id: application.id, kind: 'reject' });
                          }}
                        >
                          Rechazar postulación
                        </Button>
                      </div>
                    )}

                    {isActing && pending?.kind === 'approve' && (
                      <div
                        className="flex flex-col gap-3 rounded-lg border border-border p-4"
                        role="group"
                        aria-label={`Confirmar aprobación de ${application.fullName}`}
                      >
                        <p className="text-sm text-foreground">
                          Al aprobar, <b>{application.fullName}</b> obtiene el rol de tutor
                          verificado y sus {application.subjects.length} materias quedan visibles
                          para los estudiantes.
                        </p>
                        <div className="flex flex-col gap-3 sm:flex-row">
                          <Button
                            isDisabled={submitting}
                            onPress={() => void handleApprove(application)}
                          >
                            {submitting ? 'Aprobando...' : 'Confirmar aprobación'}
                          </Button>
                          <Button variant="tertiary" isDisabled={submitting} onPress={closeAction}>
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    )}

                    {isActing && pending?.kind === 'reject' && (
                      <form
                        className="flex flex-col gap-3 rounded-lg border border-border p-4"
                        noValidate
                        onSubmit={(event) => {
                          event.preventDefault();
                          void handleReject(application);
                        }}
                      >
                        <TextField
                          fullWidth
                          isRequired
                          value={reason}
                          onChange={setReason}
                          isInvalid={Boolean(reasonError)}
                        >
                          <Label>Motivo del rechazo</Label>
                          <TextArea
                            rows={3}
                            maxLength={REASON_MAX}
                            placeholder="Ej. El soporte de Cálculo I no es legible."
                          />
                          <Description>
                            El solicitante lo ve en su pantalla de postulación y en la
                            notificación.
                          </Description>
                          {reasonError && <FieldError>{reasonError}</FieldError>}
                        </TextField>

                        <div className="flex flex-col gap-3 sm:flex-row">
                          <Button type="submit" isDisabled={submitting}>
                            {submitting ? 'Rechazando...' : 'Confirmar rechazo'}
                          </Button>
                          <Button variant="tertiary" isDisabled={submitting} onPress={closeAction}>
                            Cancelar
                          </Button>
                        </div>
                      </form>
                    )}
                  </div>
                )}
              </Card.Content>
            </Card>
          );
        })}
    </main>
  );
}
