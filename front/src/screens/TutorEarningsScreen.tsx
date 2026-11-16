import { Button, Card, Chip, Input, Label, ListBox, Select, TextField } from '@heroui/react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ApiError, getTutorEarnings } from '../api';
import { FormNotice } from '../components/FormFeedback';
import { LoadError } from '../components/LoadError';
import { StatTile } from '../components/StatTile';
import { toFriendlyError, type FriendlyError } from '../errors';
import type { EarningsGroupBy, EarningsSummary } from '../types';

const copFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

const sessionFormatter = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const dayFormatter = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' });
const monthFormatter = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' });

const GROUP_LABEL: Record<EarningsGroupBy, string> = {
  DAY: 'Día',
  WEEK: 'Semana',
  MONTH: 'Mes',
};

function formatPeriod(value: string, groupBy: EarningsGroupBy) {
  const date = new Date(value);
  if (groupBy === 'MONTH') return monthFormatter.format(date);
  if (groupBy === 'WEEK') return `Semana del ${dayFormatter.format(date)}`;
  return dayFormatter.format(date);
}

function toRangeStart(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0).toISOString();
}

function toRangeEnd(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 23, 59, 59, 999).toISOString();
}

/**
 * Resumen de ingresos simulados del tutor (SCRUM-33).
 *
 * El total solo incluye pagos aprobados de sesiones completadas. Los reembolsos
 * se listan aparte y el aviso deja claro que no hay una transferencia real.
 */
