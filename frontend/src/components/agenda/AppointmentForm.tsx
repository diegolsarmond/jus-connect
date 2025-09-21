import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Clock, MapPin, Bell, BellRing, Users } from 'lucide-react';
import { getApiBaseUrl } from '@/lib/api';

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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  appointmentTypes,
  AppointmentType,
  Appointment,
  APPOINTMENT_TYPE_VALUES,
  normalizeAppointmentType,
  isValidAppointmentType,
} from '@/types/agenda';

const apiUrl = getApiBaseUrl();

function joinUrl(base: string, path = '') {
  const b = base.replace(/\/+$/, '');
  const p = path ? (path.startsWith('/') ? path : `/${path}`) : '';
  return `${b}${p}`;
}

const appointmentSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório'),
  description: z.string().optional(),
  type: z.string().min(1, 'Tipo é obrigatório'),
  date: z.date({ required_error: 'Data é obrigatória' }),
  startTime: z.string().min(1, 'Horário de início é obrigatório'),
  endTime: z.string().optional(),
  clientId: z.string().optional(),
  clientName: z.string().optional(),
  clientPhone: z.string().optional(),
  clientEmail: z.string().optional(),
  location: z.string().optional(),
  reminders: z.boolean().default(true),
  notifyClient: z.boolean().default(false),
});

type AppointmentFormData = z.infer<typeof appointmentSchema>;

interface AppointmentFormProps {
  onSubmit: (
    appointment: Omit<Appointment, 'id' | 'status' | 'createdAt' | 'updatedAt'>,
  ) => void | Promise<void>;
  onCancel: () => void;
  initialDate?: Date;
  initialValues?: Appointment;
  submitLabel?: string;
  isSubmitting?: boolean;
}

