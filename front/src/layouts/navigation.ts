import {
  CalendarBlankIcon,
  ChartBarIcon,
  GraduationCapIcon,
  LightningIcon,
  MagnifyingGlassIcon,
  StarIcon,
  UserGearIcon,
  type Icon,
} from '@phosphor-icons/react';
import type { Role } from '../types';

export interface NavItem {
  to: string;
  /** Texto corto: también es la etiqueta de la pestaña en móvil. */
  label: string;
  Icon: Icon;
}

/**
 * Destinos de cada rol, en el orden en que aparecen.
 *
 * Solo entran rutas que existen. Un ítem apagado o un destino que redirige le
 * cuenta al usuario qué secciones hay y cuáles no alcanza, que es justo lo que
 * `RoleRoute` evita al redirigir en silencio.
 *
 * Los wireframes de `front/wireframes/low_fidelity/` piden cuatro pestañas por
 * rol (estudiante: Buscar, Reservas, Pagos, Perfil; tutor: Agenda, Solicitudes,
 * Ingresos, Perfil; admin: Tutores, Usuarios, Pagos, Reportes). Cada una se
 * suma aquí cuando su HU tenga pantalla.
 */
const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  STUDENT: [
    { to: '/app/reservar', label: 'Reservar', Icon: MagnifyingGlassIcon },
    { to: '/app/emergencia', label: 'Emergencia', Icon: LightningIcon },
    { to: '/app/calificaciones', label: 'Calificaciones', Icon: StarIcon },
    { to: '/app/postular', label: 'Postularme', Icon: GraduationCapIcon },
  ],
  TUTOR: [
    { to: '/app/tutor', label: 'Mis sesiones', Icon: CalendarBlankIcon },
    { to: '/app/oferta', label: 'Mi oferta', Icon: UserGearIcon },
  ],
  ADMIN: [{ to: '/app/admin', label: 'Administración', Icon: ChartBarIcon }],
};

export function navItemsFor(role: Role | undefined): NavItem[] {
  return role ? NAV_BY_ROLE[role] : [];
}
