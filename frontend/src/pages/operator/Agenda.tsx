import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format as formatDateFn } from 'date-fns';
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
  normalizeMeetingFormat,
  meetingFormatToTipoLocal,
  tipoLocalToMeetingFormat,
} from '@/types/agenda';

const apiUrl = getApiBaseUrl();

const forbiddenMessage = 'Usuário autenticado não possui empresa vinculada.';

async function getForbiddenMessage(response: Response): Promise<string> {
  try {
    const data = await response.json();
    if (typeof data === 'string') {
      const trimmed = data.trim();
      return trimmed || forbiddenMessage;
    }
    if (data && typeof data === 'object') {
      const record = data as Record<string, unknown>;
      const keys = ['message', 'mensagem', 'error', 'detail'];
      for (const key of keys) {
        const value = record[key];
        if (typeof value === 'string' && value.trim()) {
          return value.trim();
        }
      }
    }
  } catch {
    return forbiddenMessage;
  }
  return forbiddenMessage;
}

interface AgendaResponse {
  id: number | string;
  titulo: string;
  id_evento?: number | string | null;
  tipo?: number | string | null;
  tipo_evento?: string | null;
  descricao?: string | null;
  data: string;
  hora_inicio: string;
  hora_fim?: string | null;
  cliente?: string | null;
  cliente_email?: string | null;
  cliente_telefone?: string | null;
  tipo_local?: string | null;
  local?: string | null;
  lembrete?: boolean | number | string | null;
  status: number | string;
  datacadastro?: string | null;
  dataatualizacao?: string | null;
}

type TipoEventoOption = {
  id: number;
  nome?: string | null;
  normalizedType?: AppointmentType;
};

type AgendaMappingContext = {
  typeById: Map<number, AppointmentType>;
  typeNameById: Map<number, string>;
  idByType: Map<AppointmentType, number>;
};

function joinUrl(base: string, path = '') {
  const b = base.replace(/\/+$/, '');
  const p = path ? (path.startsWith('/') ? path : `/${path}`) : '';
  return `${b}${p}`;
}

function toNumericId(value: unknown): number | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }

    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function mapAgendaStatus(statusAgenda: unknown): AppointmentStatus {
  const numeric = Number(statusAgenda);
  if (!Number.isNaN(numeric)) {
    if (numeric === 0) return 'cancelado';
    if (numeric === 1) return 'agendado';
    if (numeric === 2) return 'em_curso';
    if (numeric === 3) return 'concluido';
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
}

function parseAgendaDate(value: string | Date | undefined | null): Date {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed) {
      const iso = trimmed.length === 10 ? `${trimmed}T00:00:00` : trimmed;
      const parsed = new Date(iso);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }
  }

  return new Date();
}

function buildAgendaMappingContext(options: TipoEventoOption[]): AgendaMappingContext {
  const typeById = new Map<number, AppointmentType>();
  const typeNameById = new Map<number, string>();
  const idByType = new Map<AppointmentType, number>();

  options.forEach((option) => {
    const id = option.id;
    if (!Number.isFinite(id)) {
      return;
    }

    if (option.normalizedType && !typeById.has(id)) {
      typeById.set(id, option.normalizedType);
      if (!idByType.has(option.normalizedType)) {
        idByType.set(option.normalizedType, id);
      }
    }

    if (typeof option.nome === 'string' && option.nome.trim().length > 0) {
      typeNameById.set(id, option.nome.trim());
    }
  });

  return { typeById, typeNameById, idByType };
}

