import { Button, Card, Chip, Input, Label, ListBox, Select, TextField } from '@heroui/react';
import { CaretRightIcon, StarIcon } from '@phosphor-icons/react';
import { useEffect, useState, type FormEvent } from 'react';
import { ApiError } from '../../api';
import {
  listFaculties,
  listProfessors,
  listPrograms,
  listSubjects,
  listTutors,
} from '../api';
import { Avatar, FlowAlert, Loading, ScreenHeader } from '../components/ui';
import {
  VERIFICATION_COLOR,
  VERIFICATION_LABEL,
  formatCop,
  formatLongDate,
  formatTime,
} from '../format';
import type {
  FacultyOption,
  Modality,
  ProfessorOption,
  ProgramOption,
  SubjectOption,
  TutorList,
  TutorSearchFilters,
  TutorSortBy,
} from '../types';

const SORT_OPTIONS: Array<{ value: TutorSortBy; label: string }> = [
  { value: 'RELEVANCE', label: 'Más relevantes' },
  { value: 'RATING', label: 'Mejor calificación' },
  { value: 'PRICE', label: 'Menor tarifa' },
  { value: 'AVAILABILITY', label: 'Disponibilidad más cercana' },
];

/*
 * React Aria identifica cada opción por su `id` y una cadena vacía no es un
 * identificador: la opción «sin filtro» necesita un valor propio.
 */
const ANY = 'ANY';

const RATING_OPTIONS = [
  { value: ANY, label: 'Cualquiera' },
  { value: '3', label: '3 o más' },
  { value: '4', label: '4 o más' },
  { value: '4.5', label: '4.5 o más' },
];

const MODALITY_OPTIONS = [
  { value: ANY, label: 'Todas' },
  { value: 'VIRTUAL', label: 'Virtual' },
  { value: 'IN_PERSON', label: 'Presencial' },
  { value: 'HYBRID', label: 'Híbrida' },
];

const EMPTY_DRAFT = {
  q: '',
  maxRate: '',
  minRating: ANY,
  modality: ANY,
  facultyId: ANY,
  programId: ANY,
  subjectId: ANY,
  professorId: ANY,
};

type Draft = typeof EMPTY_DRAFT;

/** `ANY` es ausencia de filtro, así que no viaja a la API. */
function chosen(value: string): string | undefined {
  return value === ANY ? undefined : value;
}

interface FilterSelectProps {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}

