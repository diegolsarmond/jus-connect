export type AppointmentStatus = 'agendado' | 'em_curso' | 'concluido' | 'cancelado';

export type AppointmentType =
  | 'reuniao'
  | 'visita'
  | 'ligacao'
  | 'prazo'
  | 'outro';

export const APPOINTMENT_TYPE_VALUES: AppointmentType[] = [
  'reuniao',
  'visita',
  'ligacao',
  'prazo',
  'outro',
];

export const isValidAppointmentType = (value: unknown): value is AppointmentType =>
  typeof value === 'string' && (APPOINTMENT_TYPE_VALUES as string[]).includes(value);

const removeDiacritics = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const sanitizeTypeString = (value: string) =>
  removeDiacritics(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const collectCandidateTypes = (raw: string): string[] => {
  const candidates = new Set<string>();

  const push = (candidate: string | undefined) => {
    if (candidate) {
      candidates.add(candidate);
    }
  };

  push(raw);

  const segments = raw.split('_').filter(Boolean);
  segments.forEach((segment) => {
    push(segment);
    if (segment.endsWith('oes')) {
      push(segment.replace(/oes$/, 'ao'));
    }
    if (segment.endsWith('s')) {
      push(segment.replace(/s$/, ''));
    }
  });

  if (raw.endsWith('oes')) {
    push(raw.replace(/oes$/, 'ao'));
  }
  if (raw.endsWith('s')) {
    push(raw.replace(/s$/, ''));
  }

  return Array.from(candidates);
};

export const normalizeAppointmentType = (
  value: unknown,
): AppointmentType | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const sanitized = sanitizeTypeString(value);
  if (!sanitized) {
    return undefined;
  }

  const candidates = collectCandidateTypes(sanitized);
  for (const candidate of candidates) {
    if (isValidAppointmentType(candidate)) {
      return candidate;
    }
  }

  return undefined;
};

export interface Appointment {
  id: number;
  title: string;
  description?: string;
  type: AppointmentType;
  typeName?: string;
  status: AppointmentStatus;
  date: Date;
  startTime: string;
  endTime?: string;
  clientId?: string;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  location?: string;
  reminders: boolean;
  notifyClient?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AppointmentFilter {
  type?: AppointmentType;
  status?: AppointmentStatus;
  dateRange?: {
    start: Date;
    end: Date;
  };
  clientId?: string;
}

export const appointmentTypes: Record<AppointmentType, { label: string; color: string }> = {
  reuniao: { label: 'Reunião', color: 'bg-blue-500' },
  visita: { label: 'Visita', color: 'bg-blue-400' },
  ligacao: { label: 'Ligação', color: 'bg-blue-300' },
  prazo: { label: 'Prazo', color: 'bg-blue-600' },
  outro: { label: 'Outro', color: 'bg-blue-200' },
};
