import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Pencil, Loader2, ChevronsUpDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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
  parseDecimal,
  sanitizeLimitInput,
  orderModules,
  parseModuleInfo,
  parsePlan,
  formatLimit,
} from "./plans-utils";

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

const createFormStateFromPlan = (plan: Plan): PlanFormState => ({
  name: plan.name,
  monthlyPrice: plan.monthlyPrice,
  annualPrice: plan.annualPrice,
  modules: [...plan.modules],
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

  const moduleLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    availableModules.forEach((module) => {
      map.set(module.id, module.nome);
    });
    return map;
  }, [availableModules]);

  const normalizePlans = (rawPlans: Plan[], modules: ModuleInfo[]) =>
    rawPlans
      .map((plan) => ({
        ...plan,
        modules: orderModules(
          plan.modules.filter((id) => modules.some((module) => module.id === id)),
          modules
        ),
      }))
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

      const plansPayload = extractCollection(await plansResponse.json());
      const parsedPlans = plansPayload
        .map((entry) => parsePlan(entry))
        .filter((item): item is Plan => item !== null);

      setAvailableModules(parsedModules);
      setPlans(normalizePlans(parsedPlans, parsedModules));
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

  const openEditDialog = (plan: Plan) => {
    setEditingPlan(plan);
    setEditFormState(createFormStateFromPlan(plan));
    setEditError(null);
    setIsEditDialogOpen(true);
  };

  const closeEditDialog = () => {
    setIsEditDialogOpen(false);
    setEditingPlan(null);
    setEditFormState(initialPlanFormState);
    setEditError(null);
  };

  const handleEditModuleChange = (modules: string[]) => {
    setEditFormState((previous) => ({
      ...previous,
      modules: orderModules(
        modules.filter((id) => availableModules.some((module) => module.id === id)),
        availableModules
      ),
    }));
  };

  const handleEditSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!editingPlan || isSavingEdit) {
      return;
    }

    const name = editFormState.name.trim();
    const monthlyPriceInput = editFormState.monthlyPrice.trim();
    const annualPriceInput = editFormState.annualPrice.trim();
    if (!name || !monthlyPriceInput || !annualPriceInput) {
      setEditError("Informe o nome, o valor mensal e o valor anual do plano.");
      return;
    }

    const monthlyPriceValue = parseDecimal(monthlyPriceInput);
    const annualPriceValue = parseDecimal(annualPriceInput);
    if (monthlyPriceValue == null || annualPriceValue == null) {
      setEditError("Informe valores numéricos válidos para os preços mensal e anual.");
      return;
    }

    setIsSavingEdit(true);
    setEditError(null);

    const orderedModules = orderModules(editFormState.modules, availableModules);
    const userLimit = parseInteger(editFormState.userLimit);
    const processLimit = parseInteger(editFormState.processLimit);
    const proposalLimit = parseInteger(editFormState.proposalLimit);
    const processSyncQuota = editFormState.processSyncEnabled
      ? parseInteger(editFormState.processSyncQuota)
      : null;

    const payload: Record<string, unknown> = {
      nome: name,
      valor_mensal: monthlyPriceValue,
      valor_anual: annualPriceValue,
      valor: monthlyPriceValue,
      modulos: orderedModules,
      recursos: orderedModules,
      limite_usuarios: userLimit,
      qtde_usuarios: userLimit,
      limite_processos: processLimit,
      max_casos: processLimit,
      limite_propostas: proposalLimit,
      sincronizacao_processos_habilitada: editFormState.processSyncEnabled,
      sincronizacao_processos_cota: editFormState.processSyncEnabled ? processSyncQuota : null,
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
              parsed.modules.filter((id) => availableModules.some((module) => module.id === id)),
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
                            {plan.monthlyPrice || "—"}
                          </p>
                          <p>
                            <span className="font-medium">Anual:</span>{" "}
                            {plan.annualPrice || "—"}
                          </p>
                        </div>
                      </TableCell>
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
        <DialogContent className="sm:max-w-2xl">
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
                  onChange={(event) =>
                    setEditFormState((prev) => ({
                      ...prev,
                      monthlyPrice: event.target.value,
                    }))
                  }
                  disabled={isSavingEdit}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-plan-annual-price">Valor anual</Label>
                <Input
                  id="edit-plan-annual-price"
                  value={editFormState.annualPrice}
                  onChange={(event) =>
                    setEditFormState((prev) => ({
                      ...prev,
                      annualPrice: event.target.value,
                    }))
                  }
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

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
