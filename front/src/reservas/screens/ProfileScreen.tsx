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
              <p className="text-xs font-semibold tracking-wide text-muted uppercase">
                Tarifa de tutoría
              </p>
              <p className="text-3xl font-bold text-foreground tabular-nums">
                {formatCop(tutor.hourlyRate)}{' '}
                <span className="text-sm font-normal text-muted">COP / hora</span>
              </p>
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
                <div className="flex flex-wrap gap-2">
                  {tutor.subjects.map((subject) => (
                    <Chip key={subject.id} size="sm" variant="soft" color="accent">
                      {subject.name}
                    </Chip>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold tracking-wide text-muted uppercase">
                  Modalidad disponible
                </p>
                <div className="flex flex-wrap gap-2">
                  {tutor.modalities.map((modality) => (
                    <Chip key={modality} size="sm" variant="tertiary">
                      {MODALITY_LABEL[modality]}
                    </Chip>
                  ))}
                </div>
              </div>

              {tutor.bio && <p className="text-sm text-foreground italic">“{tutor.bio}”</p>}
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
