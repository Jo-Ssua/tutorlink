import { Button, Card, Chip } from '@heroui/react';
import { CheckCircleIcon, StarIcon } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { ApiError } from '../../api';
import { getTutor } from '../api';
import { ActionBar, Avatar, FlowAlert, Loading, ScreenHeader } from '../components/ui';
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
        setError(caught instanceof ApiError ? caught.message : 'No se pudo cargar el perfil.'),
      );
  }, [tutorId]);

  const verifiedSubjects = tutor?.subjects.filter((subject) => subject.status === 'VERIFIED') ?? [];

  return (
    <>
      <ScreenHeader onBack={onBack} backLabel="Tutores" title="Perfil del tutor" />
      {error && <FlowAlert title="No pudimos cargar el perfil">{error}</FlowAlert>}
      {!tutor && !error && <Loading label="Cargando perfil..." />}

      {tutor && (
        <>
          <Card>
            <Card.Content className="flex flex-row items-center gap-4">
              <Avatar name={tutor.fullName} size="lg" />
              <div className="flex flex-col gap-1">
                <h2 className="text-xl font-bold text-foreground">{tutor.fullName}</h2>
                <p className="flex items-center gap-1 text-sm text-muted">
                  {tutor.hasReviews ? (
                    <>
                      <StarIcon aria-hidden="true" weight="fill" className="text-warning" />
                      {tutor.averageRating.toFixed(1)} ({tutor.reviewCount} reseñas)
                    </>
                  ) : (
                    'Perfil nuevo · sin reseñas aún'
                  )}
                </p>
              </div>
            </Card.Content>
          </Card>

          <Card>
            <Card.Content className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3 text-sm text-muted sm:grid-cols-4">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold tracking-wide uppercase">Experiencia</span>
                  <strong className="text-base text-foreground">
                    {tutor.experienceYears} años
                  </strong>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold tracking-wide uppercase">Sesiones</span>
                  <strong className="text-base text-foreground">{tutor.completedSessions}</strong>
                </div>
                <div className="flex flex-col gap-1 sm:col-span-2">
                  <span className="text-xs font-semibold tracking-wide uppercase">
                    Tarifa de tutoría
                  </span>
                  <strong className="text-lg text-foreground tabular-nums">
                    {formatCop(tutor.hourlyRate)}{' '}
                    <span className="text-sm font-normal text-muted">COP / hora</span>
                  </strong>
                </div>
              </div>
              <ul className="flex flex-col gap-2 text-sm text-muted">
                <li className="flex items-start gap-2">
                  <CheckCircleIcon aria-hidden="true" className="mt-0.5 shrink-0 text-success" />
                  Pagas solo por el tiempo reservado.
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircleIcon aria-hidden="true" className="mt-0.5 shrink-0 text-success" />
                  El pago es simulado en esta fase del prototipo.
                </li>
              </ul>
            </Card.Content>
          </Card>

          <Card>
            <Card.Content className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold tracking-wide text-muted uppercase">
                  Materias verificadas
                </p>
                {verifiedSubjects.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {verifiedSubjects.map((subject) => (
                      <Chip key={subject.id} size="sm" variant="soft" color="accent">
                        {subject.name}
                      </Chip>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted">No hay materias verificadas disponibles.</p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold tracking-wide text-muted uppercase">
                  Modalidades ofrecidas
                </p>
                <div className="flex flex-wrap gap-2">
                  {tutor.modalities.map((modality) => (
                    <Chip key={modality} size="sm" variant="tertiary">
                      {MODALITY_LABEL[modality]}
                    </Chip>
                  ))}
                </div>
              </div>
            </Card.Content>
          </Card>

          {tutor.bio && (
            <Card>
              <Card.Content>
                <p className="text-sm text-foreground italic">“{tutor.bio}”</p>
              </Card.Content>
            </Card>
          )}

          <Card>
            <Card.Content className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold tracking-wide text-muted uppercase">
                    Reseñas verificadas
                  </p>
                  <h3 className="text-base font-semibold text-foreground">
                    {tutor.hasReviews ? `${tutor.averageRating.toFixed(1)} de 5` : 'Sin calificación'}
                  </h3>
                </div>
                <span className="text-sm text-muted">
                  {tutor.reviewCount} {tutor.reviewCount === 1 ? 'reseña' : 'reseñas'}
                </span>
              </div>

              {tutor.recentReviews.length > 0 ? (
                <ul className="flex flex-col gap-3">
                  {tutor.recentReviews.map((review, index) => (
                    <li key={`${review.createdAt}-${index}`} className="flex flex-col gap-1 text-sm">
                      <div className="flex items-center gap-2 text-muted">
                        <span aria-label={`${review.rating} de 5 estrellas`}>
                          {'★'.repeat(review.rating)}
                        </span>
                        <span>{review.subject}</span>
                      </div>
                      <p className="text-foreground">“{review.comment}”</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">Este tutor aún no tiene reseñas verificadas.</p>
              )}
            </Card.Content>
          </Card>
          <ActionBar>
            <Button onPress={() => onReserve(tutor)}>Ver horarios disponibles</Button>
          </ActionBar>
        </>
      )}
    </>
  );
}
