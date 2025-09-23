import { FormEvent, useEffect, useMemo, useState } from "react";
import { Plus, Loader2, ChevronsUpDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { getApiBaseUrl } from "@/lib/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface ModuleInfo {
  id: string;
  nome: string;
  descricao?: string;
  categoria?: string;
}

interface Plan {
  id: number;
  name: string;
  price: string;
  modules: string[];
  userLimit: number | null;
  processLimit: number | null;
  proposalLimit: number | null;
  processSyncEnabled: boolean;
  processSyncQuota: number | null;
}

interface PlanFormState {
  name: string;
  price: string;
  modules: string[];
  userLimit: string;
  processLimit: string;
  proposalLimit: string;
  processSyncEnabled: boolean;
  processSyncQuota: string;
}

const initialFormState: PlanFormState = {
  name: "",
  price: "",
  modules: [],
  userLimit: "",
  processLimit: "",
  proposalLimit: "",
  processSyncEnabled: false,
  processSyncQuota: "",
};

const extractCollection = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") {
    const data = value as Record<string, unknown>;
    if (Array.isArray(data.rows)) return data.rows;
    if (Array.isArray(data.data)) return data.data;
    if (data.data && typeof data.data === "object") {
      const nested = data.data as Record<string, unknown>;
      if (Array.isArray(nested.rows)) return nested.rows;
    }
  }
  return [];
};

const parseInteger = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const normalized = Number(trimmed.replace(/\./g, "").replace(/,/g, "."));
    if (Number.isFinite(normalized)) {
      return Math.trunc(normalized);
    }
  }

  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }

  return null;
};

const parseBoolean = (value: unknown): boolean => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return ["true", "1", "yes", "sim", "habilitado", "ativo"].includes(normalized);
  }
  return false;
};

const parsePrice = (value: unknown): string => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toString();
  }
  if (typeof value === "string") {
    return value;
  }
  return "";
};

const parseNumberId = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const normalized = Number(value);
    if (Number.isFinite(normalized)) {
      return normalized;
    }
  }
  return null;
};

const normalizeModuleIds = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const unique: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const trimmed = entry.trim();
    if (!trimmed || unique.includes(trimmed)) continue;
    unique.push(trimmed);
  }
  return unique;
};

const parsePlan = (raw: unknown): Plan | null => {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  const id = parseNumberId(data.id);
  if (id == null) return null;
  const name =
    typeof data.nome === "string"
      ? data.nome
      : typeof data.name === "string"
        ? data.name
        : typeof data.descricao === "string"
          ? data.descricao
          : "";

  const modules = normalizeModuleIds(
    data.modulos ?? data.modules ?? data.recursos ?? data.features ?? []
  );

  const userLimit =
    parseInteger(data.qtde_usuarios ?? data.userLimit ?? data.limiteUsuarios ?? data.maxUsers) ?? null;
  const processLimit =
    parseInteger(
      data.max_casos ??
        data.maxCases ??
        data.limite_processos ??
        data.processLimit ??
        data.maxProcessos
    ) ?? null;
  const proposalLimit =
    parseInteger(
      data.limite_propostas ??
        data.proposalLimit ??
        data.max_propostas ??
        data.maxPropostas ??
        data.propostasLimit
    ) ?? null;

  const processSyncEnabled = parseBoolean(
    data.sincronizacao_processos_habilitada ??
      data.processSyncEnabled ??
      data.syncProcessos ??
      data.processoSincronizacaoAtiva
  );
  const processSyncQuota =
    parseInteger(
      data.sincronizacao_processos_cota ??
        data.processSyncQuota ??
        data.quotaSincronizacaoProcessos ??
        data.processSyncLimit
    ) ?? null;

  return {
    id,
    name,
    price: parsePrice(data.valor),
    modules,
    userLimit,
    processLimit,
    proposalLimit,
    processSyncEnabled,
    processSyncQuota,
  } satisfies Plan;
};

const formatLimit = (value: number | null): string => {
  if (value == null) return "—";
  return value.toString();
};

const sanitizeLimitInput = (value: string): string => {
  if (!value) return "";
  return value.replace(/[^0-9]/g, "");
};

const orderModules = (modules: string[], available: ModuleInfo[]): string[] => {
  if (modules.length <= 1 || available.length === 0) return [...modules];
  const index = new Map<string, number>();
  available.forEach((module, position) => {
    index.set(module.id, position);
  });
  return [...modules].sort((a, b) => {
    const indexA = index.get(a);
    const indexB = index.get(b);
    if (indexA == null && indexB == null) return a.localeCompare(b);
    if (indexA == null) return 1;
    if (indexB == null) return -1;
    if (indexA === indexB) return a.localeCompare(b);
    return indexA - indexB;
  });
};

