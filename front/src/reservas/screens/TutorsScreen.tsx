import { Card, Chip } from '@heroui/react';
import { CaretRightIcon, StarIcon } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { ApiError } from '../../api';
import { listTutors } from '../api';
import { Avatar, FlowAlert, Loading, ScreenHeader } from '../components/ui';
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
      <ScreenHeader title="Tutores disponibles" lead="Elige un tutor para reservar tu sesión." />

      {error && <FlowAlert title="No pudimos cargar los tutores">{error}</FlowAlert>}
      {!tutors && !error && <Loading label="Cargando tutores..." />}

      <ul className="flex flex-col gap-3">
        {tutors?.map((tutor) => (
          <li key={tutor.id}>
            <button
              type="button"
              className="w-full cursor-pointer text-left"
              aria-label={`Ver el perfil de ${tutor.fullName}`}
              onClick={() => onSelect(tutor.id)}
            >
              <Card className="transition-colors hover:border-accent">
                <Card.Content className="flex flex-col gap-2">
                  {/* A 375 px las materias no caben junto al nombre: van debajo. */}
                  <div className="flex flex-row flex-nowrap items-center gap-3">
                    <Avatar name={tutor.fullName} />
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <strong className="text-foreground">{tutor.fullName}</strong>
                      <span className="flex items-center gap-1 text-sm text-muted">
                        {tutor.reviewCount > 0 ? (
                          <>
                            <StarIcon aria-hidden="true" weight="fill" className="text-warning" />
                            {tutor.averageRating.toFixed(1)} · {tutor.reviewCount} reseñas
                          </>
                        ) : (
                          'Perfil nuevo · sin reseñas'
                        )}
                      </span>
                    </div>
                    <CaretRightIcon aria-hidden="true" className="shrink-0 text-muted" />
                  </div>
                  <div className="flex flex-row items-start justify-between gap-3">
                    <span className="min-w-0 text-sm text-muted">
                      {tutor.subjects.map((subject) => subject.name).join(' · ')}
                    </span>
                    <Chip className="shrink-0" size="sm" variant="soft" color="accent">
                      {formatCop(tutor.hourlyRate)}/h
                    </Chip>
                  </div>
                </Card.Content>
              </Card>
            </button>
          </li>
        ))}
        {tutors?.length === 0 && (
          <li className="text-sm text-muted">Aún no hay tutores verificados.</li>
        )}
      </ul>
    </>
  );
}
