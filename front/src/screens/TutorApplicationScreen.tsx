import {
  Alert,
  Button,
  Card,
  Checkbox,
  Chip,
  Description,
  Input,
  Label,
  ListBox,
  Select,
  TextArea,
  TextField,
} from '@heroui/react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  ApiError,
  getOwnTutorApplication,
  getPrograms,
  listCatalogSubjects,
  submitTutorApplication,
} from '../api';
import { FormError, FormNotice } from '../components/FormFeedback';
import { LoadError } from '../components/LoadError';
import { StatTile } from '../components/StatTile';
import { toFriendlyError, type FriendlyError } from '../errors';
import type {
  ApplyTutorPayload,
  CatalogSubject,
  Modality,
  Program,
  VerificationStatus,
} from '../types';

type EvidenceMode = 'evidence' | 'record';

interface DraftSubject {
  subjectId: string;
  code: string;
  name: string;
  mode: EvidenceMode;
  evidenceUrl: string;
  grade: string;
  approvedSemester: string;
}

const MODALITIES: Array<{ id: Modality; label: string }> = [
  { id: 'VIRTUAL', label: 'Virtual' },
  { id: 'IN_PERSON', label: 'Presencial' },
  { id: 'HYBRID', label: 'Híbrida' },
];

const STATUS_LABEL: Record<VerificationStatus, string> = {
  PENDING: 'Pendiente',
  VERIFIED: 'Aprobada',
  REJECTED: 'Rechazada',
};

const STATUS_COPY: Record<VerificationStatus, string> = {
  PENDING:
    'Un administrador va a validar tu perfil y la evidencia de las materias. Puedes actualizar los datos mientras sigue pendiente.',
  VERIFIED:
    'Tu postulación fue aprobada. El rol de tutor ya está asignado y las materias quedaron habilitadas para ofrecer tutorías.',
  REJECTED: 'Corrige la información y vuelve a enviarla.',
};

