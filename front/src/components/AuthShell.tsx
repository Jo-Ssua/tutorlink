import type { ReactNode } from 'react';

interface AuthShellProps {
  /** Titular de la columna de presentación. */
  title: string;
  lead: string;
  points?: string[];
  /** Ensancha la tarjeta para formularios con muchos campos. */
  wide?: boolean;
  children: ReactNode;
}

/** Marco de las pantallas sin sesión: presentación a la izquierda, tarjeta a la derecha. */
export function AuthShell({ title, lead, points = [], wide = false, children }: AuthShellProps) {
  return (
    <main className="auth">
      <section className="auth__intro">
        <span className="brand brand--light">TutorLink</span>
        <h1>{title}</h1>
        <p>{lead}</p>
        {points.length > 0 && (
          <ul className="auth__points">
            {points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="auth__panel">
        <div className={`auth__card${wide ? ' auth__card--wide' : ''}`}>{children}</div>
      </section>
    </main>
  );
}
