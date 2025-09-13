import React, { useEffect, useState } from 'react';
import { Calendar, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { AgendaCalendar } from '@/components/agenda/AgendaCalendar';
import { AppointmentForm } from '@/components/agenda/AppointmentForm';
import { AppointmentList } from '@/components/agenda/AppointmentList';
import { statusDotClass } from '@/components/agenda/status';
import { Appointment, AppointmentType, AppointmentStatus } from '@/types/agenda';

const apiUrl = (import.meta.env.VITE_API_URL as string) || 'http://localhost:3000';

function joinUrl(base: string, path = '') {
  const b = base.replace(/\/+$/, '');
  const p = path ? (path.startsWith('/') ? path : `/${path}`) : '';
  return `${b}${p}`;
}

export default function Agenda() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formInitialDate, setFormInitialDate] = useState<Date>();
  const { toast } = useToast();

  useEffect(() => {
    const fetchAppointments = async () => {
      try {
        const url = joinUrl(apiUrl, '/api/agendas');
        const response = await fetch(url, { headers: { Accept: 'application/json' } });
        if (!response.ok) {
          throw new Error('Failed to load agendas');
        }
        const json = await response.json();
        const rows = Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : [];

        interface AgendaResponse {
          id: number;
          titulo: string;
          id_evento: number;
          tipo_evento: string;
          descricao?: string;
          data: string;
          hora_inicio: string;
          hora_fim?: string;
          cliente?: number;
          local?: string;
          lembrete: boolean;
          status: number;
          datacadastro?: string;
        }

        const typeMap = new Map<number, AppointmentType>();
        try {
          const tiposRes = await fetch(joinUrl(apiUrl, '/api/tipo-eventos'), { headers: { Accept: 'application/json' } });
          if (tiposRes.ok) {
            const tipoJson = await tiposRes.json();
            const tipoRows = Array.isArray(tipoJson)
              ? tipoJson
              : Array.isArray(tipoJson?.data)
                ? tipoJson.data
                : [];
            tipoRows.forEach((t: { id: number; nome: string }) =>
              typeMap.set(t.id, t.nome as AppointmentType)
            );
          }
        } catch (error) {
          console.error('Erro ao carregar tipos de evento:', error);
        }

              // Função de mapeamento do status
        const mapStatus = (statusAgenda: unknown): AppointmentStatus => {
          // Converte strings numéricas em número
          const statusNumber = typeof statusAgenda === 'string' ? Number(statusAgenda) : statusAgenda;

          switch (statusNumber) {
            case 0:
              return 'cancelado';
            case 1:
              return 'agendado';
            case 2:
              return 'em_curso';
            case 3:
              return 'concluido';
          }

          // Se já vier como string válida do backend, retorna direto
          if (
            statusAgenda === 'agendado' ||
            statusAgenda === 'em_curso' ||
            statusAgenda === 'concluido' ||
            statusAgenda === 'cancelado'
          ) {
            return statusAgenda;
          }

          // Qualquer valor inesperado é tratado como 'agendado'
          return 'agendado';
        };

            const data: Appointment[] = (rows as AgendaResponse[]).map((r) => ({
              id: String(r.id),
              title: r.titulo,
              description: r.descricao ?? undefined,
              type: typeMap.get(r.id_evento ?? (r as { tipo?: number }).tipo) || 'outro',
              status: mapStatus(r.status), // agora status vem certo
              date: new Date(r.data),
              startTime: r.hora_inicio,
              endTime: r.hora_fim ?? undefined,
              clientId: r.cliente ? String(r.cliente) : undefined,
              location: r.local ?? undefined,
              reminders: Boolean(r.lembrete),
              createdAt: r.datacadastro ? new Date(r.datacadastro) : new Date(),
              updatedAt: r.datacadastro ? new Date(r.datacadastro) : new Date(),
            }));

        setAppointments(data);
      } catch (error) {
        console.error('Erro ao carregar agendas:', error);
      }
    };

    fetchAppointments();
  }, []);

  const handleCreateAppointment = (date?: Date) => {
    setFormInitialDate(date);
    setIsFormOpen(true);
  };

  const handleFormSubmit = (appointmentData: Omit<Appointment, 'id' | 'status' | 'createdAt' | 'updatedAt'>) => {
    const newAppointment: Appointment = {
      ...appointmentData,
      id: Date.now().toString(),
      status: 'agendado',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    setAppointments(prev => [...prev, newAppointment]);
    setIsFormOpen(false);
    
    toast({
      title: "Agendamento criado!",
      description: `${newAppointment.title} foi agendado com sucesso.`,
    });
  };

  const handleEditAppointment = (appointment: Appointment) => {
    toast({
      title: "Funcionalidade em desenvolvimento",
      description: "A edição de agendamentos será implementada em breve.",
    });
  };

  const handleDeleteAppointment = (appointmentId: string) => {
    setAppointments(prev => prev.filter(apt => apt.id !== appointmentId));
    toast({
      title: "Agendamento excluído",
      description: "O agendamento foi removido com sucesso.",
    });
  };

  const handleViewAppointment = (appointment: Appointment) => {
    toast({
      title: "Visualizar agendamento",
      description: `Detalhes de: ${appointment.title}`,
    });
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

      {/* Calendar Section */}
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
                {appointments.filter(apt => 
                  apt.date.toDateString() === new Date().toDateString()
                ).length}
              </p>
            </div>
            
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-medium">Pendentes</span>
              </div>
              <p className="text-2xl font-bold text-foreground mt-1">
                {appointments.filter(apt => apt.status === 'agendado').length}
              </p>
            </div>
          </div>

          {/* Upcoming appointments */}
          <div className="bg-card border border-border rounded-lg p-4">
            <h3 className="font-semibold mb-3">Próximos Compromissos</h3>
            <div className="space-y-3">
              {appointments
                .filter(apt => apt.date >= new Date())
                .sort((a, b) => a.date.getTime() - b.date.getTime())
                .slice(0, 3)
                .map((appointment) => (
                    <div key={appointment.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-accent transition-colors">
                      <div className={`w-2 h-2 rounded-full ${statusDotClass[appointment.status]} mt-2`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{appointment.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {appointment.date.toLocaleDateString()} às {appointment.startTime}
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
      />

      {/* Create Appointment Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Agendamento</DialogTitle>
          </DialogHeader>
          <AppointmentForm
            onSubmit={handleFormSubmit}
            onCancel={() => setIsFormOpen(false)}
            initialDate={formInitialDate}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}