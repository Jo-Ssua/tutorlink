import { CheckCircleIcon } from '@phosphor-icons/react';
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

/**
 * Marco de las pantallas sin sesión.
 *
 * En móvil es una sola columna: una cabecera corta y debajo el formulario. La
 * lista de argumentos solo aparece desde `lg`, donde hay sitio al lado; en una
 * pantalla estrecha obligaría a bajar media pantalla antes de poder escribir.
 */
export function AuthShell({ title, lead, points = [], wide = false, children }: AuthShellProps) {
  return (
    <main className="grid min-h-dvh bg-background lg:grid-cols-2">
      <section className="flex flex-col justify-center gap-4 bg-accent px-6 py-10 text-accent-foreground lg:gap-6 lg:px-12 lg:py-16">
        <p className="text-sm font-bold tracking-widest uppercase">TutorLink</p>
        <h1 className="max-w-md text-3xl leading-tight font-bold text-balance lg:text-5xl">
          {title}
        </h1>
        <p className="max-w-md text-base opacity-90 lg:text-lg">{lead}</p>

        {points.length > 0 && (
          <ul className="hidden max-w-md flex-col gap-3 lg:flex">
            {points.map((point) => (
              <li key={point} className="flex items-start gap-3 text-base opacity-90">
                <CheckCircleIcon
                  aria-hidden="true"
                  size={22}
                  weight="fill"
                  className="mt-0.5 shrink-0"
                />
                {point}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex items-center justify-center px-4 py-10 sm:px-6 lg:px-10">
        <div className={`w-full ${wide ? 'max-w-xl' : 'max-w-md'}`}>{children}</div>
      </section>
    </main>
  );
}