function FilterSelect({ label, value, options, onChange }: FilterSelectProps) {
  return (
    <Select fullWidth value={value} onChange={(next) => onChange(String(next ?? ANY))}>
      <Label>{label}</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {options.map((option) => (
            <ListBox.Item key={option.value} id={option.value} textValue={option.label}>
              {option.label}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

/** Entrada al flujo de reserva, con la búsqueda y el orden de SCRUM-11/12/13. */
export function TutorsScreen({ onSelect }: { onSelect: (tutorId: string) => void }) {
  const [result, setResult] = useState<TutorList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<TutorSearchFilters>({
    sortBy: 'RELEVANCE',
  });
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);

  const [faculties, setFaculties] = useState<FacultyOption[]>([]);
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [professors, setProfessors] = useState<ProfessorOption[]>([]);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    listTutors(filters)
      .then((response) => {
        if (active) setResult(response);
      })
      .catch((caught: unknown) => {
        if (!active) return;
        setError(
          caught instanceof ApiError ? caught.message : 'No se pudieron cargar los tutores.',
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [filters]);

  /*
   * El catálogo se consulta en cascada: cada lista hereda lo ya elegido más
   * arriba, de modo que un programa siempre pertenece a la facultad escogida y
   * un profesor siempre dicta la materia escogida. La API ya hace ese filtro,
   * así que aquí basta con volver a pedir la lista cuando cambia su ámbito.
   */
  useEffect(() => {
    let active = true;
    listFaculties()
      .then((options) => {
        if (active) setFaculties(options);
      })
      .catch(() => {
        if (active) setCatalogError('No se pudo cargar el catálogo académico.');
      });
    return () => {
      active = false;
    };
  }, []);

  const facultyScope = chosen(draft.facultyId);
  const programScope = chosen(draft.programId);
  const subjectScope = chosen(draft.subjectId);

  useEffect(() => {
    let active = true;
    listPrograms(facultyScope)
      .then((options) => {
        if (active) setPrograms(options);
      })
      .catch(() => {
        if (active) setCatalogError('No se pudieron cargar los programas.');
      });
    return () => {
      active = false;
    };
  }, [facultyScope]);

  useEffect(() => {
    let active = true;
    listSubjects({ facultyId: facultyScope, programId: programScope })
      .then((options) => {
        if (active) setSubjects(options);
      })
      .catch(() => {
        if (active) setCatalogError('No se pudieron cargar las materias.');
      });
    return () => {
      active = false;
    };
  }, [facultyScope, programScope]);

  useEffect(() => {
    let active = true;
    listProfessors({
      facultyId: facultyScope,
      programId: programScope,
      subjectId: subjectScope,
    })
      .then((options) => {
        if (active) setProfessors(options);
      })
      .catch(() => {
        if (active) setCatalogError('No se pudieron cargar los profesores.');
      });
    return () => {
      active = false;
    };
  }, [facultyScope, programScope, subjectScope]);

  /*
   * Al cambiar un nivel se limpian los de abajo: dejar puesta una materia de
   * otro programa daría una búsqueda que nunca encuentra a nadie.
   */
  function chooseFaculty(facultyId: string) {
    setDraft((current) => ({
      ...current,
      facultyId,
      programId: ANY,
      subjectId: ANY,
      professorId: ANY,
    }));
  }

  function chooseProgram(programId: string) {
    setDraft((current) => ({ ...current, programId, subjectId: ANY, professorId: ANY }));
  }

  function chooseSubject(subjectId: string) {
    setDraft((current) => ({ ...current, subjectId, professorId: ANY }));
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFilters((current) => ({
      ...current,
      q: draft.q.trim() || undefined,
      maxRate: draft.maxRate ? Number(draft.maxRate) : undefined,
      minRating: draft.minRating === ANY ? undefined : Number(draft.minRating),
      modality: chosen(draft.modality) as Modality | undefined,
      facultyId: chosen(draft.facultyId),
      programId: chosen(draft.programId),
      subjectId: chosen(draft.subjectId),
      professorId: chosen(draft.professorId),
    }));
  }

  function clearFilters() {
    setDraft(EMPTY_DRAFT);
    setFilters((current) => ({ sortBy: current.sortBy }));
  }

  const facultyOptions = [
    { value: ANY, label: 'Todas las facultades' },
    ...faculties.map((faculty) => ({ value: faculty.id, label: faculty.name })),
  ];
  const programOptions = [
    { value: ANY, label: 'Todos los programas' },
    ...programs.map((program) => ({ value: program.id, label: program.name })),
  ];
  const subjectOptions = [
    { value: ANY, label: 'Todas las materias' },
    ...subjects.map((subject) => ({
      value: subject.id,
      label: `${subject.code} · ${subject.name}`,
    })),
  ];
  const professorOptions = [
    { value: ANY, label: 'Todos los profesores' },
    ...professors.map((professor) => ({ value: professor.id, label: professor.fullName })),
  ];

  const tutors = result?.items ?? null;
  // Si hay filtros puestos, el vacío significa «nada coincide», no «no hay tutores».
  const filtered = Boolean(
    filters.q ||
      filters.maxRate ||
      filters.minRating ||
      filters.modality ||
      filters.facultyId ||
      filters.programId ||
      filters.subjectId ||
      filters.professorId,
  );

  return (
    <>
      <ScreenHeader title="Tutores disponibles" lead="Elige un tutor para reservar tu sesión." />

      <Card>
        <Card.Content>
          <form className="flex flex-col gap-4" onSubmit={applyFilters}>
            <TextField
              fullWidth
              value={draft.q}
              onChange={(value) => setDraft({ ...draft, q: value })}
            >
              <Label>Materia o tutor</Label>
              <Input placeholder="Ej. cálculo, Laura..." />
            </TextField>

            <div className="grid gap-4 sm:grid-cols-2">
              <FilterSelect
                label="Facultad"
                value={draft.facultyId}
                options={facultyOptions}
                onChange={chooseFaculty}
              />
              <FilterSelect
                label="Programa"
                value={draft.programId}
                options={programOptions}
                onChange={chooseProgram}
              />
              <FilterSelect
                label="Materia"
                value={draft.subjectId}
                options={subjectOptions}
                onChange={chooseSubject}
              />
              <FilterSelect
                label="Profesor"
                value={draft.professorId}
                options={professorOptions}
                onChange={(professorId) => setDraft({ ...draft, professorId })}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                fullWidth
                value={draft.maxRate}
                onChange={(value) => setDraft({ ...draft, maxRate: value })}
              >
                <Label>Tarifa máxima (COP/h)</Label>
                <Input type="number" min={0} inputMode="numeric" placeholder="Sin límite" />
              </TextField>

              <FilterSelect
                label="Calificación mínima"
                value={draft.minRating}
                options={RATING_OPTIONS}
                onChange={(minRating) => setDraft({ ...draft, minRating })}
              />
            </div>

            <FilterSelect
              label="Modalidad"
              value={draft.modality}
              options={MODALITY_OPTIONS}
              onChange={(modality) => setDraft({ ...draft, modality })}
            />

            {catalogError && <p className="text-sm text-warning">{catalogError}</p>}

            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit">Aplicar filtros</Button>
              <Button type="button" variant="tertiary" onPress={clearFilters}>
                Limpiar filtros
              </Button>
            </div>
          </form>
        </Card.Content>
      </Card>

      <Select
        fullWidth
        value={filters.sortBy ?? 'RELEVANCE'}
        onChange={(value) =>
          setFilters((current) => ({
            ...current,
            sortBy: value as TutorSortBy,
          }))
        }
      >
        <Label>Ordenar resultados</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {SORT_OPTIONS.map((option) => (
              <ListBox.Item key={option.value} id={option.value} textValue={option.label}>
                {option.label}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>

      {error && <FlowAlert title="No pudimos cargar los tutores">{error}</FlowAlert>}
      {loading && <Loading label="Actualizando resultados..." />}

      <ul className="flex flex-col gap-3">
        {!loading &&
          tutors?.map((tutor) => (
            <li key={tutor.id}>
              <button
                type="button"
                className="w-full cursor-pointer text-left"
                aria-label={`Ver el perfil de ${tutor.fullName}`}
                onClick={() => onSelect(tutor.id)}
              >
                <Card className="transition-colors hover:border-accent">
                  <Card.Content className="flex flex-col gap-3">
                    <div className="flex flex-row flex-nowrap items-start gap-3">
                      <Avatar name={tutor.fullName} />
                      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <strong className="text-foreground">{tutor.fullName}</strong>
                          <Chip
                            size="sm"
                            variant="soft"
                            color={VERIFICATION_COLOR[tutor.verificationStatus]}
                          >
                            {VERIFICATION_LABEL[tutor.verificationStatus]}
                          </Chip>
                        </div>
                        {tutor.reviewCount > 0 ? (
                          <span className="flex flex-wrap items-center gap-1 text-sm text-muted">
                            <StarIcon aria-hidden="true" weight="fill" className="text-warning" />
                            <span className="font-semibold text-foreground">
                              {tutor.averageRating.toFixed(1)}
                            </span>
                            <span>
                              calificación promedio · {tutor.reviewCount}{' '}
                              {tutor.reviewCount === 1 ? 'reseña' : 'reseñas'}
                            </span>
                          </span>
                        ) : (
                          <Chip size="sm" variant="soft">
                            Sin calificaciones
                          </Chip>
                        )}
                      </div>
                      <CaretRightIcon aria-hidden="true" className="mt-1 shrink-0 text-muted" />
                    </div>

                    <div className="flex flex-wrap gap-2" aria-label="Materias">
                      {tutor.subjects.length > 0 ? (
                        tutor.subjects.map((subject) => (
                          <Chip key={subject.id} size="sm" variant="soft" color="accent">
                            {subject.name}
                          </Chip>
                        ))
                      ) : (
                        <span className="text-sm text-muted">Sin materias verificadas</span>
                      )}
                    </div>

                    <dl className="grid gap-2 border-t border-border pt-3 text-sm sm:grid-cols-2">
                      <div className="flex flex-col gap-1">
                        <dt className="text-xs font-semibold tracking-wide text-muted uppercase">
                          Tarifa
                        </dt>
                        <dd>
                          <Chip size="sm" variant="soft" color="accent">
                            {formatCop(tutor.hourlyRate)}/h
                          </Chip>
                        </dd>
                      </div>
                      <div className="flex flex-col gap-1">
                        <dt className="text-xs font-semibold tracking-wide text-muted uppercase">
                          Disponibilidad
                        </dt>
                        <dd>
                          {tutor.isAvailable && tutor.nextAvailableAt ? (
                            <span className="text-foreground">
                              {formatLongDate(tutor.nextAvailableAt)} ·{' '}
                              {formatTime(tutor.nextAvailableAt)}
                            </span>
                          ) : (
                            <Chip size="sm" variant="soft" color="warning">
                              Sin disponibilidad
                            </Chip>
                          )}
                        </dd>
                      </div>
                    </dl>
                  </Card.Content>
                </Card>
              </button>
            </li>
          ))}
        {!loading && tutors?.length === 0 && (
          <li className="text-sm text-muted">
            {filtered
              ? /*
                 * La API explica qué hacer sin resultados, y ahí es donde entra
                 * StudyMatch; el texto propio es solo el respaldo.
                 */
                (result?.suggestions ??
                'No hay tutores que coincidan. Ajusta los filtros o usa StudyMatch para una búsqueda urgente.')
              : 'Aún no hay tutores verificados.'}
          </li>
        )}
      </ul>
    </>
  );
}
