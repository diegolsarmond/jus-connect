import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Clock, MapPin, Bell } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { appointmentTypes, AppointmentType, Appointment } from '@/types/agenda';

const appointmentSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório'),
  description: z.string().optional(),
  type: z.enum(['reuniao', 'audiencia', 'peticao', 'tarefa', 'prazo', 'outro'] as const),
  date: z.date({ required_error: 'Data é obrigatória' }),
  startTime: z.string().min(1, 'Horário de início é obrigatório'),
  endTime: z.string().optional(),
  clientName: z.string().optional(),
  location: z.string().optional(),
  reminders: z.boolean().default(true),
});

type AppointmentFormData = z.infer<typeof appointmentSchema>;

interface AppointmentFormProps {
  onSubmit: (appointment: Omit<Appointment, 'id' | 'status' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
  initialDate?: Date;
}

export function AppointmentForm({ onSubmit, onCancel, initialDate }: AppointmentFormProps) {
  const form = useForm<AppointmentFormData>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      type: 'reuniao',
      date: initialDate || new Date(),
      reminders: true,
    },
  });

  const handleSubmit = (data: AppointmentFormData) => {
    onSubmit({
      title: data.title,
      description: data.description,
      type: data.type,
      date: data.date,
      startTime: data.startTime,
      endTime: data.endTime,
      clientId: data.clientName ? `client-${Date.now()}` : undefined,
      clientName: data.clientName,
      location: data.location,
      reminders: data.reminders,
    });
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarIcon className="h-5 w-5" />
          Novo Agendamento
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Título *</Label>
              <Input
                id="title"
                {...form.register('title')}
                placeholder="Ex: Reunião com cliente..."
              />
              {form.formState.errors.title && (
                <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Tipo *</Label>
              <Select
                value={form.watch('type')}
                onValueChange={(value) => form.setValue('type', value as AppointmentType)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(appointmentTypes).map(([key, { label }]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              {...form.register('description')}
              placeholder="Detalhes adicionais sobre o agendamento..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Data *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !form.watch('date') && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.watch('date') ? (
                      format(form.watch('date'), "PPP", { locale: ptBR })
                    ) : (
                      <span>Selecionar data</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={form.watch('date')}
                    onSelect={(date) => date && form.setValue('date', date)}
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="startTime">Início *</Label>
              <div className="relative">
                <Clock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="startTime"
                  type="time"
                  {...form.register('startTime')}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="endTime">Fim</Label>
              <div className="relative">
                <Clock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="endTime"
                  type="time"
                  {...form.register('endTime')}
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="clientName">Cliente</Label>
              <Input
                id="clientName"
                {...form.register('clientName')}
                placeholder="Nome do cliente (opcional)"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Local</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="location"
                  {...form.register('location')}
                  placeholder="Endereço ou local"
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-accent rounded-lg">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-accent-foreground" />
              <Label htmlFor="reminders" className="text-sm font-medium">
                Ativar lembretes
              </Label>
            </div>
            <Switch
              id="reminders"
              checked={form.watch('reminders')}
              onCheckedChange={(checked) => form.setValue('reminders', checked)}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="submit" className="flex-1">
              Criar Agendamento
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}