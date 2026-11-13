import { Card, Chip } from '@heroui/react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, getAdminStats, getPendingTutorApplications } from '../api';
import { LoadError } from '../components/LoadError';
import { StatTile } from '../components/StatTile';
import { toFriendlyError, type FriendlyError } from '../errors';
import type { AdminStats, TutorApplication } from '../types';

const copFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' });

/** Un dato de la ficha: etiqueta arriba, valor abajo. */
function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</dt>
      <dd className="text-sm text-foreground">{children}</dd>
    </div>
  );
}

/**
 * Pantalla inicial del administrador: métricas y postulaciones pendientes.
 *
 * El resumen es de solo lectura: aprobar y rechazar se hace en
 * `AdminTutorApplications` (`/app/admin/postulaciones`), que trae la evidencia
 * completa de cada postulante.
 */
export function AdminHome() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [applications, setApplications] = useState<TutorApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FriendlyError | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [nextStats, pending] = await Promise.all([
        getAdminStats(),
        getPendingTutorApplications(),
      ]);
      setStats(nextStats);
      setApplications(pending.items);
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'SESSION_EXPIRED') {
        return;
      }
      setError(toFriendlyError(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <section className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold text-balance text-foreground sm:text-3xl">
            Estado de la plataforma
          </h1>
          <p className="max-w-2xl text-sm text-muted sm:text-base">
            Métricas operativas e ingresos simulados. Los pagos de TutorLink no procesan dinero
            real.
          </p>
        </div>
        {stats && (
          <div
            className="grid grid-cols-3 gap-2 sm:gap-3 lg:w-auto lg:shrink-0"
            aria-label="Pendientes de revisión"
          >
            <StatTile
              value={stats.applications.pendingTutorApplications}
              label="Postulaciones"
              accent
            />
            <StatTile value={stats.applications.pendingSubjects} label="Materias por validar" />
            <StatTile value={stats.bookings.pending} label="Reservas pendientes" />
          </div>
        )}
      </section>

      {error && <LoadError error={error} onRetry={() => void load()} />}

      {loading && (
        <div className="flex flex-col gap-4" aria-live="polite" aria-busy="true">
          <span className="sr-only">Cargando métricas...</span>
          <div className="h-32 animate-pulse rounded-xl bg-default" />
          <div className="h-32 animate-pulse rounded-xl bg-default" />
        </div>
      )}

      {stats && (
        <section className="flex flex-col gap-4" aria-labelledby="admin-stats-title">
          <h2 id="admin-stats-title" className="text-lg font-bold text-foreground">
            Resumen
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
            <StatTile value={stats.users.students} label="Estudiantes" />
            <StatTile value={stats.users.tutors} label="Tutores" />
            <StatTile value={stats.bookings.completed} label="Sesiones completadas" />
            <StatTile
              value={copFormatter.format(stats.simulatedRevenue.platformFees)}
              label="Comisión simulada"
            />
          </div>
        </section>
      )}

      {!loading && !error && (
        <section className="flex flex-col gap-4" aria-labelledby="admin-applications-title">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="admin-applications-title" className="text-lg font-bold text-foreground">
              Postulaciones pendientes
            </h2>
            <Chip size="sm" variant="soft" color="warning">
              {applications.length}
            </Chip>
            <Link
              to="/app/admin/postulaciones"
              className="ml-auto text-sm font-semibold text-accent underline"
            >
              Revisar postulaciones
            </Link>
          </div>

          {applications.length === 0 ? (
            <Card>
              <Card.Content className="flex flex-col items-center gap-2 py-10 text-center">
                <h3 className="text-lg font-bold text-foreground">
                  No hay postulaciones por revisar
                </h3>
                <p className="max-w-md text-sm text-muted">
                  Cuando un estudiante se postule como tutor aparecerá aquí.
                </p>
              </Card.Content>
            </Card>
          ) : (
            <div className="flex flex-col gap-4">
              {applications.map((application) => (
                <Card key={application.id}>
                  <Card.Header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 flex-col gap-1">
                      <p className="truncate text-xs font-semibold tracking-wide text-muted uppercase">
                        {application.institutionalEmail}
                      </p>
                      <Card.Title>{application.fullName}</Card.Title>
                    </div>
                    <Chip className="self-start" size="sm" variant="soft" color="warning">
                      Pendiente
                    </Chip>
                  </Card.Header>

                  <Card.Content>
                    <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                      <Meta label="Postulación">
                        {dateFormatter.format(new Date(application.createdAt))}
                      </Meta>
                      <Meta label="Tarifa">
                        <span className="tabular-nums">
                          {copFormatter.format(application.hourlyRate)}
                        </span>{' '}
                        / hora
                      </Meta>
                      <Meta label="Materias">
                        {application.subjects.length > 0
                          ? application.subjects.map((link) => link.subject.code).join(', ')
                          : 'Sin materias'}
                      </Meta>
                    </dl>
                  </Card.Content>
                </Card>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
