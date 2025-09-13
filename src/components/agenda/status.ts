import type { AppointmentStatus } from '@/types/agenda';

export const statusLabel: Record<AppointmentStatus, string> = {
  agendado: 'Agendado',
  em_curso: 'Em curso',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
};

export const statusDotClass: Record<AppointmentStatus, string> = {
  agendado: 'bg-blue-500',
  em_curso: 'bg-amber-500',
  concluido: 'bg-emerald-500',
  cancelado: 'bg-rose-500',
};