function mapAgendaResponseToAppointment(
  row: AgendaResponse,
  context: AgendaMappingContext,
  fallback: Partial<Appointment> = {},
): Appointment {
  const resolveTypeById = (rawId: unknown) => {
    const numericId = toNumericId(rawId);
    if (numericId === undefined) {
      return undefined;
    }

    return context.typeById.get(numericId);
  };

  const resolveTypeNameById = (rawId: unknown) => {
    const numericId = toNumericId(rawId);
    if (numericId === undefined) {
      return undefined;
    }

    return context.typeNameById.get(numericId);
  };

  const resolvedType =
    resolveTypeById(row.id_evento) ??
    resolveTypeById(row.tipo) ??
    normalizeAppointmentType(row.tipo_evento) ??
    fallback.type ??
    'outro';

  const resolvedTypeName =
    resolveTypeNameById(row.id_evento ?? row.tipo) ??
    (typeof row.tipo_evento === 'string' && row.tipo_evento.trim().length > 0
      ? row.tipo_evento.trim()
      : undefined) ??
    fallback.typeName;

  const resolvedDate =
    typeof row.data === 'string' && row.data.trim().length > 0
      ? parseAgendaDate(row.data)
      : fallback.date ?? new Date();

  const fallbackStartTime = fallback.startTime ?? undefined;
  const fallbackEndTime = fallback.endTime ?? undefined;

  const resolvedStartTime = ensureTimeString(row.hora_inicio ?? fallbackStartTime);
  const resolvedEndTime =
    normalizeTimeString(row.hora_fim ?? fallbackEndTime) ??
    (fallbackEndTime ? ensureTimeString(fallbackEndTime) : undefined);

  const resolvedReminders =
    row.lembrete !== undefined && row.lembrete !== null
      ? String(row.lembrete) === 'true' || Number(row.lembrete) === 1
      : fallback.reminders ?? true;

  const resolvedStatus = mapAgendaStatus(row.status ?? fallback.status ?? 'agendado');

  const createdAt =
    typeof row.datacadastro === 'string' && row.datacadastro.trim().length > 0
      ? parseAgendaDate(row.datacadastro)
      : fallback.createdAt ?? new Date();

  const updatedAt =
    typeof row.dataatualizacao === 'string' && row.dataatualizacao.trim().length > 0
      ? parseAgendaDate(row.dataatualizacao)
      : typeof row.datacadastro === 'string' && row.datacadastro.trim().length > 0
        ? parseAgendaDate(row.datacadastro)
        : fallback.updatedAt ?? createdAt;

  const numericId = toNumericId(row.id);
  const finalId = numericId ?? fallback.id ?? Date.now();
  const hasRowLocation = typeof row.local === 'string' && row.local.trim().length > 0;
  const fallbackMeetingFormat = normalizeMeetingFormat(
    fallback.meetingFormat,
    hasRowLocation ? 'presencial' : 'online',
  );
  const resolvedMeetingFormat = tipoLocalToMeetingFormat(
    row.tipo_local,
    fallbackMeetingFormat,
  );
  const resolvedLocation =
    resolvedMeetingFormat === 'presencial'
      ? row.local ?? fallback.location ?? undefined
      : undefined;

  return {
    id: finalId,
    title: row.titulo ?? fallback.title ?? '(sem título)',
    description: row.descricao ?? fallback.description ?? undefined,
    type: resolvedType,
    typeName: resolvedTypeName,
    status: resolvedStatus,
    date: resolvedDate,
    startTime: resolvedStartTime,
    endTime: resolvedEndTime,
    clientId: fallback.clientId,
    clientName: row.cliente ?? fallback.clientName ?? undefined,
    clientPhone: row.cliente_telefone ?? fallback.clientPhone ?? undefined,
    clientEmail: row.cliente_email ?? fallback.clientEmail ?? undefined,
    location: resolvedLocation,
    meetingFormat: resolvedMeetingFormat,
    reminders: resolvedReminders,
    notifyClient: fallback.notifyClient ?? false,
    createdAt,
    updatedAt,
  };
}

