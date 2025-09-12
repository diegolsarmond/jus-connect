import React, { useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Appointment, appointmentTypes } from '@/types/agenda';

interface AgendaCalendarProps {
  appointments: Appointment[];
  selectedDate?: Date;
  onDateSelect: (date: Date) => void;
  onCreateAppointment: (date: Date) => void;
}

export function AgendaCalendar({ 
  appointments, 
  selectedDate = new Date(), 
  onDateSelect, 
  onCreateAppointment 
}: AgendaCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date(selectedDate));

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)));
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)));
  };

  const getAppointmentsForDate = (date: Date) => {
    return appointments.filter(appointment => isSameDay(appointment.date, date));
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">
            {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={prevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setCurrentDate(new Date())}
            >
              Hoje
            </Button>
            <Button variant="outline" size="sm" onClick={nextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* Days of week header */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day, index) => (
            <div key={index} className="p-2 text-center text-sm font-medium text-muted-foreground">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Empty cells for days before month start */}
          {Array.from({ length: monthStart.getDay() }).map((_, index) => (
            <div key={`empty-${index}`} className="h-24" />
          ))}

          {/* Days of the month */}
          {daysInMonth.map((date) => {
            const dayAppointments = getAppointmentsForDate(date);
            const isSelected = selectedDate && isSameDay(date, selectedDate);
            const isTodayDate = isToday(date);

            return (
              <div
                key={date.toString()}
                className={cn(
                  "h-24 border border-border rounded-lg p-1 cursor-pointer transition-all hover:bg-accent/50",
                  isSelected && "ring-2 ring-primary ring-offset-2",
                  isTodayDate && "bg-primary/5 border-primary/20"
                )}
                onClick={() => onDateSelect(date)}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={cn(
                    "text-sm font-medium",
                    isTodayDate && "text-primary font-semibold",
                    !isTodayDate && "text-foreground"
                  )}>
                    {format(date, 'd')}
                  </span>
                  
                  {dayAppointments.length === 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCreateAppointment(date);
                      }}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  )}
                </div>

                {/* Appointments for this day */}
                <div className="space-y-1 overflow-hidden">
                  {dayAppointments.slice(0, 2).map((appointment) => (
                    <div
                      key={appointment.id}
                      className={cn(
                        "text-xs p-1 rounded text-white truncate",
                        appointmentTypes[appointment.type].color
                      )}
                      title={appointment.title}
                    >
                      {appointment.startTime} {appointment.title}
                    </div>
                  ))}
                  
                  {dayAppointments.length > 2 && (
                    <div className="text-xs text-muted-foreground p-1">
                      +{dayAppointments.length - 2} mais
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected date summary */}
        {selectedDate && (
          <div className="mt-4 p-4 bg-accent rounded-lg">
            <h4 className="font-medium mb-2">
              {format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
            </h4>
            
            {getAppointmentsForDate(selectedDate).length > 0 ? (
              <div className="space-y-2">
                {getAppointmentsForDate(selectedDate).map((appointment) => (
                  <div key={appointment.id} className="flex items-center gap-2 text-sm">
                    <div className={cn(
                      "w-3 h-3 rounded-full",
                      appointmentTypes[appointment.type].color
                    )} />
                    <span className="font-medium">{appointment.startTime}</span>
                    <span>{appointment.title}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                Nenhum agendamento para este dia
              </div>
            )}
            
            <Button
              size="sm"
              className="mt-3"
              onClick={() => onCreateAppointment(selectedDate)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Novo Agendamento
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}