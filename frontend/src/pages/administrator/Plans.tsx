import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Pencil, Loader2, ChevronsUpDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { getApiBaseUrl, joinUrl } from "@/lib/api";
import { routes } from "@/config/routes";
import { useToast } from "@/hooks/use-toast";
import {
  ModuleInfo,
  Plan,
  PlanFormState,
  initialPlanFormState,
  extractCollection,
  parseInteger,
  sanitizeLimitInput,
  orderModules,
  parseModuleInfo,
  parsePlan,
  formatLimit,
  splitFeatureInput,
  buildRecursosPayload,
  extractCurrencyDigits,
  formatCurrencyInputValue,
  parseCurrencyDigits,
  ensureDefaultModules,
} from "./plans-utils";

interface ModuleMultiSelectProps {
  modules: ModuleInfo[];
  selected: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}

const areArraysEqual = (left: string[], right: string[]) =>
  left.length === right.length && left.every((value, index) => value === right[index]);

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
    ? `${selected.length} módulo${selected.length > 1 ? "s" : ""} selecionado${
        selected.length > 1 ? "s" : ""
      }`
    : "Selecione os módulos";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled || modules.length === 0}
        >
          <span className="truncate text-left">{triggerLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(520px,90vw)] p-0">
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

const PRICE_SANITIZE_REGEX = /[^0-9.,-]/g;

const parsePriceCents = (value: string): number | null => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const sanitized = trimmed.replace(PRICE_SANITIZE_REGEX, "");
  if (!sanitized) {
    return null;
  }

  if (sanitized.includes(",")) {
    const normalized = sanitized.replace(/\./g, "").replace(/,/g, ".");
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) {
      const cents = Math.round(parsed * 100);
      return Number.isNaN(cents) ? null : cents;
    }
  }

  const normalized = sanitized.replace(/,/g, ".");
  const parsed = Number(normalized);
  if (Number.isFinite(parsed)) {
    const cents = Math.round(parsed * 100);
    return Number.isNaN(cents) ? null : cents;
  }

  return null;
};

const formatPriceForInput = (value: string): string => {
  if (!value) {
    return "";
  }

  const cents = parsePriceCents(value);
  if (cents == null) {
    return value.trim();
  }

  return formatCurrencyInputValue(String(cents));
};

const formatPriceForDisplay = (value: string): string => {
  const formatted = formatPriceForInput(value);
  if (!formatted) {
    const trimmed = value.trim();
    return trimmed || "—";
  }

  return formatted;
};

const createFormStateFromPlan = (plan: Plan): PlanFormState => ({
  name: plan.name,
  monthlyPrice: formatPriceForInput(plan.monthlyPrice),
  annualPrice: formatPriceForInput(plan.annualPrice),
  modules: [...plan.modules],
  customAvailableFeatures: plan.customAvailableFeatures.join(", "),
  customUnavailableFeatures: plan.customUnavailableFeatures.join(", "),
  clientLimit: plan.clientLimit != null ? String(plan.clientLimit) : "",
  userLimit: plan.userLimit != null ? String(plan.userLimit) : "",
  processLimit: plan.processLimit != null ? String(plan.processLimit) : "",
  proposalLimit: plan.proposalLimit != null ? String(plan.proposalLimit) : "",
  processSyncEnabled: plan.processSyncEnabled,
  processSyncQuota: plan.processSyncQuota != null ? String(plan.processSyncQuota) : "",
});

