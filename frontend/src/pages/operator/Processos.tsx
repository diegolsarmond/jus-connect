import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { getApiUrl } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Archive,
  Check,
  Calendar,
  Clock,
  FileText,
  Gavel as GavelIcon,
  Landmark,
  Loader2,
  MapPin,
  Search,
  Users as UsersIcon,
  Eye,
  ChevronsUpDown,
  RefreshCw,
} from "lucide-react";
import AttachmentsSummaryCard from "@/components/process/AttachmentsSummaryCard";
import {
  formatResponseKey,
  formatResponseValue,
  isMetadataEntryList,
  mapApiJuditRequest,
  parseOptionalString,
  parseResponseDataFromResult,
  parseTrackingSummaryFromResult,
  toRecord,
  type ApiProcessoJuditRequest,
  type ProcessoJuditRequest,
  type ProcessoResponseData,
  type ProcessoTrackingSummary,
} from "./utils/judit";
import { renderMetadataEntries } from "./components/metadata-renderer";

interface ProcessoCliente {
  id: number;
  nome: string;
  documento: string;
  papel: string;
}

interface ProcessoAdvogado {
  id: number;
  nome: string;
  funcao?: string;
}

interface ProcessoProposta {
  id: number;
  label: string;
  solicitante?: string | null;
}

export interface Processo {
  id: number;
  numero: string;
  dataDistribuicao: string;
  status: string;
  tipo: string;
  cliente: ProcessoCliente;
  advogados: ProcessoAdvogado[];
  classeJudicial: string;
  assunto: string;
  jurisdicao: string;
  orgaoJulgador: string;
  proposta: ProcessoProposta | null;
  ultimaSincronizacao: string | null;
  consultasApiCount: number;
  movimentacoesCount: number;
  juditTrackingId: string | null;
  juditTrackingHourRange: string | null;
  juditLastRequest: ProcessoJuditRequest | null;
  trackingSummary: ProcessoTrackingSummary | null;
  responseData: ProcessoResponseData | null;
}

interface Uf {
  sigla: string;
  nome: string;
}

interface Municipio {
  id: number;
  nome: string;
}

interface ClienteResumo {
  id: number;
  nome: string;
  documento: string;
  tipo: string;
}

interface ApiCliente {
  id: number;
  nome?: string;
  documento?: string;
  tipo?: string;
}

interface ApiProcessoCliente {
  id: number;
  nome: string | null;
  documento: string | null;
  tipo: string | null;
}

interface ApiProcessoOportunidade {
  id?: number | string | null;
  sequencial_empresa?: number | string | null;
  data_criacao?: string | null;
  numero_processo_cnj?: string | null;
  numero_protocolo?: string | null;
  solicitante_id?: number | string | null;
  solicitante_nome?: string | null;
}

interface ApiProcesso {
  id: number;
  cliente_id: number;
  numero: string;
  uf: string | null;
  municipio: string | null;
  orgao_julgador: string | null;
  tipo: string | null;
  status: string | null;
  classe_judicial: string | null;
  assunto: string | null;
  jurisdicao: string | null;
  advogado_responsavel: string | null;
  data_distribuicao: string | null;
  criado_em: string | null;
  atualizado_em: string | null;
  cliente?: ApiProcessoCliente | null;
  oportunidade_id?: number | string | null;
  oportunidade?: ApiProcessoOportunidade | null;
  advogados?: ApiProcessoAdvogado[] | null;
  ultima_sincronizacao?: string | null;
  consultas_api_count?: number | string | null;
  movimentacoes_count?: number | string | null;
  judit_tracking_id?: string | null;
  judit_tracking_hour_range?: string | null;
  judit_last_request?: ApiProcessoJuditRequest | null;
}

interface ApiProcessoAdvogado {
  id?: number | string | null;
  nome?: string | null;
  name?: string | null;
  funcao?: string | null;
  cargo?: string | null;
  perfil?: string | null;
  perfil_nome?: string | null;
}

interface AdvogadoOption {
  id: string;
  nome: string;
  descricao?: string;
}

interface ApiOportunidade {
  id?: number | string | null;
  sequencial_empresa?: number | string | null;
  data_criacao?: string | null;
  solicitante_nome?: string | null;
  solicitante?: { nome?: string | null } | null;
}

interface PropostaOption {
  id: string;
  label: string;
  solicitante?: string | null;
  sequencial?: number | null;
  dataCriacao?: string | null;
}

interface ProcessFormState {
  numero: string;
  uf: string;
  municipio: string;
  clienteId: string;
  advogados: string[];
  propostaId: string;
  dataDistribuicao: string;
  instancia: string;
  instanciaOutro: string;
}

export interface ManualSyncFlags {
  withAttachments?: boolean;
  onDemand?: boolean;
}

export interface ManualSyncRequestPlan {
  path: string;
  method: "GET" | "POST";
  body: Record<string, unknown> | null;
  isStatusCheck: boolean;
  requestId: string | null;
}

export const planManualSyncRequest = (
  processo: Processo,
  flags?: ManualSyncFlags,
): ManualSyncRequestPlan => {
  const requestId = processo.juditLastRequest?.requestId?.trim();

  if (requestId) {
    return {
      path: `processos/${processo.id}/judit/requests/${requestId}`,
      method: "GET",
      body: null,
      isStatusCheck: true,
      requestId,
    };
  }

  const payload: Record<string, unknown> = {};

  if (typeof flags?.withAttachments === "boolean") {
    payload.withAttachments = flags.withAttachments;
  }

  if (typeof flags?.onDemand === "boolean") {
    payload.onDemand = flags.onDemand;
  }

  return {
    path: `processos/${processo.id}/judit/sync`,
    method: "POST",
    body: payload,
    isStatusCheck: false,
    requestId: null,
  };
};

const extractErrorMessageFromResult = (result: unknown): string | null => {
  if (typeof result === "string") {
    const trimmed = result.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  const record = toRecord(result);
  if (!record) {
    return null;
  }

  return (
    parseOptionalString(record.error) ??
    parseOptionalString(record.message) ??
    parseOptionalString(record.reason) ??
    null
  );
};

const formatProcessNumber = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 20);
  const match = digits.match(/^(\d{0,7})(\d{0,2})(\d{0,4})(\d{0,1})(\d{0,2})(\d{0,4})$/);
  if (!match) return digits;
  const [, part1 = "", part2 = "", part3 = "", part4 = "", part5 = "", part6 = ""] = match;

  let formatted = part1;
  if (part2) formatted += `-${part2}`;
  if (part3) formatted += `.${part3}`;
  if (part4) formatted += `.${part4}`;
  if (part5) formatted += `.${part5}`;
  if (part6) formatted += `.${part6}`;
  return formatted;
};

const formatDateToPtBR = (value: string | null | undefined): string => {
  if (!value) {
    return "Não informado";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Não informado";
  }

  return date.toLocaleDateString("pt-BR");
};

const formatDateTimeToPtBR = (value: string | null | undefined): string => {
  if (!value) {
    return "Sem registros";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Data inválida";
  }

  return date.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
};

const pickFirstNonEmptyString = (
  ...values: Array<string | null | undefined>
): string | undefined => {
  for (const value of values) {
    if (!value || typeof value !== "string") {
      continue;
    }

    const trimmed = value.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  return undefined;
};

const getNameFromEmail = (email: string | null | undefined): string | undefined => {
  if (!email || typeof email !== "string") {
    return undefined;
  }

  const trimmed = email.trim();
  if (!trimmed) {
    return undefined;
  }

  const [localPart] = trimmed.split("@");
  if (!localPart) {
    return undefined;
  }

  return localPart
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase())
    .trim();
};

const parseApiInteger = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return 0;
    }

    const parsed = Number.parseInt(trimmed, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
};

const parseOptionalInteger = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = Number.parseInt(trimmed, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
};

const normalizeClienteTipo = (value: string | null | undefined): string => {
  if (!value) {
    return "";
  }

  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
};

const resolveClientePapel = (tipo: string | null | undefined): string => {
  const normalized = normalizeClienteTipo(tipo);

  if (
    normalized.includes("JURIDICA") ||
    ["2", "J", "PJ"].includes(normalized)
  ) {
    return "Pessoa Jurídica";
  }

  if (
    normalized.includes("FISICA") ||
    ["1", "F", "PF"].includes(normalized)
  ) {
    return "Pessoa Física";
  }

  return "Parte";
};

const formatPropostaLabel = (
  id: number,
  sequencial: number | null,
  dataCriacao: string | null,
  solicitante?: string | null,
): string => {
  const numero = sequencial && sequencial > 0 ? sequencial : id;
  let ano = new Date().getFullYear();

  if (dataCriacao) {
    const parsed = new Date(dataCriacao);
    if (!Number.isNaN(parsed.getTime())) {
      ano = parsed.getFullYear();
    }
  }

  const solicitanteNome =
    typeof solicitante === "string" && solicitante.trim().length > 0
      ? solicitante.trim()
      : "";

  return `Proposta #${numero}/${ano}${solicitanteNome ? ` - ${solicitanteNome}` : ""}`;
};

const INSTANCIA_OUTRO_VALUE = "Outro / Especificar";