interface ModuleMultiSelectProps {
  modules: ModuleInfo[];
  selected: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}

function ModuleMultiSelect({ modules, selected, onChange, disabled }: ModuleMultiSelectProps) {
  const [open, setOpen] = useState(false);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const toggleModule = (moduleId: string) => {
    const next = new Set(selectedSet);
    if (selectedSet.has(moduleId)) {
      next.delete(moduleId);
    } else {
      next.add(moduleId);
    }
    onChange(Array.from(next));
  };

  const triggerLabel = selected.length
    ? `${selected.length} módulo${selected.length > 1 ? "s" : ""} selecionado${selected.length > 1 ? "s" : ""}`
    : "Selecione os módulos";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="justify-between"
          disabled={disabled || modules.length === 0}
        >
          <span className="truncate text-left">{triggerLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(320px,90vw)] p-0">
        <Command>
          <CommandInput placeholder="Buscar módulo..." />
          <CommandList>
            <CommandEmpty>Nenhum módulo encontrado.</CommandEmpty>
            <CommandGroup>
              {modules.map((module) => {
                const isSelected = selectedSet.has(module.id);
                return (
                  <CommandItem
                    key={module.id}
                    value={module.nome}
                    onSelect={() => toggleModule(module.id)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        isSelected ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="flex-1 truncate">{module.nome}</span>
                    {module.categoria ? (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {module.categoria}
                      </span>
                    ) : null}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function joinUrl(base: string, path = "") {
  const normalizedBase = base.replace(/\/+$/, "");
  const normalizedPath = path ? (path.startsWith("/") ? path : `/${path}`) : "";
  return `${normalizedBase}${normalizedPath}`;
}

export default function NewPlan() {
  const apiUrl = getApiBaseUrl();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [availableModules, setAvailableModules] = useState<ModuleInfo[]>([]);
  const [formState, setFormState] = useState<PlanFormState>(initialFormState);
  const [fetching, setFetching] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const moduleLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    availableModules.forEach((module) => {
      map.set(module.id, module.nome);
    });
    return map;
  }, [availableModules]);

  useEffect(() => {
    const fetchData = async () => {
      setFetching(true);
      setFetchError(null);
      try {
        const [modulesResponse, plansResponse] = await Promise.all([
          fetch(joinUrl(apiUrl, "/api/perfis/modulos"), { headers: { Accept: "application/json" } }),
          fetch(joinUrl(apiUrl, "/api/planos"), { headers: { Accept: "application/json" } }),
        ]);

        if (!modulesResponse.ok) {
          throw new Error(`HTTP ${modulesResponse.status}: ${await modulesResponse.text()}`);
        }
        if (!plansResponse.ok) {
          throw new Error(`HTTP ${plansResponse.status}: ${await plansResponse.text()}`);
        }

        const modulesPayload = extractCollection(await modulesResponse.json());
        const parsedModules = modulesPayload
          .map((entry) => {
            if (!entry || typeof entry !== "object") return null;
            const data = entry as Record<string, unknown>;
            const id = typeof data.id === "string" ? data.id : null;
            const nome = typeof data.nome === "string" ? data.nome : null;
            if (!id || !nome) return null;
            return {
              id,
              nome,
              descricao: typeof data.descricao === "string" ? data.descricao : undefined,
              categoria: typeof data.categoria === "string" ? data.categoria : undefined,
            } satisfies ModuleInfo;
          })
          .filter((item): item is ModuleInfo => item !== null);

        setAvailableModules(parsedModules);

        const plansPayload = extractCollection(await plansResponse.json());
        const parsedPlans = plansPayload
          .map((entry) => {
            const parsed = parsePlan(entry);
            if (!parsed) return null;
            return {
              ...parsed,
              modules: orderModules(
                parsed.modules.filter((moduleId) => parsedModules.some((module) => module.id === moduleId)),
                parsedModules
              ),
            } satisfies Plan;
          })
          .filter((item): item is Plan => item !== null);

        setPlans(parsedPlans);
      } catch (error) {
        console.error(error);
        setFetchError(
          error instanceof Error ? error.message : "Não foi possível carregar os dados de planos."
        );
        setAvailableModules([]);
        setPlans([]);
      } finally {
        setFetching(false);
      }
    };

    fetchData();
  }, [apiUrl]);

  useEffect(() => {
    if (availableModules.length === 0) {
      setFormState((prev) => ({ ...prev, modules: [] }));
      return;
    }

    setFormState((prev) => ({
      ...prev,
      modules: orderModules(
        prev.modules.filter((id) => availableModules.some((module) => module.id === id)),
        availableModules
      ),
    }));

    setPlans((prev) =>
      prev.map((plan) => ({
        ...plan,
        modules: orderModules(
          plan.modules.filter((id) => availableModules.some((module) => module.id === id)),
          availableModules
        ),
      }))
    );
  }, [availableModules]);

  const handleModuleChange = (next: string[]) => {
    setFormState((prev) => ({
      ...prev,
      modules: orderModules(
        next.filter((id) => availableModules.some((module) => module.id === id)),
        availableModules
      ),
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (submitting) {
      return;
    }

    const name = formState.name.trim();
    const price = formState.price.trim();
    if (!name || !price) {
      setSubmitError("Informe o nome e o valor do plano.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    const orderedModules = orderModules(formState.modules, availableModules);
    const userLimit = parseInteger(formState.userLimit);
    const processLimit = parseInteger(formState.processLimit);
    const proposalLimit = parseInteger(formState.proposalLimit);
    const processSyncQuota = formState.processSyncEnabled
      ? parseInteger(formState.processSyncQuota)
      : null;

    const payload: Record<string, unknown> = {
      nome: name,
      valor: price,
      modulos: orderedModules,
      recursos: orderedModules,
      qtde_usuarios: userLimit,
      limite_processos: processLimit,
      max_casos: processLimit,
      limite_propostas: proposalLimit,
      sincronizacao_processos_habilitada: formState.processSyncEnabled,
      sincronizacao_processos_cota: formState.processSyncEnabled ? processSyncQuota : null,
    };

    try {
      const response = await fetch(joinUrl(apiUrl, "/api/planos"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const data = await response.json();
      const parsed = parsePlan(data);

      if (parsed) {
        const normalized: Plan = {
          ...parsed,
          modules: orderModules(
            parsed.modules.filter((id) => availableModules.some((module) => module.id === id)),
            availableModules
          ),
        };

        setPlans((prev) => {
          const withoutCurrent = prev.filter((plan) => plan.id !== normalized.id);
          return [...withoutCurrent, normalized];
        });
      } else {
        // Caso a resposta não seja interpretável, refaz o carregamento dos planos.
        setFetching(true);
        try {
          const res = await fetch(joinUrl(apiUrl, "/api/planos"), {
            headers: { Accept: "application/json" },
          });
          if (res.ok) {
            const collection = extractCollection(await res.json());
            const refreshed = collection
              .map((entry) => {
                const item = parsePlan(entry);
                if (!item) return null;
                return {
                  ...item,
                  modules: orderModules(
                    item.modules.filter((id) => availableModules.some((module) => module.id === id)),
                    availableModules
                  ),
                } satisfies Plan;
              })
              .filter((item): item is Plan => item !== null);
            setPlans(refreshed);
          }
        } catch (refreshError) {
          console.error(refreshError);
        } finally {
          setFetching(false);
        }
      }

      setFormState(initialFormState);
    } catch (error) {
      console.error(error);
      setSubmitError(
        error instanceof Error ? error.message : "Não foi possível cadastrar o plano."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const renderModuleBadges = (modules: string[]) => {
    if (modules.length === 0) {
      return <span className="text-sm text-muted-foreground">Nenhum módulo selecionado</span>;
    }

    return (
      <div className="flex flex-wrap gap-2">
        {modules.map((moduleId) => (
          <Badge key={moduleId} variant="secondary">
            {moduleLabelMap.get(moduleId) ?? moduleId}
          </Badge>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-foreground">Planos</h1>
        <p className="text-muted-foreground">Cadastre novos planos e acompanhe os existentes</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-0">
        <Card>
          <CardHeader>
            <CardTitle>Cadastrar novo plano</CardTitle>
            <CardDescription>
              Defina as informações principais, os módulos habilitados e os limites oferecidos no plano.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="plan-name">Nome do plano</Label>
                <Input
                  id="plan-name"
                  placeholder="Ex.: Plano Essencial"
                  value={formState.name}
                  onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
                  disabled={submitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan-price">Valor</Label>
                <Input
                  id="plan-price"
                  placeholder="Ex.: 199,90"
                  value={formState.price}
                  onChange={(event) => setFormState((prev) => ({ ...prev, price: event.target.value }))}
                  disabled={submitting}
                />
                <p className="text-xs text-muted-foreground">
                  Utilize valores numéricos com vírgula ou ponto. Este valor será exibido na listagem de planos.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Módulos habilitados</Label>
              <ModuleMultiSelect
                modules={availableModules}
                selected={formState.modules}
                onChange={handleModuleChange}
                disabled={submitting || (fetching && availableModules.length === 0)}
              />
              {availableModules.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum módulo disponível para seleção.</p>
              ) : (
                <div className="rounded-md border border-dashed p-3">
                  <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Módulos selecionados</p>
                  {renderModuleBadges(formState.modules)}
                </div>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="plan-user-limit">Limite de usuários</Label>
                <Input
                  id="plan-user-limit"
                  placeholder="Ilimitado"
                  inputMode="numeric"
                  value={formState.userLimit}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      userLimit: sanitizeLimitInput(event.target.value),
                    }))
                  }
                  disabled={submitting}
                />
                <p className="text-xs text-muted-foreground">Deixe em branco para ilimitado ou utilize um número inteiro.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan-process-limit">Limite de processos</Label>
                <Input
                  id="plan-process-limit"
                  placeholder="Ilimitado"
                  inputMode="numeric"
                  value={formState.processLimit}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      processLimit: sanitizeLimitInput(event.target.value),
                    }))
                  }
                  disabled={submitting}
                />
                <p className="text-xs text-muted-foreground">Informe a quantidade máxima de processos sincronizados no plano.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan-proposal-limit">Limite de propostas</Label>
                <Input
                  id="plan-proposal-limit"
                  placeholder="Ilimitado"
                  inputMode="numeric"
                  value={formState.proposalLimit}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      proposalLimit: sanitizeLimitInput(event.target.value),
                    }))
                  }
                  disabled={submitting}
                />
                <p className="text-xs text-muted-foreground">Use valores inteiros. Campos em branco manterão o limite aberto.</p>
              </div>
            </div>

            <div className="space-y-4 rounded-lg border p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <Label htmlFor="plan-process-sync" className="text-base">
                    Sincronização de processos
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Habilite para ativar a sincronização automática dos processos e defina a cota mensal.
                  </p>
                </div>
                <Switch
                  id="plan-process-sync"
                  checked={formState.processSyncEnabled}
                  onCheckedChange={(checked) =>
                    setFormState((prev) => ({
                      ...prev,
                      processSyncEnabled: checked,
                      processSyncQuota: checked ? prev.processSyncQuota : "",
                    }))
                  }
                  disabled={submitting}
                />
              </div>

              {formState.processSyncEnabled ? (
                <div className="space-y-2 sm:w-64">
                  <Label htmlFor="plan-process-sync-quota">Cota de sincronizações</Label>
                  <Input
                    id="plan-process-sync-quota"
                    placeholder="Ex.: 50"
                    inputMode="numeric"
                    value={formState.processSyncQuota}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        processSyncQuota: sanitizeLimitInput(event.target.value),
                      }))
                    }
                    disabled={submitting}
                  />
                  <p className="text-xs text-muted-foreground">
                    Defina a quantidade máxima de sincronizações automáticas permitidas para o plano.
                  </p>
                </div>
              ) : null}
            </div>

            {submitError && (
              <Alert variant="destructive">
                <AlertTitle>Não foi possível salvar o plano</AlertTitle>
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            )}
          </CardContent>
          <CardFooter className="justify-end">
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar plano
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </form>

      <Card>
        <CardHeader>
          <CardTitle>Planos cadastrados</CardTitle>
          <CardDescription>Consulte os planos existentes e seus limites configurados.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {fetchError && (
            <Alert variant="destructive">
              <AlertTitle>Erro ao carregar planos</AlertTitle>
              <AlertDescription>{fetchError}</AlertDescription>
            </Alert>
          )}
          {fetching ? (
            <p className="text-sm text-muted-foreground">Carregando planos…</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Módulos</TableHead>
                    <TableHead>Limites</TableHead>
                    <TableHead>Sincronização de processos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plans.map((plan) => (
                    <TableRow key={plan.id}>
                      <TableCell className="align-top font-medium">{plan.name}</TableCell>
                      <TableCell className="align-top">{plan.price}</TableCell>
                      <TableCell className="align-top">{renderModuleBadges(plan.modules)}</TableCell>
                      <TableCell className="align-top">
                        <div className="space-y-1 text-sm">
                          <p>
                            <span className="font-medium">Usuários:</span> {formatLimit(plan.userLimit)}
                          </p>
                          <p>
                            <span className="font-medium">Processos:</span> {formatLimit(plan.processLimit)}
                          </p>
                          <p>
                            <span className="font-medium">Propostas:</span> {formatLimit(plan.proposalLimit)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="space-y-1 text-sm">
                          <Badge variant={plan.processSyncEnabled ? "default" : "outline"}>
                            {plan.processSyncEnabled ? "Habilitada" : "Desabilitada"}
                          </Badge>
                          <p>
                            <span className="font-medium">Cota:</span> {formatLimit(plan.processSyncQuota)}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {plans.length === 0 && !fetching && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        Nenhum plano cadastrado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