export function TutorEarningsScreen() {
  const [summary, setSummary] = useState<EarningsSummary | null>(null);
  const [groupBy, setGroupBy] = useState<EarningsGroupBy>('MONTH');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FriendlyError | null>(null);

  const load = useCallback(
    async (query: { from?: string; to?: string; groupBy: EarningsGroupBy }) => {
      setLoading(true);
      setError(null);

      try {
        setSummary(await getTutorEarnings(query));
      } catch (caught) {
        if (caught instanceof ApiError && caught.code === 'SESSION_EXPIRED') return;
        setError(toFriendlyError(caught));
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void load({ groupBy: 'MONTH' });
  }, [load]);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void load({
      groupBy,
      ...(from ? { from: toRangeStart(from) } : {}),
      ...(to ? { to: toRangeEnd(to) } : {}),
    });
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <section className="flex flex-col gap-2">
        <p className="text-xs font-semibold tracking-wide text-muted uppercase">Panel del tutor</p>
        <h1 className="text-2xl font-bold text-balance text-foreground sm:text-3xl">
          Resumen de ingresos
        </h1>
        <p className="max-w-2xl text-sm text-muted sm:text-base">
          Lo que generaron tus tutorías en el período, separado por fecha y por sesión.
        </p>
      </section>

      {summary && (
        <FormNotice status="accent">
          {summary.disclaimer} {summary.countingRule}
        </FormNotice>
      )}

      <Card>
        <Card.Header>
          <Card.Title>Período</Card.Title>
        </Card.Header>
        <Card.Content>
          <form className="grid gap-4 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end" onSubmit={applyFilters}>
            <TextField fullWidth value={from} onChange={setFrom}>
              <Label>Desde</Label>
              <Input type="date" />
            </TextField>
            <TextField fullWidth value={to} onChange={setTo}>
              <Label>Hasta</Label>
              <Input type="date" />
            </TextField>
            <Select fullWidth value={groupBy} onChange={(value) => setGroupBy(value as EarningsGroupBy)}>
              <Label>Agrupar</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {(Object.keys(GROUP_LABEL) as EarningsGroupBy[]).map((option) => (
                    <ListBox.Item key={option} id={option} textValue={GROUP_LABEL[option]}>
                      {GROUP_LABEL[option]}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
            <Button type="submit" isDisabled={loading}>
              {loading ? 'Consultando...' : 'Ver resumen'}
            </Button>
          </form>
        </Card.Content>
      </Card>

      {error && <LoadError error={error} onRetry={() => void load({ groupBy, ...(from ? { from: toRangeStart(from) } : {}), ...(to ? { to: toRangeEnd(to) } : {}) })} />}

      {loading && (
        <p className="text-sm text-muted" role="status">
          Cargando el resumen de ingresos...
        </p>
      )}

      {!loading && summary && (
        <>
          <section className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3" aria-label="Totales del período">
            <StatTile value={copFormatter.format(summary.totals.netEarnings)} label="Tus ingresos" accent />
            <StatTile value={summary.totals.sessions} label="Sesiones que suman" />
            <StatTile value={copFormatter.format(summary.totals.platformFees)} label="Comisión simulada" />
            <StatTile value={summary.totals.refundedSessions} label="Reembolsos" />
          </section>

          <section className="flex flex-col gap-3" aria-labelledby="earnings-periods-title">
            <h2 id="earnings-periods-title" className="text-lg font-bold text-foreground">
              Por período
            </h2>
            {summary.periods.length === 0 ? (
              <p className="text-sm text-muted">En este período no hay sesiones completadas que sumen ingresos.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {summary.periods.map((period) => (
                  <li key={period.periodStart}>
                    <Card>
                      <Card.Content className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-semibold text-foreground">
                            {formatPeriod(period.periodStart, summary.period.groupBy)}
                          </p>
                          <p className="text-sm text-muted">
                            {period.sessions} {period.sessions === 1 ? 'sesión completada' : 'sesiones completadas'}
                          </p>
                        </div>
                        <p className="text-lg font-bold text-foreground tabular-nums">
                          {copFormatter.format(period.netEarnings)}
                        </p>
                      </Card.Content>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="flex flex-col gap-3" aria-labelledby="earnings-sessions-title">
            <div className="flex items-center gap-2">
              <h2 id="earnings-sessions-title" className="text-lg font-bold text-foreground">
                Por sesión
              </h2>
              <Chip size="sm" variant="soft">
                {summary.sessions.length}
              </Chip>
            </div>
            {summary.sessions.length === 0 ? (
              <p className="text-sm text-muted">Todavía no hay pagos aprobados de sesiones completadas.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {summary.sessions.map((session) => (
                  <li key={session.paymentId}>
                    <Card>
                      <Card.Header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-xs font-semibold tracking-wide text-muted uppercase">
                            {session.subject.code} · {session.subject.name}
                          </p>
                          <Card.Title>{copFormatter.format(session.tutorEarnings)}</Card.Title>
                        </div>
                        <Chip className="self-start" size="sm" variant="soft" color="success">
                          Completada · suma
                        </Chip>
                      </Card.Header>
                      <Card.Content className="text-sm text-muted">
                        <time dateTime={session.sessionDate}>
                          {sessionFormatter.format(new Date(session.sessionDate))}
                        </time>
                        {' · '}
                        {session.studentAlias}
                        {' · pago simulado aprobado'}
                      </Card.Content>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="flex flex-col gap-3" aria-labelledby="earnings-refunds-title">
            <h2 id="earnings-refunds-title" className="text-lg font-bold text-foreground">
              No suman al ingreso
            </h2>
            <p className="text-sm text-muted">
              Reembolsos del período: {copFormatter.format(summary.totals.refundedTotal)}. Una cancelación
              o una sesión que no se completó queda fuera del total.
            </p>
            {summary.refunds.length === 0 ? (
              <p className="text-sm text-muted">No hay reembolsos en este período.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {summary.refunds.map((refund) => (
                  <li key={refund.paymentId}>
                    <Card>
                      <Card.Content className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-semibold text-foreground">
                            {refund.subject.code} · {refund.subject.name}
                          </p>
                          <p className="text-sm text-muted">
                            <time dateTime={refund.sessionDate}>
                              {sessionFormatter.format(new Date(refund.sessionDate))}
                            </time>
                            {' · '}
                            {copFormatter.format(refund.tutorEarnings)} no se incluyen
                          </p>
                        </div>
                        <Chip className="self-start" size="sm" variant="soft">
                          Reembolsada · no suma
                        </Chip>
                      </Card.Content>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}
