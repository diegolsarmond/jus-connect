import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown, Star } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api";

const formSchema = z
  .object({
    process: z.string().min(1, "Processo ou caso é obrigatório"),
    responsibles: z.array(z.string()).min(1, "Adicionar responsável"),
    title: z.string().min(1, "Tarefa é obrigatória"),
    date: z.string().min(1, "Data é obrigatória"),
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
    path: ["time"],
    message: "Hora é obrigatória",
  })
  .refine(
    (data) => !data.recurring || (data.recurrenceValue && data.recurrenceUnit),
    {
      path: ["recurrenceValue"],
      message: "Informe a recorrência",
    },
  );

export type TaskFormValues = z.infer<typeof formSchema>;

export interface TaskCreationPrefill {
  process?: string;
  processLabel?: string;
  title?: string;
  description?: string;
  date?: string;
  time?: string;
  priority?: number;
  responsibles?: string[];
}

export interface CreatedTaskSummary {
  id: number;
  title: string;
  processId: number | null;
  process: string;
  date: Date;
  time: string | null;
  description: string;
  responsibles: string[];
  responsibleIds: string[];
  status: "pendente" | "atrasada" | "resolvida";
  priority: number;
}

interface ApiUsuario {
  id: number;
  nome_completo: string;
}

interface ApiEventType {
  id: number;
  nome: string;
  tarefa?: boolean;
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
  concluido?: boolean;
}

const apiUrl = getApiBaseUrl();

function joinUrl(base: string, path = "") {
  const b = base.replace(/\/+$/, "");
  const p = path ? (path.startsWith("/") ? path : `/${path}`) : "";
  return `${b}${p}`;
}

const defaultValues: TaskFormValues = {
  process: "",
  responsibles: [],
  title: "",
  date: new Date().toISOString().slice(0, 10),
  time: "",
  showOnAgenda: true,
  allDay: false,
  location: "",
  description: "",
  attachments: undefined,
  recurring: false,
  private: false,
  recurrenceValue: "",
  recurrenceUnit: "",
  priority: 1,
};

function formatProposal(o: ApiOpportunity) {
  const year = o.data_criacao ? new Date(o.data_criacao).getFullYear() : new Date().getFullYear();
  const solicitante = o.solicitante_nome || o.solicitante?.nome;
  return `Proposta #${o.id}/${year}${solicitante ? ` - ${solicitante}` : ""}`;
}

interface TaskCreationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefill?: TaskCreationPrefill;
  onCreated?: (task: CreatedTaskSummary) => void;
}

