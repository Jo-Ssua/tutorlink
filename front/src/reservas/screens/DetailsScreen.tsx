import {
  Button,
  Card,
  Checkbox,
  Description,
  FieldError,
  Input,
  Label,
  ListBox,
  Radio,
  RadioGroup,
  Select,
  TextArea,
  TextField,
} from '@heroui/react';
import { CheckCircleIcon } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { ApiError } from '../../api';
import { FormError } from '../../components/FormFeedback';
import { createBooking, quoteBooking } from '../api';
import { ActionBar, Avatar, FlowAlert, ScreenHeader } from '../components/ui';
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

  const [subjectId, setSubjectId] = useState(
    tutor.subjects.length === 1 ? tutor.subjects[0].id : '',
  );
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

  useEffect(() => {
    quoteBooking(tutor.id, slot.id)
      .then((result) => setPrice(result.price))
      .catch(() => setPrice(null));
  }, [tutor.id, slot.id]);

  const fallbackSubtotal = (tutor.hourlyRate * durationMinutes(slot.startAt, slot.endAt)) / 60;
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
    return field === 'terms'
      ? 'Debes aceptar los términos para continuar.'
      : 'Este campo es obligatorio.';
  }

  async function handleConfirm() {
    setSubmitError(null);
    setServerFields({});
    const missing = findPending();
    setPending(missing);

    if (missing.length > 0) return;

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
      if (caught instanceof ApiError && caught.fields && Object.keys(caught.fields).length > 0) {
        const mapped: Partial<Record<FieldKey, string>> = {};
        for (const key of ['subjectId', 'topic', 'modality'] as const) {
          if (caught.fields[key]) mapped[key] = caught.fields[key][0];
        }
        setServerFields(mapped);
        setPending(Object.keys(mapped) as FieldKey[]);
        setSubmitError({ message: caught.message, slotTaken: false });
      } else if (caught instanceof ApiError) {
        setSubmitError({
          message: caught.message,
          slotTaken:
            caught.code === 'SLOT_NOT_AVAILABLE' || caught.code === 'STUDENT_BOOKING_OVERLAP',
        });
      } else {
        setSubmitError({ message: 'No fue posible crear la reserva.', slotTaken: false });
      }
    } finally {
      setSubmitting(false);
    }
  }

  // El resumen de errores toma el foco al aparecer (`FormError`), así que la
  // lista de lo que falta se arma con el mismo formato que el resto de la app.
  const summary =
    pending.length > 0
      ? {
          message: 'Faltan datos por completar',
          details: pending.map((field) => serverFields[field] ?? FIELD_LABEL[field]),
        }
      : submitError
        ? { message: submitError.message, details: [] }
        : null;

  return (
    <>
      <ScreenHeader
        onBack={onBack}
        backLabel="Horarios"
        step={{ current: 2, total: 2 }}
        title="Detalles de tu reserva"
      />

      <Card>
        <Card.Content className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <Avatar name={tutor.fullName} />
            <div className="flex flex-col">
              <strong className="text-foreground">{tutor.fullName}</strong>
              <span className="text-sm text-muted">{formatCop(tutor.hourlyRate)} / hora</span>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs font-semibold tracking-wide text-muted uppercase">Fecha</dt>
              <dd className="text-sm text-foreground">{formatLongDate(slot.startAt)}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs font-semibold tracking-wide text-muted uppercase">Hora</dt>
              <dd className="text-sm text-foreground">
                {formatTimeRange(slot.startAt, slot.endAt)}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs font-semibold tracking-wide text-muted uppercase">Duración</dt>
              <dd className="text-sm text-foreground">
                {formatDuration(durationMinutes(slot.startAt, slot.endAt))}
              </dd>
            </div>
          </dl>

          <Button
            className="-ml-2 self-start"
            size="sm"
            variant="tertiary"
            onPress={() => onChangeSlot()}
          >
            Cambiar horario
          </Button>
        </Card.Content>
      </Card>

      <FormError error={summary} />

      {submitError?.slotTaken && pending.length === 0 && (
        <FlowAlert
          status="warning"
          title="Ese horario ya no está libre"
          action={
            <Button
              size="sm"
              variant="tertiary"
              onPress={() =>
                onChangeSlot(
                  'Ese horario ya no está disponible porque otra persona lo reservó. Elige otro horario.',
                )
              }
            >
              Elegir otro
            </Button>
          }
        >
          Otra persona tomó esta franja mientras llenabas el formulario.
        </FlowAlert>
      )}

      <form
        className="flex flex-col gap-5"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void handleConfirm();
        }}
      >
        <Select
          isRequired
          fullWidth
          name="subjectId"
          placeholder="Selecciona la materia"
          value={subjectId || null}
          isInvalid={Boolean(fieldError('subjectId'))}
          onChange={(value) => setSubjectId(value ? String(value) : '')}
        >
          <Label>Materia</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {tutor.subjects.map((subject) => (
                <ListBox.Item key={subject.id} id={subject.id} textValue={subject.name}>
                  {subject.name}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
          {fieldError('subjectId') && <FieldError>{fieldError('subjectId')}</FieldError>}
        </Select>

        <TextField
          isRequired
          fullWidth
          name="topic"
          value={topic}
          onChange={setTopic}
          isInvalid={Boolean(fieldError('topic'))}
        >
          <Label>Tema o necesidad</Label>
          <Input maxLength={TOPIC_MAX} placeholder="Ej. Preparación del parcial de árboles AVL" />
          {fieldError('topic') && <FieldError>{fieldError('topic')}</FieldError>}
        </TextField>

        <TextField fullWidth name="description" value={description} onChange={setDescription}>
          <Label>Detalles adicionales (opcional)</Label>
          <TextArea
            rows={3}
            maxLength={2000}
            placeholder="Cuéntale al tutor qué temas quieres repasar."
          />
          <Description>El tutor lo ve antes de aceptar la solicitud.</Description>
        </TextField>

        <RadioGroup
          isRequired
          orientation="horizontal"
          value={modality}
          isInvalid={Boolean(fieldError('modality'))}
          onChange={(value) => setModality(value as ChosenModality)}
        >
          <Label>Modalidad</Label>
          {modalityOptions.map((option) => (
            <Radio key={option} value={option}>
              <Radio.Content>
                <Radio.Control>
                  <Radio.Indicator />
                </Radio.Control>
                {CHOSEN_MODALITY_LABEL[option]}
              </Radio.Content>
            </Radio>
          ))}
          {slot.modality !== 'HYBRID' && (
            <Description>Este horario solo está disponible en esta modalidad.</Description>
          )}
          {fieldError('modality') && <FieldError>{fieldError('modality')}</FieldError>}
        </RadioGroup>

        <Card>
          <Card.Content className="flex flex-col gap-3">
            <p className="text-xs font-semibold tracking-wide text-muted uppercase">
              Desglose del costo
            </p>
            <div className="flex items-start justify-between gap-4">
              <span className="flex flex-col text-sm text-foreground">
                Valor de la sesión
                <small className="text-muted">
                  {formatDuration(durationMinutes(slot.startAt, slot.endAt))} ×{' '}
                  {formatCop(tutor.hourlyRate)} / hora
                </small>
              </span>
              <strong className="tabular-nums">
                {formatCop(price?.subtotal ?? fallbackSubtotal)}
              </strong>
            </div>
            <div className="flex items-start justify-between gap-4">
              <span className="flex flex-col text-sm text-foreground">
                Tarifa de servicio TutorLink
                <small className="text-muted">
                  {price ? `${price.platformFeePercent}% de comisión` : 'Calculando...'}
                </small>
              </span>
              <strong className="text-accent tabular-nums">
                {formatCop(price?.platformFee ?? 0)}
              </strong>
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-border pt-3">
              <span className="text-xs font-semibold tracking-wide text-muted uppercase">
                Total a pagar
              </span>
              <strong className="text-lg tabular-nums">{formatCop(total)} COP</strong>
            </div>
          </Card.Content>
        </Card>

        <ul className="flex flex-col gap-2 text-sm text-muted">
          <li className="flex items-start gap-2">
            <CheckCircleIcon aria-hidden="true" className="mt-0.5 shrink-0 text-success" />
            <span>
              <b className="text-foreground">Solicitud sin cobro:</b> el tutor debe aceptarla antes
              de confirmar el pago simulado.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircleIcon aria-hidden="true" className="mt-0.5 shrink-0 text-success" />
            <span>Cancelación gratuita hasta 24 horas antes de la sesión.</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircleIcon aria-hidden="true" className="mt-0.5 shrink-0 text-success" />
            <span>Sin cargos ocultos ni datos bancarios reales (pago simulado).</span>
          </li>
        </ul>

        <Checkbox
          name="terms"
          isSelected={terms}
          isInvalid={Boolean(fieldError('terms'))}
          onChange={setTerms}
        >
          <Checkbox.Content>
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
            He leído y acepto los términos de servicio y políticas de cancelación.
          </Checkbox.Content>
          {fieldError('terms') && <FieldError>{fieldError('terms')}</FieldError>}
        </Checkbox>

        <ActionBar>
          <Button type="submit" isDisabled={submitting}>
            {submitting ? 'Enviando solicitud...' : `Confirmar reserva · ${formatCop(total)}`}
          </Button>
        </ActionBar>
      </form>
    </>
  );
}
