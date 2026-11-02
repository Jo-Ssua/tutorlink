import { useEffect, useRef, useState } from 'react';
import { ReservasApiError, createBooking, quoteBooking } from '../api';
import { Alert, Avatar, BottomBar, ScreenHeader } from '../components/ui';
import {
  CHOSEN_MODALITY_LABEL,
  allowedModalities,
  durationMinutes,
  formatCop,
  formatDuration,
  formatLongDate,
  formatTimeRange,
} from '../format';
import type {
  AvailabilitySlot,
  ChosenModality,
  CreatedBooking,
  PriceBreakdown,
  TutorProfile,
} from '../types';

type FieldKey = 'subjectId' | 'topic' | 'modality' | 'terms';

const FIELD_LABEL: Record<FieldKey, string> = {
  subjectId: 'Materia',
  topic: 'Tema o necesidad académica',
  modality: 'Modalidad',
  terms: 'Aceptación de términos y condiciones',
};

const TOPIC_MIN = 3;
const TOPIC_MAX = 200;

/** Paso 2: completar los datos de la reserva, revisar el costo y confirmar la solicitud. */
export function DetailsScreen({
  tutor,
  slot,
  onBack,
  onChangeSlot,
  onCreated,
}: {
  tutor: TutorProfile;
  slot: AvailabilitySlot;
  onBack: () => void;
  onChangeSlot: (notice?: string) => void;
  onCreated: (result: CreatedBooking) => void;
}) {
  const modalityOptions = allowedModalities(slot.modality);

  const [subjectId, setSubjectId] = useState(tutor.subjects.length === 1 ? tutor.subjects[0].id : '');
  const [topic, setTopic] = useState('');
  const [description, setDescription] = useState('');
  const [modality, setModality] = useState<ChosenModality | ''>(
    modalityOptions.length === 1 ? modalityOptions[0] : '',
  );
  const [terms, setTerms] = useState(false);

  const [price, setPrice] = useState<PriceBreakdown | null>(null);
  const [pending, setPending] = useState<FieldKey[]>([]);
  const [serverFields, setServerFields] = useState<Partial<Record<FieldKey, string>>>({});
  const [submitError, setSubmitError] = useState<{ message: string; slotTaken: boolean } | null>(
    null,
  );
  const [submitting, setSubmitting] = useState(false);
  const alertRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    quoteBooking(tutor.id, slot.id)
      .then((result) => setPrice(result.price))
      .catch(() => setPrice(null));
  }, [tutor.id, slot.id]);

  const fallbackSubtotal =
    (tutor.hourlyRate * durationMinutes(slot.startAt, slot.endAt)) / 60;
  const total = price?.total ?? fallbackSubtotal;
  const trimmedTopic = topic.trim();

  function findPending(): FieldKey[] {
    const missing: FieldKey[] = [];
    if (!subjectId) missing.push('subjectId');
    if (trimmedTopic.length < TOPIC_MIN) missing.push('topic');
    if (!modality) missing.push('modality');
    if (!terms) missing.push('terms');
    return missing;
  }

  function fieldError(field: FieldKey): string | null {
    if (serverFields[field]) return serverFields[field] ?? null;
    if (!pending.includes(field)) return null;
    if (field === 'topic' && trimmedTopic.length > 0) {
      return `Describe tu necesidad con al menos ${TOPIC_MIN} caracteres.`;
    }
    return field === 'terms' ? 'Debes aceptar los términos para continuar.' : 'Este campo es obligatorio.';
  }

  function focusAlert() {
    requestAnimationFrame(() =>
      alertRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
    );
  }

  async function handleConfirm() {
    setSubmitError(null);
    setServerFields({});
    const missing = findPending();
    setPending(missing);

    if (missing.length > 0) {
      focusAlert();
      return;
    }

    setSubmitting(true);
    try {
      const result = await createBooking({
        tutorProfileId: tutor.id,
        slotId: slot.id,
        subjectId,
        topic: trimmedTopic,
        modality: modality as ChosenModality,
        ...(description.trim() ? { description: description.trim() } : {}),
      });
      onCreated(result);
    } catch (caught) {
      if (caught instanceof ReservasApiError && caught.fields && Object.keys(caught.fields).length > 0) {
        const mapped: Partial<Record<FieldKey, string>> = {};
        for (const key of ['subjectId', 'topic', 'modality'] as const) {
          if (caught.fields[key]) mapped[key] = caught.fields[key][0];
        }
        setServerFields(mapped);
        setPending(Object.keys(mapped) as FieldKey[]);
        setSubmitError({ message: caught.message, slotTaken: false });
      } else if (caught instanceof ReservasApiError) {
        setSubmitError({
          message: caught.message,
          slotTaken:
            caught.code === 'SLOT_NOT_AVAILABLE' || caught.code === 'STUDENT_BOOKING_OVERLAP',
        });
      } else {
        setSubmitError({ message: 'No fue posible crear la reserva.', slotTaken: false });
      }
      focusAlert();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <ScreenHeader onBack={onBack} step="Paso 2 de 2 · Reserva" title="Detalles de tu reserva" />

      <section className="card summary">
        <div className="summary__tutor">
          <Avatar name={tutor.fullName} />
          <div>
            <strong>{tutor.fullName}</strong>
            <span className="r-muted">{formatCop(tutor.hourlyRate)} / hora</span>
          </div>
        </div>
        <dl>
          <div>
            <dt>Fecha</dt>
            <dd>{formatLongDate(slot.startAt)}</dd>
          </div>
          <div>
            <dt>Hora</dt>
            <dd>{formatTimeRange(slot.startAt, slot.endAt)}</dd>
          </div>
          <div>
            <dt>Duración</dt>
            <dd>{formatDuration(durationMinutes(slot.startAt, slot.endAt))}</dd>
          </div>
        </dl>
        <button type="button" className="link-btn" onClick={() => onChangeSlot()}>
          Cambiar horario
        </button>
      </section>

      <div ref={alertRef}>
        {pending.length > 0 && (
          <Alert title="Faltan datos por completar">
            <ul>
              {pending.map((field) => (
                <li key={field}>{serverFields[field] ?? FIELD_LABEL[field]}</li>
              ))}
            </ul>
          </Alert>
        )}
        {submitError && pending.length === 0 && (
          <Alert title="No pudimos crear la reserva">
            <p>{submitError.message}</p>
            {submitError.slotTaken && (
              <button
                type="button"
                className="link-btn"
                onClick={() =>
                  onChangeSlot(
                    'Ese horario ya no está disponible porque otra persona lo reservó. Elige otro horario.',
                  )
                }
              >
                Elegir otro horario
              </button>
            )}
          </Alert>
        )}
      </div>

      <form
        className="form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void handleConfirm();
        }}
      >
        <div className={`r-field${fieldError('subjectId') ? ' has-error' : ''}`}>
          <label htmlFor="subject">
            Materia <span aria-hidden="true">*</span>
          </label>
          <select
            id="subject"
            value={subjectId}
            aria-invalid={Boolean(fieldError('subjectId'))}
            onChange={(event) => setSubjectId(event.target.value)}
          >
            <option value="">Selecciona la materia</option>
            {tutor.subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </select>
          {fieldError('subjectId') && <p className="field-error">{fieldError('subjectId')}</p>}
        </div>

        <div className={`r-field${fieldError('topic') ? ' has-error' : ''}`}>
          <label htmlFor="topic">
            Tema o necesidad <span aria-hidden="true">*</span>
          </label>
          <input
            id="topic"
            type="text"
            maxLength={TOPIC_MAX}
            placeholder="Ej. Preparación del parcial de árboles AVL"
            value={topic}
            aria-invalid={Boolean(fieldError('topic'))}
            onChange={(event) => setTopic(event.target.value)}
          />
          {fieldError('topic') && <p className="field-error">{fieldError('topic')}</p>}
        </div>

        <div className="r-field">
          <label htmlFor="description">Detalles adicionales (opcional)</label>
          <textarea
            id="description"
            rows={3}
            maxLength={2000}
            placeholder="Cuéntale al tutor qué temas quieres repasar."
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>

        <fieldset className={`r-field${fieldError('modality') ? ' has-error' : ''}`}>
          <legend>
            Modalidad <span aria-hidden="true">*</span>
          </legend>
          <div className="segmented" role="radiogroup">
            {modalityOptions.map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={modality === option}
                className={modality === option ? 'is-active' : ''}
                onClick={() => setModality(option)}
              >
                {CHOSEN_MODALITY_LABEL[option]}
              </button>
            ))}
          </div>
          {slot.modality !== 'HYBRID' && (
            <p className="hint">Este horario solo está disponible en esta modalidad.</p>
          )}
          {fieldError('modality') && <p className="field-error">{fieldError('modality')}</p>}
        </fieldset>

        <section className="card cost">
          <p className="section-label">Desglose del costo</p>
          <div className="cost__row">
            <span>
              Valor de la sesión
              <small>
                {formatDuration(durationMinutes(slot.startAt, slot.endAt))} ×{' '}
                {formatCop(tutor.hourlyRate)} / hora
              </small>
            </span>
            <strong>{formatCop(price?.subtotal ?? fallbackSubtotal)}</strong>
          </div>
          <div className="cost__row">
            <span>
              Tarifa de servicio TutorLink
              <small>{price ? `${price.platformFeePercent}% de comisión` : 'Calculando…'}</small>
            </span>
            <strong className="accent">{formatCop(price?.platformFee ?? 0)}</strong>
          </div>
          <div className="cost__total">
            <span>TOTAL A PAGAR</span>
            <strong>{formatCop(total)} COP</strong>
          </div>
        </section>

        <ul className="check-list">
          <li>
            <b>Solicitud sin cobro:</b> el tutor debe aceptarla antes de confirmar el pago simulado.
          </li>
          <li>Cancelación gratuita hasta 24 horas antes de la sesión.</li>
          <li>Sin cargos ocultos ni datos bancarios reales (pago simulado).</li>
        </ul>

        <div className={`r-field${fieldError('terms') ? ' has-error' : ''}`}>
          <label className="r-checkbox">
            <input
              type="checkbox"
              checked={terms}
              onChange={(event) => setTerms(event.target.checked)}
            />
            <span>He leído y acepto los términos de servicio y políticas de cancelación.</span>
          </label>
          {fieldError('terms') && <p className="field-error">{fieldError('terms')}</p>}
        </div>

        <BottomBar>
          <button type="submit" className="btn btn--success" disabled={submitting}>
            {submitting ? 'Enviando solicitud…' : `Confirmar reserva · ${formatCop(total)}`}
          </button>
        </BottomBar>
      </form>
    </>
  );
}
