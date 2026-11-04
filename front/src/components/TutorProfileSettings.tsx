import { useEffect, useState, type FormEvent } from 'react';
import {
  addTutorSubject,
  createTutorAvailability,
  deleteTutorAvailability as removeAvailability,
  getTutorOwnProfile,
  listCatalogSubjects,
  listTutorAvailability,
  removeTutorSubject,
  updateTutorAvailability,
  updateTutorOwnProfile,
  ApiError,
} from '../api';
import type { Modality, TutorOwnProfile } from '../types';
import type { AvailabilitySlot } from '../reservas/types';

const modalityLabels: Record<Modality, string> = {
  IN_PERSON: 'Presencial',
  VIRTUAL: 'Virtual',
  HYBRID: 'Híbrida',
};

function toLocalInput(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function statusLabel(status: string) {
  return status === 'VERIFIED' ? 'Verificada' : status === 'REJECTED' ? 'Rechazada' : 'Pendiente';
}

export function TutorProfileSettings() {
  const [profile, setProfile] = useState<TutorOwnProfile | null>(null);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [catalog, setCatalog] = useState<Array<{ id: string; code: string; name: string; program: { name: string } }>>([]);
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function refresh() {
    const [own, availability] = await Promise.all([getTutorOwnProfile(), listTutorAvailability()]);
    setProfile(own);
    setSlots(availability);
    setBio(own.bio ?? '');
    setHourlyRate(String(own.hourlyRate));
    setModalities(own.modalities);
  }

  useEffect(() => {
    refresh().catch((caught: unknown) => setError(caught instanceof ApiError ? caught.message : 'No se pudo cargar el perfil.'))
      .finally(() => setLoading(false));
  }, []);

  async function run(action: () => Promise<void>, successMessage: string) {
    setSaving(true); setError(null); setNotice(null);
    try { await action(); setNotice(successMessage); await refresh(); }
    catch (caught) { setError(caught instanceof ApiError ? caught.message : 'No se pudo guardar el cambio.'); }
    finally { setSaving(false); }
  }

  async function searchSubjects(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(null);
    try { setCatalog(await listCatalogSubjects(search)); }
    catch (caught) { setError(caught instanceof ApiError ? caught.message : 'No se pudo consultar el catálogo.'); }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await run(async () => { await updateTutorOwnProfile({ bio, hourlyRate: Number(hourlyRate), modalities }); }, 'Perfil actualizado. Los cambios ya se reflejan en tu perfil público.');
  }

  async function saveSlot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await run(async () => {
      const payload = { startAt: new Date(startAt).toISOString(), endAt: new Date(endAt).toISOString(), modality: slotModality };
      if (editingSlot) await updateTutorAvailability(editingSlot, payload); else await createTutorAvailability(payload);
      setStartAt(''); setEndAt(''); setEditingSlot(null);
    }, editingSlot ? 'Horario actualizado.' : 'Horario agregado.');
  }

  if (loading) return <main className="dashboard"><p role="status">Cargando configuración del perfil…</p></main>;
  if (!profile) return <main className="dashboard"><section className="panel panel--center"><h1>No encontramos tu perfil de tutor</h1><p>Necesitas tener un perfil de tutor asociado a esta cuenta.</p>{error && <p className="tutor-settings__error">{error}</p>}</section></main>;

  const verified = profile.verificationStatus === 'VERIFIED';
  return <main className="dashboard tutor-settings">
    <section className="hero"><div><p className="eyebrow">Mi oferta</p><h1>Configuración del perfil</h1><p className="hero__text">Actualiza tu perfil público, materias y horarios disponibles.</p></div>
      <span className={`tutor-settings__badge ${verified ? 'is-verified' : ''}`}>{verified ? 'Tutor verificado' : `Verificación ${statusLabel(profile.verificationStatus).toLowerCase()}`}</span>
    </section>
    {error && <div className="alert alert--error" role="alert">{error}</div>}
    {notice && <div className="alert alert--success" role="status">{notice}</div>}
    {!verified && <div className="alert alert--info">Las ediciones se habilitan cuando tu perfil esté verificado.{profile.rejectionReason ? ` Motivo: ${profile.rejectionReason}` : ''}</div>}

    <section className="panel tutor-settings__panel"><h2>Información del perfil</h2><form className="tutor-settings__form" onSubmit={saveProfile}>
      <label>Biografía<textarea maxLength={2000} rows={4} value={bio} onChange={(e) => setBio(e.target.value)} disabled={!verified} /></label>
      <label>Tarifa por hora (COP)<input type="number" min="0" max="10000000" step="1000" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} disabled={!verified} required /></label>
      <fieldset><legend>Modalidades</legend><div className="tutor-settings__checks">{(Object.keys(modalityLabels) as Modality[]).map((modality) => <label key={modality}><input type="checkbox" checked={modalities.includes(modality)} disabled={!verified} onChange={(e) => setModalities(e.target.checked ? [...modalities, modality] : modalities.filter((item) => item !== modality))} />{modalityLabels[modality]}</label>)}</div></fieldset>
      <button className="button button--primary" disabled={!verified || saving || modalities.length === 0}>{saving ? 'Guardando…' : 'Guardar perfil'}</button>
    </form></section>

    <section className="panel tutor-settings__panel"><h2>Materias</h2><ul className="tutor-settings__subjects">{profile.subjects.map((link) => <li key={link.id}><div><strong>{link.subject.name}</strong><small>{link.subject.code} · {statusLabel(link.status)}</small>{link.rejectionReason && <small className="tutor-settings__error">{link.rejectionReason}</small>}</div><button className="button button--ghost button--small" disabled={!verified || saving} onClick={() => void run(() => removeTutorSubject(link.id), 'Materia retirada del perfil.')}>Retirar</button></li>)}</ul>
      <form className="tutor-settings__form" onSubmit={searchSubjects}><label>Buscar en catálogo oficial<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nombre o código de materia" /></label><button className="button button--ghost" type="submit">Buscar materias</button></form>
      {catalog.length > 0 && <ul className="tutor-settings__catalog">{catalog.map((subject) => <li key={subject.id}><span><strong>{subject.name}</strong><small>{subject.code} · {subject.program?.name}</small></span><button className="button button--primary button--small" disabled={!verified || saving || profile.subjects.some((link) => link.subject.id === subject.id)} onClick={() => void run(() => addTutorSubject(subject.id, evidenceUrl), 'Materia agregada y pendiente de validación.')}>Agregar</button></li>)}</ul>}
      <label className="tutor-settings__evidence">Enlace de evidencia (opcional)<input type="url" maxLength={500} value={evidenceUrl} onChange={(e) => setEvidenceUrl(e.target.value)} placeholder="https://…" disabled={!verified} /></label>
      <p className="muted">Las nuevas materias se validan con el catálogo oficial y quedan pendientes de aprobación.</p>
    </section>

    <section className="panel tutor-settings__panel"><h2>Disponibilidad</h2><form className="tutor-settings__form tutor-settings__schedule" onSubmit={saveSlot}>
      <label>Inicio<input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} required disabled={!verified} /></label><label>Fin<input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} required disabled={!verified} /></label><label>Modalidad<select value={slotModality} onChange={(e) => setSlotModality(e.target.value as Modality)} disabled={!verified}>{Object.entries(modalityLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><button className="button button--primary" disabled={!verified || saving}>{editingSlot ? 'Guardar horario' : 'Agregar horario'}</button>{editingSlot && <button type="button" className="button button--ghost" onClick={() => { setEditingSlot(null); setStartAt(''); setEndAt(''); }}>Cancelar edición</button>}
    </form><ul className="tutor-settings__slots">{slots.map((slot) => <li key={slot.id}><span><strong>{new Date(slot.startAt).toLocaleString('es-CO')}</strong><small>{modalityLabels[slot.modality]} · {slot.status}</small></span><div><button className="button button--ghost button--small" disabled={!verified || saving || slot.status !== 'AVAILABLE'} onClick={() => { setEditingSlot(slot.id); setStartAt(toLocalInput(slot.startAt)); setEndAt(toLocalInput(slot.endAt)); setSlotModality(slot.modality); }}>Editar</button><button className="button button--ghost button--small" disabled={!verified || saving} onClick={() => void run(() => removeAvailability(slot.id), 'Horario retirado o bloqueado.')}>Retirar</button></div></li>)}</ul>{slots.length === 0 && <p className="muted">Aún no tienes horarios registrados.</p>}</section>
  </main>;
}