const INSTANCIA_OPTIONS = [
  "1ª Vara Cível",
  "2ª Vara Cível",
  "Vara Criminal",
  "Vara de Família",
  "Vara da Fazenda Pública",
  "Juizado Especial Cível",
  "Juizado Especial Criminal",
  "Vara do Trabalho",
  "Tribunal de Justiça (TJ) — 2ª Instância",
  "Tribunal Regional Federal (TRF) — 2ª Instância",
  "Tribunal Regional do Trabalho (TRT) — 2ª Instância",
  "Tribunal Regional Eleitoral (TRE) — 2ª Instância",
  "Turma Recursal (Juizados)",
  "Tribunal Superior do Trabalho (TST)",
  "Tribunal Superior Eleitoral (TSE)",
  "Superior Tribunal de Justiça (STJ)",
  "Supremo Tribunal Federal (STF)",
  INSTANCIA_OUTRO_VALUE,

];

const createEmptyProcessForm = (): ProcessFormState => ({
  numero: "",
  uf: "",
  municipio: "",
  clienteId: "",
  advogados: [],
  propostaId: "",
  dataDistribuicao: "",
  instancia: "",
  instanciaOutro: "",
});

const mapApiProcessoToProcesso = (processo: ApiProcesso): Processo => {
  const clienteResumo = processo.cliente ?? null;
  const documento = clienteResumo?.documento ?? "";
  const jurisdicao =
    processo.jurisdicao ||
    [processo.municipio, processo.uf].filter(Boolean).join(" - ") ||
    "Não informado";

  const juditLastRequest = mapApiJuditRequest(processo.judit_last_request);
  const trackingSummary = juditLastRequest
    ? parseTrackingSummaryFromResult(juditLastRequest.result)
    : null;
  const responseData = juditLastRequest
    ? parseResponseDataFromResult(juditLastRequest.result)
    : null;

  const oportunidadeResumo = processo.oportunidade ?? null;
  const oportunidadeId = parseOptionalInteger(
    processo.oportunidade_id ?? oportunidadeResumo?.id ?? null,
  );
  const oportunidadeSequencial = parseOptionalInteger(
    oportunidadeResumo?.sequencial_empresa,
  );
  const oportunidadeDataCriacao =
    typeof oportunidadeResumo?.data_criacao === "string"
      ? oportunidadeResumo?.data_criacao
      : null;
  const oportunidadeSolicitante =
    typeof oportunidadeResumo?.solicitante_nome === "string"
      ? oportunidadeResumo.solicitante_nome
      : null;

  const advogados: ProcessoAdvogado[] = [];
  const seen = new Set<number>();

  if (Array.isArray(processo.advogados)) {
    for (const advogado of processo.advogados) {
      if (!advogado) {
        continue;
      }

      const idValue =
        typeof advogado.id === "number"
          ? advogado.id
          : typeof advogado.id === "string"
            ? Number.parseInt(advogado.id, 10)
            : null;

      if (!idValue || !Number.isFinite(idValue) || idValue <= 0 || seen.has(idValue)) {
        continue;
      }

      const nome =
        pickFirstNonEmptyString(advogado.nome, advogado.name, advogado.perfil_nome) ??
        `Advogado #${idValue}`;

      const funcao = pickFirstNonEmptyString(
        advogado.funcao,
        advogado.cargo,
        advogado.perfil,
        advogado.perfil_nome,
      );

      advogados.push({ id: idValue, nome, funcao });
      seen.add(idValue);
    }
  }

  if (advogados.length === 0) {
    const fallbackNome = processo.advogado_responsavel?.trim();
    if (fallbackNome) {
      advogados.push({ id: 0, nome: fallbackNome });
    }
  }

  advogados.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  const proposta: ProcessoProposta | null =
    oportunidadeId && oportunidadeId > 0
      ? {
          id: oportunidadeId,
          label: formatPropostaLabel(
            oportunidadeId,
            oportunidadeSequencial,
            oportunidadeDataCriacao,
            oportunidadeSolicitante,
          ),
          solicitante: oportunidadeSolicitante ?? null,
        }
      : null;

  const statusLabel =
    trackingSummary?.status?.trim() || processo.status?.trim() || "Não informado";

  return {
    id: processo.id,
    numero: processo.numero,
    dataDistribuicao:
      formatDateToPtBR(processo.data_distribuicao || processo.criado_em),
    status: statusLabel,
    tipo: processo.tipo?.trim() || "Não informado",
    cliente: {
      id: clienteResumo?.id ?? processo.cliente_id,
      nome: clienteResumo?.nome ?? "Cliente não informado",
      documento: documento,
      papel: resolveClientePapel(clienteResumo?.tipo),
    },
    advogados,
    classeJudicial: processo.classe_judicial?.trim() || "Não informada",
    assunto: processo.assunto?.trim() || "Não informado",
    jurisdicao,
    orgaoJulgador: processo.orgao_julgador?.trim() || "Não informado",
    proposta,
    ultimaSincronizacao: processo.ultima_sincronizacao ?? null,
    consultasApiCount: parseApiInteger(processo.consultas_api_count),
    movimentacoesCount: parseApiInteger(processo.movimentacoes_count),
    juditTrackingId: processo.judit_tracking_id ?? null,
    juditTrackingHourRange: processo.judit_tracking_hour_range ?? null,
    juditLastRequest,
    trackingSummary,
    responseData,
  };
};

const getStatusBadgeClassName = (status: string) => {
  const normalized = status.toLowerCase();

  if (normalized.includes("andamento") || normalized.includes("ativo")) {
    return "border-emerald-200 bg-emerald-500/10 text-emerald-600";
  }

  if (normalized.includes("arquiv")) {
    return "border-slate-200 bg-slate-500/10 text-slate-600";
  }

  if (normalized.includes("urg")) {
    return "border-amber-200 bg-amber-500/10 text-amber-600";
  }

  return "border-primary/20 bg-primary/5 text-primary";
};

const getTipoBadgeClassName = (tipo: string) => {
  if (!tipo || tipo.toLowerCase() === "não informado") {
    return "border-muted-foreground/20 bg-muted text-muted-foreground";
  }

  return "border-blue-200 bg-blue-500/10 text-blue-600";
};

