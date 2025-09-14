import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Search,
  Filter,
  ArrowUpDown,
  Download,
  Star,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Pencil,
  Trash2,
  Check,
  ChevronsUpDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { z } from 'zod';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

interface Task {
  id: number;
  title: string;
  process: string;
  participants: string[];
  date: Date;
  responsibles: string[];
  status: 'pendente' | 'atrasada' | 'resolvida';
  priority: number;
}

const COLORS = ['#fbbf24', '#ef4444', '#22c55e'];

const formSchema = z
  .object({
    process: z.string().min(1, 'Processo ou caso é obrigatório'),
    responsibles: z.array(z.string()).min(1, 'Adicionar responsáveis'),
    title: z.string().min(1, 'Tarefa é obrigatória'),
    date: z.string().min(1, 'Data é obrigatória'),
    time: z.string().optional(),
    showOnAgenda: z.boolean().optional(),
    allDay: z.boolean().optional(),
    location: z.string().optional(),
    description: z.string().optional(),
    attachments: z.any().optional(),
    recurring: z.boolean().optional(),
    private: z.boolean().optional(),
    recurrenceValue: z.string().optional(),
    recurrenceUnit: z.string().optional(),
    priority: z.number().min(1).max(5),
  })
  .refine((data) => data.allDay || data.time, {
    path: ['time'],
    message: 'Hora é obrigatória',
  })
  .refine(
    (data) => !data.recurring || (data.recurrenceValue && data.recurrenceUnit),
    {
      path: ['recurrenceValue'],
      message: 'Informe a recorrência',
    },
  );

type FormValues = z.infer<typeof formSchema>;

interface ApiUsuario {
  id: number;
  nome_completo: string;
}

interface ApiOpportunity {
  id: number;
  data_criacao?: string;
  solicitante_nome?: string;
  solicitante?: {
    nome?: string;
  };
}

interface ApiTask {
  id: number;
  id_oportunidades?: number | null;
  titulo: string;
  descricao?: string;
  data: string;
  hora?: string | null;
  dia_inteiro?: boolean;
  prioridade?: number;
  ativa?: boolean;
}

const apiUrl = (import.meta.env.VITE_API_URL as string) || 'http://localhost:3000';

function joinUrl(base: string, path = '') {
  const b = base.replace(/\/+$/, '');
  const p = path ? (path.startsWith('/') ? path : `/${path}`) : '';
  return `${b}${p}`;
}

