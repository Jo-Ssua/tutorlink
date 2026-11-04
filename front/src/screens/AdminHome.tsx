import { useCallback, useEffect, useState } from 'react';
import { ApiError, getAdminStats, getPendingTutorApplications } from '../api';
import { toFriendlyError, type FriendlyError } from '../errors';
import type { AdminStats, TutorApplication } from '../types';

const copFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' });

/**
 * Pantalla inicial del administrador: métricas y postulaciones pendientes.
 *
 * Es de solo lectura. Aprobar y rechazar postulaciones ya existe en la API
 * (`PATCH /admin/tutor-applications/:id/...`) y tendrá su propia pantalla.
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
    <main className="dashboard">
      <section className="hero">
        <div>
          <p className="eyebrow">Panel de administración</p>
          <h1>Estado de la plataforma</h1>
          <p className="hero__text">
            Métricas operativas e ingresos simulados. Los pagos de TutorLink no procesan dinero
            real.
          </p>
        </div>
        {stats && (
          <div className="stats" aria-label="Pendientes de revisión">
            <div className="stat stat--pending">
              <span className="stat__value">{stats.applications.pendingTutorApplications}</span>
              <span className="stat__label">Postulaciones</span>
            </div>
            <div className="stat stat--pending">
              <span className="stat__value">{stats.applications.pendingSubjects}</span>
              <span className="stat__label">Materias por validar</span>
            </div>
            <div className="stat">
              <span className="stat__value">{stats.bookings.pending}</span>
              <span className="stat__label">Reservas pendientes</span>
            </div>
          </div>
        )}
      </section>

      {error && (
        <div className="alert alert--error" role="alert">
          <p>{error.message}</p>
          <button
            type="button"
            className="button button--ghost button--small"
            onClick={() => void load()}
          >
            Reintentar
          </button>
        </div>
      )}

      {loading && (
        <div className="skeleton-list" aria-live="polite" aria-busy="true">
          <span className="sr-only">Cargando métricas...</span>
          <div className="skeleton" />
          <div className="skeleton" />
        </div>
      )}

      {stats && (
        <section className="section" aria-labelledby="admin-stats-title">
          <div className="section__heading">
            <h2 id="admin-stats-title">Resumen</h2>
          </div>
          <div className="stats">
            <div className="stat">
              <span className="stat__value">{stats.users.students}</span>
              <span className="stat__label">Estudiantes</span>
            </div>
            <div className="stat">
              <span className="stat__value">{stats.users.tutors}</span>
              <span className="stat__label">Tutores</span>
            </div>
            <div className="stat">
              <span className="stat__value">{stats.bookings.completed}</span>
              <span className="stat__label">Sesiones completadas</span>
            </div>
            <div className="stat">
              <span className="stat__value">
                {copFormatter.format(stats.simulatedRevenue.platformFees)}
              </span>
              <span className="stat__label">Comisión simulada</span>
            </div>
          </div>
        </section>
      )}

      {!loading && !error && (
        <section className="section" aria-labelledby="admin-applications-title">
          <div className="section__heading">
            <h2 id="admin-applications-title">Postulaciones pendientes</h2>
            <span className="count">{applications.length}</span>
          </div>

          {applications.length === 0 ? (
            <section className="panel panel--center">
              <h3>No hay postulaciones por revisar</h3>
              <p>Cuando un estudiante se postule como tutor aparecerá aquí.</p>
            </section>
          ) : (
            <div className="session-list">
              {applications.map((application) => (
                <article key={application.id} className="session-card">
                  <header className="session-card__header">
                    <div>
                      <p className="session-card__eyebrow">{application.institutionalEmail}</p>
                      <h3 className="session-card__topic">{application.fullName}</h3>
                    </div>
                    <span className="pill pill--pending">Pendiente</span>
                  </header>

                  <dl className="session-meta">
                    <div>
                      <dt>Postulación</dt>
                      <dd>{dateFormatter.format(new Date(application.createdAt))}</dd>
                    </div>
                    <div>
                      <dt>Tarifa</dt>
                      <dd>{copFormatter.format(application.hourlyRate)} / hora</dd>
                    </div>
                    <div>
                      <dt>Materias</dt>
                      <dd>
                        {application.subjects.length > 0
                          ? application.subjects
                              .map((link) => link.subject.code)
                              .join(', ')
                          : 'Sin materias'}
                      </dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