function matchesQuery(subject: CatalogSubject, query: string): boolean {
  const name = subject.name.toLowerCase();
  const code = subject.code.toLowerCase();
  return name.includes(query) || code.includes(query) || `${code} ${name}`.includes(query);
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function draftFromCatalog(subject: CatalogSubject): DraftSubject {
  return {
    subjectId: subject.id,
    code: subject.code,
    name: subject.name,
    mode: 'evidence',
    evidenceUrl: '',
    grade: '',
    approvedSemester: '',
  };
}

/**
 * Postulación como tutor.
 *
 * El estudiante completa su perfil académico y registra materias del catálogo
 * oficial. Cada materia exige evidencia o la nota y el semestre de aprobación.
 */
export function TutorApplicationScreen() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<FriendlyError | null>(null);
  const [formError, setFormError] = useState<FriendlyError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [subjects, setSubjects] = useState<CatalogSubject[]>([]);
  const [programId, setProgramId] = useState('');
  const [semester, setSemester] = useState('');
  const [studentCode, setStudentCode] = useState('');
  const [bio, setBio] = useState('');
  const [experienceYears, setExperienceYears] = useState('0');
  const [hourlyRate, setHourlyRate] = useState('');
  const [modalities, setModalities] = useState<Modality[]>(['VIRTUAL']);
  const [drafts, setDrafts] = useState<DraftSubject[]>([]);
  const [search, setSearch] = useState('');
  const [showAllCatalog, setShowAllCatalog] = useState(false);
  const [status, setStatus] = useState<VerificationStatus | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);

  const locked = status === 'VERIFIED' || submitting;
  const knownIds = useMemo(() => new Set(subjects.map((subject) => subject.id)), [subjects]);

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const [programList, subjectList, snapshot] = await Promise.all([
        getPrograms(),
        listCatalogSubjects(''),
        getOwnTutorApplication(),
      ]);
      setPrograms(programList);
      setSubjects(subjectList);

      const academic = snapshot.academicProfile;
      const application = snapshot.application;
      if (academic?.program?.id) setProgramId(academic.program.id);
      if (academic?.semester) setSemester(String(academic.semester));
      if (academic?.studentCode) setStudentCode(academic.studentCode);

      if (application) {
        setStatus(application.verificationStatus);
        setRejectionReason(application.rejectionReason);
        setBio(application.bio ?? '');
        setExperienceYears(String(application.experienceYears));
        setHourlyRate(String(application.hourlyRate));
        if (application.modalities.length > 0) setModalities(application.modalities);
        setDrafts(
          application.subjects.map((link) => ({
            subjectId: link.subject.id,
            code: link.subject.code,
            name: link.subject.name,
            mode: link.evidenceUrl ? 'evidence' : 'record',
            evidenceUrl: link.evidenceUrl ?? '',
            grade: link.grade == null ? '' : String(link.grade),
            approvedSemester: link.approvedSemester == null ? '' : String(link.approvedSemester),
          })),
        );
      }
    } catch (error) {
      if (error instanceof ApiError && error.code === 'SESSION_EXPIRED') return;
      setLoadError(toFriendlyError(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const query = search.trim().toLowerCase();
  const catalogMatches = query ? subjects.filter((subject) => matchesQuery(subject, query)) : subjects;
  const programMatches = programId
    ? catalogMatches.filter((subject) => subject.programId === programId)
    : catalogMatches;
  const visibleSubjects = (showAllCatalog || !programId ? catalogMatches : programMatches).filter(
    (subject) => !drafts.some((draft) => draft.subjectId === subject.id),
  );
  const outsideProgram =
    Boolean(query && programId && !showAllCatalog) &&
    catalogMatches.length > 0 &&
    programMatches.length === 0;
  const missingFromCatalog = Boolean(query) && catalogMatches.length === 0;

  function addSubject(subject: CatalogSubject) {
    if (!knownIds.has(subject.id)) {
      setFormError({
        message: `${subject.name} no pertenece al catálogo oficial y no se puede registrar.`,
        details: [],
      });
      return;
    }

    setDrafts((current) =>
      current.some((draft) => draft.subjectId === subject.id)
        ? current
        : [...current, draftFromCatalog(subject)],
    );
    setSearch('');
    setFormError(null);
    setNotice(null);
  }

  function updateDraft(subjectId: string, patch: Partial<DraftSubject>) {
    setDrafts((current) =>
      current.map((draft) => (draft.subjectId === subjectId ? { ...draft, ...patch } : draft)),
    );
  }

  function buildPayload(): ApplyTutorPayload {
    if (!programId) throw new Error('Selecciona tu programa en el catálogo oficial.');

    const semesterNumber = Number(semester);
    if (!Number.isInteger(semesterNumber) || semesterNumber < 1 || semesterNumber > 20) {
      throw new Error('Indica tu semestre actual, entre 1 y 20.');
    }

    const code = studentCode.trim();
    if (code.length < 4) {
      throw new Error('Registra tu código de estudiante para completar el perfil académico.');
    }

    const years = Number(experienceYears);
    if (!Number.isInteger(years) || years < 0 || years > 60) {
      throw new Error('Los años de experiencia deben ser un número entero entre 0 y 60.');
    }

    const rate = Number(hourlyRate);
    if (!Number.isFinite(rate) || rate < 0) {
      throw new Error('Indica la tarifa por hora que quieres ofrecer.');
    }

    if (modalities.length === 0) throw new Error('Selecciona al menos una modalidad de tutoría.');
    if (drafts.length === 0) throw new Error('Agrega al menos una materia del pensum oficial.');

    return {
      programId,
      semester: semesterNumber,
      studentCode: code,
      ...(bio.trim() ? { bio: bio.trim() } : {}),
      experienceYears: years,
      hourlyRate: rate,
      modalities,
      subjects: drafts.map((draft) => {
        if (!knownIds.has(draft.subjectId)) {
          throw new Error(
            `${draft.code} ${draft.name} no pertenece al catálogo oficial y no se puede registrar.`,
          );
        }

        if (draft.mode === 'evidence') {
          const evidenceUrl = draft.evidenceUrl.trim();
          if (!isHttpUrl(evidenceUrl)) {
            throw new Error(
              `Adjunta la evidencia de aprobación de ${draft.code} ${draft.name} con un enlace http o https.`,
            );
          }
          return { subjectId: draft.subjectId, evidenceUrl };
        }

        const grade = Number(draft.grade);
        const approvedSemester = Number(draft.approvedSemester);
        if (!Number.isFinite(grade) || grade < 3 || grade > 5) {
          throw new Error(
            `La nota de ${draft.code} ${draft.name} debe estar entre 3.0 y 5.0 porque solo se registran materias aprobadas.`,
          );
        }
        if (!Number.isInteger(approvedSemester) || approvedSemester < 1 || approvedSemester > 20) {
          throw new Error(`Indica el semestre en el que aprobaste ${draft.code} ${draft.name}.`);
        }

        return {
          subjectId: draft.subjectId,
          grade: Math.round(grade * 100) / 100,
          approvedSemester,
        };
      }),
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === 'VERIFIED' || submitting) return;
    setFormError(null);
    setNotice(null);

    let payload: ApplyTutorPayload;
    try {
      payload = buildPayload();
    } catch (error) {
      setFormError(toFriendlyError(error));
      return;
    }

    setSubmitting(true);
    try {
      const result = await submitTutorApplication(payload);
      setStatus(result.verificationStatus);
      setRejectionReason(result.rejectionReason);
      setNotice(
        'Postulación enviada. Tus materias quedaron registradas para validación y todavía no se ofrecen como tutorías verificadas.',
      );
    } catch (error) {
      if (error instanceof ApiError && error.code === 'SESSION_EXPIRED') return;
      setFormError(toFriendlyError(error));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
        <p className="text-muted" role="status">
          Cargando la postulación de tutor...
        </p>
      </main>
    );
  }

  if (loadError && programs.length === 0) {
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Postulación como tutor</h1>
        <LoadError error={loadError} onRetry={() => void load()} />
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <section className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">
            Postulación como tutor
          </p>
          <h1 className="text-2xl font-bold text-balance text-foreground sm:text-3xl">
            Solicita el rol de tutor con materias verificables
          </h1>
          <p className="max-w-2xl text-muted">
            Completa tu perfil académico y registra materias aprobadas del pensum oficial. Cada
            materia necesita evidencia de aprobación o la nota y el semestre para validación.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:min-w-80">
          <StatTile value={drafts.length} label="Materias" />
          <StatTile value={modalities.length} label="Modalidades" />
          <StatTile value={status ? STATUS_LABEL[status] : 'Nueva'} label="Estado" accent />
        </div>
      </section>

      {status && (
        <div className="flex flex-col items-start gap-3">
          <Chip
            color={status === 'VERIFIED' ? 'success' : status === 'REJECTED' ? 'danger' : 'warning'}
          >
            {STATUS_LABEL[status]}
          </Chip>
          <FormNotice status={status === 'REJECTED' ? 'accent' : 'success'}>
            {STATUS_COPY[status]}
            {status === 'REJECTED' && rejectionReason ? ` Motivo: ${rejectionReason}` : ''}
          </FormNotice>
        </div>
      )}

      {notice && <FormNotice>{notice}</FormNotice>}
      <FormError error={formError} />

      <form className="grid gap-6 lg:grid-cols-2" onSubmit={handleSubmit} noValidate>
        <Card>
          <Card.Header>
            <Card.Title>Perfil académico</Card.Title>
            <Card.Description>
              Estos datos identifican tu programa dentro del catálogo oficial.
            </Card.Description>
          </Card.Header>
          <Card.Content className="gap-4">
            <Select
              fullWidth
              isRequired
              placeholder="Selecciona un programa"
              value={programId || null}
              isDisabled={locked}
              onChange={(value) => setProgramId(value ? String(value) : '')}
            >
              <Label>Programa</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {programs.map((program) => (
                    <ListBox.Item
                      key={program.id}
                      id={program.id}
                      textValue={`${program.code} ${program.name}`}
                    >
                      {program.code} · {program.name}
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                fullWidth
                isRequired
                value={studentCode}
                onChange={setStudentCode}
                isDisabled={locked}
              >
                <Label>Código de estudiante</Label>
                <Input maxLength={30} />
              </TextField>
              <TextField
                fullWidth
                isRequired
                type="number"
                value={semester}
                onChange={setSemester}
                isDisabled={locked}
              >
                <Label>Semestre</Label>
                <Input min={1} max={20} inputMode="numeric" />
              </TextField>
            </div>

            <TextField fullWidth value={bio} onChange={setBio} isDisabled={locked}>
              <Label>Presentación</Label>
              <TextArea
                rows={4}
                maxLength={2000}
                placeholder="Cuéntale a otros estudiantes en qué puedes acompañarlos."
              />
              <Description>Opcional. La ven los estudiantes cuando tu perfil quede verificado.</Description>
            </TextField>

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                fullWidth
                isRequired
                type="number"
                value={experienceYears}
                onChange={setExperienceYears}
                isDisabled={locked}
              >
                <Label>Años de experiencia</Label>
                <Input min={0} max={60} inputMode="numeric" />
              </TextField>
              <TextField
                fullWidth
                isRequired
                type="number"
                value={hourlyRate}
                onChange={setHourlyRate}
                isDisabled={locked}
              >
                <Label>Tarifa por hora (COP)</Label>
                <Input min={0} step={1000} inputMode="numeric" />
              </TextField>
            </div>

            <fieldset className="flex flex-col gap-2" disabled={locked}>
              <legend className="mb-1 text-sm font-semibold text-foreground">Modalidades</legend>
              {MODALITIES.map((modality) => (
                <Checkbox
                  key={modality.id}
                  isSelected={modalities.includes(modality.id)}
                  isDisabled={locked}
                  onChange={(selected) =>
                    setModalities((current) =>
                      selected
                        ? [...current, modality.id]
                        : current.filter((item) => item !== modality.id),
                    )
                  }
                >
                  <Checkbox.Content>
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                    {modality.label}
                  </Checkbox.Content>
                </Checkbox>
              ))}
            </fieldset>
          </Card.Content>
        </Card>

        <Card>
          <Card.Header>
            <Card.Title>Materias del pensum oficial</Card.Title>
            <Card.Description>
              Solo puedes agregar materias que existan en el catálogo. Si no aparece, el sistema no
              permite registrarla.
            </Card.Description>
          </Card.Header>
          <Card.Content className="gap-4">
            <TextField fullWidth value={search} onChange={setSearch} isDisabled={locked}>
              <Label>Buscar en el catálogo</Label>
              <Input placeholder="Nombre o código, por ejemplo SIS201" />
              <Description>La lista usa el pensum de tu programa.</Description>
            </TextField>

            <Checkbox
              isSelected={showAllCatalog}
              isDisabled={locked}
              onChange={setShowAllCatalog}
            >
              <Checkbox.Content>
                <Checkbox.Control>
                  <Checkbox.Indicator />
                </Checkbox.Control>
                Ver todo el catálogo oficial
              </Checkbox.Content>
            </Checkbox>

            {missingFromCatalog && (
              <Alert status="danger">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>
                    «{search.trim()}» no pertenece al catálogo oficial. El sistema no permite su
                    registro.
                  </Alert.Title>
                </Alert.Content>
              </Alert>
            )}

            {outsideProgram && (
              <FormNotice status="accent">
                Hay coincidencias en el catálogo oficial, pero no en el pensum del programa
                seleccionado. Activa “Ver todo el catálogo oficial” para agregarlas.
              </FormNotice>
            )}

            <ul className="flex flex-col gap-3" aria-label="Materias del catálogo">
              {visibleSubjects.slice(0, 8).map((subject) => (
                <li
                  key={subject.id}
                  className="flex flex-row items-center justify-between gap-3 rounded-xl border border-border p-3"
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <strong className="text-foreground">{subject.name}</strong>
                    <small className="text-muted">
                      {subject.code}
                      {subject.program?.name ? ` · ${subject.program.name}` : ''}
                    </small>
                  </div>
                  <Button size="sm" isDisabled={locked} onPress={() => addSubject(subject)}>
                    Agregar
                  </Button>
                </li>
              ))}
              {visibleSubjects.length === 0 && !missingFromCatalog && (
                <li className="text-sm text-muted">
                  No hay más materias oficiales para agregar con este filtro.
                </li>
              )}
            </ul>

            {drafts.map((draft) => (
              <article
                key={draft.subjectId}
                className="flex flex-col gap-3 rounded-xl border border-border p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-base font-semibold text-foreground">
                    {draft.code} · {draft.name}
                  </h2>
                  <Button
                    size="sm"
                    variant="tertiary"
                    isDisabled={locked}
                    onPress={() =>
                      setDrafts((current) =>
                        current.filter((item) => item.subjectId !== draft.subjectId),
                      )
                    }
                  >
                    Quitar
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-2" role="group" aria-label={`Validación de ${draft.name}`}>
                  <Button
                    size="sm"
                    variant={draft.mode === 'evidence' ? 'primary' : 'tertiary'}
                    isDisabled={locked}
                    onPress={() => updateDraft(draft.subjectId, { mode: 'evidence' })}
                  >
                    Evidencia
                  </Button>
                  <Button
                    size="sm"
                    variant={draft.mode === 'record' ? 'primary' : 'tertiary'}
                    isDisabled={locked}
                    onPress={() => updateDraft(draft.subjectId, { mode: 'record' })}
                  >
                    Nota y semestre
                  </Button>
                </div>

                {draft.mode === 'evidence' ? (
                  <TextField
                    fullWidth
                    isRequired
                    type="url"
                    value={draft.evidenceUrl}
                    onChange={(value) => updateDraft(draft.subjectId, { evidenceUrl: value })}
                    isDisabled={locked}
                  >
                    <Label>Enlace de la evidencia</Label>
                    <Input placeholder="https://..." />
                  </TextField>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <TextField
                      fullWidth
                      isRequired
                      type="number"
                      value={draft.grade}
                      onChange={(value) => updateDraft(draft.subjectId, { grade: value })}
                      isDisabled={locked}
                    >
                      <Label>Nota</Label>
                      <Input min={3} max={5} step={0.1} inputMode="decimal" />
                    </TextField>
                    <TextField
                      fullWidth
                      isRequired
                      type="number"
                      value={draft.approvedSemester}
                      onChange={(value) => updateDraft(draft.subjectId, { approvedSemester: value })}
                      isDisabled={locked}
                    >
                      <Label>Semestre de aprobación</Label>
                      <Input min={1} max={20} inputMode="numeric" />
                    </TextField>
                  </div>
                )}
              </article>
            ))}
          </Card.Content>
        </Card>

        <div className="lg:col-span-2">
          <Button type="submit" isDisabled={status === 'VERIFIED' || submitting}>
            {status === 'VERIFIED' ? 'Postulación aprobada' : submitting ? 'Enviando...' : 'Enviar postulación'}
          </Button>
        </div>
      </form>
    </main>
  );
}
