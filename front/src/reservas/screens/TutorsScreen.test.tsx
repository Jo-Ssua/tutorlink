import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  renderApp,
  sessionUser,
  stubApi,
  waitForHeading,
  withStoredSession,
} from '../../test/renderApp';

const TUTOR_LIST = {
  items: [
    {
      id: 'tutor-1',
      fullName: 'Ana Maria Torres',
      hourlyRate: 45_000,
      averageRating: 4.8,
      reviewCount: 12,
      verificationStatus: 'VERIFIED',
      subjects: [{ id: 'subject-1', code: 'SIS201', name: 'Estructuras de Datos' }],
      nextAvailableAt: '2026-11-07T15:00:00.000Z',
      isAvailable: true,
    },
  ],
  pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
  suggestions: null,
};

const FACULTIES = [{ id: 'faculty-1', name: 'Ingeniería', code: 'ING' }];
const PROGRAMS = [
  { id: 'program-1', name: 'Ingeniería de Sistemas', code: 'SIS', facultyId: 'faculty-1' },
];
const SUBJECTS = [
  { id: 'subject-1', code: 'SIS201', name: 'Estructuras de Datos', programId: 'program-1' },
];
const PROFESSORS = [{ id: 'professor-1', fullName: 'Laura Gómez', programId: 'program-1' }];

/** Dobles del catálogo oficial más la lista de tutores que se quiera probar. */
function stubCatalog(tutors: unknown = TUTOR_LIST) {
  return stubApi({
    '/auth/me': { data: sessionUser('STUDENT') },
    '/catalog/faculties': { data: FACULTIES },
    '/catalog/programs': { data: PROGRAMS },
    '/catalog/subjects': { data: SUBJECTS },
    '/catalog/professors': { data: PROFESSORS },
    '/tutors': { data: tutors },
  });
}

/** Abre el selector por su etiqueta y elige la opción con ese texto. */
async function pickOption(label: string, option: string) {
  await userEvent.click(screen.getByLabelText(label));
  await userEvent.click(await screen.findByRole('option', { name: option }));
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe('búsqueda de tutores', () => {
  it('pide el orden por relevancia mientras no se filtre nada', async () => {
    withStoredSession('STUDENT');
    const { calls } = stubApi({
      '/auth/me': { data: sessionUser('STUDENT') },
      '/tutors': { data: TUTOR_LIST },
    });

    renderApp('/app/reservar');
    await waitForHeading(/Tutores disponibles/);

    const query = calls.find((url) => url.includes('/tutors?'));
    expect(query).toContain('sortBy=RELEVANCE');
    // «Cualquiera» y «Todas» son ausencia de filtro, no un valor que viaje.
    expect(query).not.toContain('minRating');
    expect(query).not.toContain('modality');
  });

  it('manda el texto buscado a la API al aplicar los filtros', async () => {
    withStoredSession('STUDENT');
    const { calls } = stubApi({
      '/auth/me': { data: sessionUser('STUDENT') },
      '/tutors': { data: TUTOR_LIST },
    });

    renderApp('/app/reservar');
    await waitForHeading(/Tutores disponibles/);

    await userEvent.type(screen.getByLabelText('Materia o tutor'), '  cálculo  ');
    await userEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }));

    await waitFor(() =>
      expect(calls.some((url) => url.includes('q=c%C3%A1lculo'))).toBe(true),
    );
  });

  it('muestra en cada tarjeta los datos para comparar tutores', async () => {
    withStoredSession('STUDENT');
    stubApi({
      '/auth/me': { data: sessionUser('STUDENT') },
      '/tutors': { data: TUTOR_LIST },
    });

    renderApp('/app/reservar');
    await waitForHeading(/Tutores disponibles/);

    const card = await screen.findByRole('button', { name: 'Ver el perfil de Ana Maria Torres' });
    expect(within(card).getByText('Ana Maria Torres')).toBeInTheDocument();
    expect(within(card).getByText('Verificado')).toBeInTheDocument();
    expect(within(card).getByText('Estructuras de Datos')).toBeInTheDocument();
    expect(within(card).getByText(/45\.000/)).toBeInTheDocument();
    expect(within(card).getByText('4.8')).toBeInTheDocument();
    expect(within(card).getByText(/calificación promedio/)).toBeInTheDocument();
    expect(within(card).getByText('Disponibilidad')).toBeInTheDocument();
    expect(within(card).getByText(/7 de noviembre/)).toBeInTheDocument();
  });

  it('identifica un perfil sin calificaciones', async () => {
    withStoredSession('STUDENT');
    stubApi({
      '/auth/me': { data: sessionUser('STUDENT') },
      '/tutors': {
        data: {
          ...TUTOR_LIST,
          items: [{ ...TUTOR_LIST.items[0], averageRating: 0, reviewCount: 0 }],
        },
      },
    });

    renderApp('/app/reservar');
    await waitForHeading(/Tutores disponibles/);

    const card = await screen.findByRole('button', { name: 'Ver el perfil de Ana Maria Torres' });
    expect(within(card).getByText('Sin calificaciones')).toBeInTheDocument();
    expect(within(card).queryByText(/calificación promedio/)).not.toBeInTheDocument();
  });

  it('muestra cuando el tutor no tiene disponibilidad', async () => {
    withStoredSession('STUDENT');
    stubApi({
      '/auth/me': { data: sessionUser('STUDENT') },
      '/tutors': {
        data: {
          ...TUTOR_LIST,
          items: [{ ...TUTOR_LIST.items[0], nextAvailableAt: null, isAvailable: false }],
        },
      },
    });

    renderApp('/app/reservar');
    await waitForHeading(/Tutores disponibles/);

    const card = await screen.findByRole('button', { name: 'Ver el perfil de Ana Maria Torres' });
    expect(within(card).getByText('Sin disponibilidad')).toBeInTheDocument();
    expect(within(card).queryByText(/7 de noviembre/)).not.toBeInTheDocument();
  });
});

