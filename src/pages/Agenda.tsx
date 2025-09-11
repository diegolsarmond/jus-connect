import React, { useState } from 'react';
import { Calendar, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { AgendaCalendar } from '@/components/agenda/AgendaCalendar';
import { AppointmentForm } from '@/components/agenda/AppointmentForm';
import { AppointmentList } from '@/components/agenda/AppointmentList';
import { Appointment } from '@/types/agenda';

// Mock data for demonstration
const mockAppointments: Appointment[] = [
  {
    id: '1',
    title: 'Reunião com Cliente Silva',
    description: 'Discussão sobre processo trabalhista',
    type: 'reuniao',
    status: 'agendado',
    date: new Date(2024, 11, 20),
    startTime: '14:00',
    endTime: '15:00',
    clientName: 'João Silva',
    location: 'Escritório',
    reminders: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '2',
    title: 'Audiência TRT',
    description: 'Audiência trabalhista - Processo 123456',
    type: 'audiencia',
    status: 'agendado',
    date: new Date(2024, 11, 22),
    startTime: '09:30',
    endTime: '11:00',
    clientName: 'Maria Santos',
    location: 'TRT - 5ª Vara',
    reminders: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '3',
    title: 'Lançar Petição Inicial',
    description: 'Petição inicial - Ação de Cobrança',
    type: 'peticao',
    status: 'em_andamento',
    date: new Date(2024, 11, 21),
    startTime: '10:00',
    clientName: 'Empresa XYZ Ltda',
    reminders: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

export default function Agenda() {
  const [appointments, setAppointments] = useState<Appointment[]>(mockAppointments);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formInitialDate, setFormInitialDate] = useState<Date>();
  const { toast } = useToast();

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
                <Calendar className="h-4 w-4 text-warning" />
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
                    <div className="w-2 h-2 rounded-full bg-primary mt-2" />
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