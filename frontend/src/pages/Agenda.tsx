import React, { useEffect, useState } from 'react';
import { Calendar, Plus } from 'lucide-react';
import { getApiBaseUrl } from '@/lib/api';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { AgendaCalendar } from '@/components/agenda/AgendaCalendar';
import { AppointmentForm } from '@/components/agenda/AppointmentForm';
import { AppointmentList } from '@/components/agenda/AppointmentList';
import { statusDotClass, statusLabel } from '@/components/agenda/status';
import {
  Appointment,
  AppointmentType,
  AppointmentStatus,
  appointmentTypes,
  normalizeAppointmentType,
} from '@/types/agenda';

const apiUrl = getApiBaseUrl();

function joinUrl(base: string, path = '') {
  const b = base.replace(/\/+$/, '');
  const p = path ? (path.startsWith('/') ? path : `/${path}`) : '';
  return `${b}${p}`;
}

function normalizeTimeString(time?: string | null): string | undefined {
  if (typeof time !== 'string') {
    return undefined;
  }

  const trimmed = time.trim();
  if (!trimmed) {
    return undefined;
  }

  const colonParts = trimmed.split(':');
  if (colonParts.length >= 2) {
    const hoursPart = colonParts[0] ?? '';
    const minutesPart = colonParts[1] ?? '';

    const hours = hoursPart.padStart(2, '0').slice(-2);
    const minutes = minutesPart.padStart(2, '0').slice(0, 2);

    return `${hours}:${minutes}`;
  }

  const digits = trimmed.replace(/\D/g, '');
  if (!digits) {
    return undefined;
  }

  let hoursDigits: string;
  let minutesDigits: string;

  if (digits.length <= 2) {
    hoursDigits = digits;
    minutesDigits = '00';
  } else if (digits.length === 3) {
    hoursDigits = digits.slice(0, 1);
    minutesDigits = digits.slice(1);
  } else {
    hoursDigits = digits.slice(0, 2);
    minutesDigits = digits.slice(2, 4);
  }

  const hours = hoursDigits.padStart(2, '0').slice(-2);
  const minutes = minutesDigits.padEnd(2, '0').slice(0, 2);

  return `${hours}:${minutes}`;
}

function ensureTimeString(time?: string | null): string {
  return normalizeTimeString(time) ?? (typeof time === 'string' ? time.trim() : '');
}