export function AppointmentForm({
  onSubmit,
  onCancel,
  initialDate,
  initialValues,
  submitLabel,
  isSubmitting = false,
}: AppointmentFormProps) {
  const defaultValues = useMemo<AppointmentFormData>(() => ({
    title: initialValues?.title ?? '',
    description: initialValues?.description ?? '',
    type: initialValues?.type ?? 'reuniao',
    date: initialValues?.date ?? initialDate ?? new Date(),
    startTime: initialValues?.startTime ?? '',
    endTime: initialValues?.endTime ?? '',
    clientId: initialValues?.clientId ? String(initialValues.clientId) : '',
    clientName: initialValues?.clientName ?? '',
    clientPhone: initialValues?.clientPhone ?? '',
    clientEmail: initialValues?.clientEmail ?? '',
    location: initialValues?.location ?? '',
    reminders: initialValues?.reminders ?? true,
    notifyClient: initialValues?.notifyClient ?? false,
  }), [initialValues, initialDate]);

  const form = useForm<AppointmentFormData>({
    resolver: zodResolver(appointmentSchema),
    defaultValues,
  });

  useEffect(() => {
    form.reset(defaultValues);
  }, [defaultValues, form]);

  const formTitle = initialValues ? 'Editar Agendamento' : 'Novo Agendamento';

  type ClienteOption = {
    id: number;
    nome: string;
    telefone?: string | null;
    email?: string | null;
  };

  const [tiposEvento, setTiposEvento] = useState<AppointmentType[]>(() => [...APPOINTMENT_TYPE_VALUES]);
  const [clientes, setClientes] = useState<ClienteOption[]>([]);
  const [clientesLoading, setClientesLoading] = useState(false);
  const [clientesError, setClientesError] = useState<string | null>(null);
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
  const [highlightedClienteIndex, setHighlightedClienteIndex] = useState(-1);
  const clientFieldRef = useRef<HTMLDivElement | null>(null);
  const [isAllDay, setIsAllDay] = useState<boolean>(() => Boolean(initialValues ? !initialValues.endTime : false));
  const defaultHasClient = useMemo(
    () => Boolean(initialValues?.clientId || initialValues?.clientName),
    [initialValues],
  );
  const [hasClient, setHasClient] = useState<boolean>(defaultHasClient);
  const defaultMeetingFormat = useMemo<'presencial' | 'online'>(() => {
    if (initialValues) {
      return initialValues.location ? 'presencial' : 'online';
    }
    return 'presencial';
  }, [initialValues]);
  const [meetingFormat, setMeetingFormat] = useState<'presencial' | 'online'>(defaultMeetingFormat);

  useEffect(() => {
    const fetchClientes = async () => {
      try {
        setClientesLoading(true);
        setClientesError(null);
        const url = joinUrl(apiUrl, '/api/clientes');
        const response = await fetch(url, { headers: { Accept: 'application/json' } });
        if (!response.ok) {
          throw new Error('Failed to load clientes');
        }
        const json = await response.json();
        const rows: ClienteOption[] = Array.isArray(json)
          ? json
          : Array.isArray(json?.data)
            ? json.data
            : [];
        const uniqueClientes = new Map<number, ClienteOption>();
        rows.forEach((cliente) => {
          if (cliente && typeof cliente.id === 'number') {
            uniqueClientes.set(cliente.id, {
              id: cliente.id,
              nome: cliente.nome ?? '',
              telefone: cliente.telefone ?? null,
              email: cliente.email ?? null,
            });
          }
        });

        const orderedClientes = Array.from(uniqueClientes.values()).sort((a, b) =>
          a.nome.localeCompare(b.nome, 'pt-BR')
        );

        setClientes(orderedClientes);
      } catch (error) {
        console.error('Erro ao carregar clientes:', error);
        setClientesError('Não foi possível carregar os clientes.');
      } finally {
        setClientesLoading(false);
      }
    };

    fetchClientes();
  }, []);

  useEffect(() => {
    if (!isClientDropdownOpen) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (clientFieldRef.current && !clientFieldRef.current.contains(event.target as Node)) {
        setIsClientDropdownOpen(false);
        setHighlightedClienteIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isClientDropdownOpen]);

  useEffect(() => {
    const fetchTiposEvento = async () => {
      try {
        const url = joinUrl(apiUrl, '/api/tipo-eventos');
        const response = await fetch(url, { headers: { Accept: 'application/json' } });
        if (!response.ok) {
          throw new Error('Failed to load tipo-eventos');
        }
        const json = await response.json();
        interface TipoEvento { id: number; nome: string; agenda?: boolean }
        const rows: TipoEvento[] = Array.isArray(json)
          ? json
          : Array.isArray(json?.data)
            ? json.data
            : [];

        const data: AppointmentType[] = [];
        rows
          .filter((t) => t.agenda === true)
          .forEach((t) => {
            const normalized = normalizeAppointmentType(t.nome);
            if (normalized && !data.includes(normalized)) {
              data.push(normalized);
            }
          });

        if (!data.includes('outro')) {
          data.push('outro');
        }

        const availableTypes = data.length > 0 ? data : [...APPOINTMENT_TYPE_VALUES];
        const currentType = form.getValues('type');

        if (!currentType || !isValidAppointmentType(currentType)) {
          form.setValue('type', availableTypes[0]);
        } else if (!availableTypes.includes(currentType)) {
          if (initialValues) {
            availableTypes.push(currentType);
          } else {
            form.setValue('type', availableTypes[0]);
          }
        }

        setTiposEvento(availableTypes);
      } catch (error) {
        console.error('Erro ao carregar tipos de evento:', error);
      }
    };

    fetchTiposEvento();
  }, [form, initialValues]);

  const submitButtonLabel = isSubmitting ? 'Salvando...' : submitLabel ?? 'Criar Agendamento';

  const handleSubmit = (data: AppointmentFormData) => {
    if (isSubmitting) {
      return;
    }

    const normalizedType = normalizeAppointmentType(data.type) ?? 'outro';
    onSubmit({
      title: data.title,
      description: data.description,
      type: normalizedType,
      date: data.date,
      startTime: data.startTime,
      endTime: isAllDay ? undefined : data.endTime || undefined,
      clientId: hasClient && data.clientId ? data.clientId : undefined,
      clientName: hasClient ? data.clientName : undefined,
      clientPhone: hasClient ? data.clientPhone : undefined,
      clientEmail: hasClient ? data.clientEmail : undefined,
      location: meetingFormat === 'presencial' ? data.location : undefined,
      reminders: data.reminders,
      notifyClient: hasClient ? data.notifyClient : false,
    });
  };

  const clientName = form.watch('clientName') || '';

  useEffect(() => {
    setIsAllDay(Boolean(initialValues ? !initialValues.endTime : false));
  }, [initialValues]);

  useEffect(() => {
    setHasClient(defaultHasClient);
  }, [defaultHasClient]);

  useEffect(() => {
    setMeetingFormat(defaultMeetingFormat);
  }, [defaultMeetingFormat]);

  useEffect(() => {
    if (highlightedClienteIndex >= clientes.length) {
      setHighlightedClienteIndex(clientes.length > 0 ? clientes.length - 1 : -1);
    }
  }, [clientes.length, highlightedClienteIndex]);

  const filteredClientes = useMemo(() => {
    const searchTerm = clientName.trim().toLowerCase();
    if (!searchTerm) {
      return clientes;
    }

    return clientes.filter((cliente) =>
      cliente.nome.toLowerCase().includes(searchTerm)
    );
  }, [clientName, clientes]);

  useEffect(() => {
    if (highlightedClienteIndex >= filteredClientes.length) {
      setHighlightedClienteIndex(filteredClientes.length > 0 ? 0 : -1);
    }
  }, [filteredClientes, highlightedClienteIndex]);

  const handleSelectCliente = useCallback(
    (cliente: ClienteOption) => {
      form.setValue('clientId', String(cliente.id));
      form.setValue('clientName', cliente.nome);
      form.setValue('clientPhone', cliente.telefone ?? '');
      form.setValue('clientEmail', cliente.email ?? '');
      setIsClientDropdownOpen(false);
      setHighlightedClienteIndex(-1);
    },
    [form],
  );

  const handleClientInputChange = useCallback(
    (value: string) => {
      form.setValue('clientName', value);
      const match = clientes.find((cliente) => cliente.nome === value);
      if (match) {
        form.setValue('clientId', String(match.id));
        form.setValue('clientPhone', match.telefone ?? '');
        form.setValue('clientEmail', match.email ?? '');
      } else {
        form.setValue('clientId', '');
        form.setValue('clientPhone', '');
        form.setValue('clientEmail', '');
      }
      setHighlightedClienteIndex(-1);
    },
    [clientes, form],
  );

  const handleClientInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setIsClientDropdownOpen(true);
      setHighlightedClienteIndex((prev) => {
        const nextIndex = prev + 1;
        if (nextIndex >= filteredClientes.length) {
          return filteredClientes.length > 0 ? 0 : -1;
        }
        return nextIndex;
      });
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setIsClientDropdownOpen(true);
      setHighlightedClienteIndex((prev) => {
        if (filteredClientes.length === 0) {
          return -1;
        }
        if (prev <= 0) {
          return filteredClientes.length - 1;
        }
        return prev - 1;
      });
      return;
    }

    if (event.key === 'Enter') {
      if (isClientDropdownOpen && highlightedClienteIndex >= 0 && highlightedClienteIndex < filteredClientes.length) {
        event.preventDefault();
        handleSelectCliente(filteredClientes[highlightedClienteIndex]);
      }
      return;
    }

    if (event.key === 'Escape') {
      if (isClientDropdownOpen) {
        event.preventDefault();
        setIsClientDropdownOpen(false);
        setHighlightedClienteIndex(-1);
      }
      return;
    }

    if (event.key === 'Tab') {
      setIsClientDropdownOpen(false);
      setHighlightedClienteIndex(-1);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarIcon className="h-5 w-5" />
          {formTitle}
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
                  {tiposEvento.map((tipo) => (
                    <SelectItem key={tipo} value={tipo}>
                      {appointmentTypes[tipo]?.label ?? tipo}
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

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2 md:col-span-2">
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

            <div className="flex items-center gap-3 rounded-lg border border-dashed border-muted-foreground/30 px-4 py-3 md:self-end">
              <Switch
                id="allDay"
                checked={isAllDay}
                onCheckedChange={(checked) => {
                  setIsAllDay(checked);
                  if (checked) {
                    form.setValue('endTime', '');
                  }
                }}
              />
              <div className="space-y-0.5">
                <Label htmlFor="allDay" className="text-sm font-medium">
                  Dia todo
                </Label>
                <p className="text-xs text-muted-foreground">Ocupa o dia inteiro sem horário final</p>
              </div>
            </div>

            {!isAllDay && (
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
            )}
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

          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between rounded-lg bg-accent p-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-accent-foreground" />
                <Label htmlFor="hasClient" className="text-sm font-medium">
                  Com cliente
                </Label>
              </div>
              <Switch
                id="hasClient"
                checked={hasClient}
                onCheckedChange={(checked) => {
                  setHasClient(checked);
                  if (!checked) {
                    form.setValue('clientId', '');
                    form.setValue('clientName', '');
                    form.setValue('clientPhone', '');
                    form.setValue('clientEmail', '');
                    form.setValue('notifyClient', false);
                    setIsClientDropdownOpen(false);
                    setHighlightedClienteIndex(-1);
                  }
                }}
              />
            </div>

            {hasClient && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2" ref={clientFieldRef}>
                  <Label htmlFor="clientName">Cliente</Label>
                  <div className="relative">
                    <Input
                      id="clientName"
                      autoComplete="off"
                      {...form.register('clientName')}
                      value={clientName}
                      onFocus={() => {
                        setIsClientDropdownOpen(true);
                      }}
                      onChange={(event) => {
                        handleClientInputChange(event.target.value);
                        setIsClientDropdownOpen(true);
                      }}
                      onKeyDown={handleClientInputKeyDown}
                      placeholder="Nome do cliente (opcional)"
                    />
                    {isClientDropdownOpen && (
                      <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover text-popover-foreground shadow-lg">
                        {clientesLoading ? (
                          <p className="px-3 py-2 text-sm text-muted-foreground">Carregando clientes...</p>
                        ) : clientesError ? (
                          <p className="px-3 py-2 text-sm text-destructive">{clientesError}</p>
                        ) : filteredClientes.length > 0 ? (
                          filteredClientes.map((cliente, index) => {
                            const detailParts: string[] = [];
                            if (typeof cliente.email === 'string' && cliente.email.trim().length > 0) {
                              detailParts.push(cliente.email.trim());
                            }
                            if (typeof cliente.telefone === 'string' && cliente.telefone.trim().length > 0) {
                              detailParts.push(cliente.telefone.trim());
                            }

                            return (
                              <button
                                key={cliente.id}
                                type="button"
                                onMouseDown={(event) => {
                                  event.preventDefault();
                                  handleSelectCliente(cliente);
                                }}
                                className={cn(
                                  'flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-accent',
                                  index === highlightedClienteIndex && 'bg-accent text-accent-foreground',
                                )}
                              >
                                <span className="font-medium leading-snug">{cliente.nome}</span>
                                {detailParts.length > 0 && (
                                  <span className="text-xs text-muted-foreground">{detailParts.join(' • ')}</span>
                                )}
                              </button>
                            );
                          })
                        ) : (
                          <p className="px-3 py-2 text-sm text-muted-foreground">
                            {clientName.trim().length > 0
                              ? 'Nenhum cliente encontrado'
                              : 'Nenhum cliente disponível'}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="clientPhone">Telefone</Label>
                  <Input id="clientPhone" readOnly {...form.register('clientPhone')} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="clientEmail">E-mail</Label>
                  <Input id="clientEmail" readOnly {...form.register('clientEmail')} />
                </div>

                <div className="flex items-center justify-between rounded-lg bg-accent p-4 md:col-span-2">
                  <div className="flex items-center gap-2">
                    <BellRing className="h-4 w-4 text-accent-foreground" />
                    <Label htmlFor="notifyClient" className="text-sm font-medium">
                      Notificar o cliente
                    </Label>
                  </div>
                  <Switch
                    id="notifyClient"
                    checked={form.watch('notifyClient')}
                    onCheckedChange={(checked) => form.setValue('notifyClient', checked)}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Formato do atendimento</Label>
              <RadioGroup
                value={meetingFormat}
                onValueChange={(value) => {
                  const normalized = value === 'online' ? 'online' : 'presencial';
                  setMeetingFormat(normalized);
                  if (normalized === 'online') {
                    form.setValue('location', '');
                  }
                }}
                className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="presencial" id="presencial" />
                  <Label htmlFor="presencial">Presencial</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="online" id="online" />
                  <Label htmlFor="online">Online</Label>
                </div>
              </RadioGroup>
            </div>

            {meetingFormat === 'presencial' && (
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
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="submit" className="flex-1" disabled={isSubmitting}>
              {submitButtonLabel}
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
