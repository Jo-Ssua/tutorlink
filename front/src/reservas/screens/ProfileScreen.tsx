import { useEffect, useState } from 'react';
import { ReservasApiError, getTutor } from '../api';
import { Alert, Avatar, BottomBar, Loading, ScreenHeader } from '../components/ui';
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

  const verifiedSubjects = tutor?.subjects.filter((subject) => subject.status === 'VERIFIED') ?? [];

  return (
    <>
      <ScreenHeader onBack={onBack} title="Perfil del tutor" />
      {error && <Alert title="No pudimos cargar el perfil">{error}</Alert>}
      {!tutor && !error && <Loading label="Cargando perfil…" />}

      {tutor && (
        <>
          <section className="card profile-head">
            <Avatar name={tutor.fullName} size="lg" />
            <div className="profile-head__info">
              <h2>{tutor.fullName}</h2>
              <span className="verification-badge">
                <span aria-hidden="true">✓</span> Tutor verificado
              </span>
              <p className="r-muted">
                {tutor.hasReviews
                  ? `★ ${tutor.averageRating.toFixed(1)} (${tutor.reviewCount} reseñas)`
                  : 'Perfil nuevo · sin reseñas aún'}
              </p>
            </div>
          </section>

          <section className="card profile-stats" aria-label="Resumen del tutor">
            <div>
              <strong>{tutor.experienceYears}</strong>
              <span>años de experiencia</span>
            </div>
            <div>
              <strong>{tutor.completedSessions}</strong>
              <span>sesiones completadas</span>
            </div>
          </section>

          {tutor.bio && (
            <section className="card">
              <p className="section-label">Presentación</p>
              <p className="bio">“{tutor.bio}”</p>
            </section>
          )}

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
            {verifiedSubjects.length > 0 ? (
              <ul className="subject-list">
                {verifiedSubjects.map((subject) => (
                  <li key={subject.id}>
                    <div>
                      <strong>{subject.name}</strong>
                      <span>
                        {subject.code} · {subject.program}
                      </span>
                    </div>
                    <span className="subject-status">Verificada</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="r-muted">No hay materias verificadas disponibles.</p>
            )}
            <p className="section-label">Modalidades ofrecidas</p>
            <div className="chips">
              {tutor.modalities.map((modality) => (
                <span key={modality} className="chip chip--outline">
                  {MODALITY_LABEL[modality]}
                </span>
              ))}
            </div>
          </section>

          <section className="card reviews-section">
            <div className="reviews-heading">
              <div>
                <p className="section-label">Reseñas verificadas</p>
                <h3>
                  {tutor.hasReviews ? `${tutor.averageRating.toFixed(1)} de 5` : 'Sin calificación'}
                </h3>
              </div>
              <span className="review-count">
                {tutor.reviewCount} {tutor.reviewCount === 1 ? 'reseña' : 'reseñas'}
              </span>
            </div>
            {tutor.recentReviews.length > 0 ? (
              <ul className="review-list">
                {tutor.recentReviews.map((review, index) => (
                  <li key={`${review.createdAt}-${index}`}>
                    <div className="review-meta">
                      <span className="review-stars" aria-label={`${review.rating} de 5 estrellas`}>
                        {'★'.repeat(review.rating)}
                      </span>
                      <span>{review.subject}</span>
                    </div>
                    <p>“{review.comment}”</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="r-muted">Este tutor aún no tiene reseñas verificadas.</p>
            )}
          </section>

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
