import { useEffect, useMemo, useState } from 'react';
import { format as formatDateFn } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AppointmentForm } from './AppointmentForm';
import type { Appointment, AppointmentType } from '@/types/agenda';
import { normalizeAppointmentType } from '@/types/agenda';
import { getApiBaseUrl } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

const apiUrl = getApiBaseUrl();

function joinUrl(base: string, path = '') {
  const normalizedBase = base.replace(/\/+$/, '');
  const normalizedPath = path ? (path.startsWith('/') ? path : `/${path}`) : '';
  return `${normalizedBase}${normalizedPath}`;
}

function ensureTimeString(time?: string | null): string {
  if (!time) {
    return '00:00';
  }

  const [hours = '00', minutes = '00'] = time.split(':');
  const normalizedHours = String(Math.min(Math.max(Number.parseInt(hours, 10) || 0, 0), 23)).padStart(2, '0');
  const normalizedMinutes = String(Math.min(Math.max(Number.parseInt(minutes, 10) || 0, 0), 59)).padStart(2, '0');
  return `${normalizedHours}:${normalizedMinutes}`;
}

interface TipoEventoResponse {
  id: number;
  nome?: string | null;
  agenda?: boolean;
}

export interface AppointmentCreationPrefill {
  title?: string;
  description?: string;
  type?: AppointmentType;
  date?: Date;
  startTime?: string;
  endTime?: string;
  clientId?: string;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  location?: string;
  reminders?: boolean;
  notifyClient?: boolean;
}

interface AppointmentCreationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefill?: AppointmentCreationPrefill;
}

const createInitialValues = (
  prefill?: AppointmentCreationPrefill,
): Appointment | undefined => {
  if (!prefill) {
    return undefined;
  }

  const now = new Date();

  return {
    id: -1,
    title: prefill.title ?? '',
    description: prefill.description,
    type: prefill.type ?? 'reuniao',
    status: 'agendado',
    date: prefill.date ?? now,
    startTime: prefill.startTime ?? '',
    endTime: prefill.endTime,
    clientId: prefill.clientId,
    clientName: prefill.clientName,
    clientPhone: prefill.clientPhone,
    clientEmail: prefill.clientEmail,
    location: prefill.location,
    reminders: prefill.reminders ?? true,
    notifyClient: prefill.notifyClient,
    createdAt: now,
    updatedAt: now,
  } satisfies Appointment;
};

export default function AppointmentCreationDialog({
  open,
  onOpenChange,
  prefill,
}: AppointmentCreationDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [typeMap, setTypeMap] = useState<Map<AppointmentType, number>>(new Map());

  const initialValues = useMemo(() => createInitialValues(prefill), [prefill]);

  useEffect(() => {
    let isMounted = true;
    const loadTypes = async () => {
      try {
        const response = await fetch(joinUrl(apiUrl, '/api/tipo-eventos'), {
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) {
          throw new Error(`Failed to load tipo-eventos (${response.status})`);
        }

        const json = await response.json();
        const rows: TipoEventoResponse[] = Array.isArray(json)
          ? json
          : Array.isArray(json?.data)
            ? json.data
            : [];

        const map = new Map<AppointmentType, number>();
        rows
          .filter((row) => row.agenda !== false)
          .forEach((row) => {
            if (typeof row.id !== 'number') {
              return;
            }
            const normalizedType = normalizeAppointmentType(row.nome);
            if (normalizedType) {
              map.set(normalizedType, row.id);
              return;
            }
            if (!map.has('outro')) {
              map.set('outro', row.id);
            }
          });

        if (isMounted) {
          setTypeMap(map);
        }
      } catch (error) {
        console.error('Erro ao carregar tipos de evento:', error);
      }
    };

    void loadTypes();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSubmit = async (
    appointmentData: Omit<Appointment, 'id' | 'status' | 'createdAt' | 'updatedAt'>,
  ) => {
    if (isSubmitting) {
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
      location: toOptionalString(appointmentData.location),
    };

    setIsSubmitting(true);

    try {
      const typeId = typeMap.get(normalizedData.type);
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
        tipo_local: null,
        local: normalizedData.location ?? null,
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

      toast({
        title: 'Agendamento criado!',
        description: `${normalizedData.title} foi agendado com sucesso.`,
      });
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao salvar agendamento:', error);
      toast({
        title: 'Erro ao salvar agendamento',
        description: 'Não foi possível salvar o agendamento. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onOpenChange(false);
        } else {
          onOpenChange(true);
        }
      }}
    >
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Agendamento</DialogTitle>
        </DialogHeader>
        <AppointmentForm
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
          initialValues={initialValues}
          isSubmitting={isSubmitting}
        />
      </DialogContent>
    </Dialog>
  );
}
