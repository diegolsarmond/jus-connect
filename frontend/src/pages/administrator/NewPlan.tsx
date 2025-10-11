import { FormEvent, useEffect, useMemo, useState } from "react";
import { Plus, Loader2, ChevronsUpDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { getApiBaseUrl, joinUrl } from "@/lib/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  ModuleInfo,
  PlanFormState,
  initialPlanFormState,
  extractCollection,
  parseInteger,
  sanitizeLimitInput,
  orderModules,
  parseModuleInfo,
  extractCurrencyDigits,
  formatCurrencyInputValue,
  parseCurrencyDigits,
  splitFeatureInput,
  buildRecursosPayload,
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
      <PopoverContent className="w-[min(420px,90vw)] p-0">
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

export default function NewPlan() {
  const apiUrl = getApiBaseUrl();
  const [availableModules, setAvailableModules] = useState<ModuleInfo[]>([]);
  const [formState, setFormState] = useState<PlanFormState>(initialPlanFormState);
  const [loadingModules, setLoadingModules] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [intimationSyncEnabled, setIntimationSyncEnabled] = useState(false);
  const [intimationSyncQuota, setIntimationSyncQuota] = useState("");
  const [processMonitorLawyerLimit, setProcessMonitorLawyerLimit] = useState("");
  const [intimationMonitorLawyerLimit, setIntimationMonitorLawyerLimit] = useState("");

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
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim()
      .toLowerCase();

    return /\bconsultas?\s+publicas?\b/.test(normalized);
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

  const customAvailableTopics = useMemo(
    () => splitFeatureInput(formState.customAvailableFeatures),
    [formState.customAvailableFeatures],
  );

  const customUnavailableTopics = useMemo(
    () => splitFeatureInput(formState.customUnavailableFeatures),
    [formState.customUnavailableFeatures],
  );

  useEffect(() => {
    let disposed = false;

    const fetchModules = async () => {
      setLoadingModules(true);
      setFetchError(null);
      try {
        const response = await fetch(joinUrl(apiUrl, "/api/perfis/modulos"), {
          headers: { Accept: "application/json" },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }

        const payload = extractCollection(await response.json());
        const parsedModules = payload
          .map((entry) => parseModuleInfo(entry))
          .filter((item): item is ModuleInfo => item !== null);

        if (!disposed) {
          setAvailableModules(ensureDefaultModules(parsedModules));
        }
      } catch (error) {
        if (!disposed) {
          console.error(error);
          setFetchError(
            error instanceof Error
              ? error.message
              : "Não foi possível carregar a lista de módulos."
          );
          setAvailableModules([]);
        }
      } finally {
        if (!disposed) {
          setLoadingModules(false);
        }
      }
    };

    fetchModules();

    return () => {
      disposed = true;
    };
  }, [apiUrl]);

  useEffect(() => {
    setFormState((prev) => {
      const normalizedModules = orderModules(
        prev.modules.filter((id) => availableModules.some((module) => module.id === id)),
        availableModules
      );

      if (areArraysEqual(prev.modules, normalizedModules)) {
        return prev;
      }

      return {
        ...prev,
        modules: normalizedModules,
      };
    });
  }, [availableModules]);

  const handleModuleChange = (next: string[]) => {
    const normalizedModules = orderModules(
      next.filter((id) => availableModules.some((module) => module.id === id)),
      availableModules
    );

    setFormState((prev) => ({
      ...prev,
      modules: normalizedModules,
    }));
  };

  const handleMonthlyPriceChange = (value: string) => {
    const digits = extractCurrencyDigits(value);
    setFormState((prev) => ({
      ...prev,
      monthlyPrice: formatCurrencyInputValue(digits),
    }));
  };

  const handleAnnualPriceChange = (value: string) => {
    const digits = extractCurrencyDigits(value);
    setFormState((prev) => ({
      ...prev,
      annualPrice: formatCurrencyInputValue(digits),
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (submitting) {
      return;
    }

    const name = formState.name.trim();
    const monthlyPriceDigits = extractCurrencyDigits(formState.monthlyPrice);
    const annualPriceDigits = extractCurrencyDigits(formState.annualPrice);
    if (!name || !monthlyPriceDigits || !annualPriceDigits) {
      setSubmitError("Informe o nome, o valor mensal e o valor anual do plano.");
      setSubmitSuccess(null);
      return;
    }

    const monthlyPriceValue = parseCurrencyDigits(monthlyPriceDigits);
    const annualPriceValue = parseCurrencyDigits(annualPriceDigits);
    if (monthlyPriceValue == null || annualPriceValue == null) {
      setSubmitError("Informe valores numéricos válidos para os preços mensal e anual.");
      setSubmitSuccess(null);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    const orderedModules = orderModules(formState.modules, availableModules);
    const orderedPublicConsultationModules = orderModules(
      orderedModules.filter((id) => publicConsultationModuleIdSet.has(id)),
      availableModules,
    );
    const clientLimit = parseInteger(formState.clientLimit);
    const userLimit = parseInteger(formState.userLimit);
    const processLimit = parseInteger(formState.processLimit);
    const proposalLimit = parseInteger(formState.proposalLimit);
    const processSyncQuota = formState.processSyncEnabled
      ? parseInteger(formState.processSyncQuota)
      : null;
    const intimationSyncQuotaValue = intimationSyncEnabled
      ? parseInteger(intimationSyncQuota)
      : null;
    const customAvailable = splitFeatureInput(formState.customAvailableFeatures);
    const customUnavailable = splitFeatureInput(formState.customUnavailableFeatures);
    const processMonitorLawyerLimitValue = parseInteger(processMonitorLawyerLimit);
    const intimationMonitorLawyerLimitValue = parseInteger(intimationMonitorLawyerLimit);

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
      sincronizacao_processos_habilitada: formState.processSyncEnabled,
      sincronizacao_processos_cota: formState.processSyncEnabled ? processSyncQuota : null,
      sincronizacao_processos_limite: formState.processSyncEnabled ? processSyncQuota : null,
      sincronizacaoProcessosLimite: formState.processSyncEnabled ? processSyncQuota : null,
      processSyncLimit: formState.processSyncEnabled ? processSyncQuota : null,
      consulta_publica_modulos: orderedPublicConsultationModules,
      consultaPublicaModulos: orderedPublicConsultationModules,
      publicConsultationModules: orderedPublicConsultationModules,
      recursos_consulta_publica: orderedPublicConsultationModules,
      sincronizacao_intimacoes_habilitada: intimationSyncEnabled,
      sincronizacaoIntimacoesHabilitada: intimationSyncEnabled,
      intimationSyncEnabled: intimationSyncEnabled,
      sincronizacao_intimacoes_cota: intimationSyncEnabled ? intimationSyncQuotaValue : null,
      sincronizacaoIntimacoesCota: intimationSyncEnabled ? intimationSyncQuotaValue : null,
      sincronizacao_intimacoes_limite: intimationSyncEnabled ? intimationSyncQuotaValue : null,
      sincronizacaoIntimacoesLimite: intimationSyncEnabled ? intimationSyncQuotaValue : null,
      intimationSyncLimit: intimationSyncEnabled ? intimationSyncQuotaValue : null,
      intimationSyncQuota: intimationSyncEnabled ? intimationSyncQuotaValue : null,
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

      setFormState(initialPlanFormState);
      setIntimationSyncEnabled(false);
      setIntimationSyncQuota("");
      setProcessMonitorLawyerLimit("");
      setIntimationMonitorLawyerLimit("");
      setSubmitSuccess(`Plano "${name}" cadastrado com sucesso.`);
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-foreground">Planos</h1>
        <p className="text-muted-foreground">
          Cadastre novos planos e defina os módulos e limites disponíveis para cada oferta.
        </p>
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
                <Label htmlFor="plan-monthly-price">Valor mensal</Label>
                <Input
                  id="plan-monthly-price"
                  placeholder="Ex.: 199,90"
                  value={formState.monthlyPrice}
                  inputMode="decimal"
                  onChange={(event) => handleMonthlyPriceChange(event.target.value)}
                  disabled={submitting}
                />
                <p className="text-xs text-muted-foreground">
                  Utilize valores numéricos com vírgula ou ponto. Este valor será exibido na listagem de planos.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan-annual-price">Valor anual</Label>
                <Input
                  id="plan-annual-price"
                  placeholder="Ex.: 1999,90"
                  value={formState.annualPrice}
                  inputMode="decimal"
                  onChange={(event) => handleAnnualPriceChange(event.target.value)}
                  disabled={submitting}
                />
                <p className="text-xs text-muted-foreground">
                  Informe o valor cobrado na contratação anual do plano.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Módulos disponíveis</Label>
                <ModuleMultiSelect
                  modules={availableModules}
                  selected={formState.modules}
                  onChange={handleModuleChange}
                  disabled={loadingModules || submitting}
                />
                {loadingModules ? (
                  <p className="text-xs text-muted-foreground">Carregando módulos…</p>
                ) : null}
                {renderModuleBadges(formState.modules)}
              </div>
              {fetchError ? (
                <Alert variant="destructive">
                  <AlertTitle>Não foi possível carregar os módulos</AlertTitle>
                  <AlertDescription>{fetchError}</AlertDescription>
                </Alert>
              ) : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="plan-custom-available">Recursos adicionais disponíveis</Label>
                <Textarea
                  id="plan-custom-available"
                  placeholder="Ex.: Controle de audiências, Central de tarefas"
                  value={formState.customAvailableFeatures}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      customAvailableFeatures: event.target.value,
                    }))
                  }
                  disabled={submitting}
                />
                <p className="text-xs text-muted-foreground">
                  Separe cada item com vírgula para criarmos os tópicos automaticamente.
                </p>
                {renderCustomFeatureBadges(
                  customAvailableTopics,
                  "Nenhum recurso adicional informado",
                  "secondary",
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan-custom-unavailable">Recursos não incluídos</Label>
                <Textarea
                  id="plan-custom-unavailable"
                  placeholder="Ex.: Integração com tribunais, Gestão financeira"
                  value={formState.customUnavailableFeatures}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      customUnavailableFeatures: event.target.value,
                    }))
                  }
                  disabled={submitting}
                />
                <p className="text-xs text-muted-foreground">
                  Informe o que não está contemplado neste plano para orientar sua equipe.
                </p>
                {renderCustomFeatureBadges(
                  customUnavailableTopics,
                  "Nenhum recurso indisponível informado",
                  "outline",
                )}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="plan-client-limit">Limite de clientes</Label>
                <Input
                  id="plan-client-limit"
                  placeholder="Ilimitado"
                  inputMode="numeric"
                  value={formState.clientLimit}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      clientLimit: sanitizeLimitInput(event.target.value),
                    }))
                  }
                  disabled={submitting}
                />
                <p className="text-xs text-muted-foreground">
                  Use valores inteiros. Campos em branco manterão o limite aberto.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan-process-monitor-lawyer-limit">
                  Advogados com processos monitorados
                </Label>
                <Input
                  id="plan-process-monitor-lawyer-limit"
                  placeholder="Ilimitado"
                  inputMode="numeric"
                  value={processMonitorLawyerLimit}
                  onChange={(event) =>
                    setProcessMonitorLawyerLimit(sanitizeLimitInput(event.target.value))
                  }
                  disabled={submitting}
                />
                <p className="text-xs text-muted-foreground">
                  Define quantos advogados podem ter OAB monitorada para processos.
                </p>
              </div>
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
                <p className="text-xs text-muted-foreground">
                  Use valores inteiros. Campos em branco manterão o limite aberto.
                </p>
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
                <p className="text-xs text-muted-foreground">
                  Use valores inteiros. Campos em branco manterão o limite aberto.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan-intimation-monitor-lawyer-limit">
                  Advogados com intimações monitoradas
                </Label>
                <Input
                  id="plan-intimation-monitor-lawyer-limit"
                  placeholder="Ilimitado"
                  inputMode="numeric"
                  value={intimationMonitorLawyerLimit}
                  onChange={(event) =>
                    setIntimationMonitorLawyerLimit(sanitizeLimitInput(event.target.value))
                  }
                  disabled={submitting}
                />
                <p className="text-xs text-muted-foreground">
                  Define quantos advogados podem receber intimações monitoradas.
                </p>
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

            <div className="space-y-4 rounded-lg border p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <Label htmlFor="plan-intimation-sync" className="text-base">
                    Sincronização de intimações
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Controle o recebimento automático de intimações e configure a cota mensal permitida.
                  </p>
                </div>
                <Switch
                  id="plan-intimation-sync"
                  checked={intimationSyncEnabled}
                  onCheckedChange={(checked) => {
                    setIntimationSyncEnabled(checked);
                    setIntimationSyncQuota((prev) => (checked ? prev : ""));
                  }}
                  disabled={submitting}
                />
              </div>

              {intimationSyncEnabled ? (
                <div className="space-y-2 sm:w-64">
                  <Label htmlFor="plan-intimation-sync-quota">Cota de intimações</Label>
                  <Input
                    id="plan-intimation-sync-quota"
                    placeholder="Ex.: 50"
                    inputMode="numeric"
                    value={intimationSyncQuota}
                    onChange={(event) =>
                      setIntimationSyncQuota(sanitizeLimitInput(event.target.value))
                    }
                    disabled={submitting}
                  />
                  <p className="text-xs text-muted-foreground">
                    Defina a quantidade máxima de intimações sincronizadas automaticamente para o plano.
                  </p>
                </div>
              ) : null}
            </div>

            {submitError ? (
              <Alert variant="destructive">
                <AlertTitle>Não foi possível salvar o plano</AlertTitle>
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            ) : null}

            {submitSuccess ? (
              <Alert>
                <AlertTitle>Plano cadastrado</AlertTitle>
                <AlertDescription>{submitSuccess}</AlertDescription>
              </Alert>
            ) : null}
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
    </div>
  );
}
