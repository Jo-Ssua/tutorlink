import { useEffect, useMemo, useState } from 'react';
import {
  applicationError,
  getOfficialSubjects,
  getPrograms,
  getTutorApplication,
  isSessionExpired,
  submitTutorApplication,
} from './api';
import type {
  ApplyTutorPayload,
  CatalogProgram,
  CatalogSubject,
  DraftSubject,
  Modality,
  VerificationStatus,
} from './types';

interface PostulacionAppProps {
  onSessionExpired: () => void;
}

const MODALITIES: Array<{ id: Modality; label: string; hint: string }> = [
  { id: 'VIRTUAL', label: 'Virtual', hint: 'Sesiones en línea' },
  { id: 'IN_PERSON', label: 'Presencial', hint: 'En el campus' },
  { id: 'HYBRID', label: 'Híbrida', hint: 'Las dos modalidades' },
];

const STATUS_LABEL: Record<VerificationStatus, string> = {
  PENDING: 'Pendiente',
  VERIFIED: 'Aprobada',
  REJECTED: 'Rechazada',
};

const STATUS_COPY: Record<VerificationStatus, { title: string; text: string }> = {
  PENDING: {
    title: 'Postulación en revisión',
    text: 'Un administrador va a validar tu perfil y la evidencia de las materias. Puedes actualizar los datos mientras sigue pendiente.',
  },
  VERIFIED: {
    title: 'Ya eres tutor verificado',
    text: 'Tu postulación fue aprobada. El rol de tutor ya está asignado y las materias quedaron habilitadas para ofrecer tutorías.',
  },
  REJECTED: {
    title: 'Postulación rechazada',
    text: 'Corrige la información y vuelve a enviarla. El motivo de la revisión anterior queda visible abajo.',
  },
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

export function PostulacionApp({ onSessionExpired }: PostulacionAppProps) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<{ message: string; details: string[] } | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [programs, setPrograms] = useState<CatalogProgram[]>([]);
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

  const locked = status === 'VERIFIED';
  const knownIds = useMemo(() => new Set(subjects.map((subject) => subject.id)), [subjects]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const [programList, subjectList, snapshot] = await Promise.all([
          getPrograms(),
          getOfficialSubjects(),
          getTutorApplication(),
        ]);
        if (cancelled) return;

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
              grade: link.grade === null || link.grade === undefined ? '' : String(link.grade),
              approvedSemester:
                link.approvedSemester === null || link.approvedSemester === undefined
                  ? ''
                  : String(link.approvedSemester),
            })),
          );
        }
      } catch (error) {
        if (isSessionExpired(error)) {
          onSessionExpired();
          return;
        }
        setLoadError(applicationError(error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [onSessionExpired]);

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
    setSavedMessage(null);
  }

  function updateDraft(subjectId: string, patch: Partial<DraftSubject>) {
    setDrafts((current) =>
      current.map((draft) => (draft.subjectId === subjectId ? { ...draft, ...patch } : draft)),
    );
  }

  function toggleModality(modality: Modality) {
    setModalities((current) =>
      current.includes(modality)
        ? current.filter((item) => item !== modality)
        : [...current, modality],
    );
  }

  function buildPayload(): ApplyTutorPayload {
    if (!programId) {
      throw new Error('Selecciona tu programa en el catálogo oficial.');
    }

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

    if (modalities.length === 0) {
      throw new Error('Selecciona al menos una modalidad de tutoría.');
    }

    if (drafts.length === 0) {
      throw new Error('Agrega al menos una materia del pensum oficial.');
    }

    const payloadSubjects = drafts.map((draft) => {
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
        throw new Error(
          `Indica el semestre en el que aprobaste ${draft.code} ${draft.name}.`,
        );
      }

      return {
        subjectId: draft.subjectId,
        grade: Math.round(grade * 100) / 100,
        approvedSemester,
      };
    });

    return {
      programId,
      semester: semesterNumber,
      studentCode: code,
      ...(bio.trim() ? { bio: bio.trim() } : {}),
      experienceYears: years,
      hourlyRate: rate,
      modalities,
      subjects: payloadSubjects,
    };
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked || submitting) return;
    setFormError(null);
    setSavedMessage(null);

    let payload: ApplyTutorPayload;
    try {
      payload = buildPayload();
    } catch (error) {
      setFormError(applicationError(error));
      return;
    }

    setSubmitting(true);
    try {
      const result = await submitTutorApplication(payload);
      setStatus(result.verificationStatus);
      setRejectionReason(result.rejectionReason);
      setSavedMessage(
        'Postulación enviada. Tus materias quedaron registradas para validación y todavía no se ofrecen como tutorías verificadas.',
      );
    } catch (error) {
      if (isSessionExpired(error)) {
        onSessionExpired();
        return;
      }
      setFormError(applicationError(error));
    } finally {
      setSubmitting(false);
    }
  }

  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const typed = search.trim();
    if (!typed) return;

    if (catalogMatches.length === 0) {
      setFormError({
        message: `«${typed}» no pertenece al catálogo oficial. El sistema no permite registrarla.`,
        details: [],
      });
      return;
    }

    if (visibleSubjects.length === 1) {
      addSubject(visibleSubjects[0]);
    }
  }

  if (loading) {
    return (
      <div className="skeleton-list" aria-live="polite" aria-busy="true">
        <span className="sr-only">Cargando la postulación de tutor...</span>
        <div className="skeleton" />
        <div className="skeleton" />
      </div>
    );
  }

  if (loadError) {
    return (
      <section className="panel panel--center">
        <h1>No pudimos abrir la postulación</h1>
        <p>{loadError}</p>
      </section>
    );
  }

  return (
    <>
      <section className="hero">
        <div>
          <p className="eyebrow">Postulación como tutor</p>
          <h1>Solicita el rol de tutor con materias verificables</h1>
          <p className="hero__text">
            Completa tu perfil académico y registra materias aprobadas del pensum oficial.
            Cada materia necesita evidencia de aprobación o la nota y el semestre para validación.
          </p>
        </div>
        <div className="stats" aria-label="Resumen de la postulación">
          <div className="stat">
            <span className="stat__value">{drafts.length}</span>
            <span className="stat__label">Materias</span>
          </div>
          <div className="stat">
            <span className="stat__value">{modalities.length}</span>
            <span className="stat__label">Modalidades</span>
          </div>
          <div className={`stat${status === 'PENDING' ? ' stat--pending' : ''}`}>
            <span className="stat__value stat__value--text">
              {status ? STATUS_LABEL[status] : 'Nueva'}
            </span>
            <span className="stat__label">Estado</span>
          </div>
        </div>
      </section>

      {status && (
        <section className={`status-banner status-banner--${status.toLowerCase()}`} role="status">
          <h2>{STATUS_COPY[status].title}</h2>
          <p>{STATUS_COPY[status].text}</p>
          {status === 'REJECTED' && rejectionReason && <p>Motivo: {rejectionReason}</p>}
        </section>
      )}

      {savedMessage && (
        <div className="alert alert--success" role="status">
          <p>{savedMessage}</p>
        </div>
      )}

      <form className="apply-grid" onSubmit={handleSubmit} noValidate>
        <section className="apply-card">
          <h2>Perfil académico</h2>
          <p className="muted">Estos datos identifican tu programa dentro del catálogo oficial.</p>

          <div className="field">
            <label className="field__label" htmlFor="apply-program">
              Programa <span className="required">*</span>
            </label>
            <select
              id="apply-program"
              value={programId}
              disabled={locked}
              onChange={(event) => setProgramId(event.target.value)}
              required
            >
              <option value="">Selecciona un programa</option>
              {programs.map((program) => (
                <option key={program.id} value={program.id}>
                  {program.code} · {program.name}
                </option>
              ))}
            </select>
          </div>

          <div className="draft__split">
            <div className="field">
              <label className="field__label" htmlFor="apply-code">
                Código de estudiante <span className="required">*</span>
              </label>
              <input
                id="apply-code"
                value={studentCode}
                disabled={locked}
                maxLength={30}
                onChange={(event) => setStudentCode(event.target.value)}
                required
              />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="apply-semester">
                Semestre <span className="required">*</span>
              </label>
              <input
                id="apply-semester"
                type="number"
                min={1}
                max={20}
                value={semester}
                disabled={locked}
                onChange={(event) => setSemester(event.target.value)}
                required
              />
            </div>
          </div>

          <h2>Oferta de tutoría</h2>
          <div className="field">
            <label className="field__label" htmlFor="apply-bio">
              Presentación <span className="optional">(opcional)</span>
            </label>
            <textarea
              id="apply-bio"
              maxLength={2000}
              value={bio}
              disabled={locked}
              onChange={(event) => setBio(event.target.value)}
              placeholder="Cuéntale a otros estudiantes en qué puedes acompañarlos."
            />
          </div>

          <div className="draft__split">
            <div className="field">
              <label className="field__label" htmlFor="apply-years">
                Años de experiencia <span className="required">*</span>
              </label>
              <input
                id="apply-years"
                type="number"
                min={0}
                max={60}
                value={experienceYears}
                disabled={locked}
                onChange={(event) => setExperienceYears(event.target.value)}
                required
              />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="apply-rate">
                Tarifa por hora (COP) <span className="required">*</span>
              </label>
              <input
                id="apply-rate"
                type="number"
                min={0}
                step={1000}
                value={hourlyRate}
                disabled={locked}
                onChange={(event) => setHourlyRate(event.target.value)}
                required
              />
            </div>
          </div>

          <fieldset className="modality-set" disabled={locked}>
            <legend className="field__label">Modalidades</legend>
            {MODALITIES.map((modality) => (
              <label key={modality.id} className="checkbox">
                <input
                  type="checkbox"
                  checked={modalities.includes(modality.id)}
                  onChange={() => toggleModality(modality.id)}
                />
                <span>
                  {modality.label}
                  <small>{modality.hint}</small>
                </span>
              </label>
            ))}
          </fieldset>
        </section>

        <section className="apply-card">
          <h2>Materias del pensum oficial</h2>
          <p className="muted">
            Solo puedes agregar materias que existan en el catálogo. Si no aparece, el sistema no
            permite registrarla.
          </p>

          <div className="field">
            <label className="field__label" htmlFor="apply-search">
              Buscar en el catálogo
            </label>
            <input
              id="apply-search"
              value={search}
              disabled={locked}
              placeholder="Nombre o código, por ejemplo SIS201"
              onChange={(event) => {
                setSearch(event.target.value);
                setFormError(null);
              }}
              onKeyDown={handleSearchKeyDown}
            />
            <p className="field__hint">Enter agrega la materia cuando hay una sola coincidencia.</p>
          </div>

          <label className="checkbox">
            <input
              type="checkbox"
              checked={showAllCatalog}
              disabled={locked}
              onChange={(event) => setShowAllCatalog(event.target.checked)}
            />
            <span>
              Ver todo el catálogo oficial
              <small>Si lo dejas quieto, la lista usa el pensum de tu programa.</small>
            </span>
          </label>

          {missingFromCatalog && (
            <div className="alert alert--error" role="alert">
              <p>
                «{search.trim()}» no pertenece al catálogo oficial. El sistema no permite su
                registro.
              </p>
            </div>
          )}

          {outsideProgram && (
            <div className="alert alert--warning" role="status">
              <p>
                Hay coincidencias en el catálogo oficial, pero no en el pensum del programa
                seleccionado. Activa “Ver todo el catálogo oficial” para agregarlas.
              </p>
            </div>
          )}

          <ul className="picker__list">
            {visibleSubjects.slice(0, 8).map((subject) => (
              <li key={subject.id}>
                <button
                  type="button"
                  className="picker__item"
                  disabled={locked}
                  onClick={() => addSubject(subject)}
                >
                  <span>
                    <strong>{subject.code}</strong> {subject.name}
                    <small>{subject.program?.name}</small>
                  </span>
                  <span className="picker__add">Agregar</span>
                </button>
              </li>
            ))}
          </ul>
          {visibleSubjects.length === 0 && !missingFromCatalog && (
            <p className="muted">No hay más materias oficiales para agregar con este filtro.</p>
          )}

          <div className="draft-list">
            {drafts.map((draft) => (
              <article key={draft.subjectId} className="draft">
                <header className="draft__header">
                  <h3>
                    {draft.code} · {draft.name}
                  </h3>
                  <button
                    type="button"
                    className="button button--ghost button--small"
                    disabled={locked}
                    onClick={() =>
                      setDrafts((current) =>
                        current.filter((item) => item.subjectId !== draft.subjectId),
                      )
                    }
                  >
                    Quitar
                  </button>
                </header>

                <div className="segmented" role="group" aria-label={`Validación de ${draft.name}`}>
                  <button
                    type="button"
                    aria-pressed={draft.mode === 'evidence'}
                    disabled={locked}
                    onClick={() => updateDraft(draft.subjectId, { mode: 'evidence' })}
                  >
                    Evidencia
                  </button>
                  <button
                    type="button"
                    aria-pressed={draft.mode === 'record'}
                    disabled={locked}
                    onClick={() => updateDraft(draft.subjectId, { mode: 'record' })}
                  >
                    Nota y semestre
                  </button>
                </div>

                {draft.mode === 'evidence' ? (
                  <div className="field">
                    <label className="field__label" htmlFor={`evidence-${draft.subjectId}`}>
                      Enlace de la evidencia <span className="required">*</span>
                    </label>
                    <input
                      id={`evidence-${draft.subjectId}`}
                      type="url"
                      placeholder="https://..."
                      value={draft.evidenceUrl}
                      disabled={locked}
                      onChange={(event) =>
                        updateDraft(draft.subjectId, { evidenceUrl: event.target.value })
                      }
                      required
                    />
                  </div>
                ) : (
                  <div className="draft__split">
                    <div className="field">
                      <label className="field__label" htmlFor={`grade-${draft.subjectId}`}>
                        Nota <span className="required">*</span>
                      </label>
                      <input
                        id={`grade-${draft.subjectId}`}
                        type="number"
                        min={3}
                        max={5}
                        step={0.1}
                        value={draft.grade}
                        disabled={locked}
                        onChange={(event) =>
                          updateDraft(draft.subjectId, { grade: event.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="field">
                      <label className="field__label" htmlFor={`semester-${draft.subjectId}`}>
                        Semestre de aprobación <span className="required">*</span>
                      </label>
                      <input
                        id={`semester-${draft.subjectId}`}
                        type="number"
                        min={1}
                        max={20}
                        value={draft.approvedSemester}
                        disabled={locked}
                        onChange={(event) =>
                          updateDraft(draft.subjectId, { approvedSemester: event.target.value })
                        }
                        required
                      />
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>

        {formError && (
          <div className="alert alert--error apply-grid__full" role="alert">
            <p>{formError.message}</p>
            {formError.details.length > 0 && (
              <ul>
                {formError.details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="apply-actions apply-grid__full">
          <button type="submit" className="button button--primary" disabled={locked || submitting}>
            {locked ? 'Postulación aprobada' : submitting ? 'Enviando...' : 'Enviar postulación'}
          </button>
        </div>
      </form>
    </>
  );
}
