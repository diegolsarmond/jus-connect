export type AppointmentStatus = 'agendado' | 'em_curso' | 'concluido' | 'cancelado';

export type AppointmentType =
  | 'reuniao'
  | 'visita'
  | 'ligacao'
  | 'prazo'
  | 'outro';

export interface Appointment {
  id: string;
  title: string;
  description?: string;
  type: AppointmentType;
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
  reuniao: { label: 'Reunião', color: 'bg-primary' },
  visita: { label: 'Visita', color: 'bg-secondary' },
  ligacao: { label: 'Ligação', color: 'bg-success' },
  prazo: { label: 'Prazo', color: 'bg-destructive' },
  outro: { label: 'Outro', color: 'bg-muted' },
};