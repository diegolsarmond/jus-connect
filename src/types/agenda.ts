export type AppointmentStatus = 'agendado' | 'em_curso' | 'concluido' | 'cancelado';

export type AppointmentType =
  | 'reuniao'
  | 'visita'
  | 'ligacao'
  | 'prazo'
  | 'outro';

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
