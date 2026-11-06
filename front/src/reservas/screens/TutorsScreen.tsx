import { Button, Card, Chip, Input, Label, ListBox, Select, TextField } from '@heroui/react';
import { CaretRightIcon, StarIcon } from '@phosphor-icons/react';
import { useEffect, useState, type FormEvent } from 'react';
import { ApiError } from '../../api';
import { listTutors } from '../api';
import { Avatar, FlowAlert, Loading, ScreenHeader } from '../components/ui';
import { formatCop, formatLongDate, formatTime } from '../format';
import type {
  Modality,
  TutorCard,
  TutorSearchFilters,
  TutorSortBy,
  VerificationStatus,
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

const MODALITY_OPTIONS: Array<{ value: typeof ANY | Modality; label: string }> = [
  { value: 'ANY', label: 'Todas' },
  { value: 'VIRTUAL', label: 'Virtual' },
  { value: 'IN_PERSON', label: 'Presencial' },
  { value: 'HYBRID', label: 'Híbrida' },
];

const VERIFICATION_LABEL: Record<VerificationStatus, string> = {
  VERIFIED: 'Verificado',
  PENDING: 'Pendiente',
  REJECTED: 'Rechazado',
};

const VERIFICATION_COLOR: Record<VerificationStatus, 'success' | 'warning' | 'danger'> = {
  VERIFIED: 'success',
  PENDING: 'warning',
  REJECTED: 'danger',
};

const EMPTY_DRAFT = {
  q: '',
  maxRate: '',
  minRating: ANY as typeof ANY | string,
  modality: ANY as typeof ANY | Modality,
};

/** Entrada al flujo de reserva, con la búsqueda y el orden de SCRUM-11/12/13. */
export function TutorsScreen({ onSelect }: { onSelect: (tutorId: string) => void }) {
  const [tutors, setTutors] = useState<TutorCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<TutorSearchFilters>({
    sortBy: 'RELEVANCE',
  });
  const [draft, setDraft] = useState(EMPTY_DRAFT);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    listTutors(filters)
      .then((result) => {
        if (active) setTutors(result.items);
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

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFilters((current) => ({
      ...current,
      q: draft.q.trim() || undefined,
      maxRate: draft.maxRate ? Number(draft.maxRate) : undefined,
      minRating: draft.minRating === ANY ? undefined : Number(draft.minRating),
      modality: draft.modality === ANY ? undefined : draft.modality,
    }));
  }

  function clearFilters() {
    setDraft(EMPTY_DRAFT);
    setFilters((current) => ({ sortBy: current.sortBy }));
  }

  // Si hay filtros puestos, el vacío significa «nada coincide», no «no hay tutores».
  const filtered = Boolean(filters.q || filters.maxRate || filters.minRating || filters.modality);

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
              <TextField
                fullWidth
                value={draft.maxRate}
                onChange={(value) => setDraft({ ...draft, maxRate: value })}
              >
                <Label>Tarifa máxima (COP/h)</Label>
                <Input type="number" min={0} inputMode="numeric" placeholder="Sin límite" />
              </TextField>

              <Select
                fullWidth
                value={draft.minRating}
                onChange={(value) => setDraft({ ...draft, minRating: String(value ?? ANY) })}
              >
                <Label>Calificación mínima</Label>
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {RATING_OPTIONS.map((option) => (
                      <ListBox.Item key={option.value} id={option.value} textValue={option.label}>
                        {option.label}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
            </div>

            <Select
              fullWidth
              value={draft.modality}
              onChange={(value) =>
                setDraft({ ...draft, modality: (value ?? ANY) as typeof ANY | Modality })
              }
            >
              <Label>Modalidad</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {MODALITY_OPTIONS.map((option) => (
                    <ListBox.Item key={option.value} id={option.value} textValue={option.label}>
                      {option.label}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>

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
              ? 'No hay tutores que coincidan. Prueba ajustar los filtros.'
              : 'Aún no hay tutores verificados.'}
          </li>
        )}
      </ul>
    </>
  );
}
