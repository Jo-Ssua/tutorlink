import { useEffect, useMemo, useState } from 'react';
import {
  ReservasApiError,
  listFaculties,
  listProfessors,
  listPrograms,
  listSubjects,
  listTutors,
  type TutorSearchFilters,
} from '../api';
import { Alert, Avatar, Loading, ScreenHeader } from '../components/ui';
import { formatCop } from '../format';
import type {
  FacultyOption,
  ProfessorOption,
  ProgramOption,
  SubjectOption,
  TutorCard,
} from '../types';

/** Directorio de tutores con filtros del catálogo académico oficial. */
export function TutorsScreen({ onSelect }: { onSelect: (tutorId: string) => void }) {
  const [tutors, setTutors] = useState<TutorCard[] | null>(null);
  const [faculties, setFaculties] = useState<FacultyOption[]>([]);
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [professors, setProfessors] = useState<ProfessorOption[]>([]);
  const [filters, setFilters] = useState<TutorSearchFilters>({});
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listFaculties(), listPrograms(), listSubjects(), listProfessors(), listTutors()])
      .then(([facultyOptions, programOptions, subjectOptions, professorOptions, result]) => {
        setFaculties(facultyOptions);
        setPrograms(programOptions);
        setSubjects(subjectOptions);
        setProfessors(professorOptions);
        setTutors(result.items);
      })
      .catch((caught: unknown) =>
        setError(
          caught instanceof ReservasApiError
            ? caught.message
            : 'No se pudo cargar el directorio académico.',
        ),
      );
  }, []);

  const availablePrograms = useMemo(
    () => programs.filter((program) => !filters.facultyId || program.facultyId === filters.facultyId),
    [filters.facultyId, programs],
  );
  const availableSubjects = useMemo(
    () =>
      subjects.filter(
        (subject) =>
          (!filters.facultyId || subject.program.facultyId === filters.facultyId) &&
          (!filters.programId || subject.programId === filters.programId),
      ),
    [filters.facultyId, filters.programId, subjects],
  );
  const availableProfessors = useMemo(
    () =>
      professors.filter(
        (professor) =>
          (!filters.facultyId || professor.program.facultyId === filters.facultyId) &&
          (!filters.programId || professor.programId === filters.programId) &&
          (!filters.subjectId ||
            subjects.some(
              (subject) =>
                subject.id === filters.subjectId &&
                subject.programId === professor.programId,
            )),
      ),
    [filters.facultyId, filters.programId, filters.subjectId, professors, subjects],
  );

  function updateFilter(key: keyof TutorSearchFilters, value: string) {
    setFilters((current) => {
      const next = { ...current, [key]: value || undefined };
      if (key === 'facultyId') {
        next.programId = undefined;
        next.subjectId = undefined;
        next.professorId = undefined;
      } else if (key === 'programId') {
        next.subjectId = undefined;
        next.professorId = undefined;
      } else if (key === 'subjectId') {
        next.professorId = undefined;
      }
      return next;
    });
  }

  async function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoadingSearch(true);
    setError(null);
    try {
      const result = await listTutors(filters);
      setTutors(result.items);
    } catch (caught: unknown) {
      setError(
        caught instanceof ReservasApiError ? caught.message : 'No se pudo ejecutar la búsqueda.',
      );
    } finally {
      setLoadingSearch(false);
    }
  }

  return (
    <>
      <ScreenHeader title="Buscar tutores" />
      <p className="lead">Encuentra apoyo para tu facultad, programa y curso específico.</p>

      {error && <Alert title="No pudimos cargar los tutores">{error}</Alert>}
      {!tutors && !error && <Loading label="Cargando directorio…" />}

      <form className="card search-filters" onSubmit={handleSearch}>
        <p className="section-label">Filtros académicos</p>
        <label className="r-field">
          Facultad
          <select
            value={filters.facultyId ?? ''}
            onChange={(event) => updateFilter('facultyId', event.target.value)}
          >
            <option value="">Todas las facultades</option>
            {faculties.map((faculty) => (
              <option key={faculty.id} value={faculty.id}>
                {faculty.name}
              </option>
            ))}
          </select>
        </label>
        <label className="r-field">
          Programa
          <select
            value={filters.programId ?? ''}
            onChange={(event) => updateFilter('programId', event.target.value)}
          >
            <option value="">Todos los programas</option>
            {availablePrograms.map((program) => (
              <option key={program.id} value={program.id}>
                {program.name} ({program.code})
              </option>
            ))}
          </select>
        </label>
        <label className="r-field">
          Materia o código
          <select
            value={filters.subjectId ?? ''}
            onChange={(event) => updateFilter('subjectId', event.target.value)}
          >
            <option value="">Todas las materias</option>
            {availableSubjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.code} · {subject.name}
              </option>
            ))}
          </select>
        </label>
        <label className="r-field">
          Profesor
          <select
            value={filters.professorId ?? ''}
            onChange={(event) => updateFilter('professorId', event.target.value)}
          >
            <option value="">Todos los profesores</option>
            {availableProfessors.map((professor) => (
              <option key={professor.id} value={professor.id}>
                {professor.fullName}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn btn--primary" disabled={loadingSearch}>
          {loadingSearch ? 'Buscando…' : 'Buscar tutores'}
        </button>
      </form>

      <ul className="card-list">
        {tutors?.map((tutor) => (
          <li key={tutor.id}>
            <button type="button" className="card tutor-card" onClick={() => onSelect(tutor.id)}>
              <Avatar name={tutor.fullName} />
              <div className="tutor-card__body">
                <strong>{tutor.fullName}</strong>
                <span className="r-muted">{tutor.subjects.map((s) => s.name).join(' · ')}</span>
                <span className="r-muted">
                  {tutor.reviewCount > 0
                    ? `★ ${tutor.averageRating.toFixed(1)} · ${tutor.reviewCount} reseñas`
                    : 'Perfil nuevo · sin reseñas'}
                </span>
              </div>
              <span className="price">{formatCop(tutor.hourlyRate)}/h</span>
            </button>
          </li>
        ))}
        {tutors?.length === 0 && (
          <li>
            <Alert tone="info" title="No encontramos tutores compatibles">
              Ajusta los filtros o usa StudyMatch para encontrar apoyo urgente.
            </Alert>
          </li>
        )}
      </ul>
    </>
  );
}