export default function Plans() {
  const apiUrl = getApiBaseUrl();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [availableModules, setAvailableModules] = useState<ModuleInfo[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [editFormState, setEditFormState] = useState<PlanFormState>(initialPlanFormState);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editIntimationSyncEnabled, setEditIntimationSyncEnabled] = useState(false);
  const [editIntimationSyncQuota, setEditIntimationSyncQuota] = useState("");
  const [editProcessMonitorLawyerLimit, setEditProcessMonitorLawyerLimit] = useState("");
  const [editIntimationMonitorLawyerLimit, setEditIntimationMonitorLawyerLimit] = useState("");

  const moduleLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    availableModules.forEach((module) => {
      map.set(module.id, module.nome);
    });
    return map;
  }, [availableModules]);

  const matchesPublicConsultation = (value: string | undefined): boolean => {
    if (!value) {
      return false;
    }

    const normalized = value
      .normalize("NFD")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

    return normalized.includes("consulta publica");
  };

  const availablePublicConsultationModules = useMemo(
    () =>
      availableModules.filter(
        (module) =>
          matchesPublicConsultation(module.categoria) || matchesPublicConsultation(module.nome),
      ),
    [availableModules],
  );

  const publicConsultationModuleIdSet = useMemo(
    () => new Set(availablePublicConsultationModules.map((module) => module.id)),
    [availablePublicConsultationModules],
  );


  const normalizePlans = (rawPlans: Plan[], modules: ModuleInfo[]) =>
    rawPlans
      .map((plan) => {
        const moduleIds = Array.isArray(plan.modules) ? plan.modules : [];
        const publicConsultationModuleIds = Array.isArray(plan.publicConsultationModules)
          ? plan.publicConsultationModules
          : [];

        return {
          ...plan,
          modules: orderModules(
            Array.from(
              new Set([
                ...moduleIds,
                ...publicConsultationModuleIds,
              ]),
            ).filter((id) => modules.some((module) => module.id === id)),
            modules
          ),
          publicConsultationModules: orderModules(
            publicConsultationModuleIds.filter((id) =>
              modules.some((module) => module.id === id)
            ),
            modules
          ),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

  const loadInitialData = async () => {
    setLoading(true);
    setError(null);
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
        .map((entry) => parseModuleInfo(entry))
        .filter((item): item is ModuleInfo => item !== null);

      const augmentedModules = ensureDefaultModules(parsedModules);

      const plansPayload = extractCollection(await plansResponse.json());
      const parsedPlans = plansPayload
        .map((entry) => parsePlan(entry))
        .filter((item): item is Plan => item !== null);

      setAvailableModules(augmentedModules);
      setPlans(normalizePlans(parsedPlans, augmentedModules));
    } catch (err) {
      console.error(err);
      setAvailableModules([]);
      setPlans([]);
      setError(err instanceof Error ? err.message : "Não foi possível carregar os planos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiUrl]);

  const refreshPlans = async () => {
    try {
      const response = await fetch(joinUrl(apiUrl, "/api/planos"), {
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const payload = extractCollection(await response.json());
      const parsedPlans = payload
        .map((entry) => parsePlan(entry))
        .filter((item): item is Plan => item !== null);

      setPlans(normalizePlans(parsedPlans, availableModules));
    } catch (err) {
      console.error(err);
      toast({
        title: "Erro ao atualizar planos",
        description: err instanceof Error ? err.message : "Não foi possível atualizar a lista.",
        variant: "destructive",
      });
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

  const renderCustomFeatureBadges = (
    items: string[],
    emptyMessage: string,
    variant: "secondary" | "outline" = "secondary",
  ) => {
    if (items.length === 0) {
      return <span className="text-sm text-muted-foreground">{emptyMessage}</span>;
    }

    return (
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <Badge key={item} variant={variant} className="whitespace-nowrap">
            {item}
          </Badge>
        ))}
      </div>
    );
  };

  const openEditDialog = (plan: Plan) => {
    setEditingPlan(plan);

    const normalizedModules = orderModules(
      Array.from(new Set([...plan.modules, ...plan.publicConsultationModules])).filter((id) =>
        availableModules.some((module) => module.id === id)
      ),
      availableModules,
    );

    setEditFormState({
      ...createFormStateFromPlan(plan),
      modules: normalizedModules,
    });
    setEditPublicConsultationModules(
      orderModules(
        plan.publicConsultationModules.filter((id) =>
          availableModules.some((module) => module.id === id)
        ),
        availableModules
      )
    );

    setEditIntimationSyncEnabled(plan.intimationSyncEnabled);
    setEditIntimationSyncQuota(
      plan.intimationSyncQuota != null ? String(plan.intimationSyncQuota) : ""
    );
    setEditProcessMonitorLawyerLimit(
      plan.processMonitorLawyerLimit != null ? String(plan.processMonitorLawyerLimit) : ""
    );
    setEditIntimationMonitorLawyerLimit(
      plan.intimationMonitorLawyerLimit != null ? String(plan.intimationMonitorLawyerLimit) : ""
    );
    setEditError(null);
    setIsEditDialogOpen(true);
  };

  const closeEditDialog = () => {
    setIsEditDialogOpen(false);
    setEditingPlan(null);
    setEditFormState(initialPlanFormState);
    setEditIntimationSyncEnabled(false);
    setEditIntimationSyncQuota("");
    setEditProcessMonitorLawyerLimit("");
    setEditIntimationMonitorLawyerLimit("");
    setEditError(null);
  };

  const handleEditModuleChange = (modules: string[]) => {
    const normalizedModules = orderModules(
      modules.filter((id) => availableModules.some((module) => module.id === id)),
      availableModules
    );

    setEditFormState((previous) => ({
      ...previous,
      modules: normalizedModules,
    }));
  };

  const editCustomAvailableTopics = useMemo(
    () => splitFeatureInput(editFormState.customAvailableFeatures),
    [editFormState.customAvailableFeatures],
  );

  const editCustomUnavailableTopics = useMemo(
    () => splitFeatureInput(editFormState.customUnavailableFeatures),
    [editFormState.customUnavailableFeatures],
  );

  const handleEditSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!editingPlan || isSavingEdit) {
      return;
    }

    const name = editFormState.name.trim();
    const monthlyPriceDigits = extractCurrencyDigits(editFormState.monthlyPrice);
    const annualPriceDigits = extractCurrencyDigits(editFormState.annualPrice);
    if (!name || !monthlyPriceDigits || !annualPriceDigits) {
      setEditError("Informe o nome, o valor mensal e o valor anual do plano.");
      return;
    }

    const monthlyPriceValue = parseCurrencyDigits(monthlyPriceDigits);
    const annualPriceValue = parseCurrencyDigits(annualPriceDigits);
    if (monthlyPriceValue == null || annualPriceValue == null) {
      setEditError("Informe valores numéricos válidos para os preços mensal e anual.");
      return;
    }

    setIsSavingEdit(true);
    setEditError(null);

    const orderedModules = orderModules(editFormState.modules, availableModules);
    const orderedPublicConsultationModules = orderModules(
      orderedModules.filter((id) => publicConsultationModuleIdSet.has(id)),
      availableModules
    );
    const clientLimit = parseInteger(editFormState.clientLimit);
    const userLimit = parseInteger(editFormState.userLimit);
    const processLimit = parseInteger(editFormState.processLimit);
    const proposalLimit = parseInteger(editFormState.proposalLimit);
    const processSyncQuota = editFormState.processSyncEnabled
      ? parseInteger(editFormState.processSyncQuota)
      : null;
    const intimationSyncQuotaValue = editIntimationSyncEnabled
      ? parseInteger(editIntimationSyncQuota)
      : null;
    const customAvailable = splitFeatureInput(editFormState.customAvailableFeatures);
    const customUnavailable = splitFeatureInput(editFormState.customUnavailableFeatures);
    const processMonitorLawyerLimitValue = parseInteger(editProcessMonitorLawyerLimit);
    const intimationMonitorLawyerLimitValue = parseInteger(editIntimationMonitorLawyerLimit);

    const payload: Record<string, unknown> = {
      nome: name,
      valor_mensal: monthlyPriceValue,
      valor_anual: annualPriceValue,
      valor: monthlyPriceValue,
      modulos: orderedModules,
      recursos: buildRecursosPayload({
        modules: orderedModules,
        customAvailable,
        customUnavailable,
      }),
      limite_clientes: clientLimit,
      clientes_limit: clientLimit,
      client_limit: clientLimit,
      limite_usuarios: userLimit,
      qtde_usuarios: userLimit,
      limite_processos: processLimit,
      max_casos: processLimit,
      limite_propostas: proposalLimit,
      sincronizacao_processos_habilitada: editFormState.processSyncEnabled,
      sincronizacao_processos_cota: editFormState.processSyncEnabled ? processSyncQuota : null,
      consulta_publica_modulos: orderedPublicConsultationModules,
      consultaPublicaModulos: orderedPublicConsultationModules,
      publicConsultationModules: orderedPublicConsultationModules,
      recursos_consulta_publica: orderedPublicConsultationModules,
      sincronizacao_intimacoes_habilitada: editIntimationSyncEnabled,
      sincronizacaoIntimacoesHabilitada: editIntimationSyncEnabled,
      intimationSyncEnabled: editIntimationSyncEnabled,
      sincronizacao_intimacoes_cota: editIntimationSyncEnabled ? intimationSyncQuotaValue : null,
      sincronizacaoIntimacoesCota: editIntimationSyncEnabled ? intimationSyncQuotaValue : null,
      intimationSyncQuota: editIntimationSyncEnabled ? intimationSyncQuotaValue : null,
      limite_advogados_processos: processMonitorLawyerLimitValue,
      limiteAdvogadosProcessos: processMonitorLawyerLimitValue,
      limite_advogados_processos_monitorados: processMonitorLawyerLimitValue,
      processMonitorLawyerLimit: processMonitorLawyerLimitValue,
      limite_advogados_intimacoes: intimationMonitorLawyerLimitValue,
      limiteAdvogadosIntimacoes: intimationMonitorLawyerLimitValue,
      limite_advogados_intimacoes_monitoradas: intimationMonitorLawyerLimitValue,
      intimationMonitorLawyerLimit: intimationMonitorLawyerLimitValue,
    };

    try {
      const response = await fetch(joinUrl(apiUrl, `/api/planos/${editingPlan.id}`), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      let updatedPlan: Plan | null = null;
      try {
        const data = await response.json();
        const parsed = parsePlan(data);
        if (parsed) {
          updatedPlan = {
            ...parsed,
            modules: orderModules(
              Array.from(
                new Set([
                  ...parsed.modules,
                  ...parsed.publicConsultationModules,
                ]).filter((id) => availableModules.some((module) => module.id === id)),
              ),
              availableModules
            ),
            publicConsultationModules: orderModules(
              parsed.publicConsultationModules.filter((id) =>
                availableModules.some((module) => module.id === id)
              ),
              availableModules
            ),
          };
        }
      } catch {
        // Resposta sem corpo JSON; será tratado pelo refresh abaixo
      }

      if (updatedPlan) {
        setPlans((previous) =>
          normalizePlans(
            previous.map((plan) => (plan.id === updatedPlan!.id ? updatedPlan! : plan)),
            availableModules
          )
        );
      } else {
        await refreshPlans();
      }

      toast({
        title: "Plano atualizado",
        description: `O plano ${name} foi atualizado com sucesso.`,
      });
      closeEditDialog();
    } catch (err) {
      console.error(err);
      setEditError(err instanceof Error ? err.message : "Não foi possível atualizar o plano.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Planos</h1>
          <p className="text-muted-foreground">
            Consulte os planos cadastrados, visualize seus limites e atualize as configurações conforme necessário.
          </p>
        </div>
        <Button onClick={() => navigate(routes.admin.newPlan)}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Plano
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Planos cadastrados</CardTitle>
          <CardDescription>Visualize os módulos, limites e opções de sincronização configurados para cada plano.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Erro ao carregar planos</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando planos…</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Preços</TableHead>
                    <TableHead>Módulos</TableHead>
                    <TableHead>Limites</TableHead>
                    <TableHead>Sincronização de processos</TableHead>
                    <TableHead className="w-[140px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plans.map((plan) => (
                    <TableRow key={plan.id}>
                      <TableCell className="align-top font-medium">{plan.name}</TableCell>
                      <TableCell className="align-top">
                        <div className="space-y-1 text-sm">
                          <p>
                            <span className="font-medium">Mensal:</span>{" "}
                            {formatPriceForDisplay(plan.monthlyPrice)}
                          </p>
                          <p>
                            <span className="font-medium">Anual:</span>{" "}
                            {formatPriceForDisplay(plan.annualPrice)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="align-top">{renderModuleBadges(plan.modules)}</TableCell>
                      <TableCell className="align-top">
                        <div className="space-y-1 text-sm">
                          <p>
                            <span className="font-medium">Clientes:</span> {formatLimit(plan.clientLimit)}
                          </p>
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
                      <TableCell className="align-top">
                        <Button variant="outline" size="sm" className="w-full" onClick={() => openEditDialog(plan)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Editar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {plans.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                        Nenhum plano cadastrado.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeEditDialog();
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar plano</DialogTitle>
            <DialogDescription>Atualize as informações do plano selecionado.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="edit-plan-name">Nome do plano</Label>
                <Input
                  id="edit-plan-name"
                  value={editFormState.name}
                  onChange={(event) =>
                    setEditFormState((prev) => ({
                      ...prev,
                      name: event.target.value,
                    }))
                  }
                  disabled={isSavingEdit}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-plan-monthly-price">Valor mensal</Label>
                <Input
                  id="edit-plan-monthly-price"
                  value={editFormState.monthlyPrice}
                  inputMode="decimal"
                  onChange={(event) => {
                    const digits = extractCurrencyDigits(event.target.value);
                    setEditFormState((prev) => ({
                      ...prev,
                      monthlyPrice: formatCurrencyInputValue(digits),
                    }));
                  }}
                  disabled={isSavingEdit}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-plan-annual-price">Valor anual</Label>
                <Input
                  id="edit-plan-annual-price"
                  value={editFormState.annualPrice}
                  inputMode="decimal"
                  onChange={(event) => {
                    const digits = extractCurrencyDigits(event.target.value);
                    setEditFormState((prev) => ({
                      ...prev,
                      annualPrice: formatCurrencyInputValue(digits),
                    }));
                  }}
                  disabled={isSavingEdit}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Módulos disponíveis</Label>
              <ModuleMultiSelect
                modules={availableModules}
                selected={editFormState.modules}
                onChange={handleEditModuleChange}
                disabled={isSavingEdit}
              />
              {renderModuleBadges(editFormState.modules)}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-plan-custom-available">Recursos adicionais disponíveis</Label>
                <Textarea
                  id="edit-plan-custom-available"
                  value={editFormState.customAvailableFeatures}
                  onChange={(event) =>
                    setEditFormState((prev) => ({
                      ...prev,
                      customAvailableFeatures: event.target.value,
                    }))
                  }
                  disabled={isSavingEdit}
                />
                <p className="text-xs text-muted-foreground">
                  Separe os itens com vírgula para manter os tópicos organizados.
                </p>
                {renderCustomFeatureBadges(
                  editCustomAvailableTopics,
                  "Nenhum recurso adicional informado",
                  "secondary",
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-plan-custom-unavailable">Recursos não incluídos</Label>
                <Textarea
                  id="edit-plan-custom-unavailable"
                  value={editFormState.customUnavailableFeatures}
                  onChange={(event) =>
                    setEditFormState((prev) => ({
                      ...prev,
                      customUnavailableFeatures: event.target.value,
                    }))
                  }
                  disabled={isSavingEdit}
                />
                <p className="text-xs text-muted-foreground">
                  Liste o que não está disponível neste plano para evitar dúvidas.
                </p>
                {renderCustomFeatureBadges(
                  editCustomUnavailableTopics,
                  "Nenhum recurso indisponível informado",
                  "outline",
                )}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="edit-plan-client-limit">Limite de clientes</Label>
                <Input
                  id="edit-plan-client-limit"
                  inputMode="numeric"
                  value={editFormState.clientLimit}
                  onChange={(event) =>
                    setEditFormState((prev) => ({
                      ...prev,
                      clientLimit: sanitizeLimitInput(event.target.value),
                    }))
                  }
                  disabled={isSavingEdit}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-plan-user-limit">Limite de usuários</Label>
                <Input
                  id="edit-plan-user-limit"
                  inputMode="numeric"
                  value={editFormState.userLimit}
                  onChange={(event) =>
                    setEditFormState((prev) => ({
                      ...prev,
                      userLimit: sanitizeLimitInput(event.target.value),
                    }))
                  }
                  disabled={isSavingEdit}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-plan-process-limit">Limite de processos</Label>
                <Input
                  id="edit-plan-process-limit"
                  inputMode="numeric"
                  value={editFormState.processLimit}
                  onChange={(event) =>
                    setEditFormState((prev) => ({
                      ...prev,
                      processLimit: sanitizeLimitInput(event.target.value),
                    }))
                  }
                  disabled={isSavingEdit}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-plan-proposal-limit">Limite de propostas</Label>
                <Input
                  id="edit-plan-proposal-limit"
                  inputMode="numeric"
                  value={editFormState.proposalLimit}
                  onChange={(event) =>
                    setEditFormState((prev) => ({
                      ...prev,
                      proposalLimit: sanitizeLimitInput(event.target.value),
                    }))
                  }
                  disabled={isSavingEdit}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-plan-process-monitor-lawyer-limit">
                  Advogados monitorados (processos)
                </Label>
                <Input
                  id="edit-plan-process-monitor-lawyer-limit"
                  inputMode="numeric"
                  value={editProcessMonitorLawyerLimit}
                  onChange={(event) =>
                    setEditProcessMonitorLawyerLimit(
                      sanitizeLimitInput(event.target.value)
                    )
                  }
                  disabled={isSavingEdit}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-plan-intimation-monitor-lawyer-limit">
                  Advogados monitorados (intimações)
                </Label>
                <Input
                  id="edit-plan-intimation-monitor-lawyer-limit"
                  inputMode="numeric"
                  value={editIntimationMonitorLawyerLimit}
                  onChange={(event) =>
                    setEditIntimationMonitorLawyerLimit(
                      sanitizeLimitInput(event.target.value)
                    )
                  }
                  disabled={isSavingEdit}
                />
              </div>
            </div>

            <div className="space-y-4 rounded-lg border p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <Label htmlFor="edit-plan-process-sync" className="text-base">
                    Sincronização de processos
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Defina se a sincronização automática está habilitada para este plano e, se necessário, ajuste a cota mensal.
                  </p>
                </div>
                <Switch
                  id="edit-plan-process-sync"
                  checked={editFormState.processSyncEnabled}
                  onCheckedChange={(checked) =>
                    setEditFormState((prev) => ({
                      ...prev,
                      processSyncEnabled: checked,
                      processSyncQuota: checked ? prev.processSyncQuota : "",
                    }))
                  }
                  disabled={isSavingEdit}
                />
              </div>

              {editFormState.processSyncEnabled ? (
                <div className="space-y-2 sm:w-64">
                  <Label htmlFor="edit-plan-process-sync-quota">Cota de sincronizações</Label>
                  <Input
                    id="edit-plan-process-sync-quota"
                    inputMode="numeric"
                    value={editFormState.processSyncQuota}
                    onChange={(event) =>
                      setEditFormState((prev) => ({
                        ...prev,
                        processSyncQuota: sanitizeLimitInput(event.target.value),
                      }))
                    }
                    disabled={isSavingEdit}
                  />
                </div>
              ) : null}
            </div>

            <div className="space-y-4 rounded-lg border p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <Label htmlFor="edit-plan-intimation-sync" className="text-base">
                    Sincronização de intimações
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Utilize esta opção para controlar a sincronização automática de intimações e,
                    se necessário, ajuste a cota mensal disponível para o plano.
                  </p>
                </div>
                <Switch
                  id="edit-plan-intimation-sync"
                  checked={editIntimationSyncEnabled}
                  onCheckedChange={(checked) => {
                    setEditIntimationSyncEnabled(checked);
                    if (!checked) {
                      setEditIntimationSyncQuota("");
                    }
                  }}
                  disabled={isSavingEdit}
                />
              </div>

              {editIntimationSyncEnabled ? (
                <div className="space-y-2 sm:w-64">
                  <Label htmlFor="edit-plan-intimation-sync-quota">Cota de intimações</Label>
                  <Input
                    id="edit-plan-intimation-sync-quota"
                    inputMode="numeric"
                    value={editIntimationSyncQuota}
                    onChange={(event) =>
                      setEditIntimationSyncQuota(
                        sanitizeLimitInput(event.target.value)
                      )
                    }
                    disabled={isSavingEdit}
                  />
                </div>
              ) : null}
            </div>

            {editError ? (
              <Alert variant="destructive">
                <AlertTitle>Erro ao atualizar plano</AlertTitle>
                <AlertDescription>{editError}</AlertDescription>
              </Alert>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeEditDialog} disabled={isSavingEdit}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSavingEdit}>
                {isSavingEdit ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Salvar alterações"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
