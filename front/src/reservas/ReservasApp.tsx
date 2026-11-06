import { useState } from 'react';
import { DetailsScreen } from './screens/DetailsScreen';
import { DoneScreen } from './screens/DoneScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { SlotsScreen } from './screens/SlotsScreen';
import { TutorsScreen } from './screens/TutorsScreen';
import type { AvailabilitySlot, CreatedBooking, TutorProfile } from './types';

type Screen =
  | { name: 'tutors' }
  | { name: 'profile'; tutorId: string }
  | { name: 'slots'; tutor: TutorProfile; slot: AvailabilitySlot | null; notice?: string }
  | { name: 'details'; tutor: TutorProfile; slot: AvailabilitySlot }
  | { name: 'done'; result: CreatedBooking };

/**
 * Flujo de reserva del estudiante: SCRUM-21 (crear reserva) y SCRUM-20
 * (consultar disponibilidad).
 *
 * Vive dentro del armazón común (`AppLayout`): barra superior, pestañas
 * inferiores y el mismo ancho de página que las demás pantallas. Ya no se
 * dibuja dentro de un marco de 430 px.
 */
export function ReservasApp() {
  const [screen, setScreen] = useState<Screen>({ name: 'tutors' });

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      {screen.name === 'tutors' && (
        <TutorsScreen onSelect={(tutorId) => setScreen({ name: 'profile', tutorId })} />
      )}

      {screen.name === 'profile' && (
        <ProfileScreen
          tutorId={screen.tutorId}
          onBack={() => setScreen({ name: 'tutors' })}
          onReserve={(tutor) => setScreen({ name: 'slots', tutor, slot: null })}
        />
      )}

      {screen.name === 'slots' && (
        <SlotsScreen
          tutor={screen.tutor}
          initialSlot={screen.slot}
          initialNotice={screen.notice}
          onBack={() => setScreen({ name: 'profile', tutorId: screen.tutor.id })}
          onContinue={(slot) => setScreen({ name: 'details', tutor: screen.tutor, slot })}
        />
      )}

      {screen.name === 'details' && (
        <DetailsScreen
          key={screen.slot.id}
          tutor={screen.tutor}
          slot={screen.slot}
          onBack={() => setScreen({ name: 'slots', tutor: screen.tutor, slot: screen.slot })}
          onChangeSlot={(notice) =>
            setScreen({ name: 'slots', tutor: screen.tutor, slot: null, notice })
          }
          onCreated={(result) => setScreen({ name: 'done', result })}
        />
      )}

      {screen.name === 'done' && (
        <DoneScreen result={screen.result} onHome={() => setScreen({ name: 'tutors' })} />
      )}
    </main>
  );
}
