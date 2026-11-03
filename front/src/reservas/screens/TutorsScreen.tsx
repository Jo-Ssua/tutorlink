import { useEffect, useState, type FormEvent } from 'react';
import { ReservasApiError, listTutors } from '../api';
import { Alert, Avatar, Loading, ScreenHeader } from '../components/ui';
import { formatCop } from '../format';
import type { Modality, TutorCard, TutorSearchFilters, TutorSortBy } from '../types';

const SORT_OPTIONS: Array<{ value: TutorSortBy; label: string }> = [
  { value: 'RELEVANCE', label: 'Más relevantes' },
  { value: 'RATING', label: 'Mejor calificación' },
  { value: 'PRICE', label: 'Menor tarifa' },
  { value: 'AVAILABILITY', label: 'Disponibilidad más cercana' },
];

/** Punto de entrada mínimo al flujo de reserva. La búsqueda completa es de SCRUM-11/12/13. */
export function TutorsScreen({ onSelect }: { onSelect: (tutorId: string) => void }) {
  const [tutors, setTutors] = useState<TutorCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<TutorSearchFilters>({ sortBy: 'RELEVANCE' });
  const [draft, setDraft] = useState({ q: '', maxRate: '', minRating: '', modality: '' as '' | Modality });

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    listTutors(filters)
      .then((result) => { if (active) setTutors(result.items); })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof ReservasApiError ? caught.message : 'No se pudieron cargar los tutores.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [filters]);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFilters((current) => ({
      ...current,
      q: draft.q.trim() || undefined,
      maxRate: draft.maxRate ? Number(draft.maxRate) : undefined,
      minRating: draft.minRating ? Number(draft.minRating) : undefined,
      modality: draft.modality || undefined,
    }));
  }

  function changeSort(sortBy: TutorSortBy) {
    setFilters((current) => ({ ...current, sortBy }));
  }

  function clearFilters() {
    setDraft({ q: '', maxRate: '', minRating: '', modality: '' });
    setFilters((current) => ({ sortBy: current.sortBy }));
  }

  return (
    <>
      <ScreenHeader title="Tutores disponibles" />
      <p className="lead">Elige un tutor para reservar tu sesión.</p>

      <form className="tutor-search card" onSubmit={applyFilters}>
        <label className="r-field">
          <span>Materia o tutor</span>
          <input type="text" value={draft.q} onChange={(event) => setDraft({ ...draft, q: event.target.value })} placeholder="Ej. cálculo, Laura…" />
        </label>
        <div className="tutor-search__row">
          <label className="r-field">
            <span>Tarifa máxima (COP/h)</span>
            <input type="number" min="0" value={draft.maxRate} onChange={(event) => setDraft({ ...draft, maxRate: event.target.value })} placeholder="Sin límite" />
          </label>
          <label className="r-field">
            <span>Calificación mínima</span>
            <select value={draft.minRating} onChange={(event) => setDraft({ ...draft, minRating: event.target.value })}>
              <option value="">Cualquiera</option><option value="3">3 o más</option><option value="4">4 o más</option><option value="4.5">4.5 o más</option>
            </select>
          </label>
        </div>
        <label className="r-field">
          <span>Modalidad</span>
          <select value={draft.modality} onChange={(event) => setDraft({ ...draft, modality: event.target.value as '' | Modality })}>
            <option value="">Todas</option><option value="VIRTUAL">Virtual</option><option value="IN_PERSON">Presencial</option><option value="HYBRID">Híbrida</option>
          </select>
        </label>
        <div className="tutor-search__actions">
          <button type="submit" className="btn btn--primary">Aplicar filtros</button>
          <button type="button" className="link-btn" onClick={clearFilters}>Limpiar filtros</button>
        </div>
      </form>

      <label className="r-field tutor-sort">
        <span>Ordenar resultados</span>
        <select value={filters.sortBy ?? 'RELEVANCE'} onChange={(event) => changeSort(event.target.value as TutorSortBy)}>
          {SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>

      {error && <Alert title="No pudimos cargar los tutores">{error}</Alert>}
      {loading && <Loading label="Actualizando resultados…" />}

      <ul className="card-list">
        {!loading && tutors?.map((tutor) => (
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
        {!loading && tutors?.length === 0 && <li className="r-muted">No hay tutores que coincidan. Prueba ajustar los filtros.</li>}
      </ul>
    </>
  );
}