export function TaskCreationDialog({ open, onOpenChange, prefill, onCreated }: TaskCreationDialogProps) {
  const [users, setUsers] = useState<ApiUsuario[]>([]);
  const [eventTypes, setEventTypes] = useState<ApiEventType[]>([]);
  const [opportunities, setOpportunities] = useState<ApiOpportunity[]>([]);
  const [openProposal, setOpenProposal] = useState(false);
  const [openResponsible, setOpenResponsible] = useState(false);
  const [titleDropdownOpen, setTitleDropdownOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
    control,
    setValue,
    watch,
  } = useForm<TaskFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const url = joinUrl(apiUrl, "/api/usuarios/empresa");
        const response = await fetch(url, { headers: { Accept: "application/json" } });
        if (!response.ok) throw new Error("Failed to fetch users");
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
        console.error("Erro ao buscar usuários:", err);
      }
    };

    const fetchEventTypes = async () => {
      try {
        const url = joinUrl(apiUrl, "/api/tipo-eventos");
        const response = await fetch(url, { headers: { Accept: "application/json" } });
        if (!response.ok) throw new Error("Failed to fetch event types");
        const json = await response.json();
        const data: ApiEventType[] = Array.isArray(json)
          ? json
          : Array.isArray(json?.rows)
          ? json.rows
          : Array.isArray(json?.data?.rows)
          ? json.data.rows
          : Array.isArray(json?.data)
          ? json.data
          : [];
        const tasksOnly = data.filter((type) => type.tarefa === true);
        setEventTypes(tasksOnly);
      } catch (err) {
        console.error("Erro ao buscar tipos de evento:", err);
      }
    };

    const fetchOpportunities = async () => {
      try {
        const url = joinUrl(apiUrl, "/api/oportunidades");
        const response = await fetch(url, { headers: { Accept: "application/json" } });
        if (!response.ok) throw new Error("Failed to fetch opportunities");
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
        console.error("Erro ao buscar oportunidades:", err);
      }
    };

    fetchUsers();
    fetchEventTypes();
    fetchOpportunities();
  }, []);

  const defaultsWithPrefill = useMemo(() => {
    return {
      ...defaultValues,
      process: prefill?.process ?? "",
      responsibles: prefill?.responsibles ?? [],
      title: prefill?.title ?? "",
      date: prefill?.date ?? defaultValues.date,
      time: prefill?.time ?? "",
      description: prefill?.description ?? "",
      priority: prefill?.priority ?? 1,
    } satisfies TaskFormValues;
  }, [prefill]);

  useEffect(() => {
    if (open) {
      reset(defaultsWithPrefill);
    } else {
      reset(defaultValues);
      setOpenResponsible(false);
      setOpenProposal(false);
      setTitleDropdownOpen(false);
    }
  }, [open, defaultsWithPrefill, reset]);

  const onSubmit = async (data: TaskFormValues) => {
    const files: File[] = Array.from(data.attachments?.[0] ? data.attachments : []);
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        alert("Arquivo muito grande (máx 5MB)");
        return;
      }
      const allowed = ["image/png", "image/jpeg", "application/pdf"];
      if (!allowed.includes(file.type)) {
        alert("Tipo de arquivo não suportado");
        return;
      }
    }

    const selectedOpportunity = opportunities.find((o) => String(o.id) === data.process);
    const year =
      (selectedOpportunity?.data_criacao && new Date(selectedOpportunity.data_criacao).getFullYear()) ||
      new Date().getFullYear();

    const processText = selectedOpportunity
      ? formatProposal(selectedOpportunity)
      : prefill?.processLabel ?? data.process;

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
      concluido: false,
    };

    try {
      const url = joinUrl(apiUrl, "/api/tarefas");
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Failed to create task");
      const created: ApiTask = await response.json();

      if (data.responsibles.length) {
        try {
          const rUrl = joinUrl(apiUrl, `/api/tarefas/${created.id}/responsaveis`);
          await fetch(rUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ responsaveis: data.responsibles.map((r) => Number(r)) }),
          });
        } catch (e) {
          console.error("Erro ao adicionar responsáveis:", e);
        }
      }

      const createdDatePart = created.data.split(/[T\s]/)[0];
      const date = new Date(`${createdDatePart}T00:00:00`);
      if (!created.dia_inteiro && created.hora) {
        const [h, m] = created.hora.split(":");
        date.setHours(Number(h), Number(m));
      }

      const status: CreatedTaskSummary["status"] = created.concluido
        ? "resolvida"
        : date < new Date()
        ? "atrasada"
        : "pendente";

      const opp = opportunities.find((o) => o.id === created.id_oportunidades);
      const procText = opp ? formatProposal(opp) : processText || `Proposta #${created.id_oportunidades}/${year}`;

      const summary: CreatedTaskSummary = {
        id: created.id,
        title: created.titulo,
        processId: created.id_oportunidades ?? null,
        process: procText,
        date,
        time: created.hora ? created.hora.slice(0, 5) : null,
        description: created.descricao || "",
        responsibles: data.responsibles.map((id) => {
          const user = users.find((usr) => String(usr.id) === id);
          return user ? user.nome_completo : id;
        }),
        responsibleIds: data.responsibles,
        status,
        priority: created.prioridade ?? data.priority,
      };

      onCreated?.(summary);
      reset(defaultValues);
      onOpenChange(false);
    } catch (err) {
      console.error("Erro ao salvar tarefa:", err);
      alert("Erro ao salvar tarefa");
    }
  };

  const allDay = watch("allDay");
  const recurring = watch("recurring");
  const priority = watch("priority");
  const selectedProposalId = watch("process");
  const watchedTitle = watch("title") ?? "";

  const selectedProposal = useMemo(
    () => opportunities.find((o) => String(o.id) === selectedProposalId),
    [opportunities, selectedProposalId],
  );

  const filteredEventTypes = useMemo(() => {
    const query = watchedTitle.trim().toLowerCase();
    if (!query) {
      return eventTypes;
    }
    return eventTypes.filter((type) => type.nome.toLowerCase().includes(query));
  }, [eventTypes, watchedTitle]);

  const processButtonLabel = selectedProposal
    ? formatProposal(selectedProposal)
    : prefill?.processLabel || "Selecione";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Criar nova tarefa</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Controller
            name="title"
            control={control}
            render={({ field }) => (
              <div className="relative">
                <Label htmlFor="title">Título da Tarefa</Label>
                <Input
                  id="title"
                  autoComplete="off"
                  {...field}
                  onChange={(event) => {
                    field.onChange(event.target.value);
                    setTitleDropdownOpen(true);
                  }}
                  onFocus={() => setTitleDropdownOpen(true)}
                  onBlur={() => {
                    window.setTimeout(() => setTitleDropdownOpen(false), 150);
                  }}
                />
                {titleDropdownOpen && filteredEventTypes.length > 0 && (
                  <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
                    <ul className="max-h-48 overflow-y-auto py-1 text-sm">
                      {filteredEventTypes.map((type) => (
                        <li
                          key={type.id}
                          className="cursor-pointer px-3 py-2 hover:bg-accent"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => {
                            field.onChange(type.nome);
                            setTitleDropdownOpen(false);
                          }}
                        >
                          {type.nome}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
              </div>
            )}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="process">Proposta:</Label>
              <input type="hidden" id="process" {...register("process")} />
              <Popover open={openProposal} onOpenChange={setOpenProposal}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openProposal}
                    className="w-full justify-between"
                  >
                    {processButtonLabel}
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
                                setValue("process", String(o.id));
                                setOpenProposal(false);
                              }}
                            >
                              {label}
                              {selectedProposalId === String(o.id) && <Check className="ml-auto h-4 w-4" />}
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {errors.process && <p className="text-sm text-destructive">{errors.process.message}</p>}
            </div>
            <Controller
              name="responsibles"
              control={control}
              render={({ field }) => {
                const value = Array.isArray(field.value) ? field.value : [];
                const currentId = value[0] ?? "";
                const currentResponsible = users.find((u) => String(u.id) === currentId);
                return (
                  <div>
                    <Label htmlFor="responsibles">Adicionar responsável</Label>
                    <Popover open={openResponsible} onOpenChange={setOpenResponsible}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          role="combobox"
                          aria-expanded={openResponsible}
                          className="w-full justify-between"
                        >
                          {currentResponsible ? currentResponsible.nome_completo : "Selecione"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0">
                        <Command>
                          <CommandInput placeholder="Buscar responsável..." />
                          <CommandList>
                            <CommandEmpty>Nenhum responsável encontrado.</CommandEmpty>
                            <CommandGroup>
                              {users.map((u) => (
                                <CommandItem
                                  key={u.id}
                                  value={u.nome_completo}
                                  onSelect={() => {
                                    field.onChange([String(u.id)]);
                                    setOpenResponsible(false);
                                  }}
                                >
                                  {u.nome_completo}
                                  {currentId === String(u.id) && <Check className="ml-auto h-4 w-4" />}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    {errors.responsibles && (
                      <p className="text-sm text-destructive">{errors.responsibles.message}</p>
                    )}
                  </div>
                );
              }}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <Label htmlFor="date">Data:</Label>
              <Input type="date" id="date" {...register("date")} />
              {errors.date && <p className="text-sm text-destructive">{errors.date.message}</p>}
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
                <Input type="time" id="time" {...register("time")} />
                {errors.time && <p className="text-sm text-destructive">{errors.time.message}</p>}
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="description">Descrição</Label>
            <Textarea id="description" placeholder="Descreva sua tarefa" {...register("description")} />
          </div>

          <div>
            <Label htmlFor="attachments">Anexos</Label>
            <Input type="file" id="attachments" multiple {...register("attachments")} />
          </div>

          <div>
            <Label>Prioridade</Label>
            <input type="hidden" {...register("priority", { valueAsNumber: true })} />
            <div className="flex space-x-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <button type="button" key={i} onClick={() => setValue("priority", i)}>
                  <Star className={`h-5 w-5 ${i <= (priority || 1) ? "text-amber-500" : "text-muted-foreground"}`} />
                </button>
              ))}
            </div>
            {errors.priority && <p className="text-sm text-destructive">{errors.priority.message}</p>}
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox id="showOnAgenda" {...register("showOnAgenda")} />
              <Label htmlFor="showOnAgenda">Mostrar na agenda</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="private" {...register("private")} />
              <Label htmlFor="private">Privada</Label>
            </div>
          </div>

          <Controller
            name="recurring"
            control={control}
            render={({ field }) => (
              <RadioGroup
                className="flex items-center gap-4"
                onValueChange={(value) => field.onChange(value === "true")}
                value={field.value ? "true" : "false"}
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
                <Input id="recurrenceValue" {...register("recurrenceValue")} />
              </div>
              <div className="col-span-2">
                <Label htmlFor="recurrenceUnit">A cada:</Label>
                <select id="recurrenceUnit" className="w-full border rounded-md h-9 px-2" {...register("recurrenceUnit")}>
                  <option value="minutos">Minutos</option>
                  <option value="horas">Horas</option>
                  <option value="dias">Dias</option>
                  <option value="semanas">Semanas</option>
                  <option value="meses">Meses</option>
                  <option value="anos">Anos</option>
                </select>
              </div>
              {errors.recurrenceValue && (
                <p className="text-sm text-destructive col-span-3">{errors.recurrenceValue.message}</p>
              )}
            </div>
          )}

          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                reset(defaultValues);
              }}
            >
              Cancelar
            </Button>
            <Button type="submit">Criar nova tarefa</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default TaskCreationDialog;