function sortAppointments(items: Appointment[]): Appointment[] {
  return [...items].sort((a, b) => {
    const dateDiff = a.date.getTime() - b.date.getTime();
    if (dateDiff !== 0) {
      return dateDiff;
    }

    return ensureTimeString(a.startTime).localeCompare(ensureTimeString(b.startTime));
  });
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
  const [tipoEventoContext, setTipoEventoContext] = useState<AgendaMappingContext>(() => ({
    typeById: new Map<number, AppointmentType>(),
    typeNameById: new Map<number, string>(),
    idByType: new Map<AppointmentType, number>(),
  }));
  const [isSavingAppointment, setIsSavingAppointment] = useState(false);
  const [isCancellingAppointment, setIsCancellingAppointment] = useState(false);
  const [searchParams] = useSearchParams();
  const [prefillKey, setPrefillKey] = useState<string | null>(null);
  const [prefillAppointment, setPrefillAppointment] =
    useState<Omit<Appointment, 'id' | 'status' | 'createdAt' | 'updatedAt'> | null>(null);

  useEffect(() => {
    const fetchAppointments = async () => {
      setLoading(true);
      try {
        const url = joinUrl(apiUrl, '/api/agendas');
        const response = await fetch(url, { headers: { Accept: 'application/json' } });
        if (response.status === 403) {
          setAppointments([]);
          setTipoEventoContext({
            typeById: new Map<number, AppointmentType>(),
            typeNameById: new Map<number, string>(),
            idByType: new Map<AppointmentType, number>(),
          });
          setLoading(false);
          const description = await getForbiddenMessage(response);
          toast({ title: 'Acesso negado', description, variant: 'destructive' });
          return;
        }
        if (!response.ok) throw new Error('Failed to load agendas');

        const json = await response.json();

        // aceita array direto ou objetos { data: [...] } / { rows: [...] } / { agendas: [...] }
        const rows: unknown[] =
          Array.isArray(json)
            ? json
            : Array.isArray(json?.data)
              ? json.data
              : Array.isArray(json?.rows)
                ? json.rows
                : Array.isArray(json?.agendas)
                  ? json.agendas
                  : [];

        let tipoEventoOptions: TipoEventoOption[] = [];
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

            tipoEventoOptions = (tipoRows as Array<{ id?: unknown; nome?: unknown }>).
              reduce<TipoEventoOption[]>((acc, raw) => {
                const numericId = toNumericId(raw?.id);
                if (numericId === undefined) {
                  return acc;
                }

                const nome = typeof raw?.nome === 'string' ? raw.nome : undefined;
                acc.push({
                  id: numericId,
                  nome,
                  normalizedType: normalizeAppointmentType(nome),
                });
                return acc;
              }, []);
          }
        } catch (error) {
          console.error('Erro ao carregar tipos de evento:', error);
        }

        const mappingContext = buildAgendaMappingContext(tipoEventoOptions);
        setTipoEventoContext(mappingContext);

        const data: Appointment[] = (rows as AgendaResponse[])
          .filter((row) => row && typeof row === 'object')
          .map((row) => mapAgendaResponseToAppointment(row, mappingContext));

        setAppointments(sortAppointments(data));
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

    void fetchAppointments();
  }, [toast]);

  useEffect(() => {
    const currentKey = searchParams.toString();
    if (prefillKey === currentKey) {
      return;
    }

    const hasIntimacaoSource =
      searchParams.get('origem') === 'intimacao' ||
      searchParams.get('intimacao') !== null ||
      searchParams.get('processo') !== null;

    if (!hasIntimacaoSource) {
      return;
    }

    const parseDateParam = (value: string | null): Date | undefined => {
      if (!value) {
        return undefined;
      }

      const trimmed = value.trim();
      if (!trimmed) {
        return undefined;
      }

      const direct = new Date(trimmed);
      if (!Number.isNaN(direct.getTime())) {
        return direct;
      }

      const parts = trimmed.split('/');
      if (parts.length === 3) {
        const [day, month, year] = parts.map((part) => Number(part));
        if (
          Number.isFinite(day) &&
          Number.isFinite(month) &&
          Number.isFinite(year) &&
          day > 0 &&
          month > 0 &&
          month <= 12
        ) {
          const parsed = new Date(year, month - 1, day);
          if (!Number.isNaN(parsed.getTime())) {
            return parsed;
          }
        }
      }

      return undefined;
    };

    const dateParam = searchParams.get('data') ?? searchParams.get('prazo');
    const resolvedDate = parseDateParam(dateParam) ?? new Date();
    const timeParam = searchParams.get('hora');
    const normalizedTime = normalizeTimeString(timeParam) ?? '09:00';
    const titleParam = searchParams.get('titulo');
    const descriptionParam = searchParams.get('descricao');
    const typeParam = normalizeAppointmentType(searchParams.get('tipo')) ?? 'prazo';

    const fallbackRef =
      searchParams.get('processo')?.trim() || searchParams.get('intimacao')?.trim() || '';
    const title = titleParam && titleParam.trim()
      ? titleParam.trim()
      : fallbackRef
        ? `Compromisso da intimação ${fallbackRef}`
        : 'Compromisso da intimação';

    const appointmentData: Omit<Appointment, 'id' | 'status' | 'createdAt' | 'updatedAt'> = {
      title,
      description: descriptionParam?.trim() ?? '',
      type: typeParam,
      typeName: undefined,
      date: resolvedDate,
      startTime: normalizedTime,
      endTime: undefined,
      clientId: undefined,
      clientName: undefined,
      clientPhone: undefined,
      clientEmail: undefined,
      location: undefined,
      meetingFormat: 'online',
      reminders: true,
      notifyClient: false,
    };

    setPrefillAppointment(appointmentData);
    setFormInitialDate(resolvedDate);
    setSelectedDate(resolvedDate);
    setIsFormOpen(true);
    setPrefillKey(currentKey);
  }, [prefillKey, searchParams]);

  const handleCreateAppointment = (date?: Date) => {
    setEditingAppointment(null);
    setFormInitialDate(date);
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (
    appointmentData: Omit<Appointment, 'id' | 'status' | 'createdAt' | 'updatedAt'>,
  ) => {
    if (isSavingAppointment) {
      return;
    }

    const toOptionalString = (value?: string | null) => {
      if (typeof value !== 'string') {
        return undefined;
      }

      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    };

    const normalizedStartTime = ensureTimeString(appointmentData.startTime);
    const normalizedEndTime = appointmentData.endTime
      ? ensureTimeString(appointmentData.endTime)
      : undefined;
    const normalizedMeetingFormat = normalizeMeetingFormat(appointmentData.meetingFormat);
    const normalizedLocation = toOptionalString(appointmentData.location);

    const normalizedData: Omit<Appointment, 'id' | 'status' | 'createdAt' | 'updatedAt'> = {
      ...appointmentData,
      title: appointmentData.title.trim(),
      description: toOptionalString(appointmentData.description),
      startTime: normalizedStartTime,
      endTime: normalizedEndTime,
      clientId: toOptionalString(appointmentData.clientId),
      clientName: toOptionalString(appointmentData.clientName),
      clientPhone: toOptionalString(appointmentData.clientPhone),
      clientEmail: toOptionalString(appointmentData.clientEmail),
      meetingFormat: normalizedMeetingFormat,
      location: normalizedMeetingFormat === 'presencial' ? normalizedLocation : undefined,
    };

    setIsSavingAppointment(true);

    try {
      if (editingAppointment) {
        const updatedAppointment: Appointment = {
          ...editingAppointment,
          ...normalizedData,
          status: editingAppointment.status,
          updatedAt: new Date(),
        };

        setAppointments((prev) => {
          const updatedList = prev.map((apt) =>
            apt.id === editingAppointment.id ? updatedAppointment : apt
          );
          return sortAppointments(updatedList);
        });
        setViewingAppointment((current) =>
          current && current.id === editingAppointment.id ? updatedAppointment : current,
        );
        toast({
          title: 'Agendamento atualizado',
          description: `${updatedAppointment.title} foi atualizado com sucesso.`,
        });
      } else {
        const typeId = tipoEventoContext.idByType.get(normalizedData.type);
        const parsedClientId =
          normalizedData.clientId && Number.isFinite(Number(normalizedData.clientId))
            ? Number(normalizedData.clientId)
            : undefined;

        const payload = {
          titulo: normalizedData.title,
          tipo: typeId ?? null,
          descricao: normalizedData.description ?? null,
          data: formatDateFn(normalizedData.date, 'yyyy-MM-dd'),
          hora_inicio: normalizedData.startTime,
          hora_fim: normalizedData.endTime ?? null,
          cliente: parsedClientId ?? null,
          tipo_local: meetingFormatToTipoLocal(normalizedMeetingFormat),
          local:
            normalizedMeetingFormat === 'presencial' ? normalizedData.location ?? null : null,
          lembrete: normalizedData.reminders,
          status: 1,
        };

        const response = await fetch(joinUrl(apiUrl, '/api/agendas'), {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error(`Failed to create agenda (${response.status})`);
        }

        const createdRow: AgendaResponse = await response.json();
        const fallbackAppointment: Partial<Appointment> = {
          ...normalizedData,
          status: 'agendado',
        };
        const createdAppointment = mapAgendaResponseToAppointment(
          createdRow,
          tipoEventoContext,
          fallbackAppointment,
        );

        setAppointments((prev) => sortAppointments([...prev, createdAppointment]));
        toast({
          title: 'Agendamento criado!',
          description: `${createdAppointment.title} foi agendado com sucesso.`,
        });
      }

      setSelectedDate(normalizedData.date);
      setIsFormOpen(false);
      setEditingAppointment(null);
      setFormInitialDate(undefined);
    } catch (error) {
      console.error('Erro ao salvar agendamento:', error);
      toast({
        title: 'Erro ao salvar agendamento',
        description: 'Não foi possível salvar o agendamento. Tente novamente.',
        variant: 'destructive',
      });
      return;
    } finally {
      setIsSavingAppointment(false);
    }
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

  const handleConfirmCancelAppointment = async () => {
    if (!appointmentToCancel || isCancellingAppointment) return;

    setIsCancellingAppointment(true);

    try {
      const cancellationDate = new Date();
      const parsedClientId = toNumericId(appointmentToCancel.clientId);
      const normalizedStartTime = ensureTimeString(appointmentToCancel.startTime);
      const normalizedEndTime = appointmentToCancel.endTime
        ? ensureTimeString(appointmentToCancel.endTime)
        : undefined;
      const payload = {
        titulo: appointmentToCancel.title,
        tipo: tipoEventoContext.idByType.get(appointmentToCancel.type) ?? null,
        descricao: appointmentToCancel.description ?? null,
        data: formatDateFn(appointmentToCancel.date, 'yyyy-MM-dd'),
        hora_inicio: normalizedStartTime,
        hora_fim: normalizedEndTime ?? null,
        cliente: parsedClientId ?? null,
        tipo_local: meetingFormatToTipoLocal(appointmentToCancel.meetingFormat),
        local:
          appointmentToCancel.meetingFormat === 'presencial'
            ? appointmentToCancel.location ?? null
            : null,
        lembrete: appointmentToCancel.reminders,
        status: 0,
      };

      const response = await fetch(
        joinUrl(apiUrl, `/api/agendas/${appointmentToCancel.id}`),
        {
          method: 'PUT',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to cancel agenda (${response.status})`);
      }

      const updatedRow: AgendaResponse = await response.json();
      const fallbackAppointment: Partial<Appointment> = {
        ...appointmentToCancel,
        status: 'cancelado',
        updatedAt: cancellationDate,
      };
      const updatedAppointment = mapAgendaResponseToAppointment(
        updatedRow,
        tipoEventoContext,
        fallbackAppointment,
      );

      setAppointments((prev) =>
        sortAppointments(
          prev.map((apt) => (apt.id === updatedAppointment.id ? updatedAppointment : apt)),
        ),
      );
      setViewingAppointment((current) =>
        current && current.id === updatedAppointment.id ? updatedAppointment : current,
      );

      toast({
        title: 'Agendamento cancelado',
        description: `${updatedAppointment.title} foi cancelado.`,
      });

      setAppointmentToCancel(null);
    } catch (error) {
      console.error('Erro ao cancelar agendamento:', error);
      toast({
        title: 'Erro ao cancelar agendamento',
        description: 'Não foi possível cancelar o agendamento. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsCancellingAppointment(false);
    }
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
    <div className="p-4 sm:p-6 space-y-6">
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
            <AlertDialogAction
              onClick={handleConfirmCancelAppointment}
              disabled={isCancellingAppointment}
            >
              {isCancellingAppointment ? 'Cancelando...' : 'Confirmar cancelamento'}
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
            setPrefillAppointment(null);
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
              setPrefillAppointment(null);
            }}
            initialDate={editingAppointment ? undefined : formInitialDate}
            initialValues={editingAppointment ?? undefined}
            prefillValues={editingAppointment ? undefined : prefillAppointment ?? undefined}
            submitLabel={editingAppointment ? 'Salvar alterações' : 'Criar Agendamento'}
            isSubmitting={isSavingAppointment}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
