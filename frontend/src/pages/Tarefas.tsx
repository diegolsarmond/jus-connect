import React, { useState } from 'react';
import {
  Plus,
  Search,
  Filter,
  ArrowUpDown,
  Download,
  Star,
  StarOff,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Pencil,
  Trash2,
  Check,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
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
  deadline: Date;
  responsibles: string[];
  status: 'pendente' | 'atrasada' | 'resolvida';
  priority: boolean;
}

const COLORS = ['#fbbf24', '#ef4444', '#22c55e'];

const formSchema = z
  .object({
    process: z.string().min(1, 'Processo ou caso é obrigatório'),
    responsibles: z.string().min(1, 'Adicionar responsáveis'),
    title: z.string().min(1, 'Tarefa é obrigatória'),
    date: z.string().min(1, 'Data é obrigatória'),
    time: z.string().min(1, 'Hora é obrigatória'),
    deadline: z.string().min(1, 'Prazo fatal é obrigatório'),
    showOnAgenda: z.boolean().optional(),
    informEnd: z.boolean().optional(),
    allDay: z.boolean().optional(),
    location: z.string().optional(),
    description: z.string().optional(),
    attachments: z.any().optional(),
    important: z.boolean().optional(),
    urgent: z.boolean().optional(),
    future: z.boolean().optional(),
    recurring: z.boolean().optional(),
    private: z.boolean().optional(),
    retroactive: z.boolean().optional(),
  })
  .refine(
    (data) => {
      const start = new Date(`${data.date}T${data.time}`);
      const deadline = new Date(data.deadline);
      return deadline >= start;
    },
    {
      path: ['deadline'],
      message: 'Prazo fatal não pode ser anterior à data',
    },
  );

type FormValues = z.infer<typeof formSchema>;

export default function Tarefas() {
  const [tasks, setTasks] = useState<Task[]>([
    {
      id: 1,
      title: 'Enviar documentação',
      process: 'Processo 123',
      participants: ['Cliente X'],
      date: new Date(),
      deadline: new Date(new Date().getTime() + 86400000),
      responsibles: ['Maria'],
      status: 'pendente',
      priority: true,
    },
  ]);
  const [open, setOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      showOnAgenda: true,
      informEnd: true,
      allDay: false,
      important: false,
      urgent: false,
      future: false,
      recurring: false,
      private: false,
      retroactive: false,
    },
  });

  const onSubmit = (data: FormValues) => {
    const responsaveis = data.responsibles
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

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

    const newTask: Task = {
      id: tasks.length + 1,
      title: data.title,
      process: data.process,
      participants: [],
      date: new Date(`${data.date}T${data.time}`),
      deadline: new Date(data.deadline),
      responsibles: responsaveis,
      status: 'pendente',
      priority: data.important || false,
    };
    setTasks((prev) => [...prev, newTask]);
    reset();
    setOpen(false);
  };

  const pending = tasks.filter((t) => t.status === 'pendente').length;
  const late = tasks.filter((t) => t.status === 'atrasada').length;
  const done = tasks.filter((t) => t.status === 'resolvida').length;

  const chartData = [
    { name: 'Pendentes', value: pending },
    { name: 'Atrasadas', value: late },
    { name: 'Resolvidas', value: done },
  ];

  const taskDates = tasks.map((t) => t.date);

  const markDone = (id: number) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: 'resolvida' } : t)),
    );
  };

  const deleteTask = (id: number) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

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
              <TableHead className="w-10">Prioridade</TableHead>
              <TableHead className="w-20">Status</TableHead>
              <TableHead>Título</TableHead>
              <TableHead>Partes</TableHead>
              <TableHead>Compromisso</TableHead>
              <TableHead>Prazo fatal</TableHead>
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
                  {task.priority ? (
                    <Star className="h-4 w-4 text-amber-500" />
                  ) : (
                    <StarOff className="h-4 w-4 text-muted-foreground" />
                  )}
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
                <TableCell>{task.deadline.toLocaleDateString()}</TableCell>
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
                <Label htmlFor="process">Processo ou caso</Label>
                <Input id="process" {...register('process')} />
                {errors.process && (
                  <p className="text-sm text-destructive">
                    {errors.process.message}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="responsibles">Adicionar responsáveis</Label>
                <Input
                  id="responsibles"
                  placeholder="Nomes separados por vírgula"
                  {...register('responsibles')}
                />
                {errors.responsibles && (
                  <p className="text-sm text-destructive">
                    {errors.responsibles.message}
                  </p>
                )}
              </div>
            </div>
            <div>
              <Label htmlFor="title">Tarefa</Label>
              <Input id="title" {...register('title')} />
              {errors.title && (
                <p className="text-sm text-destructive">{errors.title.message}</p>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="date">Data</Label>
                <Input type="date" id="date" {...register('date')} />
                {errors.date && (
                  <p className="text-sm text-destructive">{errors.date.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="time">Hora</Label>
                <Input type="time" id="time" {...register('time')} />
                {errors.time && (
                  <p className="text-sm text-destructive">{errors.time.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="deadline">Prazo fatal</Label>
                <Input type="date" id="deadline" {...register('deadline')} />
                {errors.deadline && (
                  <p className="text-sm text-destructive">
                    {errors.deadline.message}
                  </p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox id="showOnAgenda" {...register('showOnAgenda')} />
                <Label htmlFor="showOnAgenda">Mostrar na agenda</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="informEnd" {...register('informEnd')} />
                <Label htmlFor="informEnd">Informar término</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="allDay" {...register('allDay')} />
                <Label htmlFor="allDay">Dia inteiro</Label>
              </div>
            </div>
            <div>
              <Label htmlFor="location">Local</Label>
              <Input id="location" {...register('location')} />
            </div>
            <div>
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                placeholder="Use @ para mencionar"
                {...register('description')}
              />
            </div>
            <div>
              <Label htmlFor="attachments">Anexos</Label>
              <Input type="file" id="attachments" multiple {...register('attachments')} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <div className="flex items-center space-x-2">
                <Checkbox id="important" {...register('important')} />
                <Label htmlFor="important">Importante</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="urgent" {...register('urgent')} />
                <Label htmlFor="urgent">Urgente</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="future" {...register('future')} />
                <Label htmlFor="future">Futura</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="recurring" {...register('recurring')} />
                <Label htmlFor="recurring">Recorrente</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="private" {...register('private')} />
                <Label htmlFor="private">Privada</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="retroactive" {...register('retroactive')} />
                <Label htmlFor="retroactive">Retroativa</Label>
              </div>
            </div>
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