describe('búsqueda contextual', () => {
  it('manda facultad, programa, materia y profesor a la API', async () => {
    withStoredSession('STUDENT');
    const { calls } = stubCatalog();

    renderApp('/app/reservar');
    await waitForHeading(/Tutores disponibles/);

    await pickOption('Facultad', 'Ingeniería');
    await pickOption('Programa', 'Ingeniería de Sistemas');
    await pickOption('Materia', 'SIS201 · Estructuras de Datos');
    await pickOption('Profesor', 'Laura Gómez');
    await userEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }));

    await waitFor(() => {
      const query = calls.filter((url) => url.includes('/tutors?')).at(-1);
      expect(query).toContain('facultyId=faculty-1');
      expect(query).toContain('programId=program-1');
      expect(query).toContain('subjectId=subject-1');
      expect(query).toContain('professorId=professor-1');
    });
  });

  it('cada lista del catálogo hereda lo ya elegido', async () => {
    withStoredSession('STUDENT');
    const { calls } = stubCatalog();

    renderApp('/app/reservar');
    await waitForHeading(/Tutores disponibles/);

    await pickOption('Facultad', 'Ingeniería');
    await waitFor(() =>
      expect(
        calls.some((url) => url.includes('/catalog/programs?facultyId=faculty-1')),
      ).toBe(true),
    );

    await pickOption('Programa', 'Ingeniería de Sistemas');
    await waitFor(() =>
      expect(
        calls.some(
          (url) => url.includes('/catalog/subjects?') && url.includes('programId=program-1'),
        ),
      ).toBe(true),
    );

    await pickOption('Materia', 'SIS201 · Estructuras de Datos');
    await waitFor(() =>
      expect(
        calls.some(
          (url) => url.includes('/catalog/professors?') && url.includes('subjectId=subject-1'),
        ),
      ).toBe(true),
    );
  });

  it('al cambiar de facultad olvida el programa, la materia y el profesor', async () => {
    withStoredSession('STUDENT');
    const { calls } = stubCatalog();

    renderApp('/app/reservar');
    await waitForHeading(/Tutores disponibles/);

    await pickOption('Facultad', 'Ingeniería');
    await pickOption('Programa', 'Ingeniería de Sistemas');
    await pickOption('Materia', 'SIS201 · Estructuras de Datos');
    await pickOption('Facultad', 'Todas las facultades');
    await userEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }));

    await waitFor(() => {
      const query = calls.filter((url) => url.includes('/tutors?')).at(-1);
      expect(query).not.toContain('facultyId');
      expect(query).not.toContain('programId');
      expect(query).not.toContain('subjectId');
      expect(query).not.toContain('professorId');
    });
  });

  it('sin tutores compatibles sugiere ajustar los filtros o usar StudyMatch', async () => {
    withStoredSession('STUDENT');
    stubCatalog({
      items: [],
      pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
      suggestions: 'No hay tutores compatibles. Ajusta los filtros o usa StudyMatch.',
    });

    renderApp('/app/reservar');
    await waitForHeading(/Tutores disponibles/);

    await pickOption('Facultad', 'Ingeniería');
    await userEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }));

    expect(await screen.findByText(/usa StudyMatch/)).toBeInTheDocument();
  });

  it('conserva los filtros al cambiar el orden', async () => {
    withStoredSession('STUDENT');
    const { calls } = stubCatalog();

    renderApp('/app/reservar');
    await waitForHeading(/Tutores disponibles/);

    await pickOption('Facultad', 'Ingeniería');
    await userEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }));
    await waitFor(() =>
      expect(calls.some((url) => url.includes('facultyId=faculty-1'))).toBe(true),
    );

    await pickOption('Ordenar resultados', 'Mejor calificación');

    await waitFor(() => {
      const query = calls.filter((url) => url.includes('/tutors?')).at(-1);
      expect(query).toContain('sortBy=RATING');
      expect(query).toContain('facultyId=faculty-1');
    });
  });
});
