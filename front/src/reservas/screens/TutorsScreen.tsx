import { useEffect, useState } from 'react';
import { ApiError } from '../../api';
import { listTutors } from '../api';
import { Alert, Avatar, Loading, ScreenHeader } from '../components/ui';
import { formatCop } from '../format';
import type { TutorCard } from '../types';

/** Punto de entrada mínimo al flujo de reserva. La búsqueda completa es de SCRUM-11/12/13. */
export function TutorsScreen({ onSelect }: { onSelect: (tutorId: string) => void }) {
  const [tutors, setTutors] = useState<TutorCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listTutors()
      .then((result) => setTutors(result.items))
      .catch((caught: unknown) =>
        setError(caught instanceof ApiError ? caught.message : 'No se pudieron cargar los tutores.'),
      );
  }, []);

  return (
    <>
      <ScreenHeader title="Tutores disponibles" />
      <p className="lead">Elige un tutor para reservar tu sesión.</p>

      {error && <Alert title="No pudimos cargar los tutores">{error}</Alert>}
      {!tutors && !error && <Loading label="Cargando tutores…" />}

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
        {tutors?.length === 0 && <li className="r-muted">Aún no hay tutores verificados.</li>}
      </ul>
    </>
  );
}
