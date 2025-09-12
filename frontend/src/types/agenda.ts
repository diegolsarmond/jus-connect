export type AppointmentType = 'reuniao' | 'audiencia' | 'peticao' | 'tarefa' | 'prazo' | 'outro';

export type AppointmentStatus = 'agendado' | 'em_andamento' | 'concluido' | 'cancelado';

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
  location?: string;
  reminders: boolean;
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
  audiencia: { label: 'Audiência', color: 'bg-warning' },
  peticao: { label: 'Lançar Petição', color: 'bg-success' },
  tarefa: { label: 'Tarefa', color: 'bg-accent' },
  prazo: { label: 'Prazo', color: 'bg-destructive' },
  outro: { label: 'Outro', color: 'bg-muted' },
};

export const appointmentStatuses: Record<AppointmentStatus, { label: string; color: string }> = {
  agendado: { label: 'Agendado', color: 'text-primary' },
  em_andamento: { label: 'Em Andamento', color: 'text-warning' },
  concluido: { label: 'Concluído', color: 'text-success' },
  cancelado: { label: 'Cancelado', color: 'text-muted-foreground' },
};