// normaliza a data para 00:00:00, para o DayPicker bater corretamente o dia
function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export default function Tarefas() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<ApiUsuario[]>([]);
  const [opportunities, setOpportunities] = useState<ApiOpportunity[]>([]);
  const [openProposal, setOpenProposal] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
    watch,
    setValue,
    control,
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      showOnAgenda: true,
      allDay: false,
      recurring: false,
      private: false,
      responsibles: [],
      priority: 1,
    },
  });

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const url = joinUrl(apiUrl, '/api/usuarios');
        const response = await fetch(url, { headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error('Failed to fetch users');
        const json = await response.json();
        const data: ApiUsuario[] = Array.isArray(json)
          ? json
          : Array.isArray(json?.rows)
          ? json.rows
          : Array.isArray(json?.data?.rows)
          ? json.data.rows
          : Array.isArray(json?.data)
          ? json.data
          : [];
        setUsers(data);
      } catch (err) {
        console.error('Erro ao buscar usuários:', err);
      }
    };
    fetchUsers();
  }, []);

  useEffect(() => {
    const fetchOpportunities = async () => {
      try {
        const url = joinUrl(apiUrl, '/api/oportunidades');
        const response = await fetch(url, { headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error('Failed to fetch opportunities');
        const json = await response.json();
        const data: ApiOpportunity[] = Array.isArray(json)
          ? json
          : Array.isArray(json?.rows)
          ? json.rows
          : Array.isArray(json?.data?.rows)
          ? json.data.rows
          : Array.isArray(json?.data)
          ? json.data
          : [];
        const extended = data.map((o) => ({
          ...o,
          solicitante_nome: o.solicitante_nome || o.solicitante?.nome,
        }));
        setOpportunities(extended);
      } catch (err) {
        console.error('Erro ao buscar propostas:', err);
      }
    };
    fetchOpportunities();
  }, []);

  useEffect(() => {
    const fetchTasks = async () => {
      if (!users.length) return;
      try {
        const url = joinUrl(apiUrl, '/api/tarefas');
        const response = await fetch(url, { headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error('Failed to fetch tasks');
        const json = await response.json();
        const data: ApiTask[] = Array.isArray(json)
          ? json
          : Array.isArray(json?.rows)
          ? json.rows
          : Array.isArray(json?.data?.rows)
          ? json.data.rows
          : Array.isArray(json?.data)
          ? json.data
          : [];
        const tasksMapped: Task[] = await Promise.all(
          data.map(async (t) => {
            const dateStr = t.dia_inteiro ? t.data : `${t.data}${t.hora ? `T${t.hora}` : ''}`;
            const date = new Date(dateStr);
            const status: Task['status'] = !t.ativa
              ? 'resolvida'
              : date < new Date()
              ? 'atrasada'
              : 'pendente';
            let responsibles: string[] = [];
            try {
              const rUrl = joinUrl(apiUrl, `/api/tarefas/${t.id}/responsaveis`);
              const rRes = await fetch(rUrl, { headers: { Accept: 'application/json' } });
              if (rRes.ok) {
                const rJson = await rRes.json();
                const ids: number[] = Array.isArray(rJson)
                  ? rJson.map((r: { id_usuario: number }) => r.id_usuario)
                  : Array.isArray(rJson?.rows)
                  ? rJson.rows.map((r: { id_usuario: number }) => r.id_usuario)
                  : [];
                responsibles = ids.map((id) => {
                  const u = users.find((usr) => usr.id === id);
                  return u ? u.nome_completo : String(id);
                });
              }
            } catch (e) {
              console.error('Erro ao buscar responsáveis:', e);
            }
            return {
              id: t.id,
              title: t.titulo,
              process: t.id_oportunidades ? String(t.id_oportunidades) : '',
              participants: [],
              date,
              responsibles,
              status,
              priority: t.prioridade ?? 1,
            };
          }),
        );
        setTasks(tasksMapped);
      } catch (err) {
        console.error('Erro ao buscar tarefas:', err);
      }
    };
    fetchTasks();
  }, [users]);


  const onSubmit = async (data: FormValues) => {
    const files: File[] = Array.from(data.attachments?.[0] ? data.attachments : []);
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        alert('Arquivo muito grande (máx 5MB)');
        return;
      }
      const allowed = ['image/png', 'image/jpeg', 'application/pdf'];
      if (!allowed.includes(file.type)) {
        alert('Tipo de arquivo não suportado');
        return;
      }
    }

    const selectedOpportunity = opportunities.find(
      (o) => String(o.id) === data.process,
    );

    const year =
      (selectedOpportunity?.data_criacao &&
        new Date(selectedOpportunity.data_criacao).getFullYear()) ||
      new Date().getFullYear();

    const processText = selectedOpportunity
      ? `Proposta #${selectedOpportunity.id}/${year}${
          selectedOpportunity.solicitante_nome ? ` - ${selectedOpportunity.solicitante_nome}` : ''
        }`
      : data.process;

    const payload = {
      id_oportunidades: Number(data.process),
      titulo: data.title,
      descricao: data.description,

      data: data.date,
      hora: data.allDay ? null : data.time,
      dia_inteiro: data.allDay,
      prioridade: data.priority,
      mostrar_na_agenda: data.showOnAgenda,
      privada: data.private,
      recorrente: data.recurring,
      repetir_quantas_vezes: data.recurring ? Number(data.recurrenceValue) || 1 : 1,
      repetir_cada_unidade: data.recurring ? data.recurrenceUnit : null,
      repetir_intervalo: 1,

      ativa: true,
    };

    try {
      const url = joinUrl(apiUrl, '/api/tarefas');
      const response = await fetch(url, {
        method: 'POST',

        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error('Failed to create task');
      const created: ApiTask = await response.json();
        if (data.responsibles.length) {
          try {
            const rUrl = joinUrl(apiUrl, `/api/tarefas/${created.id}/responsaveis`);
            await fetch(rUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
              body: JSON.stringify({ responsaveis: data.responsibles.map((r) => Number(r)) }),
            });
          } catch (e) {
            console.error('Erro ao adicionar responsáveis:', e);
          }
        }
      const dateStr = created.dia_inteiro
        ? created.data
        : `${created.data}${created.hora ? `T${created.hora}` : ''}`;
      const date = new Date(dateStr);
      const status: Task['status'] = !created.ativa
        ? 'resolvida'
        : date < new Date()
        ? 'atrasada'
        : 'pendente';
      const newTask: Task = {
        id: created.id,
        title: created.titulo,
        process: created.id_oportunidades ? String(created.id_oportunidades) : processText,
        participants: [],
        date,
        responsibles: data.responsibles.map((id) => { const u = users.find((usr) => String(usr.id) === id); return u ? u.nome_completo : id; }),
        status,
        priority: created.prioridade ?? data.priority,
      };
      setTasks((prev) => [...prev, newTask]);
      reset();
      setOpen(false);
    } catch (err) {
      console.error('Erro ao criar tarefa:', err);
      alert('Erro ao criar tarefa');

    }
  };

  const pending = tasks.filter((t) => t.status === 'pendente').length;
  const late = tasks.filter((t) => t.status === 'atrasada').length;
  const done = tasks.filter((t) => t.status === 'resolvida').length;

  const chartData = [
    { name: 'Pendentes', value: pending },
    { name: 'Atrasadas', value: late },
    { name: 'Resolvidas', value: done },
  ];

  const markDone = (id: number) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: 'resolvida' } : t)));
  };

  const deleteTask = (id: number) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const allDay = watch('allDay');
  const recurring = watch('recurring');
  const priority = watch('priority');
  const selectedProposalId = watch('process');
  const selectedProposal = opportunities.find(
    (o) => String(o.id) === selectedProposalId,
  );
  const formatProposal = (o: ApiOpportunity) =>
    `Proposta #${o.id}/${new Date(o.data_criacao || '').getFullYear()}${
      o.solicitante_nome ? ` - ${o.solicitante_nome}` : ''
    }`;

  // gera os dias com tarefas para o calendário
  const taskDates = useMemo(() => tasks.map((t) => startOfDay(t.date)), [tasks]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Tarefas</h1>
          <p className="text-muted-foreground">Gerencie suas tarefas e prazos</p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova tarefa
          </Button>
          <Button variant="outline">
            <Search className="h-4 w-4 mr-2" />
            Buscar
          </Button>
          <Button variant="outline">
            <Filter className="h-4 w-4 mr-2" />
            Filtrar
          </Button>
          <Button variant="outline">
            <ArrowUpDown className="h-4 w-4 mr-2" />
            Ordenar
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="font-semibold mb-2">Produtividade</h3>
          <p className="text-2xl font-bold">{pending}</p>
          <p className="text-sm text-muted-foreground">Tarefas pendentes</p>
        </div>

        <div className="bg-card border border-border rounded-lg p-4 lg:col-span-1">
          <h3 className="font-semibold mb-2">Status</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartData} dataKey="value" nameKey="name" label>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Card do Calendário */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="font-semibold mb-2">Calendário</h3>
          <Calendar
            modifiers={{ taskDay: taskDates }}
            modifiersClassNames={{
              taskDay: 'bg-primary text-primary-foreground rounded-full',
            }}
          />
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox aria-label="Selecionar todas" />
              </TableHead>
              <TableHead className="w-20">Prioridade</TableHead>
              <TableHead className="w-20">Status</TableHead>
              <TableHead>Título</TableHead>
              <TableHead>Partes</TableHead>
              <TableHead>Compromisso</TableHead>
              <TableHead>Responsáveis</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map((task) => (
              <TableRow key={task.id}>
                <TableCell>
                  <Checkbox aria-label="Selecionar tarefa" />
                </TableCell>
                <TableCell>
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star
                        key={i}
                        className={`h-4 w-4 ${i <= task.priority ? 'text-amber-500' : 'text-muted-foreground'}`}
                      />
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  {task.status === 'pendente' && (
                    <Clock className="h-4 w-4 text-amber-500" />
                  )}
                  {task.status === 'atrasada' && (
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                  )}
                  {task.status === 'resolvida' && (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  )}
                </TableCell>
                <TableCell className="font-medium">{task.title}</TableCell>
                <TableCell>{task.participants.join(', ')}</TableCell>
                <TableCell>{task.date.toLocaleDateString()}</TableCell>
                <TableCell>
                  <div className="flex -space-x-2">
                    {task.responsibles.map((r, idx) => (
                      <Avatar key={idx} className="h-6 w-6 border-2 border-background">
                        <AvatarFallback>{r.charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button variant="ghost" size="icon" onClick={() => markDone(task.id)}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteTask(task.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Criar nova tarefa</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="process">Proposta:</Label>
                <input type="hidden" id="process" {...register('process')} />
                <Popover open={openProposal} onOpenChange={setOpenProposal}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={openProposal}
                      className="w-full justify-between"
                    >
                      {selectedProposal
                        ? formatProposal(selectedProposal)
                        : 'Selecione'}
                      <ChevronsUpDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0">
                    <Command>
                      <CommandInput placeholder="Buscar proposta..." />
                      <CommandList>
                        <CommandEmpty>Nenhuma proposta encontrada.</CommandEmpty>
                        <CommandGroup>
                          {opportunities.map((o) => {
                            const label = formatProposal(o);
                            return (
                              <CommandItem
                                key={o.id}
                                value={label}
                                onSelect={() => {
                                  setValue('process', String(o.id));
                                  setOpenProposal(false);
                                }}
                              >
                                {label}
                                {selectedProposalId === String(o.id) && (
                                  <Check className="ml-auto h-4 w-4" />
                                )}
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {errors.process && (
                  <p className="text-sm text-destructive">{errors.process.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="responsibles">Adicionar responsáveis</Label>
                <select
                  id="responsibles"
                  multiple
                  className="w-full border rounded-md h-32 px-2"
                  {...register('responsibles')}
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nome_completo}
                    </option>
                  ))}
                </select>
                {errors.responsibles && (
                  <p className="text-sm text-destructive">{errors.responsibles.message}</p>
                )}
              </div>
            </div>
            <div>
              <Label htmlFor="title">Título da Tarefa</Label>
              <Input id="title" {...register('title')} />
              {errors.title && (
                <p className="text-sm text-destructive">{errors.title.message}</p>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <Label htmlFor="date">Data:</Label>
                <Input type="date" id="date" {...register('date')} />
                {errors.date && (
                  <p className="text-sm text-destructive">{errors.date.message}</p>
                )}
              </div>
              <div className="pt-6">
                <Controller
                  name="allDay"
                  control={control}
                  render={({ field }) => (
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="all-day"
                        checked={field.value}
                        onCheckedChange={(checked) => field.onChange(!!checked)}
                      />
                      <Label htmlFor="all-day">Dia inteiro</Label>
                    </div>
                  )}
                />
              </div>
              {!allDay && (
                <div>
                  <Label htmlFor="time">Hora:</Label>
                  <Input type="time" id="time" {...register('time')} />
                  {errors.time && (
                    <p className="text-sm text-destructive">{errors.time.message}</p>
                  )}
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                placeholder="Descreva sua tarefa"
                {...register('description')}
              />
            </div>
            <div>
              <Label htmlFor="attachments">Anexos</Label>
              <Input type="file" id="attachments" multiple {...register('attachments')} />
            </div>
            <div>
              <Label>Prioridade</Label>
              <input type="hidden" {...register('priority', { valueAsNumber: true })} />
              <div className="flex space-x-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <button type="button" key={i} onClick={() => setValue('priority', i)}>
                    <Star
                      className={`h-5 w-5 ${i <= priority ? 'text-amber-500' : 'text-muted-foreground'}`}
                    />
                  </button>
                ))}
              </div>
              {errors.priority && (
                <p className="text-sm text-destructive">{errors.priority.message}</p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox id="showOnAgenda" {...register('showOnAgenda')} />
                <Label htmlFor="showOnAgenda">Mostrar na agenda</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="private" {...register('private')} />
                <Label htmlFor="private">Privada</Label>
              </div>
            </div>
            <Controller
              name="recurring"
              control={control}
              render={({ field }) => (
                <RadioGroup
                  className="flex items-center gap-4"
                  onValueChange={(value) => field.onChange(value === 'true')}
                  value={field.value ? 'true' : 'false'}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="false" id="not-recurring" />
                    <Label htmlFor="not-recurring">Única</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="true" id="recurring" />
                    <Label htmlFor="recurring">Recorrente</Label>
                  </div>
                </RadioGroup>
              )}
            />
            {recurring && (
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label htmlFor="recurrenceValue">Repetir quantas vezes:</Label>
                  <Input id="recurrenceValue" {...register('recurrenceValue')} />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="recurrenceUnit">A cada:</Label>
                  <select
                    id="recurrenceUnit"
                    className="w-full border rounded-md h-9 px-2"
                    {...register('recurrenceUnit')}
                  >
                    <option value="minutos">Minutos</option>
                    <option value="horas">Horas</option>
                    <option value="dias">Dias</option>
                    <option value="semanas">Semanas</option>
                    <option value="meses">Meses</option>
                    <option value="anos">Anos</option>
                  </select>
                </div>
                {errors.recurrenceValue && (
                  <p className="text-sm text-destructive col-span-3">
                    {errors.recurrenceValue.message}
                  </p>
                )}
              </div>
            )}
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">Criar nova tarefa</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
