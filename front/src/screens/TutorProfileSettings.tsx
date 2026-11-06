import {
  Button,
  Card,
  Checkbox,
  Chip,
  Description,
  Input,
  Label,
  ListBox,
  Select,
  TextArea,
  TextField,
} from '@heroui/react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  ApiError,
  addTutorSubject,
  createTutorAvailability,
  deleteTutorAvailability,
  getTutorOwnProfile,
  listCatalogSubjects,
  listTutorAvailability,
  removeTutorSubject,
  updateTutorAvailability,
  updateTutorOwnProfile,
} from '../api';
import { FormError, FormNotice } from '../components/FormFeedback';
import { LoadError } from '../components/LoadError';
import { toFriendlyError, type FriendlyError } from '../errors';
import type { CatalogSubject, Modality, TutorOwnProfile, VerificationStatus } from '../types';
import type { AvailabilitySlot } from '../reservas/types';

const MODALITY_LABEL: Record<Modality, string> = {
  IN_PERSON: 'Presencial',
  VIRTUAL: 'Virtual',
  HYBRID: 'Híbrida',
};

const STATUS_LABEL: Record<VerificationStatus, string> = {
  PENDING: 'Pendiente',
  VERIFIED: 'Verificada',
  REJECTED: 'Rechazada',
};

const MODALITIES = Object.keys(MODALITY_LABEL) as Modality[];

const dateTimeFormatter = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

/** `datetime-local` solo acepta hora local sin zona: `YYYY-MM-DDTHH:mm`. */
function toLocalInput(value: string) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

/**
 * Configuración de la oferta del tutor (SCRUM-15): perfil público, materias y
 * horarios disponibles.
 *
 * Las ediciones solo se habilitan con el perfil verificado, igual que en el
 * backend; lo que está bloqueado se marca con `isDisabled`, no se esconde, para
 * que se entienda que existe y por qué no se puede usar todavía.
 */