export default function Agenda() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formInitialDate, setFormInitialDate] = useState<Date>();
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [viewingAppointment, setViewingAppointment] = useState<Appointment | null>(null);
  const [appointmentToCancel, setAppointmentToCancel] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchAppointments = async () => {
      setLoading(true);
      try {
        const url = joinUrl(apiUrl, '/api/agendas');
        const response = await fetch(url, { headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error('Failed to load agendas');

        const json = await response.json();

        // aceita array direto ou objetos { data: [...] } / { rows: [...] } / { agendas: [...] }
        const rows: unknown[] =
          Array.isArray(json) ? json :
          Array.isArray(json?.data) ? json.data :
          Array.isArray(json?.rows) ? json.rows :
          Array.isArray(json?.agendas) ? json.agendas : [];

        interface AgendaResponse {
          id: number | string;
          titulo: string;
          id_evento?: number;        // id do tipo (se houver)
          tipo?: number;             // compat
          tipo_evento?: string;      // nome do tipo (se houver)
          descricao?: string;
          data: string;              // "YYYY-MM-DD" ou ISO
          hora_inicio: string;
          hora_fim?: string;
          cliente:  string;
          local?: string;
          lembrete: boolean | number | string;
          status: number | string;   // 0..3 ou string
          datacadastro?: string;
        }

        // Mapa de id->nome do tipo (AppointmentType)
        const typeMap = new Map<number, AppointmentType>();
        try {
          const tiposRes = await fetch(joinUrl(apiUrl, '/api/tipo-eventos'), {
            headers: { Accept: 'application/json' },
          });
          if (tiposRes.ok) {
            const tipoJson = await tiposRes.json();
            const tipoRows = Array.isArray(tipoJson)
              ? tipoJson
              : Array.isArray(tipoJson?.data)
                ? tipoJson.data
                : [];
            tipoRows.forEach((t: { id: number; nome: string }) => {
              const normalized = normalizeAppointmentType(t?.nome);
              if (normalized) typeMap.set(t.id, normalized);
            });
          }
        } catch (error) {
          console.error('Erro ao carregar tipos de evento:', error);
        }

        const mapStatus = (statusAgenda: unknown): AppointmentStatus => {
          const n = Number(statusAgenda);
          if (!Number.isNaN(n)) {
            if (n === 0) return 'cancelado';
            if (n === 1) return 'agendado';
            if (n === 2) return 'em_curso';
            if (n === 3) return 'concluido';
          }
          if (
            statusAgenda === 'agendado' ||
            statusAgenda === 'em_curso' ||
            statusAgenda === 'concluido' ||
            statusAgenda === 'cancelado'
          ) {
            return statusAgenda;
          }
          return 'agendado';
        };

        const toDateOnly = (d: string) =>
          d && d.length === 10 ? new Date(`${d}T00:00:00`) : new Date(d);

        const data: Appointment[] = (rows as AgendaResponse[]).map((r) => {
          // Resolve o tipo: por id_evento/tipo → map, senão por tipo_evento (string), senão 'outro'
          const typeById = typeMap.get((r.id_evento ?? r.tipo) as number);
          const typeByName = normalizeAppointmentType(r.tipo_evento);

          return {
            id: Number(r.id), // padroniza como number
            title: r.titulo ?? '(sem título)',
            description: r.descricao ?? undefined,
            type: typeById || typeByName || 'outro',
            typeName: r.tipo_evento ?? undefined,
            status: mapStatus(r.status),
            date: toDateOnly(r.data),
            startTime: ensureTimeString(r.hora_inicio),
            endTime: normalizeTimeString(r.hora_fim) ?? undefined,
            clientName: r.cliente ?? undefined,
            location: r.local ?? undefined,
            reminders: String(r.lembrete) === 'true' || Number(r.lembrete) === 1,
            createdAt: r.datacadastro ? new Date(r.datacadastro) : new Date(),
            updatedAt: r.datacadastro ? new Date(r.datacadastro) : new Date(),
          };
        });

        setAppointments(data);
      } catch (error) {
        console.error('Erro ao carregar agendas:', error);
        toast({
          title: 'Erro ao carregar agendas',
          description: 'Não foi possível carregar os agendamentos.',
          variant: 'destructive',
        });
        setAppointments([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAppointments();
  }, [toast]);

  const handleCreateAppointment = (date?: Date) => {
    setEditingAppointment(null);
    setFormInitialDate(date);
    setIsFormOpen(true);
  };

  // cria/atualiza localmente (exibição); a persistência no backend pode ser adicionada depois
  const handleFormSubmit = (
    appointmentData: Omit<Appointment, 'id' | 'status' | 'createdAt' | 'updatedAt'>
  ) => {
    const normalizedData: Omit<Appointment, 'id' | 'status' | 'createdAt' | 'updatedAt'> = {
      ...appointmentData,
      startTime: ensureTimeString(appointmentData.startTime),
      endTime: appointmentData.endTime ? ensureTimeString(appointmentData.endTime) : undefined,
    };

    if (editingAppointment) {
      const updatedAppointment: Appointment = {
        ...editingAppointment,
        ...normalizedData,
        status: editingAppointment.status,
        updatedAt: new Date(),
      };

      setAppointments((prev) =>
        prev.map((apt) => (apt.id === editingAppointment.id ? updatedAppointment : apt))
      );
      setViewingAppointment((current) =>
        current && current.id === editingAppointment.id ? updatedAppointment : current
      );
      toast({
        title: 'Agendamento atualizado',
        description: `${updatedAppointment.title} foi atualizado com sucesso.`,
      });
    } else {
      const newAppointment: Appointment = {
        ...normalizedData,
        id: Date.now(),
        status: 'agendado',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      setAppointments((prev) => [...prev, newAppointment]);
      toast({
        title: 'Agendamento criado!',
        description: `${newAppointment.title} foi agendado com sucesso.`,
      });
    }

    setSelectedDate(appointmentData.date);
    setIsFormOpen(false);
    setEditingAppointment(null);
    setFormInitialDate(undefined);
  };

  const handleEditAppointment = (appointment: Appointment) => {
    setEditingAppointment(appointment);
    setFormInitialDate(undefined);
    setIsFormOpen(true);
  };

  const handleDeleteAppointment = (appointmentId: number) => {
    setAppointments((prev) => prev.filter((apt) => apt.id !== appointmentId));
    if (viewingAppointment?.id === appointmentId) {
      setViewingAppointment(null);
    }
    if (editingAppointment?.id === appointmentId) {
      setEditingAppointment(null);
      setIsFormOpen(false);
    }
    if (appointmentToCancel?.id === appointmentId) {
      setAppointmentToCancel(null);
    }
    toast({
      title: 'Agendamento excluído',
      description: 'O agendamento foi removido com sucesso.',
    });
  };

  const handleViewAppointment = (appointment: Appointment) => {
    setViewingAppointment(appointment);
  };

  const handleRequestCancelAppointment = (appointment: Appointment) => {
    setAppointmentToCancel(appointment);
  };

  const handleConfirmCancelAppointment = () => {
    if (!appointmentToCancel) return;

    const cancellationDate = new Date();

    setAppointments((prev) =>
      prev.map((apt) =>
        apt.id === appointmentToCancel.id
          ? { ...apt, status: 'cancelado', updatedAt: cancellationDate }
          : apt
      )
    );
    setViewingAppointment((current) =>
      current && current.id === appointmentToCancel.id
        ? { ...current, status: 'cancelado', updatedAt: cancellationDate }
        : current
    );

    toast({
      title: 'Agendamento cancelado',
      description: `${appointmentToCancel.title} foi cancelado.`,
    });

    setAppointmentToCancel(null);
  };

  const formatFullDate = (date: Date) =>
    date.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

  const formatTimeRange = (appointment: Appointment) => {
    const start = ensureTimeString(appointment.startTime);
    const end = appointment.endTime ? ensureTimeString(appointment.endTime) : undefined;
    return end ? `${start} - ${end}` : start;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Agenda</h1>
          <p className="text-muted-foreground">
            Gerencie seus agendamentos, prazos e compromissos
          </p>
        </div>
        <Button onClick={() => handleCreateAppointment()}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Agendamento
        </Button>
      </div>

      {/* Calendar + Sidebar */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <AgendaCalendar
            appointments={appointments}
            selectedDate={selectedDate}
            onDateSelect={setSelectedDate}
            onCreateAppointment={handleCreateAppointment}
          />
        </div>

        <div className="space-y-4">
          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Hoje</span>
              </div>
              <p className="text-2xl font-bold text-foreground mt-1">
                {appointments.filter(
                  (apt) => apt.date.toDateString() === new Date().toDateString()
                ).length}
              </p>
            </div>

            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-medium">Pendentes</span>
              </div>
              <p className="text-2xl font-bold text-foreground mt-1">
                {appointments.filter((apt) => apt.status === 'agendado').length}
              </p>
            </div>
          </div>

          {/* Upcoming */}
          <div className="bg-card border border-border rounded-lg p-4">
            <h3 className="font-semibold mb-3">Próximos Compromissos</h3>
            <div className="space-y-3">
              {appointments
                .filter((apt) => apt.date >= new Date())
                .sort((a, b) => a.date.getTime() - b.date.getTime())
                .slice(0, 3)
                .map((appointment) => (
                  <div
                    key={appointment.id}
                    className="flex items-start gap-3 p-2 rounded-lg hover:bg-accent transition-colors"
                  >
                    <div
                      className={`w-2 h-2 rounded-full ${statusDotClass[appointment.status]} mt-2`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {appointment.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {appointment.date.toLocaleDateString()} às {ensureTimeString(appointment.startTime)}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>

      {/* Appointments List */}
      <AppointmentList
        appointments={appointments}
        onEdit={handleEditAppointment}
        onDelete={handleDeleteAppointment}
        onView={handleViewAppointment}
        onCancel={handleRequestCancelAppointment}
        loading={loading}
      />

      {/* View Appointment Dialog */}
      <Dialog
        open={Boolean(viewingAppointment)}
        onOpenChange={(open) => {
          if (!open) setViewingAppointment(null);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{viewingAppointment?.title ?? 'Agendamento'}</DialogTitle>
          </DialogHeader>

          {viewingAppointment && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${statusDotClass[viewingAppointment.status]}`}
                  />
                  {statusLabel[viewingAppointment.status]}
                </Badge>
                <Badge variant="secondary">
                  {viewingAppointment.typeName ?? appointmentTypes[viewingAppointment.type].label}
                </Badge>
              </div>

              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Data</p>
                <p className="font-medium capitalize">{formatFullDate(viewingAppointment.date)}</p>
              </div>

              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Horário</p>
                <p className="font-medium">{formatTimeRange(viewingAppointment)}</p>
              </div>

              {viewingAppointment.description && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Descrição</p>
                  <p className="text-sm leading-relaxed">{viewingAppointment.description}</p>
                </div>
              )}

              {(viewingAppointment.clientName ||
                viewingAppointment.clientEmail ||
                viewingAppointment.clientPhone) && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Cliente</p>
                  <div className="text-sm space-y-1">
                    {viewingAppointment.clientName && <p>{viewingAppointment.clientName}</p>}
                    {viewingAppointment.clientEmail && (
                      <p className="text-muted-foreground">{viewingAppointment.clientEmail}</p>
                    )}
                    {viewingAppointment.clientPhone && (
                      <p className="text-muted-foreground">{viewingAppointment.clientPhone}</p>
                    )}
                  </div>
                </div>
              )}

              {viewingAppointment.location && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Local</p>
                  <p className="text-sm">{viewingAppointment.location}</p>
                </div>
              )}

              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Lembretes</p>
                <p className="text-sm">
                  {viewingAppointment.reminders ? 'Ativados' : 'Desativados'}
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-3 pt-6">
            <Button variant="outline" onClick={() => setViewingAppointment(null)}>
              Fechar
            </Button>
            {viewingAppointment && (
              <Button
                onClick={() => {
                  const appointment = viewingAppointment;
                  setViewingAppointment(null);
                  handleEditAppointment(appointment);
                }}
              >
                Editar
              </Button>
            )}
            {viewingAppointment?.status !== 'cancelado' && viewingAppointment && (
              <Button
                variant="destructive"
                onClick={() => handleRequestCancelAppointment(viewingAppointment)}
              >
                Cancelar evento
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(appointmentToCancel)}
        onOpenChange={(open) => {
          if (!open) setAppointmentToCancel(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar agendamento</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja realmente cancelar{' '}
              <span className="font-semibold">{appointmentToCancel?.title}</span>? Essa ação
              mantém o registro, mas altera o status para cancelado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmCancelAppointment}>
              Confirmar cancelamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Appointment Dialog */}
      <Dialog
        open={isFormOpen}
        onOpenChange={(open) => {
          setIsFormOpen(open);
          if (!open) {
            setEditingAppointment(null);
            setFormInitialDate(undefined);
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingAppointment ? 'Editar Agendamento' : 'Novo Agendamento'}
            </DialogTitle>
          </DialogHeader>
          <AppointmentForm
            onSubmit={handleFormSubmit}
            onCancel={() => {
              setIsFormOpen(false);
              setEditingAppointment(null);
              setFormInitialDate(undefined);
            }}
            initialDate={editingAppointment ? undefined : formInitialDate}
            initialValues={editingAppointment ?? undefined}
            submitLabel={editingAppointment ? 'Salvar alterações' : 'Criar Agendamento'}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
