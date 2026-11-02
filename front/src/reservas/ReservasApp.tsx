import { useState } from 'react';
import { DetailsScreen } from './screens/DetailsScreen';
import { DoneScreen } from './screens/DoneScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { SlotsScreen } from './screens/SlotsScreen';
import { TutorsScreen } from './screens/TutorsScreen';
import type { AvailabilitySlot, CreatedBooking, TutorProfile } from './types';
import './reservas.css';

type Screen =
  | { name: 'tutors' }
  | { name: 'profile'; tutorId: string }
  | { name: 'slots'; tutor: TutorProfile; slot: AvailabilitySlot | null; notice?: string }
  | { name: 'details'; tutor: TutorProfile; slot: AvailabilitySlot }
  | { name: 'done'; result: CreatedBooking };

/**
 * Flujo de reserva del estudiante: SCRUM-21 (crear reserva) y SCRUM-20 (consultar disponibilidad).
 * Usa la sesión existente (`../session`) y los estilos acotados a `.rsv`.
 */
export function ReservasApp() {
  const [screen, setScreen] = useState<Screen>({ name: 'tutors' });

  return (
    <div className="rsv">
      <main className="frame">
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
    </div>
  );
}