export function TutorProfileSettings() {
  const [profile, setProfile] = useState<TutorOwnProfile | null>(null);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [catalog, setCatalog] = useState<CatalogSubject[]>([]);
  const [search, setSearch] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [bio, setBio] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [modalities, setModalities] = useState<Modality[]>([]);
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [slotModality, setSlotModality] = useState<Modality>('VIRTUAL');
  const [editingSlot, setEditingSlot] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<FriendlyError | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<FriendlyError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [own, availability] = await Promise.all([getTutorOwnProfile(), listTutorAvailability()]);
    setProfile(own);
    setSlots(availability);
    setBio(own.bio ?? '');
    setHourlyRate(String(own.hourlyRate));
    setModalities(own.modalities);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      await refresh();
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'SESSION_EXPIRED') return;
      setLoadError(toFriendlyError(caught));
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(action: () => Promise<void>, successMessage: string) {
    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      await action();
      setNotice(successMessage);
      await refresh();
    } catch (caught) {
      setError(toFriendlyError(caught));
    } finally {
      setSaving(false);
    }
  }

  async function searchSubjects(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    try {
      setCatalog(await listCatalogSubjects(search));
    } catch (caught) {
      setError(toFriendlyError(caught));
    }
  }

  function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(async () => {
      await updateTutorOwnProfile({
        bio,
        hourlyRate: Number(hourlyRate),
        modalities,
      });
    }, 'Perfil actualizado. Los cambios ya se reflejan en tu perfil público.');
  }

  function saveSlot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(
      async () => {
        const payload = {
          startAt: new Date(startAt).toISOString(),
          endAt: new Date(endAt).toISOString(),
          modality: slotModality,
        };
        if (editingSlot) await updateTutorAvailability(editingSlot, payload);
        else await createTutorAvailability(payload);
        setStartAt('');
        setEndAt('');
        setEditingSlot(null);
      },
      editingSlot ? 'Horario actualizado.' : 'Horario agregado.',
    );
  }

  if (loading) {
    return (
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
        <p className="text-muted" role="status">
          Cargando la configuración de tu perfil...
        </p>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
        <h1 className="text-2xl font-bold text-balance text-foreground sm:text-3xl">
          No encontramos tu perfil de tutor
        </h1>
        <p className="text-muted">Esta cuenta todavía no tiene un perfil de tutor asociado.</p>
        {loadError && <LoadError error={loadError} onRetry={() => void load()} />}
      </main>
    );
  }

  const verified = profile.verificationStatus === 'VERIFIED';
  const locked = !verified || saving;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">Mi oferta</p>
          <h1 className="text-2xl font-bold text-balance text-foreground sm:text-3xl">
            Configuración del perfil
          </h1>
          <p className="text-muted">
            Actualiza tu perfil público, tus materias y los horarios que ofreces.
          </p>
        </div>
        <Chip className="self-start sm:self-auto" color={verified ? 'success' : 'warning'}>
          {verified
            ? 'Tutor verificado'
            : `Verificación ${STATUS_LABEL[profile.verificationStatus].toLowerCase()}`}
        </Chip>
      </section>

      {loadError && <LoadError error={loadError} onRetry={() => void load()} />}
      <FormError error={error} />
      {notice && <FormNotice>{notice}</FormNotice>}

      {!verified && (
        <FormNotice status="accent">
          {`Las ediciones se habilitan cuando tu perfil esté verificado.${
            profile.rejectionReason ? ` Motivo: ${profile.rejectionReason}` : ''
          }`}
        </FormNotice>
      )}

      <Card>
        <Card.Header>
          <Card.Title>Información del perfil</Card.Title>
        </Card.Header>
        <Card.Content>
          <form className="flex flex-col gap-4" onSubmit={saveProfile}>
            <TextField fullWidth value={bio} onChange={setBio} isDisabled={!verified}>
              <Label>Biografía</Label>
              <TextArea rows={4} maxLength={2000} />
              <Description>La ven los estudiantes en tu perfil público.</Description>
            </TextField>

            <TextField
              fullWidth
              isRequired
              value={hourlyRate}
              onChange={setHourlyRate}
              isDisabled={!verified}
            >
              <Label>Tarifa por hora (COP)</Label>
              <Input type="number" min={0} max={10_000_000} step={1000} inputMode="numeric" />
            </TextField>

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-semibold text-foreground">Modalidades</legend>
              {MODALITIES.map((modality) => (
                <Checkbox
                  key={modality}
                  isSelected={modalities.includes(modality)}
                  isDisabled={!verified}
                  onChange={(selected) =>
                    setModalities((current) =>
                      selected
                        ? [...current, modality]
                        : current.filter((item) => item !== modality),
                    )
                  }
                >
                  <Checkbox.Content>
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                    {MODALITY_LABEL[modality]}
                  </Checkbox.Content>
                </Checkbox>
              ))}
            </fieldset>

            <Button
              type="submit"
              className="self-start"
              isDisabled={locked || modalities.length === 0}
            >
              {saving ? 'Guardando...' : 'Guardar perfil'}
            </Button>
          </form>
        </Card.Content>
      </Card>

      <Card>
        <Card.Header>
          <Card.Title>Materias</Card.Title>
        </Card.Header>
        <Card.Content className="gap-5">
          <ul className="flex flex-col gap-3">
            {profile.subjects.map((link) => (
              <li
                key={link.id}
                className="flex flex-row items-center justify-between gap-3 rounded-xl border border-border p-3"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <strong className="text-foreground">{link.subject.name}</strong>
                  <small className="text-muted">
                    {link.subject.code} · {STATUS_LABEL[link.status]}
                  </small>
                  {link.rejectionReason && (
                    <small className="text-danger">{link.rejectionReason}</small>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="tertiary"
                  isDisabled={locked}
                  onPress={() =>
                    void run(() => removeTutorSubject(link.id), 'Materia retirada del perfil.')
                  }
                >
                  Retirar
                </Button>
              </li>
            ))}
            {profile.subjects.length === 0 && (
              <li className="text-sm text-muted">Todavía no tienes materias en tu perfil.</li>
            )}
          </ul>

          <form className="flex flex-col gap-3" onSubmit={searchSubjects}>
            <TextField fullWidth value={search} onChange={setSearch}>
              <Label>Buscar en el catálogo oficial</Label>
              <Input placeholder="Nombre o código de la materia" />
            </TextField>
            <Button type="submit" variant="secondary" className="self-start">
              Buscar materias
            </Button>
          </form>

          {catalog.length > 0 && (
            <ul className="flex flex-col gap-3" aria-label="Resultados del catálogo">
              {catalog.map((subject) => (
                <li
                  key={subject.id}
                  className="flex flex-row items-center justify-between gap-3 rounded-xl border border-border p-3"
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <strong className="text-foreground">{subject.name}</strong>
                    <small className="text-muted">
                      {subject.code} · {subject.program?.name}
                    </small>
                  </div>
                  <Button
                    size="sm"
                    isDisabled={
                      locked || profile.subjects.some((link) => link.subject.id === subject.id)
                    }
                    onPress={() =>
                      void run(
                        () => addTutorSubject(subject.id, evidenceUrl),
                        'Materia agregada y pendiente de validación.',
                      )
                    }
                  >
                    Agregar
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <TextField fullWidth value={evidenceUrl} onChange={setEvidenceUrl} isDisabled={!verified}>
            <Label>Enlace de evidencia</Label>
            <Input type="url" maxLength={500} placeholder="https://..." />
            <Description>
              Adjunta la evidencia de aprobación. Sin ese enlace, o sin la nota y el semestre, la
              materia no se puede registrar.
            </Description>
          </TextField>
        </Card.Content>
      </Card>

      <Card>
        <Card.Header>
          <Card.Title>Disponibilidad</Card.Title>
        </Card.Header>
        <Card.Content className="gap-5">
          <form className="flex flex-col gap-4" onSubmit={saveSlot}>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                fullWidth
                isRequired
                value={startAt}
                onChange={setStartAt}
                isDisabled={!verified}
              >
                <Label>Inicio</Label>
                <Input type="datetime-local" />
              </TextField>

              <TextField
                fullWidth
                isRequired
                value={endAt}
                onChange={setEndAt}
                isDisabled={!verified}
              >
                <Label>Fin</Label>
                <Input type="datetime-local" />
              </TextField>
            </div>

            <Select
              fullWidth
              value={slotModality}
              isDisabled={!verified}
              onChange={(value) => setSlotModality(value as Modality)}
            >
              <Label>Modalidad</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {MODALITIES.map((modality) => (
                    <ListBox.Item key={modality} id={modality} textValue={MODALITY_LABEL[modality]}>
                      {MODALITY_LABEL[modality]}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>

            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" isDisabled={locked}>
                {editingSlot ? 'Guardar horario' : 'Agregar horario'}
              </Button>
              {editingSlot && (
                <Button
                  type="button"
                  variant="tertiary"
                  onPress={() => {
                    setEditingSlot(null);
                    setStartAt('');
                    setEndAt('');
                  }}
                >
                  Cancelar edición
                </Button>
              )}
            </div>
          </form>

          <ul className="flex flex-col gap-3">
            {slots.map((slot) => (
              <li
                key={slot.id}
                className="flex flex-col gap-3 rounded-xl border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <strong className="text-foreground">
                    {dateTimeFormatter.format(new Date(slot.startAt))}
                  </strong>
                  <small className="text-muted">
                    {MODALITY_LABEL[slot.modality]} · {slot.status}
                  </small>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="tertiary"
                    isDisabled={locked || slot.status !== 'AVAILABLE'}
                    onPress={() => {
                      setEditingSlot(slot.id);
                      setStartAt(toLocalInput(slot.startAt));
                      setEndAt(toLocalInput(slot.endAt));
                      setSlotModality(slot.modality);
                    }}
                  >
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="tertiary"
                    isDisabled={locked}
                    onPress={() =>
                      void run(
                        () => deleteTutorAvailability(slot.id),
                        'Horario retirado o bloqueado.',
                      )
                    }
                  >
                    Retirar
                  </Button>
                </div>
              </li>
            ))}
            {slots.length === 0 && (
              <li className="text-sm text-muted">Aún no tienes horarios registrados.</li>
            )}
          </ul>
        </Card.Content>
      </Card>
    </main>
  );
}
