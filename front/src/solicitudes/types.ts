import type { BookingStatus, Modality } from '../types';

/**
 * Tipos del panel de solicitudes del tutor (`/tutor/requests/dashboard`). Viven
 * aparte de `types.ts` para que esta funcionalidad no toque los archivos
 * compartidos.
 */

export interface RequestItem {
  id: string;
  /** Alias anonimo del estudiante: la API nunca entrega su identidad. */
  studentAlias: string;
  subject: { id: string; code: string; name: string };
  topic: string;
  description: string | null;
  startAt: string;
  endAt: string;
  durationMinutes: number;
  modality: Modality;
  status: BookingStatus;
  /** Tarifa por hora pactada. */
  rate: number;
  /** Valor de la sesion para el tutor, sin la comision de la plataforma. */
  subtotal: number;
  total: number;
  isEmergency: boolean;
  cancellationReason: string | null;
  createdAt: string;
  /** Pendiente y con la hora todavia por venir: solo entonces se puede aceptar. */
  canRespond: boolean;
}

export interface RequestsDashboard {
  counts: { pending: number; accepted: number; rejected: number; upcoming: number };
  pending: RequestItem[];
  accepted: RequestItem[];
  rejected: RequestItem[];
  upcoming: RequestItem[];
}

export interface RespondResult {
  message: string;
}