export default function Processos() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [tipoFilter, setTipoFilter] = useState("todos");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [processForm, setProcessForm] = useState<ProcessFormState>(
    createEmptyProcessForm,
  );
  const [advogadosOptions, setAdvogadosOptions] = useState<AdvogadoOption[]>([]);
  const [advogadosLoading, setAdvogadosLoading] = useState(false);
  const [advogadosError, setAdvogadosError] = useState<string | null>(null);
  const [advogadosPopoverOpen, setAdvogadosPopoverOpen] = useState(false);
  const [propostas, setPropostas] = useState<PropostaOption[]>([]);
  const [propostasLoading, setPropostasLoading] = useState(false);
  const [propostasError, setPropostasError] = useState<string | null>(null);
  const [propostasPopoverOpen, setPropostasPopoverOpen] = useState(false);
  const [ufs, setUfs] = useState<Uf[]>([]);
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [municipiosLoading, setMunicipiosLoading] = useState(false);
  const [clientes, setClientes] = useState<ClienteResumo[]>([]);
  const [clientesLoading, setClientesLoading] = useState(false);
  const [processosLoading, setProcessosLoading] = useState(false);
  const [processosError, setProcessosError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creatingProcess, setCreatingProcess] = useState(false);
  const [syncingProcessIds, setSyncingProcessIds] = useState<number[]>([]);
  const [syncErrors, setSyncErrors] = useState<Record<number, string | null>>({});
  const [manualSyncProcess, setManualSyncProcess] = useState<Processo | null>(null);
  const [manualSyncWithAttachments, setManualSyncWithAttachments] = useState(false);
  const [manualSyncOnDemand, setManualSyncOnDemand] = useState(false);
  useEffect(() => {
    let cancelled = false;

    const fetchUfs = async () => {
      try {
        const res = await fetch(
          "https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome",
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as Uf[];
        if (!cancelled) setUfs(data);
      } catch (error) {
        console.error(error);
        if (!cancelled) setUfs([]);
      }
    };

    fetchUfs();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchClientes = async () => {
      setClientesLoading(true);
      try {
        const res = await fetch(getApiUrl("clientes"), {
          headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const data: ApiCliente[] = Array.isArray(json)
          ? json
          : Array.isArray((json as { rows?: ApiCliente[] })?.rows)
            ? ((json as { rows: ApiCliente[] }).rows)
            : Array.isArray((json as { data?: { rows?: ApiCliente[] } })?.data?.rows)
              ? ((json as { data: { rows: ApiCliente[] } }).data.rows)
              : Array.isArray((json as { data?: ApiCliente[] })?.data)
                ? ((json as { data: ApiCliente[] }).data)
                : [];
        const mapped = data
          .filter((cliente) => typeof cliente.id === "number")
          .map((cliente) => ({
            id: cliente.id,
            nome: cliente.nome ?? "Sem nome",
            documento: cliente.documento ?? "",
            tipo:
              cliente.tipo === null || cliente.tipo === undefined
                ? ""
                : typeof cliente.tipo === "string"
                  ? cliente.tipo
                  : String(cliente.tipo),
          }));
        if (!cancelled) {
          setClientes(mapped);
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setClientes([]);
        }
      } finally {
        if (!cancelled) {
          setClientesLoading(false);
        }
      }
    };

    fetchClientes();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchAdvogados = async () => {
      setAdvogadosLoading(true);
      setAdvogadosError(null);

      try {
        const res = await fetch(getApiUrl("usuarios/empresa"), {
          headers: { Accept: "application/json" },
        });

        let json: unknown = null;
        try {
          json = await res.json();
        } catch (error) {
          console.error("Não foi possível interpretar a resposta de advogados", error);
        }

        if (!res.ok) {
          const message =
            json && typeof json === "object" && "error" in json &&
            typeof (json as { error?: unknown }).error === "string"
              ? String((json as { error: string }).error)
              : `Não foi possível carregar os advogados (HTTP ${res.status})`;
          throw new Error(message);
        }

        const payloadArray: Record<string, unknown>[] = Array.isArray(json)
          ? (json as Record<string, unknown>[])
          : Array.isArray((json as { data?: unknown[] })?.data)
            ? ((json as { data: unknown[] }).data as Record<string, unknown>[])
            : Array.isArray((json as { rows?: unknown[] })?.rows)
              ? ((json as { rows: unknown[] }).rows as Record<string, unknown>[])
              : [];

        const options: AdvogadoOption[] = [];
        const seen = new Set<string>();

        for (const item of payloadArray) {
          if (!item) {
            continue;
          }

          const idRaw = item["id"];
          let idValue: string | null = null;

          if (typeof idRaw === "number" && Number.isFinite(idRaw)) {
            idValue = String(Math.trunc(idRaw));
          } else if (typeof idRaw === "string") {
            const trimmed = idRaw.trim();
            if (trimmed) {
              idValue = trimmed;
            }
          }

          if (!idValue || seen.has(idValue)) {
            continue;
          }

          const nome = pickFirstNonEmptyString(
            typeof item["nome_completo"] === "string" ? (item["nome_completo"] as string) : undefined,
            typeof item["nome"] === "string" ? (item["nome"] as string) : undefined,
            typeof item["nome_usuario"] === "string" ? (item["nome_usuario"] as string) : undefined,
            typeof item["nomeusuario"] === "string" ? (item["nomeusuario"] as string) : undefined,
            typeof item["email"] === "string" ? getNameFromEmail(item["email"] as string) : undefined,
          );

          if (!nome) {
            continue;
          }

          const descricao = pickFirstNonEmptyString(
            typeof item["perfil_nome"] === "string" ? (item["perfil_nome"] as string) : undefined,
            typeof item["perfil_nome_exibicao"] === "string"
              ? (item["perfil_nome_exibicao"] as string)
              : undefined,
            typeof item["funcao"] === "string" ? (item["funcao"] as string) : undefined,
            typeof item["cargo"] === "string" ? (item["cargo"] as string) : undefined,
          );

          options.push({ id: idValue, nome, descricao });
          seen.add(idValue);
        }

        options.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

        if (!cancelled) {
          setAdvogadosOptions(options);
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setAdvogadosOptions([]);
          setAdvogadosError(
            error instanceof Error
              ? error.message
              : "Erro ao carregar advogados",
          );
        }
      } finally {
        if (!cancelled) {
          setAdvogadosLoading(false);
        }
      }
    };

    fetchAdvogados();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchPropostas = async () => {
      setPropostasLoading(true);
      setPropostasError(null);

      try {
        const res = await fetch(getApiUrl("oportunidades"), {
          headers: { Accept: "application/json" },
        });

        let json: unknown = null;
        try {
          json = await res.json();
        } catch (error) {
          console.error("Não foi possível interpretar a resposta de propostas", error);
        }

        if (!res.ok) {
          const message =
            json && typeof json === "object" && "error" in json &&
            typeof (json as { error?: unknown }).error === "string"
              ? String((json as { error: string }).error)
              : `Não foi possível carregar as propostas (HTTP ${res.status})`;
          throw new Error(message);
        }

        const payloadArray: Record<string, unknown>[] = Array.isArray(json)
          ? (json as Record<string, unknown>[])
          : Array.isArray((json as { data?: unknown[] })?.data)
            ? ((json as { data: unknown[] }).data as Record<string, unknown>[])
            : Array.isArray((json as { rows?: unknown[] })?.rows)
              ? ((json as { rows: unknown[] }).rows as Record<string, unknown>[])
              : [];

        const options: PropostaOption[] = [];
        const seen = new Set<string>();

        for (const item of payloadArray) {
          if (!item) {
            continue;
          }

          const idParsed = parseOptionalInteger(item["id"]);
          if (!idParsed || idParsed <= 0) {
            continue;
          }

          const sequencialValue = parseOptionalInteger(
            item["sequencial_empresa"],
          );
          const dataCriacaoValue =
            typeof item["data_criacao"] === "string"
              ? (item["data_criacao"] as string)
              : null;

          const solicitanteNome =
            pickFirstNonEmptyString(
              typeof item["solicitante_nome"] === "string"
                ? (item["solicitante_nome"] as string)
                : undefined,
              typeof (item["solicitante"] as { nome?: unknown })?.nome === "string"
                ? ((item["solicitante"] as { nome?: string }).nome)
                : undefined,
            ) ?? null;

          const idValue = String(idParsed);
          if (seen.has(idValue)) {
            continue;
          }

          options.push({
            id: idValue,
            label: formatPropostaLabel(
              idParsed,
              sequencialValue,
              dataCriacaoValue,
              solicitanteNome,
            ),
            solicitante: solicitanteNome,
            sequencial: sequencialValue,
            dataCriacao: dataCriacaoValue,
          });
          seen.add(idValue);
        }

        options.sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));

        if (!cancelled) {
          setPropostas(options);
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setPropostas([]);
          setPropostasError(
            error instanceof Error
              ? error.message
              : "Erro ao carregar propostas",
          );
        }
      } finally {
        if (!cancelled) {
          setPropostasLoading(false);
        }
      }
    };

    fetchPropostas();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setProcessForm((prev) => {
      const valid = prev.advogados.filter((id) =>
        advogadosOptions.some((option) => option.id === id)
      );

      if (valid.length === prev.advogados.length) {
        return prev;
      }

      return { ...prev, advogados: valid };
    });
  }, [advogadosOptions]);

  useEffect(() => {
    setProcessForm((prev) => {
      if (!prev.propostaId) {
        return prev;
      }

      const exists = propostas.some((option) => option.id === prev.propostaId);
      if (exists) {
        return prev;
      }

      return { ...prev, propostaId: "" };
    });
  }, [propostas]);

  const selectedAdvogados = useMemo(
    () =>
      processForm.advogados
        .map((id) => advogadosOptions.find((option) => option.id === id))
        .filter((option): option is AdvogadoOption => Boolean(option)),
    [processForm.advogados, advogadosOptions],
  );

  const selectedProposta = useMemo(
    () => propostas.find((option) => option.id === processForm.propostaId) ?? null,
    [processForm.propostaId, propostas],
  );

  const propostaButtonLabel = selectedProposta
    ? selectedProposta.label
    : propostasLoading && propostas.length === 0
      ? "Carregando propostas..."
      : processForm.propostaId
        ? `Proposta #${processForm.propostaId}`
        : propostas.length === 0
          ? "Nenhuma proposta disponível"
          : "Selecione a proposta";

  const toggleAdvogadoSelection = useCallback((id: string) => {
    setProcessForm((prev) => {
      const alreadySelected = prev.advogados.includes(id);
      const updated = alreadySelected
        ? prev.advogados.filter((advId) => advId !== id)
        : [...prev.advogados, id];

      return { ...prev, advogados: updated };
    });
  }, []);

  const loadProcessos = useCallback(async () => {
    const res = await fetch(getApiUrl("processos"), {
      headers: { Accept: "application/json" },
    });

    let json: unknown = null;
    try {
      json = await res.json();
    } catch (error) {
      console.error("Não foi possível interpretar a resposta de processos", error);
    }

    if (!res.ok) {
      const message =
        json && typeof json === "object" &&
        "error" in json &&
        typeof (json as { error: unknown }).error === "string"
          ? (json as { error: string }).error
          : `Não foi possível carregar os processos (HTTP ${res.status})`;
      throw new Error(message);
    }

    const data: ApiProcesso[] = Array.isArray(json)
      ? (json as ApiProcesso[])
      : Array.isArray((json as { rows?: ApiProcesso[] })?.rows)
        ? ((json as { rows: ApiProcesso[] }).rows)
        : Array.isArray((json as { data?: { rows?: ApiProcesso[] } })?.data?.rows)
          ? ((json as { data: { rows: ApiProcesso[] } }).data.rows)
          : Array.isArray((json as { data?: ApiProcesso[] })?.data)
            ? ((json as { data: ApiProcesso[] }).data)
            : [];

    return data.map(mapApiProcessoToProcesso);
  }, []);

  useEffect(() => {
    let active = true;

    const fetchProcessos = async () => {
      setProcessosLoading(true);
      setProcessosError(null);
      try {
        const data = await loadProcessos();
        if (!active) return;
        setProcessos(data);
      } catch (error) {
        console.error(error);
        if (!active) return;
        const message =
          error instanceof Error
            ? error.message
            : "Erro ao carregar processos";
        setProcessos([]);
        setProcessosError(message);
        toast({
          title: "Erro ao carregar processos",
          description: message,
          variant: "destructive",
        });
      } finally {
        if (active) {
          setProcessosLoading(false);
        }
      }
    };

    fetchProcessos();

    return () => {
      active = false;
    };
  }, [loadProcessos, toast]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const POLLING_INTERVAL = 30000;
    let cancelled = false;

    const poll = async () => {
      try {
        const data = await loadProcessos();
        if (!cancelled) {
          setProcessos(data);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Erro ao atualizar processos em segundo plano", error);
        }
      }
    };

    const intervalId = window.setInterval(() => {
      void poll();
    }, POLLING_INTERVAL);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [loadProcessos]);

  useEffect(() => {
    if (
      processForm.clienteId &&
      !clientes.some((cliente) => String(cliente.id) === processForm.clienteId)
    ) {
      setProcessForm((prev) => ({ ...prev, clienteId: "" }));
    }
  }, [clientes, processForm.clienteId]);

  useEffect(() => {
    if (!processForm.uf) {
      setMunicipios([]);
      setMunicipiosLoading(false);
      return;
    }

    let cancelled = false;
    setMunicipiosLoading(true);

    const fetchMunicipios = async () => {
      try {
        const res = await fetch(
          `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${processForm.uf}/municipios?orderBy=nome`,
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as Municipio[];
        if (!cancelled) setMunicipios(data);
      } catch (error) {
        console.error(error);
        if (!cancelled) setMunicipios([]);
      } finally {
        if (!cancelled) setMunicipiosLoading(false);
      }
    };

    fetchMunicipios();

    return () => {
      cancelled = true;
    };
  }, [processForm.uf]);

  const statusOptions = useMemo(() => {
    const values = Array.from(
      new Set(
        processos
          .map((processo) => processo.status?.trim())
          .filter((status): status is string => Boolean(status) && status !== "Não informado"),
      ),
    ).sort((a, b) => a.localeCompare(b));

    return values;
  }, [processos]);

  const tipoOptions = useMemo(() => {
    const values = Array.from(
      new Set(
        processos
          .map((processo) => processo.tipo?.trim())
          .filter((tipo): tipo is string => Boolean(tipo) && tipo !== "Não informado"),
      ),
    ).sort((a, b) => a.localeCompare(b));

    return values;
  }, [processos]);

  useEffect(() => {
    if (statusFilter !== "todos" && !statusOptions.includes(statusFilter)) {
      setStatusFilter("todos");
    }
  }, [statusFilter, statusOptions]);

  useEffect(() => {
    if (tipoFilter !== "todos" && !tipoOptions.includes(tipoFilter)) {
      setTipoFilter("todos");
    }
  }, [tipoFilter, tipoOptions]);

  const totalProcessos = useMemo(() => processos.length, [processos]);

  const processosEmAndamento = useMemo(
    () =>
      processos.filter((processo) =>
        processo.status.toLowerCase().includes("andamento") ||
        processo.status.toLowerCase().includes("ativo"),
      ).length,
    [processos],
  );

  const processosArquivados = useMemo(
    () => processos.filter((processo) => processo.status.toLowerCase().includes("arquiv")).length,
    [processos],
  );

  const clientesAtivos = useMemo(
    () => new Set(processos.map((processo) => processo.cliente.id)).size,
    [processos],
  );

  const handleDialogOpenChange = useCallback((open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setAdvogadosPopoverOpen(false);
      setPropostasPopoverOpen(false);
      setProcessForm(createEmptyProcessForm());
      setCreateError(null);
    }
  }, []);

  const handleProcessCreate = async () => {
    if (creatingProcess) {
      return;
    }

    if (!processForm.clienteId) {
      setCreateError("Selecione o cliente responsável pelo processo.");
      return;
    }

    const selectedCliente = clientes.find(
      (cliente) => String(cliente.id) === processForm.clienteId,
    );

    if (!selectedCliente) {
      return;
    }

    setCreateError(null);
    setCreatingProcess(true);

    try {
      const advogadosPayload = processForm.advogados
        .map((id) => Number.parseInt(id, 10))
        .filter((value) => Number.isFinite(value) && value > 0);

      const jurisdicaoPayload = [processForm.municipio, processForm.uf]
        .map((value) => value?.trim())
        .filter((value) => value && value.length > 0)
        .join(" - ");

      const payload: Record<string, unknown> = {
        cliente_id: selectedCliente.id,
        numero: processForm.numero,
        uf: processForm.uf,
        municipio: processForm.municipio,
        ...(jurisdicaoPayload ? { jurisdicao: jurisdicaoPayload } : {}),
        advogados: advogadosPayload,
      };

      const instanciaPayload =
        processForm.instancia === INSTANCIA_OUTRO_VALUE
          ? processForm.instanciaOutro.trim()
          : processForm.instancia.trim();
      if (instanciaPayload) {
        payload.orgao_julgador = instanciaPayload;
      }

      const dataDistribuicaoPayload = processForm.dataDistribuicao.trim();
      if (dataDistribuicaoPayload) {
        payload.data_distribuicao = dataDistribuicaoPayload;
      }

      const propostaId = parseOptionalInteger(processForm.propostaId);
      if (propostaId && propostaId > 0) {
        payload.oportunidade_id = propostaId;
      }

      const res = await fetch(getApiUrl("processos"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      let json: unknown = null;
      try {
        json = await res.json();
      } catch (error) {
        console.error("Não foi possível interpretar a resposta de criação", error);
      }

      if (!res.ok) {
        const message =
          json && typeof json === "object" &&
          "error" in json &&
          typeof (json as { error: unknown }).error === "string"
            ? (json as { error: string }).error
            : `Não foi possível cadastrar o processo (HTTP ${res.status})`;
        throw new Error(message);
      }

      if (!json || typeof json !== "object") {
        throw new Error("Resposta inválida do servidor ao cadastrar o processo");
      }

      const mapped = mapApiProcessoToProcesso(json as ApiProcesso);
      setProcessos((prev) => [mapped, ...prev.filter((p) => p.id !== mapped.id)]);
      toast({ title: "Processo cadastrado com sucesso" });
      handleDialogOpenChange(false);
    } catch (error) {
      console.error(error);
      const message =
        error instanceof Error
          ? error.message
          : "Erro ao cadastrar processo";
      setCreateError(message);
      toast({
        title: "Erro ao cadastrar processo",
        description: message,
        variant: "destructive",
      });
    } finally {
      setCreatingProcess(false);
    }
  };

  const handleManualSync = useCallback(
    async (processoToSync: Processo, flags?: ManualSyncFlags) => {
      setSyncingProcessIds((prev) =>
        prev.includes(processoToSync.id) ? prev : [...prev, processoToSync.id],
      );
      setSyncErrors((prev) => ({ ...prev, [processoToSync.id]: null }));

      const requestPlan = planManualSyncRequest(processoToSync, flags);

      try {
        const headers: Record<string, string> = { Accept: "application/json" };

        if (requestPlan.method === "POST") {
          headers["Content-Type"] = "application/json";
        }

        const res = await fetch(getApiUrl(requestPlan.path), {
          method: requestPlan.method,
          headers,
          ...(requestPlan.method === "POST"
            ? { body: JSON.stringify(requestPlan.body ?? {}) }
            : {}),
        });

        const text = await res.text();
        let json: unknown = null;

        if (text) {
          try {
            json = JSON.parse(text);
          } catch (error) {
            console.error(
              "Não foi possível interpretar a resposta de sincronização manual",
              error,
            );
          }
        }

        if (!res.ok) {
          const message =
            json && typeof json === "object" && "error" in (json as { error?: unknown })
              ? String((json as { error?: unknown }).error ?? "Falha ao sincronizar processo")
              : `Não foi possível sincronizar o processo (HTTP ${res.status})`;
          throw new Error(message);
        }

        const responseRecord = toRecord(json) ?? {};
        const trackingRecord =
          toRecord(responseRecord["tracking"] ?? null) ??
          toRecord(responseRecord["tracking_status"] ?? null) ??
          toRecord(responseRecord["sync"] ?? null);
        const requestRecord =
          toRecord(responseRecord["request"] ?? null) ??
          (requestPlan.isStatusCheck ? responseRecord : null);
        const requestMapped = mapApiJuditRequest(
          (requestRecord ?? null) as ApiProcessoJuditRequest | null,
        );

        const requestStatus = requestMapped?.status ?? null;
        const shouldApplyResult = requestStatus === "completed";

        setProcessos((prev) =>
          prev.map((item) => {
            if (item.id !== processoToSync.id) {
              return item;
            }

            const trackingSummary = shouldApplyResult
              ? parseTrackingSummaryFromResult(requestMapped?.result) ??
                item.trackingSummary
              : item.trackingSummary;
            const responseData = shouldApplyResult
              ? parseResponseDataFromResult(requestMapped?.result) ??
                item.responseData
              : item.responseData;

            const trackingId = shouldApplyResult
              ? parseOptionalString(
                  trackingRecord?.tracking_id ?? trackingRecord?.id ?? null,
                ) ?? item.juditTrackingId
              : item.juditTrackingId;
            const trackingHourRange = shouldApplyResult
              ? parseOptionalString(trackingRecord?.hour_range) ??
                item.juditTrackingHourRange
              : item.juditTrackingHourRange;

            const trackingStatus = shouldApplyResult
              ? parseOptionalString(trackingRecord?.status) ??
                trackingSummary?.status ??
                item.status
              : item.status;

            const updatedAt = shouldApplyResult
              ? trackingSummary?.updatedAt ??
                item.trackingSummary?.updatedAt ??
                null
              : item.trackingSummary?.updatedAt ?? null;

            return {
              ...item,
              juditTrackingId: trackingId,
              juditTrackingHourRange: trackingHourRange,
              juditLastRequest: requestMapped ?? item.juditLastRequest,
              trackingSummary,
              responseData,
              status: trackingStatus || item.status,
              ultimaSincronizacao: shouldApplyResult
                ? updatedAt ?? item.ultimaSincronizacao
                : item.ultimaSincronizacao,
            };
          }),
        );

        if (requestStatus === "error") {
          const errorMessage =
            extractErrorMessageFromResult(requestMapped?.result) ??
            "A Judit retornou um erro ao processar a solicitação.";
          setSyncErrors((prev) => ({ ...prev, [processoToSync.id]: errorMessage }));
          toast({
            title: "Erro ao sincronizar processo",
            description: errorMessage,
            variant: "destructive",
          });
          return;
        }

        const shouldRefreshProcessList =
          !requestPlan.isStatusCheck || shouldApplyResult;

        if (shouldRefreshProcessList) {
          try {
            const refreshed = await loadProcessos();
            setProcessos(refreshed);
          } catch (refreshError) {
            console.error(
              "Falha ao atualizar lista após sincronização manual",
              refreshError,
            );
          }
        }

        if (requestPlan.isStatusCheck) {
          if (shouldApplyResult) {
            toast({
              title: "Dados do processo atualizados",
              description:
                "A consulta manual anterior foi concluída e os dados foram atualizados.",
            });
          } else {
            const pendingStatuses = new Set(["pending", "processing", "queued"]);
            const isPending =
              !requestStatus || pendingStatuses.has(requestStatus.toLowerCase());

            if (isPending) {
              toast({
                title: "Ainda buscando os dados do processo",
                description:
                  "A Judit ainda está processando esta solicitação. Verifique novamente em alguns minutos.",
              });
            } else {
              toast({
                title: "Status da solicitação verificado",
                description: `Status atual: ${requestStatus}.`,
              });
            }
          }
        } else {
          toast({
            title: "Solicitação enviada para a Judit",
            description:
              "Primeira solicitação manual registrada. Avisaremos quando os dados forem atualizados.",
          });
        }
      } catch (error) {
        console.error(error);
        const message =
          error instanceof Error
            ? error.message
            : "Não foi possível acionar a sincronização manual.";
        setSyncErrors((prev) => ({ ...prev, [processoToSync.id]: message }));
        toast({
          title: "Erro ao sincronizar processo",
          description: message,
          variant: "destructive",
        });
      } finally {
        setSyncingProcessIds((prev) => prev.filter((id) => id !== processoToSync.id));
      }
    },
    [loadProcessos, toast],
  );

  const handleManualSyncDialogOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setManualSyncProcess(null);
      setManualSyncWithAttachments(false);
      setManualSyncOnDemand(false);
    }
  }, []);

  const handleRequestManualSync = useCallback((processo: Processo) => {
    setManualSyncProcess(processo);
    setManualSyncWithAttachments(false);
    setManualSyncOnDemand(false);
  }, []);

  const handleConfirmManualSync = useCallback(() => {
    if (!manualSyncProcess) {
      return;
    }

    const processo = manualSyncProcess;
    void handleManualSync(processo, {
      withAttachments: manualSyncWithAttachments,
      onDemand: manualSyncOnDemand,
    });
    setManualSyncProcess(null);
    setManualSyncWithAttachments(false);
    setManualSyncOnDemand(false);
  }, [
    handleManualSync,
    manualSyncOnDemand,
    manualSyncProcess,
    manualSyncWithAttachments,
  ]);

  const navigateToProcess = useCallback(
    (
      processoToView: Processo,
      options?: { initialTab?: "resumo" | "historico" | "anexos" },
    ) => {
      const clienteId = processoToView.cliente?.id ?? null;

      if (!clienteId || clienteId <= 0) {
        toast({
          title: "Não foi possível abrir o processo",
          description: "Cliente relacionado ao processo não identificado.",
          variant: "destructive",
        });
        return;
      }

      const state = options?.initialTab ? { initialTab: options.initialTab } : undefined;
      const navigateOptions = state ? { state } : undefined;

      navigate(`/clientes/${clienteId}/processos/${processoToView.id}`, navigateOptions);
    },
    [navigate, toast],
  );

  const handleViewProcessDetails = useCallback(
    (processoToView: Processo) => {
      navigateToProcess(processoToView);
    },
    [navigateToProcess],
  );

  const handleViewProcessAttachments = useCallback(
    (processoToView: Processo) => {
      navigateToProcess(processoToView, { initialTab: "anexos" });
    },
    [navigateToProcess],
  );

  const isInstanciaOutroSelected = processForm.instancia === INSTANCIA_OUTRO_VALUE;

  const isCreateDisabled =
    !processForm.numero ||
    !processForm.uf ||
    !processForm.municipio ||
    !processForm.clienteId ||
    (isInstanciaOutroSelected && processForm.instanciaOutro.trim().length === 0) ||
    creatingProcess;

  const filteredProcessos = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const numericSearch = normalizedSearch.replace(/\D/g, "");

    return processos.filter((processo) => {
      const matchesStatus =
        statusFilter === "todos" || processo.status === statusFilter;
      const matchesTipo = tipoFilter === "todos" || processo.tipo === tipoFilter;

      if (!matchesStatus || !matchesTipo) {
        return false;
      }

      if (normalizedSearch.length === 0) {
        return true;
      }

      const searchPool = [
        processo.numero,
        processo.cliente?.nome,
        processo.status,
        processo.tipo,
        processo.orgaoJulgador,
        processo.classeJudicial,
        processo.advogados.map((adv) => adv.nome).join(" "),
        processo.proposta?.label,
        processo.proposta?.solicitante ?? null,
        processo.trackingSummary?.status ?? null,
        processo.trackingSummary?.phase ?? null,
        processo.trackingSummary?.lastStep?.label ?? null,
        processo.trackingSummary?.tags.join(" ") ?? null,
      ];

      const hasTextMatch = searchPool.some((value) => {
        if (!value) return false;
        return value.toLowerCase().includes(normalizedSearch);
      });

      const documento = processo.cliente?.documento ?? "";
      const propostaNumero = processo.proposta?.label
        ? processo.proposta.label.replace(/\D/g, "")
        : "";
      const hasDocumentoMatch =
        numericSearch.length > 0
          ? [documento.replace(/\D/g, ""), propostaNumero]
              .filter((value) => value.length > 0)
              .some((value) => value.includes(numericSearch))
          : false;

      return hasTextMatch || hasDocumentoMatch;
    });
  }, [processos, searchTerm, statusFilter, tipoFilter]);

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-foreground">Processos</h1>
          <p className="text-sm text-muted-foreground">
            Monitore os processos em andamento, acompanhe movimentações internas e identifique prioridades com mais clareza.
          </p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} className="self-start">
          Cadastrar processo
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border-border/60 bg-card/60 shadow-sm">
          <CardContent className="flex items-center justify-between gap-4 pt-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <GavelIcon className="h-5 w-5" />
            </div>
            <div className="text-right">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Total de processos
              </p>
              <p className="text-2xl font-semibold">{totalProcessos}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/60 shadow-sm">
          <CardContent className="flex items-center justify-between gap-4 pt-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
              <Clock className="h-5 w-5" />
            </div>
            <div className="text-right">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Em andamento
              </p>
              <p className="text-2xl font-semibold">{processosEmAndamento}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/60 shadow-sm">
          <CardContent className="flex items-center justify-between gap-4 pt-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-500/10 text-slate-600">
              <Archive className="h-5 w-5" />
            </div>
            <div className="text-right">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Arquivados
              </p>
              <p className="text-2xl font-semibold">{processosArquivados}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/60 shadow-sm">
          <CardContent className="flex items-center justify-between gap-4 pt-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10 text-blue-600">
              <UsersIcon className="h-5 w-5" />
            </div>
            <div className="text-right">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Clientes vinculados
              </p>
              <p className="text-2xl font-semibold">{clientesAtivos}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60 bg-card/60 shadow-sm">
        <CardHeader className="flex flex-col gap-2 pb-0 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">Filtros inteligentes</CardTitle>
            <CardDescription>
              Refine a visualização por status, tipo de processo ou busque por cliente, número ou documento.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 pt-4 md:grid-cols-[1.5fr,1fr,1fr]">
          <div className="relative flex items-center">
            <Search className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar por número, cliente, CPF ou advogado"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="h-11 pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-11">
              <SelectValue placeholder="Status do processo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              {statusOptions.length === 0 ? (
                <SelectItem value="__empty" disabled>
                  Nenhum status disponível
                </SelectItem>
              ) : (
                statusOptions.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <Select value={tipoFilter} onValueChange={setTipoFilter}>
            <SelectTrigger className="h-11">
              <SelectValue placeholder="Tipo do processo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              {tipoOptions.length === 0 ? (
                <SelectItem value="__empty" disabled>
                  Nenhum tipo disponível
                </SelectItem>
              ) : (
                tipoOptions.map((tipo) => (
                  <SelectItem key={tipo} value={tipo}>
                    {tipo}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {processosLoading ? (
        <Card className="border-border/60 bg-card/60 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Processos</CardTitle>
            <CardDescription>Carregando dados...</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[0, 1, 2].map((item) => (
              <div key={item} className="space-y-3 rounded-lg border border-dashed border-border/60 bg-muted/40 p-4">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : processosError ? (
        <Card className="border-destructive/40 bg-destructive/5 text-destructive">
          <CardHeader>
            <CardTitle>Não foi possível carregar os processos</CardTitle>
            <CardDescription className="text-destructive/80">
              {processosError}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : filteredProcessos.length === 0 ? (
        <Card className="border-border/60 bg-card/60 shadow-sm">
          <CardHeader>
            <CardTitle>Nenhum processo encontrado</CardTitle>
            <CardDescription>
              Ajuste os filtros ou refine a busca para visualizar outros resultados.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Você pode cadastrar um novo processo clicando no botão acima.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Accordion type="multiple" className="space-y-4">
          {filteredProcessos.map((processo) => {
            const clienteDocumento =
              processo.cliente?.documento?.trim() || "Documento não informado";
            const clientePapel = processo.cliente?.papel?.trim();
            const trackingUpdatedAt = processo.trackingSummary?.updatedAt ?? null;
            const ultimaAtualizacaoLabel = trackingUpdatedAt
              ? formatDateTimeToPtBR(trackingUpdatedAt)
              : processo.ultimaSincronizacao
                ? formatDateTimeToPtBR(processo.ultimaSincronizacao)
                : "Sem registros recentes";
            const movimentacoesLabel =
              processo.movimentacoesCount === 1
                ? "1 movimentação registrada"
                : `${processo.movimentacoesCount} movimentações registradas`;
            const trackingPhase = processo.trackingSummary?.phase?.trim() || null;
            const trackingTags = processo.trackingSummary?.tags ?? [];
              const trackingLastStep = processo.trackingSummary?.lastStep ?? null;
              const trackingLastStepLabel =
                trackingLastStep?.label ?? trackingLastStep?.name ?? null;
              const trackingLastStepDescription = trackingLastStep?.description ?? null;
              const trackingLastStepUpdatedAt = trackingLastStep?.updatedAt ?? null;
              const trackingLastStepContent = trackingLastStepLabel ? (
                trackingLastStepDescription || trackingLastStepUpdatedAt ? (
                  <Tooltip>
                    <TooltipTrigger className="text-left">
                      Etapa atual: {trackingLastStepLabel}
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs space-y-1">
                      {trackingLastStepDescription ? (
                        <p className="text-xs text-muted-foreground">{trackingLastStepDescription}</p>
                      ) : null}
                      {trackingLastStepUpdatedAt ? (
                        <p className="text-xs text-muted-foreground">
                          Atualizado em {formatDateTimeToPtBR(trackingLastStepUpdatedAt)}
                        </p>
                      ) : null}
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <>Etapa atual: {trackingLastStepLabel}</>
                )
              ) : (
                <>Etapa atual: Não informada</>
              );
              const trackingIncrements = processo.trackingSummary?.increments ?? [];
            const isSyncing = syncingProcessIds.includes(processo.id);
            const syncError = syncErrors[processo.id] ?? null;

            return (
              <AccordionItem
                key={processo.id}
                value={String(processo.id)}
                className="overflow-hidden rounded-xl border border-border/60 bg-card/60 text-card-foreground shadow-sm transition hover:border-primary/40 hover:shadow-md data-[state=open]:shadow-md"
              >
                <AccordionTrigger className="px-6 py-6 text-left hover:no-underline sm:px-8">
                  <div className="flex w-full flex-col gap-4 text-left">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-xl font-semibold">
                          Processo {processo.numero}
                        </CardTitle>
                        <CardDescription className="text-sm text-muted-foreground">
                          {processo.cliente.nome} · {processo.classeJudicial}
                        </CardDescription>
                      </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            variant="outline"
                            className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusBadgeClassName(processo.status)}`}
                          >
                            {processo.status}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={`rounded-full px-3 py-1 text-xs font-medium ${getTipoBadgeClassName(processo.tipo)}`}
                          >
                            {processo.tipo}
                          </Badge>
                          {trackingPhase ? (
                            <Badge
                              variant="outline"
                              className="rounded-full border-purple-200 bg-purple-500/10 px-3 py-1 text-xs font-medium text-purple-700"
                            >
                              Fase: {trackingPhase}
                            </Badge>
                          ) : null}
                          {trackingTags.map((tag, index) => (
                            <Badge
                              key={`${processo.id}-tag-${index}-${tag}`}
                              variant="outline"
                              className="rounded-full border-primary/30 bg-primary/5 px-3 py-1 text-xs font-medium text-primary"
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-4">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-primary" />
                          Distribuído em {processo.dataDistribuicao}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-primary" />
                          Última atualização: {ultimaAtualizacaoLabel}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <FileText className="h-3.5 w-3.5 text-primary" />
                          {movimentacoesLabel}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <ChevronsUpDown className="h-3.5 w-3.5 text-primary" />
                          {trackingLastStepContent}
                        </span>
                      </div>
                    </div>
                </AccordionTrigger>
                <AccordionContent className="border-t border-border/40 px-6 pb-6 pt-6 sm:px-8">
                  <div className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      <div className="rounded-lg border border-dashed border-border/60 bg-muted/40 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Cliente
                        </p>
                        <div className="mt-3 flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {processo.cliente.nome}
                            </p>
                            <p className="text-xs text-muted-foreground">{clienteDocumento}</p>
                          </div>
                          {clientePapel ? (
                            <Badge
                              variant="outline"
                              className="rounded-full border-muted-foreground/20 bg-background px-2.5 py-1 text-[10px] uppercase tracking-wide text-muted-foreground"
                            >
                              {clientePapel}
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                      {processo.proposta ? (
                        <div className="rounded-lg border border-dashed border-border/60 bg-muted/40 p-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Proposta vinculada
                          </p>
                          <div className="mt-3 flex items-start gap-2 text-sm text-foreground">
                            <Archive className="mt-0.5 h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="font-medium text-foreground">
                                {processo.proposta.label}
                              </p>
                              {processo.proposta.solicitante ? (
                                <p className="text-xs text-muted-foreground">
                                  Solicitante: {processo.proposta.solicitante}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      ) : null}
                      <div className="rounded-lg border border-dashed border-border/60 bg-muted/40 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Jurisdição
                        </p>
                        <div className="mt-3 flex items-start gap-2 text-sm text-foreground">
                          <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                          <span>{processo.jurisdicao}</span>
                        </div>
                      </div>
                      <div className="rounded-lg border border-dashed border-border/60 bg-muted/40 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Órgão julgador
                        </p>
                        <div className="mt-3 flex items-start gap-2 text-sm text-foreground">
                          <Landmark className="mt-0.5 h-4 w-4 text-muted-foreground" />
                          <span>{processo.orgaoJulgador}</span>
                        </div>
                      </div>
                      <div className="rounded-lg border border-dashed border-border/60 bg-muted/40 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Classe judicial
                        </p>
                        <div className="mt-3 flex items-start gap-2 text-sm text-foreground">
                          <FileText className="mt-0.5 h-4 w-4 text-muted-foreground" />
                          <span>{processo.classeJudicial}</span>
                        </div>
                      </div>
                      <div className="rounded-lg border border-dashed border-border/60 bg-muted/40 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Assunto principal
                        </p>
                        <div className="mt-3 flex items-start gap-2 text-sm text-foreground">
                          <GavelIcon className="mt-0.5 h-4 w-4 text-muted-foreground" />
                          <span>{processo.assunto}</span>
                        </div>
                      </div>
                      <div className="rounded-lg border border-dashed border-border/60 bg-muted/40 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Data da distribuição
                        </p>
                        <div className="mt-3 flex items-start gap-2 text-sm text-foreground">
                          <Calendar className="mt-0.5 h-4 w-4 text-muted-foreground" />
                          <span>{processo.dataDistribuicao}</span>
                        </div>
                      </div>
                      <div className="rounded-lg border border-dashed border-border/60 bg-muted/40 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Status atual
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <Badge
                            variant="outline"
                            className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusBadgeClassName(processo.status)}`}
                          >
                            {processo.status}
                          </Badge>
                        </div>
                      </div>
                      <div className="rounded-lg border border-dashed border-border/60 bg-muted/40 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Tipo do processo
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <Badge
                            variant="outline"
                            className={`rounded-full px-3 py-1 text-xs font-medium ${getTipoBadgeClassName(processo.tipo)}`}
                          >
                            {processo.tipo}
                          </Badge>
                        </div>
                      </div>
                      <div className="rounded-lg border border-dashed border-border/60 bg-muted/40 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Última solicitação Judit
                        </p>
                        <div className="mt-3 space-y-1 text-sm text-foreground">
                          {processo.juditLastRequest ? (
                            <>
                              <p className="font-medium text-foreground">
                                #{processo.juditLastRequest.requestId} · {processo.juditLastRequest.status}
                              </p>
                              {processo.juditLastRequest.updatedAt ? (
                                <p className="text-xs text-muted-foreground">
                                  Atualizado em {formatDateTimeToPtBR(processo.juditLastRequest.updatedAt)}
                                </p>
                              ) : null}
                              <p className="text-xs text-muted-foreground">
                                Origem: {processo.juditLastRequest.source}
                              </p>
                            </>
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              Nenhuma solicitação registrada até o momento.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    {processo.responseData ? (
                      <div className="space-y-4">
                        {processo.responseData.cover ? (
                          <div className="rounded-lg border border-dashed border-border/60 bg-muted/40 p-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Capa do processo
                            </p>
                            <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                              {Object.entries(processo.responseData.cover).map(([key, value]) => {
                                const formattedValue = formatResponseValue(value);
                                const isStructured = isMetadataEntryList(formattedValue);
                                const entryKey = `${processo.id}-cover-${key}`;

                                return (
                                  <div key={entryKey} className="space-y-1">
                                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                      {formatResponseKey(key)}
                                    </dt>
                                    <dd
                                      className={cn(
                                        "break-words",
                                        isStructured
                                          ? "text-foreground"
                                          : "text-sm text-foreground",
                                      )}
                                    >
                                      {isStructured
                                        ? renderMetadataEntries(formattedValue, {
                                            keyPrefix: entryKey,
                                            containerClassName: "space-y-2",
                                            nestedContainerClassName: "space-y-2",
                                            valueClassName:
                                              "text-sm text-foreground break-words",
                                            nestedValueClassName:
                                              "text-xs text-foreground/90 break-words",
                                          })
                                        : formattedValue}
                                    </dd>
                                  </div>
                                );
                              })}
                            </dl>
                          </div>
                        ) : null}
                        {processo.responseData.partes.length > 0 ? (
                          <div className="rounded-lg border border-dashed border-border/60 bg-muted/40 p-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Partes identificadas
                            </p>
                            <div className="mt-3 space-y-3">
                              {processo.responseData.partes.map((parte, index) => {
                                const parteNome =
                                  parseOptionalString(parte.nome) ??
                                  parseOptionalString(parte.name) ??
                                  parseOptionalString(parte.parte) ??
                                  `Parte ${index + 1}`;
                                const ignoredKeys = new Set([
                                  "nome",
                                  "name",
                                  "parte",
                                  "id",
                                ]);
                                return (
                                  <div
                                    key={`${processo.id}-parte-${index}-${parteNome}`}
                                    className="rounded-md border border-border/40 bg-background/60 p-3"
                                  >
                                    <p className="text-sm font-medium text-foreground">{parteNome}</p>
                                    <dl className="mt-2 grid gap-2 sm:grid-cols-2">
                                      {Object.entries(parte)
                                        .filter(([key]) => !ignoredKeys.has(key))
                                        .map(([key, value]) => {
                                          const formattedValue = formatResponseValue(value);
                                          const isStructured = isMetadataEntryList(formattedValue);
                                          const entryKey = `${processo.id}-parte-${index}-${key}`;

                                          return (
                                            <div key={entryKey} className="space-y-1">
                                              <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                                {formatResponseKey(key)}
                                              </dt>
                                              <dd
                                                className={cn(
                                                  "break-words",
                                                  isStructured
                                                    ? "text-foreground"
                                                    : "text-xs text-foreground",
                                                )}
                                              >
                                                {isStructured
                                                  ? renderMetadataEntries(formattedValue, {
                                                      keyPrefix: entryKey,
                                                      containerClassName: "space-y-2",
                                                      nestedContainerClassName: "space-y-2",
                                                      valueClassName:
                                                        "text-xs text-foreground break-words",
                                                      nestedValueClassName:
                                                        "text-[11px] text-foreground/90 break-words",
                                                    })
                                                  : formattedValue}
                                              </dd>
                                            </div>
                                          );
                                        })}
                                    </dl>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : null}
                        {processo.responseData.movimentacoes.length > 0 ? (
                          <div className="rounded-lg border border-dashed border-border/60 bg-muted/40 p-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Movimentações recentes (Judit)
                            </p>
                            <div className="mt-3 space-y-3">
                              {processo.responseData.movimentacoes.map((movimentacao, index) => {
                                const descricao =
                                  parseOptionalString(movimentacao.descricao) ??
                                  parseOptionalString(movimentacao.description) ??
                                  parseOptionalString(movimentacao.titulo) ??
                                  parseOptionalString(movimentacao.title) ??
                                  `Movimentação ${index + 1}`;
                                const dataMovimentacao =
                                  parseOptionalString(movimentacao.data) ??
                                  parseOptionalString(movimentacao.date) ??
                                  parseOptionalString(movimentacao.timestamp);
                                return (
                                  <div
                                    key={`${processo.id}-mov-${index}-${descricao}`}
                                    className="rounded-md border border-border/40 bg-background/60 p-3"
                                  >
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <p className="text-sm font-medium text-foreground">{descricao}</p>
                                      {dataMovimentacao ? (
                                        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                          {formatDateTimeToPtBR(dataMovimentacao)}
                                        </span>
                                      ) : null}
                                    </div>
                                    <dl className="mt-2 grid gap-2 sm:grid-cols-2">
                                      {Object.entries(movimentacao)
                                        .filter(([key]) => !["descricao", "description", "titulo", "title", "data", "date", "timestamp"].includes(key))
                                        .map(([key, value]) => {
                                          const formattedValue = formatResponseValue(value);
                                          const isStructured = isMetadataEntryList(formattedValue);
                                          const entryKey = `${processo.id}-mov-${index}-${key}`;

                                          return (
                                            <div key={entryKey} className="space-y-1">
                                              <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                                {formatResponseKey(key)}
                                              </dt>
                                              <dd
                                                className={cn(
                                                  "break-words",
                                                  isStructured
                                                    ? "text-foreground"
                                                    : "text-xs text-foreground",
                                                )}
                                              >
                                                {isStructured
                                                  ? renderMetadataEntries(formattedValue, {
                                                      keyPrefix: entryKey,
                                                      containerClassName: "space-y-2",
                                                      nestedContainerClassName: "space-y-2",
                                                      valueClassName:
                                                        "text-xs text-foreground break-words",
                                                      nestedValueClassName:
                                                        "text-[11px] text-foreground/90 break-words",
                                                    })
                                                  : formattedValue}
                                              </dd>
                                            </div>
                                          );
                                        })}
                                    </dl>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : null}
                        {processo.responseData.anexos.length > 0 ? (
                          <AttachmentsSummaryCard
                            attachments={processo.responseData.anexos}
                            onViewAttachments={() => handleViewProcessAttachments(processo)}
                          />
                        ) : null}
                        {processo.responseData.metadata ? (
                          <div className="rounded-lg border border-dashed border-border/60 bg-muted/40 p-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Metadados adicionais
                            </p>
                            {renderMetadataEntries(
                              Object.entries(processo.responseData.metadata).map(([key, value]) => ({
                                key,
                                label: formatResponseKey(key),
                                value: formatResponseValue(value),
                              })),
                              {
                                keyPrefix: `${processo.id}-metadata`,
                                containerClassName: "mt-3 grid gap-2 sm:grid-cols-2",
                                valueClassName: "text-xs text-foreground break-words",
                                nestedValueClassName: "text-[11px] text-foreground/90 break-words",
                              },
                            )}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    {trackingIncrements.length > 0 ? (
                      <div className="rounded-lg border border-dashed border-border/60 bg-muted/40 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Incrementos recentes recebidos
                        </p>
                        <ul className="mt-3 space-y-3 text-sm text-foreground">
                          {trackingIncrements.map((increment, index) => (
                            <li
                              key={`${processo.id}-increment-${increment.id}-${index}`}
                              className="space-y-1"
                            >
                              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                {increment.type ? (
                                  <span className="font-medium text-foreground">{increment.type}</span>
                                ) : null}
                                {increment.occurredAt ? (
                                  <span>{formatDateTimeToPtBR(increment.occurredAt)}</span>
                                ) : null}
                              </div>
                              <p className="text-sm text-foreground">
                                {increment.description
                                  ? increment.description
                                  : typeof increment.raw === "string"
                                    ? increment.raw
                                    : "Atualização registrada pelo webhook."}
                              </p>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    <div className="grid gap-4 lg:grid-cols-[1.5fr,1fr]">
                      <div className="rounded-lg border border-dashed border-border/60 bg-muted/40 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Equipe jurídica
                        </p>
                        {processo.advogados.length > 0 ? (
                          <ul className="mt-3 space-y-2 text-sm text-foreground">
                            {processo.advogados.map((advogado) => (
                              <li
                                key={`${processo.id}-adv-${advogado.id}-${advogado.nome}`}
                                className="space-y-0.5"
                              >
                                <p className="font-medium">{advogado.nome}</p>
                                {advogado.funcao ? (
                                  <p className="text-xs text-muted-foreground">{advogado.funcao}</p>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-3 text-xs text-muted-foreground">
                            Nenhum advogado cadastrado para este processo.
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">
                        ID interno: {processo.id}
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRequestManualSync(processo)}
                          disabled={isSyncing}
                        >
                          {isSyncing ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Sincronizando...
                            </>
                          ) : (
                            <>
                              <RefreshCw className="mr-2 h-4 w-4" />
                              Sincronizar
                            </>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewProcessDetails(processo)}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          Visualizar detalhes
                        </Button>
                      </div>
                    </div>
                    {syncError ? (
                      <p className="text-xs text-destructive">{syncError}</p>
                    ) : null}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

      <Dialog open={manualSyncProcess !== null} onOpenChange={handleManualSyncDialogOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Sincronizar processo com a Judit</DialogTitle>
            <DialogDescription>
              Configure os parâmetros da consulta manual antes de enviá-la para a Judit.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                Processo selecionado
              </p>
              <p className="text-sm text-muted-foreground">
                {manualSyncProcess?.numero ?? "Nenhum processo selecionado"}
              </p>
            </div>
            <div className="flex items-start space-x-3">
              <Checkbox
                id="manual-sync-attachments"
                checked={manualSyncWithAttachments}
                onCheckedChange={(checked) =>
                  setManualSyncWithAttachments(checked === true)
                }
              />
              <div className="space-y-1">
                <Label htmlFor="manual-sync-attachments">Incluir anexos</Label>
                <p className="text-xs text-muted-foreground">
                  Solicitar que a Judit busque e entregue anexos disponíveis junto com o processo.
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <Checkbox
                id="manual-sync-on-demand"
                checked={manualSyncOnDemand}
                onCheckedChange={(checked) => setManualSyncOnDemand(checked === true)}
              />
              <div className="space-y-1">
                <Label htmlFor="manual-sync-on-demand">Busca sob demanda</Label>
                <p className="text-xs text-muted-foreground">
                  Forçar uma consulta imediata ao processo na Judit, sem aguardar o rastreamento automático.
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleManualSyncDialogOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmManualSync}
              disabled={
                manualSyncProcess === null ||
                (manualSyncProcess !== null &&
                  syncingProcessIds.includes(manualSyncProcess.id))
              }
            >
              Solicitar sincronização
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Cadastrar processo</DialogTitle>
            <DialogDescription>
              Informe os dados básicos para registrar um novo processo.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="process-client">Cliente</Label>
              <Select
                value={processForm.clienteId}
                onValueChange={(value) =>
                  setProcessForm((prev) => ({
                    ...prev,
                    clienteId: value,
                  }))
                }
              >
                <SelectTrigger
                  id="process-client"
                  disabled={clientesLoading || clientes.length === 0}
                >
                  <SelectValue
                    placeholder={
                      clientesLoading
                        ? "Carregando clientes..."
                        : clientes.length > 0
                          ? "Selecione o cliente"
                          : "Nenhum cliente encontrado"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((cliente) => (
                    <SelectItem key={cliente.id} value={String(cliente.id)}>
                      {cliente.nome}
                      {cliente.documento ? ` (${cliente.documento})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="process-proposta">Proposta vinculada</Label>
              <Popover
                open={propostasPopoverOpen}
                onOpenChange={setPropostasPopoverOpen}
              >
                <PopoverTrigger asChild>
                  <Button
                    id="process-proposta"
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={propostasPopoverOpen}
                    className="w-full justify-between"
                    disabled={propostasLoading && propostas.length === 0}
                  >
                    <span className="truncate">{propostaButtonLabel}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[var(--radix-popover-trigger-width)] p-0"
                  align="start"
                >
                  <Command>
                    <CommandInput placeholder="Buscar proposta..." />
                    <CommandList>
                      <CommandEmpty>
                        {propostasLoading
                          ? "Carregando propostas..."
                          : propostasError ?? "Nenhuma proposta encontrada"}
                      </CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="Nenhuma proposta"
                          onSelect={() => {
                            setProcessForm((prev) => ({ ...prev, propostaId: "" }));
                            setPropostasPopoverOpen(false);
                          }}
                        >
                          <Check
                            className={`mr-2 h-4 w-4 ${processForm.propostaId === "" ? "opacity-100" : "opacity-0"}`}
                          />
                          Nenhuma proposta vinculada
                        </CommandItem>
                        {propostas.map((proposta) => {
                          const selected = processForm.propostaId === proposta.id;
                          return (
                            <CommandItem
                              key={proposta.id}
                              value={proposta.label}
                              onSelect={() => {
                                setProcessForm((prev) => ({
                                  ...prev,
                                  propostaId: proposta.id,
                                }));
                                setPropostasPopoverOpen(false);
                              }}
                            >
                              <Check
                                className={`mr-2 h-4 w-4 ${selected ? "opacity-100" : "opacity-0"}`}
                              />
                              <div className="flex flex-col">
                                <span>{proposta.label}</span>
                                {proposta.solicitante ? (
                                  <span className="text-xs text-muted-foreground">
                                    Solicitante: {proposta.solicitante}
                                  </span>
                                ) : null}
                              </div>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {propostasError ? (
                <p className="text-xs text-destructive">{propostasError}</p>
              ) : selectedProposta ? (
                <p className="text-xs text-muted-foreground">
                  Proposta selecionada{selectedProposta.solicitante ? ` para ${selectedProposta.solicitante}` : ""}.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Vincule uma proposta existente ao processo (opcional).
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="process-uf">UF</Label>
              <Select
                value={processForm.uf}
                onValueChange={(value) =>
                  setProcessForm((prev) => ({
                    ...prev,
                    uf: value,
                    municipio: "",
                  }))
                }
              >
                <SelectTrigger id="process-uf">
                  <SelectValue placeholder="Selecione a UF" />
                </SelectTrigger>
                <SelectContent>
                  {ufs.map((uf) => (
                    <SelectItem key={uf.sigla} value={uf.sigla}>
                      {uf.nome} ({uf.sigla})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="process-municipio">Município</Label>
              <Select
                value={processForm.municipio}
                onValueChange={(value) =>
                  setProcessForm((prev) => ({ ...prev, municipio: value }))
                }
              >
                <SelectTrigger
                  id="process-municipio"
                  disabled={!processForm.uf || municipiosLoading}
                >
                  <SelectValue
                    placeholder={
                      !processForm.uf
                        ? "Selecione a UF primeiro"
                        : municipiosLoading
                          ? "Carregando municípios..."
                          : municipios.length > 0
                            ? "Selecione o município"
                            : "Nenhum município encontrado"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {municipios.map((municipio) => (
                    <SelectItem key={municipio.id} value={municipio.nome}>
                      {municipio.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Advogados responsáveis</Label>
              <Popover
                open={advogadosPopoverOpen}
                onOpenChange={setAdvogadosPopoverOpen}
              >
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={advogadosPopoverOpen}
                    className="w-full justify-between"
                    disabled={advogadosLoading && advogadosOptions.length === 0}
                  >
                    <span className="truncate">
                      {advogadosLoading && advogadosOptions.length === 0
                        ? "Carregando advogados..."
                        : selectedAdvogados.length === 0
                          ? advogadosOptions.length === 0
                            ? "Nenhum advogado disponível"
                            : "Selecione os advogados responsáveis"
                          : selectedAdvogados.length === 1
                            ? selectedAdvogados[0].nome
                            : `${selectedAdvogados.length} advogados selecionados`}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[var(--radix-popover-trigger-width)] p-0"
                  align="start"
                >
                  <Command>
                    <CommandInput placeholder="Pesquisar advogados..." />
                    <CommandList>
                      <CommandEmpty>
                        {advogadosLoading
                          ? "Carregando advogados..."
                          : advogadosError ?? "Nenhum advogado encontrado"}
                      </CommandEmpty>
                      <CommandGroup>
                        {advogadosOptions.map((advogado) => {
                          const selected = processForm.advogados.includes(advogado.id);
                          return (
                            <CommandItem
                              key={advogado.id}
                              value={`${advogado.nome} ${advogado.descricao ?? ""}`}
                              onSelect={() => toggleAdvogadoSelection(advogado.id)}
                            >
                              <Check
                                className={`mr-2 h-4 w-4 ${selected ? "opacity-100" : "opacity-0"}`}
                              />
                              <div className="flex flex-col">
                                <span>{advogado.nome}</span>
                                {advogado.descricao ? (
                                  <span className="text-xs text-muted-foreground">
                                    {advogado.descricao}
                                  </span>
                                ) : null}
                              </div>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {selectedAdvogados.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {selectedAdvogados.map((advogado) => (
                    <Badge
                      key={`selected-${advogado.id}`}
                      variant="secondary"
                      className="flex items-center gap-1 text-xs"
                    >
                      <span>{advogado.nome}</span>
                      <button
                        type="button"
                        onClick={() => toggleAdvogadoSelection(advogado.id)}
                        className="ml-1 text-muted-foreground transition hover:text-foreground"
                        aria-label={`Remover ${advogado.nome}`}
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {advogadosError
                    ? advogadosError
                    : "Selecione os advogados responsáveis pelo processo (opcional)."}
                </p>
              )}
            </div>
            <div className="space-y-4 sm:col-span-2 md:col-span-1">
              <div className="space-y-2">
                <Label htmlFor="process-number">Número do processo</Label>
                <Input
                  id="process-number"
                  placeholder="0000000-00.0000.0.00.0000"
                  value={processForm.numero}
                  onChange={(event) =>
                    setProcessForm((prev) => ({
                      ...prev,
                      numero: formatProcessNumber(event.target.value),
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="process-instancia">Instância do processo</Label>
                <Select
                  value={processForm.instancia}
                  onValueChange={(value) =>
                    setProcessForm((prev) => ({
                      ...prev,
                      instancia: value,
                      instanciaOutro:
                        value === INSTANCIA_OUTRO_VALUE ? prev.instanciaOutro : "",
                    }))
                  }
                >
                  <SelectTrigger id="process-instancia">
                    <SelectValue placeholder="Selecione a instância" />
                  </SelectTrigger>
                  <SelectContent>
                    {INSTANCIA_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {isInstanciaOutroSelected ? (
                <div className="space-y-2">
                  <Label htmlFor="process-instancia-outro">Especificar instância</Label>
                  <Input
                    id="process-instancia-outro"
                    placeholder="Descreva a instância"
                    value={processForm.instanciaOutro}
                    onChange={(event) =>
                      setProcessForm((prev) => ({
                        ...prev,
                        instanciaOutro: event.target.value,
                      }))
                    }
                  />
                </div>
              ) : null}

            </div>
            <div className="space-y-2 sm:col-span-2 md:col-span-1">
              <Label htmlFor="process-distribution-date">Data da distribuição</Label>
              <Input
                id="process-distribution-date"
                type="date"
                value={processForm.dataDistribuicao}
                onChange={(event) =>
                  setProcessForm((prev) => ({
                    ...prev,
                    dataDistribuicao: event.target.value,
                  }))
                }
              />
            </div>
          </div>
          {createError ? (
            <p className="text-sm text-destructive">{createError}</p>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => handleDialogOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleProcessCreate}
              disabled={isCreateDisabled}
            >
              {creatingProcess ? "Cadastrando..." : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

