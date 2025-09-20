import { useEffect, useState, type FormEvent } from "react";
import {
  KeyRound,
  Link2,
  Plus,
  ShieldCheck,
  Copy,
  Trash2,
  RefreshCcw,
  Loader2,
  PencilLine,
  Webhook as WebhookIcon,
  Info,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import {
  API_KEY_ENVIRONMENT_LABELS,
  API_KEY_PROVIDER_LABELS,
  API_KEY_PROVIDERS,
  type ApiKeyEnvironment,
  type ApiKeyProvider,
  type IntegrationApiKey,
  type UpdateIntegrationApiKeyPayload,
  createIntegrationApiKey,
  fetchIntegrationApiKey,
  deleteIntegrationApiKey,
  fetchIntegrationApiKeys,
  updateIntegrationApiKey,
  getApiKeyProviderLabel,
  getApiKeyEnvironmentLabel,
  validateAsaasIntegrationApiKey,
} from "@/lib/integrationApiKeys";

const randomChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

const generateRandomString = (length: number) => {
  let result = "";
  for (let i = 0; i < length; i += 1) {
    result += randomChars.charAt(Math.floor(Math.random() * randomChars.length));
  }
  return result;
};

const maskCredential = (value: string) => {
  if (value.length <= 8) return value;
  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
};

type ApiEnvironment = ApiKeyEnvironment;

type ApiKey = IntegrationApiKey;

type AuthType = "apiKey" | "oauth" | "basic" | "token" | "webhook";

type SyncFrequency = "realTime" | "hourly" | "daily" | "weekly";

type Integration = {
  id: number;
  name: string;
  system: string;
  authType: AuthType;
  frequency: SyncFrequency;
  endpoint: string;
  enabled: boolean;
  lastSync: string | null;
};

const eventOptions = [
  {
    value: "cliente.criado",
    label: "Cliente criado",
    description: "Disparado quando um novo cliente é cadastrado.",
  },
  {
    value: "cliente.atualizado",
    label: "Cliente atualizado",
    description: "Atualizado quando dados cadastrais sofrem alteração.",
  },
  {
    value: "processo.movimentado",
    label: "Processo movimentado",
    description: "Emitido ao registrar uma movimentação em um processo.",
  },
  {
    value: "tarefa.concluida",
    label: "Tarefa concluída",
    description: "Enviado quando uma tarefa é finalizada pela equipe.",
  },
  {
    value: "financeiro.lancamento",
    label: "Lançamento financeiro",
    description: "Disparado ao criar ou atualizar um lançamento financeiro.",
  },
] as const;

type WebhookEvent = (typeof eventOptions)[number]["value"];

type Webhook = {
  id: number;
  name: string;
  url: string;
  events: WebhookEvent[];
  secret: string;
  active: boolean;
  lastDelivery: string | null;
};

type WebhookForm = {
  name: string;
  url: string;
  events: WebhookEvent[];
  secret: string;
};

type EditApiKeyForm = {
  provider: ApiKeyProvider;
  environment: ApiEnvironment;
  apiUrl: string;
  key: string;
  active: boolean;
};

const resolveProviderLabel = (provider: string) => getApiKeyProviderLabel(provider) || "—";

const resolveEnvironmentLabel = (environment: string) =>
  getApiKeyEnvironmentLabel(environment) || "—";

const environmentOptions = Object.keys(API_KEY_ENVIRONMENT_LABELS) as ApiEnvironment[];

const ASAAS_DEFAULT_ENDPOINTS: Record<ApiEnvironment, string> = {
  producao: "https://api.asaas.com/api/v3",
  homologacao: "https://sandbox.asaas.com/api/v3",
};

const AsaasEndpointTooltip = ({ selectedEnvironment }: { selectedEnvironment: ApiEnvironment }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <span
        className="inline-flex h-6 w-6 cursor-help items-center justify-center rounded-full border border-dashed border-muted-foreground/60 text-muted-foreground transition hover:text-foreground"
        aria-label="Ver endpoints padrão do Asaas"
        role="button"
        tabIndex={0}
      >
        <Info className="h-3.5 w-3.5" />
      </span>
    </TooltipTrigger>
    <TooltipContent className="max-w-xs space-y-2 text-xs">
      <p className="font-medium text-foreground">Endpoints padrão Asaas</p>
      <ul className="space-y-1 text-left">
        {environmentOptions.map((environment) => {
          const isSelected = environment === selectedEnvironment;
          return (
            <li key={environment} className="space-y-0.5">
              <p className="font-medium text-foreground">
                {API_KEY_ENVIRONMENT_LABELS[environment]}
              </p>
              <p
                className={`font-mono ${
                  isSelected ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {ASAAS_DEFAULT_ENDPOINTS[environment]}
                {isSelected ? " • selecionado" : ""}
              </p>
            </li>
          );
        })}
      </ul>
    </TooltipContent>
  </Tooltip>
);

const normalizeProviderValue = (
  value: string | null | undefined,
  fallback: ApiKeyProvider,
): ApiKeyProvider => {
  if (typeof value !== "string") {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }
  return API_KEY_PROVIDERS.includes(normalized as ApiKeyProvider)
    ? (normalized as ApiKeyProvider)
    : fallback;
};

const normalizeEnvironmentValue = (
  value: string | null | undefined,
  fallback: ApiEnvironment,
): ApiEnvironment => {
  if (typeof value !== "string") {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }
  return environmentOptions.includes(normalized as ApiEnvironment)
    ? (normalized as ApiEnvironment)
    : fallback;
};

const authTypeLabels: Record<AuthType, string> = {
  apiKey: "API Key",
  oauth: "OAuth 2.0",
  basic: "Basic Auth",
  token: "Token JWT",
  webhook: "Webhook",
};

const frequencyLabels: Record<SyncFrequency, string> = {
  realTime: "Tempo real",
  hourly: "A cada hora",
  daily: "Diário",
  weekly: "Semanal",
};

const formatDateTime = (value: string | null) => {
  if (!value) return "Sem registros";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
};

const createWebhookSecret = () => `whsec_${generateRandomString(24)}`;

const getDefaultWebhookForm = (): WebhookForm => ({
  name: "",
  url: "",
  events: [eventOptions[0]?.value ?? "cliente.criado"],
  secret: createWebhookSecret(),
});

export default function Integracoes() {
  const { toast } = useToast();
  const fallbackProvider = (API_KEY_PROVIDERS[0] ?? 'gemini') as ApiKeyProvider;
  const fallbackEnvironment = (environmentOptions[0] ?? 'producao') as ApiEnvironment;
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isLoadingApiKeys, setIsLoadingApiKeys] = useState(true);
  const [isSavingApiKey, setIsSavingApiKey] = useState(false);
  const [pendingApiKeyId, setPendingApiKeyId] = useState<number | null>(null);
  const [deletingKeyId, setDeletingKeyId] = useState<number | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingApiKeyId, setEditingApiKeyId] = useState<number | null>(null);
  const [isLoadingEditApiKey, setIsLoadingEditApiKey] = useState(false);
  const [isUpdatingApiKey, setIsUpdatingApiKey] = useState(false);
  const [testingConnectionId, setTestingConnectionId] = useState<number | null>(null);
  const [editApiKeyForm, setEditApiKeyForm] = useState<EditApiKeyForm>({
    provider: fallbackProvider,
    environment: fallbackEnvironment,
    apiUrl: "",
    key: "",
    active: true,
  });
  const [newApiKey, setNewApiKey] = useState({
    provider: fallbackProvider,
    apiUrl: "",
    key: "",
    environment: fallbackEnvironment,
  });
  useEffect(() => {
    let isMounted = true;

    const loadApiKeys = async () => {
      setIsLoadingApiKeys(true);
      try {
        const items = await fetchIntegrationApiKeys();
        if (!isMounted) {
          return;
        }
        setApiKeys(items);
      } catch (error) {
        if (!isMounted) {
          return;
        }
        console.error("Failed to load integration API keys:", error);
        toast({
          title: "Não foi possível carregar as chaves",
          description:
            error instanceof Error
              ? error.message
              : "Erro inesperado ao buscar as chaves de API.",
          variant: "destructive",
        });
      } finally {
        if (isMounted) {
          setIsLoadingApiKeys(false);
        }
      }
    };

    loadApiKeys();

    return () => {
      isMounted = false;
    };
  }, [toast]);

  const resetEditApiKeyState = () => {
    setEditApiKeyForm({
      provider: fallbackProvider,
      environment: fallbackEnvironment,
      apiUrl: "",
      key: "",
      active: true,
    });
    setEditingApiKeyId(null);
    setIsLoadingEditApiKey(false);
    setIsUpdatingApiKey(false);
  };

  const handleEditDialogOpenChange = (open: boolean) => {
    setIsEditDialogOpen(open);
    if (!open) {
      resetEditApiKeyState();
    }
  };

  const startEditApiKey = async (id: number) => {
    setEditingApiKeyId(id);
    setIsEditDialogOpen(true);
    setIsLoadingEditApiKey(true);
    try {
      const apiKey = await fetchIntegrationApiKey(id);
      setEditApiKeyForm({
        provider: normalizeProviderValue(apiKey.provider, fallbackProvider),
        environment: normalizeEnvironmentValue(apiKey.environment, fallbackEnvironment),
        apiUrl: apiKey.apiUrl ?? "",
        key: apiKey.key,
        active: apiKey.active,
      });
    } catch (error) {
      console.error("Failed to load integration API key:", error);
      toast({
        title: "Não foi possível carregar a chave",
        description:
          error instanceof Error
            ? error.message
            : "Erro inesperado ao buscar a chave selecionada.",
        variant: "destructive",
      });
      setIsEditDialogOpen(false);
      resetEditApiKeyState();
    } finally {
      setIsLoadingEditApiKey(false);
    }
  };

  const handleUpdateApiKey = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (editingApiKeyId === null) {
      return;
    }

    const trimmedKey = editApiKeyForm.key.trim();
    const trimmedApiUrl = editApiKeyForm.apiUrl.trim();

    if (!trimmedKey) {
      toast({
        title: "Preencha o valor da chave",
        description: "Informe o valor da chave antes de salvar as alterações.",
        variant: "destructive",
      });
      return;
    }

    setIsUpdatingApiKey(true);
    try {
      const payload: UpdateIntegrationApiKeyPayload = {
        provider: editApiKeyForm.provider,
        environment: editApiKeyForm.environment,
        key: trimmedKey,
        active: editApiKeyForm.active,
        apiUrl: trimmedApiUrl ? trimmedApiUrl : null,
      };

      const updated = await updateIntegrationApiKey(editingApiKeyId, payload);
      setApiKeys((prev) => prev.map((item) => (item.id === editingApiKeyId ? updated : item)));

      const providerLabel = resolveProviderLabel(updated.provider);
      toast({
        title: "Chave atualizada",
        description: `${providerLabel} foi atualizada com sucesso.`,
      });

      handleEditDialogOpenChange(false);
    } catch (error) {
      toast({
        title: "Não foi possível atualizar a chave",
        description:
          error instanceof Error
            ? error.message
            : "Erro inesperado ao atualizar a chave de API.",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingApiKey(false);
    }
  };
  const [integrations, setIntegrations] = useState<Integration[]>([
    {
      id: 1,
      name: "Google Agenda",
      system: "Google Workspace",
      authType: "oauth",
      frequency: "realTime",
      endpoint: "https://www.googleapis.com/calendar/v3/calendars/primary/events",
      enabled: true,
      lastSync: "2024-03-18T12:45:00Z",
    },
    {
      id: 2,
      name: "ERP Financeiro",
      system: "Totvs Protheus",
      authType: "apiKey",
      frequency: "hourly",
      endpoint: "https://erp.empresa.com/api/v1/financeiro",
      enabled: false,
      lastSync: "2024-03-15T09:20:00Z",
    },
    {
      id: 3,
      name: "Slack - notificações",
      system: "Slack",
      authType: "webhook",
      frequency: "realTime",
      endpoint: "https://hooks.slack.com/services/T000/B000/XYZ",
      enabled: true,
      lastSync: "2024-03-18T09:05:00Z",
    },
  ]);
  const [integrationForm, setIntegrationForm] = useState({
    name: "",
    system: "",
    authType: "apiKey" as AuthType,
    frequency: "realTime" as SyncFrequency,
    endpoint: "",
  });
  const [webhooks, setWebhooks] = useState<Webhook[]>([
    {
      id: 1,
      name: "Clientes - Hub de marketing",
      url: "https://hooks.zapier.com/hooks/catch/123456/abc123",
      events: ["cliente.criado", "cliente.atualizado"],
      secret: "whsec_8fb12a9c4d8ef730b1a2c4d5",
      active: true,
      lastDelivery: "2024-03-17T15:40:00Z",
    },
    {
      id: 2,
      name: "Notificações de tarefas",
      url: "https://automacao.empresa.com/webhooks/tarefas",
      events: ["tarefa.concluida"],
      secret: "whsec_c91de02f8b6a43c0f7a1b5d9",
      active: false,
      lastDelivery: null,
    },
  ]);
  const [webhookForm, setWebhookForm] = useState<WebhookForm>(getDefaultWebhookForm);

  const activeApiKeys = apiKeys.filter((key) => key.active).length;
  const activeIntegrations = integrations.filter((integration) => integration.enabled).length;
  const activeWebhooks = webhooks.filter((webhook) => webhook.active).length;

  const handleAddApiKey = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedKey = newApiKey.key.trim();
    const trimmedApiUrl = newApiKey.apiUrl.trim();
    if (!trimmedKey) {
      toast({
        title: "Preencha os dados da chave",
        description: "Informe o valor da chave antes de salvar.",
        variant: "destructive",
      });
      return;
    }

    setIsSavingApiKey(true);
    try {
      const created = await createIntegrationApiKey({
        provider: newApiKey.provider,
        apiUrl: trimmedApiUrl ? trimmedApiUrl : null,
        key: trimmedKey,
        environment: newApiKey.environment,
      });
      setApiKeys((prev) => [created, ...prev]);
      const providerLabel = resolveProviderLabel(created.provider);
      toast({
        title: "Chave adicionada",
        description: `${providerLabel} cadastrada com sucesso.`,
      });
      setNewApiKey((prev) => ({ ...prev, key: "", apiUrl: "" }));
    } catch (error) {
      toast({
        title: "Não foi possível salvar a chave",
        description:
          error instanceof Error
            ? error.message
            : "Erro inesperado ao registrar a chave de API.",
        variant: "destructive",
      });
    } finally {
      setIsSavingApiKey(false);
    }
  };

  const toggleApiKey = async (id: number, value: boolean) => {
    const current = apiKeys.find((item) => item.id === id);
    if (!current) {
      return;
    }

    const providerLabel = resolveProviderLabel(current.provider);
    const previousState = current.active;
    setPendingApiKeyId(id);
    setApiKeys((prev) => prev.map((item) => (item.id === id ? { ...item, active: value } : item)));

    try {
      const updated = await updateIntegrationApiKey(id, { active: value });
      setApiKeys((prev) => prev.map((item) => (item.id === id ? updated : item)));
      toast({
        title: value ? "Chave ativada" : "Chave desativada",
        description: `${providerLabel} agora está ${value ? "ativa" : "inativa"}.`,
      });
    } catch (error) {
      setApiKeys((prev) => prev.map((item) => (item.id === id ? { ...item, active: previousState } : item)));
      toast({
        title: "Não foi possível atualizar a chave",
        description:
          error instanceof Error
            ? error.message
            : "Erro inesperado ao atualizar a chave de API.",
        variant: "destructive",
      });
    } finally {
      setPendingApiKeyId(null);
    }
  };

  const testIntegrationConnection = async (apiKey: ApiKey) => {
    if (apiKey.provider !== "asaas") {
      return;
    }

    const providerLabel = resolveProviderLabel(apiKey.provider);
    const environmentLabel = resolveEnvironmentLabel(apiKey.environment);
    setTestingConnectionId(apiKey.id);

    try {
      const result = await validateAsaasIntegrationApiKey(apiKey.id);
      if (result.success === false) {
        throw new Error(
          result.message?.trim() ||
            `Não foi possível validar ${providerLabel} (${environmentLabel}).`,
        );
      }

      const successDescription = result.message?.trim()
        ? result.message
        : `Conexão com ${providerLabel} (${environmentLabel}) validada com sucesso.`;

      toast({
        title: "Conexão validada",
        description: successDescription,
      });
    } catch (error) {
      toast({
        title: "Falha ao testar conexão",
        description:
          error instanceof Error && error.message.trim()
            ? error.message
            : `Não foi possível validar ${providerLabel} (${environmentLabel}).`,
        variant: "destructive",
      });
    } finally {
      setTestingConnectionId(null);
    }
  };

  const removeApiKey = async (id: number) => {
    const current = apiKeys.find((item) => item.id === id);
    if (!current) {
      return;
    }

    const providerLabel = resolveProviderLabel(current.provider);
    setDeletingKeyId(id);
    try {
      await deleteIntegrationApiKey(id);
      setApiKeys((prev) => prev.filter((item) => item.id !== id));
      toast({
        title: "Chave removida",
        description: `${providerLabel} foi removida.`,
      });
    } catch (error) {
      toast({
        title: "Não foi possível remover a chave",
        description:
          error instanceof Error
            ? error.message
            : "Erro inesperado ao excluir a chave de API.",
        variant: "destructive",
      });
    } finally {
      setDeletingKeyId(null);
    }
  };

  const copyCredential = async (value: string, label: string) => {
    try {
      if (typeof navigator === "undefined" || !navigator.clipboard) {
        throw new Error("Clipboard API indisponível");
      }
      await navigator.clipboard.writeText(value);
      toast({
        title: `${label} copiado`,
        description: "Valor disponível na área de transferência.",
      });
    } catch (error) {
      toast({
        title: "Não foi possível copiar",
        description: value,
        variant: "destructive",
      });
    }
  };

  const handleAddIntegration = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!integrationForm.name.trim() || !integrationForm.system.trim() || !integrationForm.endpoint.trim()) {
      toast({
        title: "Preencha os dados da integração",
        description: "Informe nome, sistema e endpoint de conexão.",
        variant: "destructive",
      });
      return;
    }

    setIntegrations((prev) => [
      ...prev,
      {
        id: Date.now(),
        name: integrationForm.name.trim(),
        system: integrationForm.system.trim(),
        authType: integrationForm.authType,
        frequency: integrationForm.frequency,
        endpoint: integrationForm.endpoint.trim(),
        enabled: true,
        lastSync: null,
      },
    ]);
    toast({
      title: "Integração cadastrada",
      description: `${integrationForm.name} foi adicionada à lista.`,
    });
    setIntegrationForm((prev) => ({
      ...prev,
      name: "",
      system: "",
      endpoint: "",
    }));
  };

  const toggleIntegration = (id: number, value: boolean) => {
    const current = integrations.find((item) => item.id === id);
    setIntegrations((prev) => prev.map((item) => (item.id === id ? { ...item, enabled: value } : item)));
    toast({
      title: value ? "Integração ativada" : "Integração desativada",
      description: current ? `${current.name} agora está ${value ? "ativa" : "pausada"}.` : undefined,
    });
  };

  const removeIntegration = (id: number) => {
    const current = integrations.find((item) => item.id === id);
    setIntegrations((prev) => prev.filter((item) => item.id !== id));
    toast({
      title: "Integração removida",
      description: current ? `${current.name} foi excluída.` : "Integração excluída.",
    });
  };

  const updateWebhookEventSelection = (value: WebhookEvent, checked: boolean) => {
    setWebhookForm((prev) => {
      if (checked) {
        if (prev.events.includes(value)) return prev;
        return { ...prev, events: [...prev.events, value] };
      }
      return { ...prev, events: prev.events.filter((event) => event !== value) };
    });
  };

  const handleGenerateWebhookSecret = () => {
    setWebhookForm((prev) => ({ ...prev, secret: createWebhookSecret() }));
    toast({
      title: "Novo segredo gerado",
      description: "Compartilhe o valor apenas com provedores confiáveis.",
    });
  };

  const handleAddWebhook = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!webhookForm.name.trim() || !webhookForm.url.trim()) {
      toast({
        title: "Preencha os dados do webhook",
        description: "Informe nome e URL de destino.",
        variant: "destructive",
      });
      return;
    }
    if (webhookForm.events.length === 0) {
      toast({
        title: "Selecione ao menos um evento",
        description: "Escolha quais eventos irão disparar o webhook.",
        variant: "destructive",
      });
      return;
    }

    setWebhooks((prev) => [
      ...prev,
      {
        id: Date.now(),
        name: webhookForm.name.trim(),
        url: webhookForm.url.trim(),
        events: webhookForm.events,
        secret: webhookForm.secret,
        active: true,
        lastDelivery: null,
      },
    ]);
    toast({
      title: "Webhook configurado",
      description: `${webhookForm.name} foi adicionado e está ativo.`,
    });
    setWebhookForm(getDefaultWebhookForm());
  };

  const toggleWebhook = (id: number, value: boolean) => {
    const current = webhooks.find((item) => item.id === id);
    setWebhooks((prev) => prev.map((item) => (item.id === id ? { ...item, active: value } : item)));
    toast({
      title: value ? "Webhook ativado" : "Webhook desativado",
      description: current ? `${current.name} agora está ${value ? "ativo" : "inativo"}.` : undefined,
    });
  };

  const removeWebhook = (id: number) => {
    const current = webhooks.find((item) => item.id === id);
    setWebhooks((prev) => prev.filter((item) => item.id !== id));
    toast({
      title: "Webhook removido",
      description: current ? `${current.name} foi excluído.` : "Webhook excluído.",
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold text-foreground">Integrações</h1>
        <p className="text-muted-foreground">
          Gerencie chaves de API, conectores externos e webhooks responsáveis por manter o escritório integrado.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <Card className="xl:col-span-2">
          <CardHeader>
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-primary" />
                Chaves de API
              </CardTitle>
              <CardDescription>
                Cadastre, revogue e acompanhe o uso de credenciais utilizadas por integrações externas.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleAddApiKey} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="api-key-provider">Nome da chave</Label>
                  <Select
                    value={newApiKey.provider}
                    onValueChange={(value) =>
                      setNewApiKey((prev) => ({ ...prev, provider: value as ApiKeyProvider }))
                    }
                  >
                    <SelectTrigger id="api-key-provider">
                      <SelectValue placeholder="Selecione um provedor" />
                    </SelectTrigger>
                    <SelectContent>
                      {API_KEY_PROVIDERS.map((provider) => (
                        <SelectItem key={provider} value={provider}>
                          {API_KEY_PROVIDER_LABELS[provider]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Ambiente</Label>
                  <Select
                    value={newApiKey.environment}
                    onValueChange={(value) =>
                      setNewApiKey((prev) => ({ ...prev, environment: value as ApiEnvironment }))
                    }
                  >
                    <SelectTrigger id="api-key-environment">
                      <SelectValue placeholder="Selecione um ambiente" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="producao">Produção</SelectItem>
                      <SelectItem value="homologacao">Homologação/Testes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_auto]">
              <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="api-key-url">Endpoint da API</Label>
                    {newApiKey.provider === "asaas" && (
                      <AsaasEndpointTooltip selectedEnvironment={newApiKey.environment} />
                    )}
                  </div>
                  <Input
                    id="api-key-url"
                    placeholder={
                      newApiKey.provider === "asaas"
                        ? ASAAS_DEFAULT_ENDPOINTS[newApiKey.environment]
                        : "https://api.quantumtecnologia.com/v1"
                    }
                    value={newApiKey.apiUrl}
                    onChange={(event) =>
                      setNewApiKey((prev) => ({ ...prev, apiUrl: event.target.value }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Informe o endpoint utilizado pelas requisições. Opcional.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="api-key-value">Valor da chave</Label>
                  <Input
                    id="api-key-value"
                    placeholder="Informe o valor da Chave API Key"
                    value={newApiKey.key}
                    onChange={(event) => setNewApiKey((prev) => ({ ...prev, key: event.target.value }))}
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    Armazene este valor com segurança e compartilhe apenas com sistemas confiáveis.
                  </p>
                </div>
                <div className="flex items-end justify-end">
                  <Button type="submit" className="whitespace-nowrap" disabled={isSavingApiKey}>
                    <Plus className="mr-2 h-4 w-4" />
                    {isSavingApiKey ? "Salvando..." : "Salvar chave"}
                  </Button>
                </div>
              </div>
            </form>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Provedor</TableHead>
                  <TableHead>Ambiente</TableHead>
                  <TableHead>Endpoint</TableHead>
                  <TableHead>Chave</TableHead>
                  <TableHead>Criada em</TableHead>
                  <TableHead>Último uso</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[220px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingApiKeys ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-sm text-muted-foreground">
                      Carregando chaves cadastradas...
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {apiKeys.map((item) => {
                      const providerLabel = resolveProviderLabel(item.provider);
                      const environmentLabel = resolveEnvironmentLabel(item.environment);
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{providerLabel}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{environmentLabel}</Badge>
                          </TableCell>
                          <TableCell>
                            {item.apiUrl ? (
                              <button
                                type="button"
                                onClick={() => void copyCredential(item.apiUrl!, "Endpoint da API")}
                                className="text-sm text-primary underline-offset-4 hover:underline"
                              >
                                {item.apiUrl}
                              </button>
                            ) : (
                              <span className="text-sm text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-sm">{maskCredential(item.key)}</span>
                          </TableCell>
                          <TableCell>{formatDateTime(item.createdAt)}</TableCell>
                          <TableCell>{formatDateTime(item.lastUsed)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Badge
                                variant={item.active ? "default" : "outline"}
                                className={item.active ? "bg-success text-success-foreground" : ""}
                              >
                                {item.active ? "Ativa" : "Inativa"}
                              </Badge>
                              <Switch
                                checked={item.active}
                                disabled={pendingApiKeyId === item.id}
                                onCheckedChange={(checked) => void toggleApiKey(item.id, checked)}
                                aria-label={`Alterar status da chave ${providerLabel}`}
                              />
                            </div>
                          </TableCell>
                          <TableCell className="flex flex-wrap items-center gap-2">
                            {item.provider === "asaas" && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => void testIntegrationConnection(item)}
                                disabled={testingConnectionId === item.id}
                                className="h-8 gap-1"
                              >
                                {testingConnectionId === item.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <ShieldCheck className="h-4 w-4" />
                                )}
                                <span className="whitespace-nowrap">Testar conexão</span>
                              </Button>
                            )}
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={() => void startEditApiKey(item.id)}
                              aria-label="Editar chave"
                            >
                              <PencilLine className="h-4 w-4" />
                            </Button>
                            {item.apiUrl && (
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                onClick={() => void copyCredential(item.apiUrl!, "Endpoint da API")}
                                aria-label="Copiar endpoint da API"
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={() => void copyCredential(item.key, "Chave de API")}
                              aria-label="Copiar chave"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={() => void removeApiKey(item.id)}
                              aria-label="Remover chave"
                              disabled={deletingKeyId === item.id}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {apiKeys.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-sm text-muted-foreground">
                          Nenhuma chave cadastrada até o momento.
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>


      </div>

      {/*<Card>*/}
      {/*  <CardHeader>*/}
      {/*    <div className="space-y-1">*/}
      {/*      <CardTitle className="flex items-center gap-2">*/}
      {/*        <Link2 className="h-5 w-5 text-primary" />*/}
      {/*        Integrações com outros sistemas*/}
      {/*      </CardTitle>*/}
      {/*      <CardDescription>*/}
      {/*        Cadastre conectores personalizados e controle a sincronização com ERPs, marketing e comunicação.*/}
      {/*      </CardDescription>*/}
      {/*    </div>*/}
      {/*  </CardHeader>*/}
      {/*  <CardContent className="space-y-6">*/}
      {/*    <form onSubmit={handleAddIntegration} className="space-y-4">*/}
      {/*      <div className="grid gap-4 md:grid-cols-2">*/}
      {/*        <div className="space-y-2">*/}
      {/*          <Label htmlFor="integration-name">Nome da integração</Label>*/}
      {/*          <Input*/}
      {/*            id="integration-name"*/}
      {/*            placeholder="Ex: ERP Financeiro"*/}
      {/*            value={integrationForm.name}*/}
      {/*            onChange={(event) => setIntegrationForm((prev) => ({ ...prev, name: event.target.value }))}*/}
      {/*          />*/}
      {/*        </div>*/}
      {/*        <div className="space-y-2">*/}
      {/*          <Label htmlFor="integration-system">Sistema / fornecedor</Label>*/}
      {/*          <Input*/}
      {/*            id="integration-system"*/}
      {/*            placeholder="SAP, Totvs, HubSpot..."*/}
      {/*            value={integrationForm.system}*/}
      {/*            onChange={(event) => setIntegrationForm((prev) => ({ ...prev, system: event.target.value }))}*/}
      {/*          />*/}
      {/*        </div>*/}
      {/*        <div className="space-y-2">*/}
      {/*          <Label>Método de autenticação</Label>*/}
      {/*          <Select*/}
      {/*            value={integrationForm.authType}*/}
      {/*            onValueChange={(value) =>*/}
      {/*              setIntegrationForm((prev) => ({ ...prev, authType: value as AuthType }))*/}
      {/*            }*/}
      {/*          >*/}
      {/*            <SelectTrigger id="integration-auth">*/}
      {/*              <SelectValue placeholder="Selecione uma opção" />*/}
      {/*            </SelectTrigger>*/}
      {/*            <SelectContent>*/}
      {/*              <SelectItem value="apiKey">API Key</SelectItem>*/}
      {/*              <SelectItem value="oauth">OAuth 2.0</SelectItem>*/}
      {/*              <SelectItem value="basic">Basic Auth</SelectItem>*/}
      {/*              <SelectItem value="token">Token JWT</SelectItem>*/}
      {/*              <SelectItem value="webhook">Webhook</SelectItem>*/}
      {/*            </SelectContent>*/}
      {/*          </Select>*/}
      {/*        </div>*/}
      {/*        <div className="space-y-2">*/}
      {/*          <Label>Frequência de sincronização</Label>*/}
      {/*          <Select*/}
      {/*            value={integrationForm.frequency}*/}
      {/*            onValueChange={(value) =>*/}
      {/*              setIntegrationForm((prev) => ({ ...prev, frequency: value as SyncFrequency }))*/}
      {/*            }*/}
      {/*          >*/}
      {/*            <SelectTrigger id="integration-frequency">*/}
      {/*              <SelectValue placeholder="Defina uma frequência" />*/}
      {/*            </SelectTrigger>*/}
      {/*            <SelectContent>*/}
      {/*              <SelectItem value="realTime">Tempo real</SelectItem>*/}
      {/*              <SelectItem value="hourly">A cada hora</SelectItem>*/}
      {/*              <SelectItem value="daily">Diário</SelectItem>*/}
      {/*              <SelectItem value="weekly">Semanal</SelectItem>*/}
      {/*            </SelectContent>*/}
      {/*          </Select>*/}
      {/*        </div>*/}
      {/*      </div>*/}

      {/*      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">*/}
      {/*        <div className="space-y-2">*/}
      {/*          <Label htmlFor="integration-endpoint">Endpoint / URL</Label>*/}
      {/*          <Input*/}
      {/*            id="integration-endpoint"*/}
      {/*            placeholder="https://api.seusistema.com/v1/..."*/}
      {/*            value={integrationForm.endpoint}*/}
      {/*            onChange={(event) => setIntegrationForm((prev) => ({ ...prev, endpoint: event.target.value }))}*/}
      {/*          />*/}
      {/*          <p className="text-xs text-muted-foreground">*/}
      {/*            Utilize URLs seguras (HTTPS) e restrinja o acesso por IP quando possível.*/}
      {/*          </p>*/}
      {/*        </div>*/}
      {/*        <div className="flex items-end">*/}
      {/*          <Button type="submit" className="whitespace-nowrap">*/}
      {/*            <Plus className="mr-2 h-4 w-4" />*/}
      {/*            Adicionar integração*/}
      {/*          </Button>*/}
      {/*        </div>*/}
      {/*      </div>*/}
      {/*    </form>*/}

      {/*    <Table>*/}
      {/*      <TableHeader>*/}
      {/*        <TableRow>*/}
      {/*          <TableHead>Integração</TableHead>*/}
      {/*          <TableHead>Sistema</TableHead>*/}
      {/*          <TableHead>Autenticação</TableHead>*/}
      {/*          <TableHead>Frequência</TableHead>*/}
      {/*          <TableHead>Status</TableHead>*/}
      {/*          <TableHead className="w-[120px]">Ações</TableHead>*/}
      {/*        </TableRow>*/}
      {/*      </TableHeader>*/}
      {/*      <TableBody>*/}
      {/*        {integrations.map((integration) => (*/}
      {/*          <TableRow key={integration.id}>*/}
      {/*            <TableCell>*/}
      {/*              <div className="space-y-1">*/}
      {/*                <p className="font-medium">{integration.name}</p>*/}
      {/*                <p className="text-xs text-muted-foreground max-w-[260px] truncate">*/}
      {/*                  {integration.endpoint}*/}
      {/*                </p>*/}
      {/*              </div>*/}
      {/*            </TableCell>*/}
      {/*            <TableCell>{integration.system}</TableCell>*/}
      {/*            <TableCell>{authTypeLabels[integration.authType]}</TableCell>*/}
      {/*            <TableCell>{frequencyLabels[integration.frequency]}</TableCell>*/}
      {/*            <TableCell>*/}
      {/*              <div className="space-y-1">*/}
      {/*                <div className="flex items-center gap-3">*/}
      {/*                  <Badge*/}
      {/*                    variant={integration.enabled ? "default" : "outline"}*/}
      {/*                    className={integration.enabled ? "bg-success text-success-foreground" : ""}*/}
      {/*                  >*/}
      {/*                    {integration.enabled ? "Ativa" : "Pausada"}*/}
      {/*                  </Badge>*/}
      {/*                  <Switch*/}
      {/*                    checked={integration.enabled}*/}
      {/*                    onCheckedChange={(checked) => toggleIntegration(integration.id, checked)}*/}
      {/*                    aria-label={`Alterar status da integração ${integration.name}`}*/}
      {/*                  />*/}
      {/*                </div>*/}
      {/*                <p className="text-xs text-muted-foreground">*/}
      {/*                  {integration.lastSync*/}
      {/*                    ? `Última sincronização ${formatDateTime(integration.lastSync)}`*/}
      {/*                    : "Nunca sincronizado"}*/}
      {/*                </p>*/}
      {/*              </div>*/}
      {/*            </TableCell>*/}
      {/*            <TableCell className="flex items-center gap-2">*/}
      {/*              <Button*/}
      {/*                type="button"*/}
      {/*                size="icon"*/}
      {/*                variant="ghost"*/}
      {/*                onClick={() => copyCredential(integration.endpoint, `Endpoint ${integration.name}`)}*/}
      {/*                aria-label="Copiar endpoint"*/}
      {/*              >*/}
      {/*                <Link2 className="h-4 w-4" />*/}
      {/*              </Button>*/}
      {/*              <Button*/}
      {/*                type="button"*/}
      {/*                size="icon"*/}
      {/*                variant="ghost"*/}
      {/*                onClick={() => removeIntegration(integration.id)}*/}
      {/*                aria-label="Remover integração"*/}
      {/*              >*/}
      {/*                <Trash2 className="h-4 w-4" />*/}
      {/*              </Button>*/}
      {/*            </TableCell>*/}
      {/*          </TableRow>*/}
      {/*        ))}*/}
      {/*        {integrations.length === 0 && (*/}
      {/*          <TableRow>*/}
      {/*            <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">*/}
      {/*              Nenhuma integração cadastrada no momento.*/}
      {/*            </TableCell>*/}
      {/*          </TableRow>*/}
      {/*        )}*/}
      {/*      </TableBody>*/}
      {/*    </Table>*/}
      {/*  </CardContent>*/}
      {/*</Card>*/}

      {/*<Card>*/}
      {/*  <CardHeader>*/}
      {/*    <div className="space-y-1">*/}
      {/*      <CardTitle className="flex items-center gap-2">*/}
      {/*        <WebhookIcon className="h-5 w-5 text-primary" />*/}
      {/*        Webhooks*/}
      {/*      </CardTitle>*/}
      {/*      <CardDescription>*/}
      {/*        Configure endpoints que devem ser notificados automaticamente sempre que eventos ocorrerem na plataforma.*/}
      {/*      </CardDescription>*/}
      {/*    </div>*/}
      {/*  </CardHeader>*/}
      {/*  <CardContent className="space-y-6">*/}
      {/*    <form onSubmit={handleAddWebhook} className="space-y-4">*/}
      {/*      <div className="grid gap-4 md:grid-cols-2">*/}
      {/*        <div className="space-y-2">*/}
      {/*          <Label htmlFor="webhook-name">Nome</Label>*/}
      {/*          <Input*/}
      {/*            id="webhook-name"*/}
      {/*            placeholder="Ex: Disparo para o ERP"*/}
      {/*            value={webhookForm.name}*/}
      {/*            onChange={(event) => setWebhookForm((prev) => ({ ...prev, name: event.target.value }))}*/}
      {/*          />*/}
      {/*        </div>*/}
      {/*        <div className="space-y-2">*/}
      {/*          <Label htmlFor="webhook-url">URL do webhook</Label>*/}
      {/*          <Input*/}
      {/*            id="webhook-url"*/}
      {/*            placeholder="https://..."*/}
      {/*            value={webhookForm.url}*/}
      {/*            onChange={(event) => setWebhookForm((prev) => ({ ...prev, url: event.target.value }))}*/}
      {/*          />*/}
      {/*        </div>*/}
      {/*      </div>*/}

      {/*      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">*/}
      {/*        <div className="space-y-2">*/}
      {/*          <Label htmlFor="webhook-secret">Segredo de assinatura</Label>*/}
      {/*          <div className="flex gap-2">*/}
      {/*            <Input*/}
      {/*              id="webhook-secret"*/}
      {/*              value={webhookForm.secret}*/}
      {/*              readOnly*/}
      {/*              className="font-mono"*/}
      {/*            />*/}
      {/*            <Button*/}
      {/*              type="button"*/}
      {/*              size="icon"*/}
      {/*              variant="outline"*/}
      {/*              onClick={() => copyCredential(webhookForm.secret, "Segredo do webhook")}*/}
      {/*              aria-label="Copiar segredo"*/}
      {/*            >*/}
      {/*              <Copy className="h-4 w-4" />*/}
      {/*            </Button>*/}
      {/*          </div>*/}
      {/*        </div>*/}
      {/*        <div className="flex items-end gap-2">*/}
      {/*          <Button type="button" variant="outline" onClick={handleGenerateWebhookSecret} className="whitespace-nowrap">*/}
      {/*            <RefreshCcw className="mr-2 h-4 w-4" />*/}
      {/*            Gerar novo segredo*/}
      {/*          </Button>*/}
      {/*          <Button type="submit" className="whitespace-nowrap">*/}
      {/*            <Plus className="mr-2 h-4 w-4" />*/}
      {/*            Adicionar webhook*/}
      {/*          </Button>*/}
      {/*        </div>*/}
      {/*      </div>*/}

      {/*      <div className="space-y-2">*/}
      {/*        <Label>Eventos monitorados</Label>*/}
      {/*        <p className="text-xs text-muted-foreground">*/}
      {/*          Escolha quais eventos da plataforma irão disparar o envio para o endpoint configurado.*/}
      {/*        </p>*/}
      {/*        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">*/}
      {/*          {eventOptions.map((event) => (*/}
      {/*            <label*/}
      {/*              key={event.value}*/}
      {/*              className="flex cursor-pointer items-start gap-3 rounded-lg border p-3"*/}
      {/*            >*/}
      {/*              <Checkbox*/}
      {/*                checked={webhookForm.events.includes(event.value)}*/}
      {/*                onCheckedChange={(checked) =>*/}
      {/*                  updateWebhookEventSelection(event.value, checked === true)*/}
      {/*                }*/}
      {/*              />*/}
      {/*              <div className="space-y-1">*/}
      {/*                <p className="text-sm font-medium leading-none">{event.label}</p>*/}
      {/*                <p className="text-xs text-muted-foreground">{event.description}</p>*/}
      {/*              </div>*/}
      {/*            </label>*/}
      {/*          ))}*/}
      {/*        </div>*/}
      {/*      </div>*/}
      {/*    </form>*/}

      {/*    <Table>*/}
      {/*      <TableHeader>*/}
      {/*        <TableRow>*/}
      {/*          <TableHead>Webhook</TableHead>*/}
      {/*          <TableHead>Endpoint</TableHead>*/}
      {/*          <TableHead>Eventos</TableHead>*/}
      {/*          <TableHead>Status</TableHead>*/}
      {/*          <TableHead className="w-[120px]">Ações</TableHead>*/}
      {/*        </TableRow>*/}
      {/*      </TableHeader>*/}
      {/*      <TableBody>*/}
      {/*        {webhooks.map((webhook) => (*/}
      {/*          <TableRow key={webhook.id}>*/}
      {/*            <TableCell>*/}
      {/*              <div className="space-y-1">*/}
      {/*                <p className="font-medium">{webhook.name}</p>*/}
      {/*                <p className="text-xs text-muted-foreground font-mono">*/}
      {/*                  {maskCredential(webhook.secret)}*/}
      {/*                </p>*/}
      {/*              </div>*/}
      {/*            </TableCell>*/}
      {/*            <TableCell>*/}
      {/*              <span className="block max-w-[260px] truncate font-mono text-sm">{webhook.url}</span>*/}
      {/*            </TableCell>*/}
      {/*            <TableCell>*/}
      {/*              <div className="flex flex-wrap gap-1">*/}
      {/*                {webhook.events.map((event) => {*/}
      {/*                  const option = eventOptions.find((item) => item.value === event);*/}
      {/*                  return (*/}
      {/*                    <Badge key={event} variant="secondary">*/}
      {/*                      {option?.label ?? event}*/}
      {/*                    </Badge>*/}
      {/*                  );*/}
      {/*                })}*/}
      {/*              </div>*/}
      {/*            </TableCell>*/}
      {/*            <TableCell>*/}
      {/*              <div className="space-y-1">*/}
      {/*                <div className="flex items-center gap-3">*/}
      {/*                  <Badge*/}
      {/*                    variant={webhook.active ? "default" : "outline"}*/}
      {/*                    className={webhook.active ? "bg-success text-success-foreground" : ""}*/}
      {/*                  >*/}
      {/*                    {webhook.active ? "Ativo" : "Inativo"}*/}
      {/*                  </Badge>*/}
      {/*                  <Switch*/}
      {/*                    checked={webhook.active}*/}
      {/*                    onCheckedChange={(checked) => toggleWebhook(webhook.id, checked)}*/}
      {/*                    aria-label={`Alterar status do webhook ${webhook.name}`}*/}
      {/*                  />*/}
      {/*                </div>*/}
      {/*                <p className="text-xs text-muted-foreground">*/}
      {/*                  {webhook.lastDelivery*/}
      {/*                    ? `Último envio ${formatDateTime(webhook.lastDelivery)}`*/}
      {/*                    : "Nenhuma entrega realizada"}*/}
      {/*                </p>*/}
      {/*              </div>*/}
      {/*            </TableCell>*/}
      {/*            <TableCell className="flex items-center gap-2">*/}
      {/*              <Button*/}
      {/*                type="button"*/}
      {/*                size="icon"*/}
      {/*                variant="ghost"*/}
      {/*                onClick={() => copyCredential(webhook.secret, `Segredo ${webhook.name}`)}*/}
      {/*                aria-label="Copiar segredo"*/}
      {/*              >*/}
      {/*                <Copy className="h-4 w-4" />*/}
      {/*              </Button>*/}
      {/*              <Button*/}
      {/*                type="button"*/}
      {/*                size="icon"*/}
      {/*                variant="ghost"*/}
      {/*                onClick={() => removeWebhook(webhook.id)}*/}
      {/*                aria-label="Remover webhook"*/}
      {/*              >*/}
      {/*                <Trash2 className="h-4 w-4" />*/}
      {/*              </Button>*/}
      {/*            </TableCell>*/}
      {/*          </TableRow>*/}
      {/*        ))}*/}
      {/*        {webhooks.length === 0 && (*/}
      {/*          <TableRow>*/}
      {/*            <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">*/}
      {/*              Nenhum webhook configurado até o momento.*/}
      {/*            </TableCell>*/}
      {/*          </TableRow>*/}
      {/*        )}*/}
      {/*      </TableBody>*/}
      {/*    </Table>*/}
      {/*  </CardContent>*/}
      {/*</Card>*/}

      <Card>
        <CardHeader>
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-xl">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Monitoramento
            </CardTitle>
            <CardDescription>
              Acompanhe rapidamente o estado das integrações e siga boas práticas de segurança.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="space-y-3">
            <div className="rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <span className="font-medium text-foreground">Chaves ativas</span>
                <Badge variant="secondary">
                  {activeApiKeys} / {apiKeys.length}
                </Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Revise periodicamente as credenciais e revogue acessos que não são mais utilizados.
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <span className="font-medium text-foreground">Integrações habilitadas</span>
                <Badge variant="secondary">
                  {activeIntegrations} / {integrations.length}
                </Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Garanta que apenas integrações necessárias tenham permissão para sincronizar dados.
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <span className="font-medium text-foreground">Webhooks ativos</span>
                <Badge variant="secondary">
                  {activeWebhooks} / {webhooks.length}
                </Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Utilize ambientes de teste para validar webhooks antes de ativá-los em produção.
              </p>
            </div>
          </div>
          <ul className="space-y-2 text-xs text-muted-foreground">
            <li>• Ative logs de auditoria nas integrações críticas.</li>
            <li>• Compartilhe segredos apenas por canais seguros.</li>
            <li>• Defina responsáveis por revisar integrações periodicamente.</li>
          </ul>
        </CardContent>
      </Card>

      <Dialog open={isEditDialogOpen} onOpenChange={handleEditDialogOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar chave de API</DialogTitle>
            <DialogDescription>
              Ajuste os dados da credencial selecionada. As alterações entram em vigor imediatamente.
            </DialogDescription>
          </DialogHeader>
          {isLoadingEditApiKey ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <form onSubmit={handleUpdateApiKey} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-api-key-provider">Provedor</Label>
                  <Select
                    value={editApiKeyForm.provider}
                    onValueChange={(value) =>
                      setEditApiKeyForm((prev) => ({ ...prev, provider: value as ApiKeyProvider }))
                    }
                  >
                    <SelectTrigger id="edit-api-key-provider">
                      <SelectValue placeholder="Selecione um provedor" />
                    </SelectTrigger>
                    <SelectContent>
                      {API_KEY_PROVIDERS.map((provider) => (
                        <SelectItem key={provider} value={provider}>
                          {API_KEY_PROVIDER_LABELS[provider]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-api-key-environment">Ambiente</Label>
                  <Select
                    value={editApiKeyForm.environment}
                    onValueChange={(value) =>
                      setEditApiKeyForm((prev) => ({
                        ...prev,
                        environment: value as ApiEnvironment,
                      }))
                    }
                  >
                    <SelectTrigger id="edit-api-key-environment">
                      <SelectValue placeholder="Selecione um ambiente" />
                    </SelectTrigger>
                    <SelectContent>
                      {environmentOptions.map((environment) => (
                        <SelectItem key={environment} value={environment}>
                          {API_KEY_ENVIRONMENT_LABELS[environment]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="edit-api-key-url">Endpoint da API</Label>
                  {editApiKeyForm.provider === "asaas" && (
                    <AsaasEndpointTooltip selectedEnvironment={editApiKeyForm.environment} />
                  )}
                </div>
                <Input
                  id="edit-api-key-url"
                  placeholder={
                    editApiKeyForm.provider === "asaas"
                      ? ASAAS_DEFAULT_ENDPOINTS[editApiKeyForm.environment]
                      : "https://api.seuprovedor.com/v1"
                  }
                  value={editApiKeyForm.apiUrl}
                  onChange={(event) =>
                    setEditApiKeyForm((prev) => ({ ...prev, apiUrl: event.target.value }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Informe o endpoint utilizado pelas requisições. Opcional.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-api-key-value">Valor da chave</Label>
                <Input
                  id="edit-api-key-value"
                  value={editApiKeyForm.key}
                  onChange={(event) =>
                    setEditApiKeyForm((prev) => ({ ...prev, key: event.target.value }))
                  }
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Armazene este valor com segurança e compartilhe apenas com sistemas confiáveis.
                </p>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium leading-none">Status da chave</p>
                  <p className="text-xs text-muted-foreground">
                    Controle se a credencial pode ser utilizada pelas integrações.
                  </p>
                </div>
                <Switch
                  id="edit-api-key-active"
                  checked={editApiKeyForm.active}
                  onCheckedChange={(checked) =>
                    setEditApiKeyForm((prev) => ({ ...prev, active: checked }))
                  }
                />
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={() => handleEditDialogOpenChange(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isUpdatingApiKey}>
                  {isUpdatingApiKey ? (
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
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
