import { useEffect, useState } from 'react';
import { ReservasApiError, getTutor } from '../api';
import { Alert, Avatar, BottomBar, Loading, ScreenHeader } from '../components/ui';
import { ReviewsList } from '../components/ReviewsList';
import { MODALITY_LABEL, formatCop } from '../format';
import type { TutorProfile } from '../types';

/** Resumen mínimo del tutor antes de reservar. El perfil público completo es SCRUM-15. */
export function ProfileScreen({
  tutorId,
  onBack,
  onReserve,
}: {
  tutorId: string;
  onBack: () => void;
  onReserve: (tutor: TutorProfile) => void;
}) {
  const [tutor, setTutor] = useState<TutorProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getTutor(tutorId)
      .then(setTutor)
      .catch((caught: unknown) =>
        setError(caught instanceof ReservasApiError ? caught.message : 'No se pudo cargar el perfil.'),
      );
  }, [tutorId]);

  return (
    <>
      <ScreenHeader onBack={onBack} title="Perfil del tutor" />
      {error && <Alert title="No pudimos cargar el perfil">{error}</Alert>}
      {!tutor && !error && <Loading label="Cargando perfil…" />}

      {tutor && (
        <>
          <section className="card profile-head">
            <Avatar name={tutor.fullName} size="lg" />
            <div>
              <h2>{tutor.fullName}</h2>
              <p className="r-muted">
                {tutor.hasReviews
                  ? `★ ${tutor.averageRating.toFixed(1)} (${tutor.reviewCount} reseñas)`
                  : 'Perfil nuevo · sin reseñas aún'}
              </p>
            </div>
          </section>

          <section className="card">
            <p className="section-label">Tarifa de tutoría</p>
            <p className="big-price">
              {formatCop(tutor.hourlyRate)} <small>COP / hora</small>
            </p>
            <ul className="check-list">
              <li>Pagas solo por el tiempo reservado.</li>
              <li>El pago es simulado en esta fase del prototipo.</li>
            </ul>
          </section>

          <section className="card">
            <p className="section-label">Materias verificadas</p>
            <div className="chips">
              {tutor.subjects.map((subject) => (
                <span key={subject.id} className="chip">
                  {subject.name}
                </span>
              ))}
            </div>
            <p className="section-label">Modalidad disponible</p>
            <div className="chips">
              {tutor.modalities.map((modality) => (
                <span key={modality} className="chip chip--outline">
                  {MODALITY_LABEL[modality]}
                </span>
              ))}
            </div>
            {tutor.bio && <p className="bio">“{tutor.bio}”</p>}
          </section>

          <ReviewsList
            tutorId={tutor.id}
            hasReviews={tutor.hasReviews}
            averageRating={tutor.averageRating}
            reviewCount={tutor.reviewCount}
          />

          <BottomBar>
            <button type="button" className="btn btn--primary" onClick={() => onReserve(tutor)}>
              Ver horarios disponibles
            </button>
          </BottomBar>
        </>
      )}
    </>
  );
}
