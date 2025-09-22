
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getApiBaseUrl } from "@/lib/api";

import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { format as dfFormat, parseISO } from "date-fns";
import { Download, ExternalLink, FileText, Loader2, Trash } from "lucide-react";
import { createSimplePdfFromHtml } from "@/lib/pdf";

interface Envolvido {
  nome?: string;
  cpf_cnpj?: string;
  telefone?: string;
  endereco?: string;
  relacao?: string;
  [key: string]: unknown;
}

interface OpportunityData {
  id: number;
  title?: string;
  status_id?: number | null;
  status?: string;
  ultima_atualizacao?: string;
  envolvidos?: Envolvido[];
  responsavel_id?: number | null;
  responsible?: string | null;
  valor_causa?: number | string | null;
  valor_honorarios?: number | string | null;
  percentual_honorarios?: number | string | null;
  forma_pagamento?: string | null;
  qtde_parcelas?: number | string | null;
  sequencial_empresa?: number;
  data_criacao?: string | null;
  numero_processo_cnj?: string | null;
  numero_protocolo?: string | null;
  vara_ou_orgao?: string | null;
  comarca?: string | null;
  tipo_processo_nome?: string | null;
  area?: string | null;
  documentos_anexados?: unknown;
  criado_por?: number | string | null;
  criado_por_nome?: string | null;
  [key: string]: unknown;
}

interface ParticipantData {
  id?: number;
  nome?: string;
  documento?: string;
  telefone?: string;
  endereco?: string;
  relacao?: string;
}

interface StatusOption {
  id: string;
  name: string;
}

const sortStatusOptions = (options: StatusOption[]) =>
  [...options].sort((a, b) =>
    a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" })
  );

const parseSituacaoOptions = (data: unknown[]): StatusOption[] => {
  const byId = new Map<string, StatusOption>();

  data.forEach((item) => {
    if (!item || typeof item !== "object") return;
    const record = item as Record<string, unknown>;
    const id = record["id"];
    if (id === null || id === undefined) return;

    const ativo = record["ativo"];
    if (ativo !== undefined && ativo !== null && ativo !== true) return;

    const rawLabel = record["nome"] ?? record["name"];
    const label =
      typeof rawLabel === "string" && rawLabel.trim().length > 0
        ? rawLabel.trim()
        : String(id);

    byId.set(String(id), { id: String(id), name: label });
  });

  return sortStatusOptions(Array.from(byId.values()));
};

interface InteractionAttachment {
  name: string;
  size: number;
  mimeType?: string;
  dataUrl?: string;
}

interface InteractionEntry {
  id: number;
  comment: string;
  attachments: InteractionAttachment[];
  createdAt: string;
}

const sanitizeInteractionEntries = (value: unknown): InteractionEntry[] => {
  if (!Array.isArray(value)) return [];

  const entries: InteractionEntry[] = [];

  value.forEach((item) => {
    if (!item || typeof item !== "object") return;
    const record = item as Record<string, unknown>;

    const rawId = record["id"];
    const idNumber =
      typeof rawId === "number"
        ? rawId
        : typeof rawId === "string"
          ? Number.parseInt(rawId, 10)
          : Number.NaN;

    if (!Number.isFinite(idNumber)) return;

    const rawCreatedAt = record["createdAt"];
    const createdAt =
      typeof rawCreatedAt === "string" && rawCreatedAt.trim().length > 0
        ? rawCreatedAt
        : new Date(idNumber).toISOString();

    const rawComment = record["comment"];
    const comment = typeof rawComment === "string" ? rawComment : "";

    const attachmentsValue = record["attachments"];
    const attachments: InteractionEntry["attachments"] = Array.isArray(
      attachmentsValue,
    )
      ? attachmentsValue.flatMap((attachment) => {
          if (!attachment || typeof attachment !== "object") return [];
          const attachmentRecord = attachment as Record<string, unknown>;
          const rawName = attachmentRecord["name"];
          const name =
            typeof rawName === "string" && rawName.trim().length > 0
              ? rawName.trim()
              : null;

          if (!name) return [];

          const rawSize = attachmentRecord["size"];
          const size =
            typeof rawSize === "number"
              ? rawSize
              : typeof rawSize === "string"
                ? Number.parseInt(rawSize, 10)
                : Number.NaN;

          const normalizedSize =
            Number.isFinite(size) && size >= 0 ? size : 0;

          const rawMimeType = attachmentRecord["mimeType"] ?? attachmentRecord["type"];
          const mimeType =
            typeof rawMimeType === "string" && rawMimeType.trim().length > 0
              ? rawMimeType.trim()
              : undefined;

          const rawDataUrl = attachmentRecord["dataUrl"] ?? attachmentRecord["dataURL"];
          const trimmedDataUrl =
            typeof rawDataUrl === "string" && rawDataUrl.trim().length > 0
              ? rawDataUrl.trim()
              : null;

          const dataUrl =
            trimmedDataUrl && trimmedDataUrl.startsWith("data:")
              ? trimmedDataUrl
              : undefined;


          return [
            {
              name,
              size: normalizedSize,
              ...(mimeType ? { mimeType } : {}),
              ...(dataUrl ? { dataUrl } : {}),

            },
          ];
        })
      : [];

    entries.push({
      id: idNumber,
      comment,
      attachments,
      createdAt,
    });
  });

  return entries;
};

interface OpportunityDocument {
  id: number;
  oportunidade_id?: number | null;
  template_id: number | null;
  title: string;
  created_at: string;
  content_html: string;
  variables?: Record<string, unknown>;
  metadata?: unknown;
}

const normalizeOpportunityDocuments = (payload: unknown): OpportunityDocument[] => {
  const extractList = (): unknown[] => {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    if (typeof payload === "object") {
      const documents = (payload as { documents?: unknown }).documents;
      if (Array.isArray(documents)) return documents;
    }
    return [];
  };

  const items = extractList();
  return items.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;

    const rawId = record["id"];
    const numericId =
      typeof rawId === "number"
        ? rawId
        : typeof rawId === "string"
          ? Number.parseInt(rawId, 10)
          : Number.NaN;
    if (!Number.isFinite(numericId)) return [];

    const rawTemplateId = record["template_id"];
    const templateId = (() => {
      if (typeof rawTemplateId === "number") {
        return Number.isFinite(rawTemplateId) ? rawTemplateId : null;
      }
      if (typeof rawTemplateId === "string") {
        const parsed = Number.parseInt(rawTemplateId, 10);
        return Number.isNaN(parsed) ? null : parsed;
      }
      return null;
    })();

    const rawTitle = record["title"];
    const title =
      typeof rawTitle === "string" && rawTitle.trim().length > 0
        ? rawTitle.trim()
        : `Documento ${numericId}`;

    const rawCreatedAt = record["created_at"];
    const createdAt =
      typeof rawCreatedAt === "string" && rawCreatedAt.trim().length > 0
        ? rawCreatedAt.trim()
        : new Date().toISOString();

    const rawContent = record["content_html"];
    const contentHtml =
      typeof rawContent === "string" && rawContent.trim().length > 0
        ? rawContent
        : "<p></p>";

    const rawVariables = record["variables"];
    const variables =
      rawVariables && typeof rawVariables === "object" && !Array.isArray(rawVariables)
        ? (rawVariables as Record<string, unknown>)
        : undefined;

    return [
      {
        id: numericId,
        oportunidade_id: (record["oportunidade_id"] as number | null | undefined) ?? null,
        template_id: templateId,
        title,
        created_at: createdAt,
        content_html: contentHtml,
        variables,
        metadata: record["metadata"],
      },
    ];
  });
};

const slugifyFilename = (value: string): string => {
  const base = value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9\s-]+/g, " ")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
  return base.length > 0 ? base : "documento";
};

interface BillingRecord {
  id: number;
  oportunidade_id: number;
  forma_pagamento: string;
  condicao_pagamento?: string | null;
  valor?: number | string | null;
  parcelas?: number | string | null;
  observacoes?: string | null;
  data_faturamento?: string | null;
  criado_em?: string | null;
}

interface InstallmentRecord {
  id: number;
  oportunidade_id: number;
  numero_parcela: number;
  valor: number | string;
  valor_pago?: number | string | null;
  status?: string | null;
  data_prevista?: string | null;
  quitado_em?: string | null;
  faturamento_id?: number | null;
  criado_em?: string | null;
  atualizado_em?: string | null;
}

const BILLING_PAYMENT_OPTIONS = [
  "Cartão de crédito",
  "Cartão de débito",
  "Boleto",
  "Pix",
  "Transferência bancária",
  "Dinheiro",
  "Outro",
] as const;

const BILLING_CONDITIONS = ["À vista", "Parcelado"] as const;

type BillingCondition = (typeof BILLING_CONDITIONS)[number];

interface BillingFormState {
  formaPagamento: string;
  formaPagamentoDescricao: string;
  condicaoPagamento: BillingCondition;
  parcelas: string;
  valor: string;
  juros: string;
  multa: string;
  dataFaturamento: string;
  observacoes: string;
  selectedInstallmentIds: number[];
}

const coerceArray = (data: unknown): unknown[] => {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const fromRows = (data as { rows?: unknown[] }).rows;
    if (Array.isArray(fromRows)) return fromRows;
    const fromData = (data as { data?: unknown }).data;
    if (Array.isArray(fromData)) return fromData;
    const fromDataRows = (data as { data?: { rows?: unknown[] } }).data?.rows;
    if (Array.isArray(fromDataRows)) return fromDataRows;
    const fromBilling = (data as { faturamentos?: unknown[] }).faturamentos;
    if (Array.isArray(fromBilling)) return fromBilling;
  }
  return [];
};

const mapBillingRecords = (data: unknown): BillingRecord[] =>
  coerceArray(data).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const id = record["id"];
    const forma = record["forma_pagamento"];
    if (id === undefined || id === null || typeof forma !== "string") {
      return [];
    }

    const numericId = Number(id);
    if (Number.isNaN(numericId)) {
      return [];
    }

    const oportunidadeIdRaw = record["oportunidade_id"];
    let numericOpportunity: number | undefined;
    if (typeof oportunidadeIdRaw === "number") {
      numericOpportunity = Number.isNaN(oportunidadeIdRaw)
        ? undefined
        : oportunidadeIdRaw;
    } else if (typeof oportunidadeIdRaw === "string") {
      const parsed = Number(oportunidadeIdRaw);
      numericOpportunity = Number.isNaN(parsed) ? undefined : parsed;
    }

    return [
      {
        id: numericId,
        oportunidade_id: numericOpportunity ?? numericId,
        forma_pagamento: forma,
        condicao_pagamento: record["condicao_pagamento"] as string | null | undefined,
        valor: record["valor"] as number | string | null | undefined,
        parcelas: record["parcelas"] as number | string | null | undefined,
        observacoes: record["observacoes"] as string | null | undefined,
        data_faturamento: record["data_faturamento"] as string | null | undefined,
        criado_em: record["criado_em"] as string | null | undefined,
      },
    ];
  });

const mapInstallmentRecords = (data: unknown): InstallmentRecord[] =>
  coerceArray(data).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const idRaw = record["id"];
    const numeroRaw = record["numero_parcela"];
    if (idRaw === undefined || numeroRaw === undefined) return [];
    const id = Number(idRaw);
    const numero = Number(numeroRaw);
    if (Number.isNaN(id) || Number.isNaN(numero)) return [];
    const oportunidadeIdRaw = record["oportunidade_id"];
    const oportunidadeId =
      oportunidadeIdRaw === undefined || oportunidadeIdRaw === null
        ? id
        : Number(oportunidadeIdRaw);

    return [
      {
        id,
        oportunidade_id: Number.isNaN(oportunidadeId) ? id : oportunidadeId,
        numero_parcela: numero,
        valor: record["valor"] as number | string,
        valor_pago: record["valor_pago"] as number | string | null | undefined,
        status: typeof record["status"] === "string" ? record["status"] : null,
        data_prevista: record["data_prevista"] as string | null | undefined,
        quitado_em: record["quitado_em"] as string | null | undefined,
        faturamento_id: record["faturamento_id"] as number | null | undefined,
        criado_em: record["criado_em"] as string | null | undefined,
        atualizado_em: record["atualizado_em"] as string | null | undefined,
      },
    ];
  });

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

const STATUS_EMPTY_VALUE = "__no_status__";

export default function VisualizarOportunidade() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const apiUrl = getApiBaseUrl();

  const [opportunity, setOpportunity] = useState<OpportunityData | null>(null);
  const [snack, setSnack] = useState<{ open: boolean; message?: string }>({ open: false });
  const [expandedDetails, setExpandedDetails] = useState(false);
  const [participants, setParticipants] = useState<ParticipantData[]>([]);
  const [statusOptions, setStatusOptions] = useState<StatusOption[]>([]);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusSaving, setStatusSaving] = useState(false);
  const [documentDialogOpen, setDocumentDialogOpen] = useState(false);
  const [documentType, setDocumentType] = useState<"modelo" | "processo" | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [documentTemplates, setDocumentTemplates] = useState<
    Array<{ value: string; label: string }>
  >([]);
  const [documentTemplatesLoading, setDocumentTemplatesLoading] = useState(false);
  const [documentTemplatesError, setDocumentTemplatesError] = useState<string | null>(
    null,
  );
  const [documentSubmitting, setDocumentSubmitting] = useState(false);
  const [documents, setDocuments] = useState<OpportunityDocument[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsError, setDocumentsError] = useState<string | null>(null);
  const [documentPreview, setDocumentPreview] = useState<OpportunityDocument | null>(null);
  const [documentPreviewUrl, setDocumentPreviewUrl] = useState<string | null>(null);
  const [documentPreviewLoading, setDocumentPreviewLoading] = useState(false);
  const [documentPreviewError, setDocumentPreviewError] = useState<string | null>(null);
  const [documentActionState, setDocumentActionState] = useState<
    { id: number; type: "download" | "open" } | null
  >(null);
  const [documentToDelete, setDocumentToDelete] = useState<OpportunityDocument | null>(
    null,
  );
  const [documentDeleting, setDocumentDeleting] = useState(false);
  const [processForm, setProcessForm] = useState({
    numero: "",
    uf: "",
    municipio: "",
    orgaoJulgador: "",
  });
  const [ufs, setUfs] = useState<{ sigla: string; nome: string }[]>([]);
  const [municipios, setMunicipios] = useState<{ id: number; nome: string }[]>([]);
  const [municipiosLoading, setMunicipiosLoading] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<File[]>([]);
  const [commentText, setCommentText] = useState("");
  const [interactionHistory, setInteractionHistory] = useState<InteractionEntry[]>([]);
  const [installments, setInstallments] = useState<InstallmentRecord[]>([]);
  const [billingHistory, setBillingHistory] = useState<BillingRecord[]>([]);
  const billingHistoryById = useMemo(() => {
    const map = new Map<number, BillingRecord>();
    billingHistory.forEach((record) => {
      map.set(record.id, record);
    });
    return map;
  }, [billingHistory]);
  const [billingDialogOpen, setBillingDialogOpen] = useState(false);
  const [billingSubmitting, setBillingSubmitting] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [billingForm, setBillingForm] = useState<BillingFormState>(() => ({
    formaPagamento: "",
    formaPagamentoDescricao: "",
    condicaoPagamento: "À vista",
    parcelas: "1",
    valor: "",
    juros: "",
    multa: "",
    dataFaturamento: new Date().toISOString().slice(0, 10),
    observacoes: "",
    selectedInstallmentIds: [],
  }));

  const interactionStorageKey = useMemo(
    () => (id ? `opportunity-interactions:${id}` : null),
    [id],
  );
  const skipInteractionPersistenceRef = useRef<string | null>(null);
  const documentPdfUrlsRef = useRef<Map<number, string>>(new Map());

  const patchOpportunity = useCallback(
    (updater: (prev: OpportunityData) => OpportunityData) => {
      setOpportunity((prev) => {
        if (!prev) return prev;
        const next = updater(prev);
        if ((prev as { _namesLoaded?: boolean })._namesLoaded) {
          Object.defineProperty(next, "_namesLoaded", {
            value: true,
            enumerable: false,
          });
        }
        return next;
      });
    },
    []
  );

  const fetchDocuments = useCallback(async (): Promise<OpportunityDocument[]> => {
    if (!id) return [];

    const response = await fetch(
      `${apiUrl}/api/oportunidades/${id}/documentos`,
      { headers: { Accept: "application/json" } },
    );
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = (await response.json()) as unknown;
    return normalizeOpportunityDocuments(payload);
  }, [apiUrl, id]);

  const refreshDocuments = useCallback(async () => {
    if (!id) {
      setDocuments([]);
      setDocumentsError(null);
      return;
    }

    setDocumentsLoading(true);
    setDocumentsError(null);
    try {
      const docs = await fetchDocuments();
      setDocuments(docs);
    } catch (error) {
      console.error(error);
      setDocumentsError("Erro ao carregar documentos");
    } finally {
      setDocumentsLoading(false);
    }
  }, [fetchDocuments, id]);

  const resetDocumentDialog = () => {
    setDocumentType(null);
    setSelectedTemplate("");
    setProcessForm({ numero: "", uf: "", municipio: "", orgaoJulgador: "" });
    setMunicipios([]);
    setMunicipiosLoading(false);
    setDocumentTemplatesError(null);
    setDocumentSubmitting(false);
  };

  useEffect(() => {
    let cancelled = false;

    const fetchUfs = async () => {
      try {
        const res = await fetch(
          "https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome",
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { sigla: string; nome: string }[];
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
    const cache = documentPdfUrlsRef.current;
    return () => {
      cache.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch (error) {
          console.warn("Falha ao revogar URL do PDF", error);
        }
      });
      cache.clear();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!id) {
      setDocuments([]);
      setDocumentsError(null);
      setDocumentsLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setDocumentsLoading(true);
    setDocumentsError(null);

    fetchDocuments()
      .then((docs) => {
        if (!cancelled) {
          setDocuments(docs);
        }
      })
      .catch((error) => {
        console.error(error);
        if (!cancelled) {
          setDocumentsError("Erro ao carregar documentos");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setDocumentsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [fetchDocuments, id]);

  useEffect(() => {
    const cached = documentPdfUrlsRef.current;
    const validIds = new Set(documents.map((doc) => doc.id));
    for (const [docId, url] of cached) {
      if (!validIds.has(docId)) {
        try {
          URL.revokeObjectURL(url);
        } catch (error) {
          console.warn("Falha ao revogar URL do PDF", error);
        }
        cached.delete(docId);
      }
    }

    if (documentPreview && !validIds.has(documentPreview.id)) {
      setDocumentPreview(null);
      setDocumentPreviewUrl(null);
    }
  }, [documents, documentPreview]);

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
        const data = (await res.json()) as { id: number; nome: string }[];
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

  const getStatusLabel = (value: number | null | undefined) => {
    if (value === null || value === undefined) return undefined;
    const match = statusOptions.find(
      (option) => Number(option.id) === Number(value)
    );
    return match?.name ?? String(value);
  };

  const fetchList = async (url: string): Promise<unknown[]> => {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: unknown = await res.json();
    if (Array.isArray(data)) return data;
    if (Array.isArray((data as { rows?: unknown[] }).rows))
      return (data as { rows: unknown[] }).rows;
    if (
      Array.isArray(
        (data as { data?: { rows?: unknown[] } }).data?.rows
      )
    )
      return (data as { data: { rows: unknown[] } }).data.rows;
    if (Array.isArray((data as { data?: unknown[] }).data))
      return (data as { data: unknown[] }).data;
    return [];
  };

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const fetchOpportunity = async () => {
      try {
        const res = await fetch(`${apiUrl}/api/oportunidades/${id}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) setOpportunity(data);
      } catch (e) {
        console.error(e);
        if (!cancelled) setSnack({ open: true, message: "Erro ao carregar oportunidade" });
      }
    };
    fetchOpportunity();
    return () => {
      cancelled = true;
    };
  }, [id, apiUrl]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const fetchParticipants = async () => {
      try {
        const res = await fetch(`${apiUrl}/api/oportunidades/${id}/envolvidos`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) setParticipants(data);
      } catch (e) {
        console.error(e);
      }
    };
    fetchParticipants();
    return () => {
      cancelled = true;
    };
  }, [id, apiUrl]);

  const fetchInstallments = useCallback(async (): Promise<InstallmentRecord[]> => {
    if (!id) return [];
    const res = await fetch(`${apiUrl}/api/oportunidades/${id}/parcelas`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return mapInstallmentRecords(data).sort(
      (a, b) => a.numero_parcela - b.numero_parcela,
    );
  }, [apiUrl, id]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    fetchInstallments()
      .then((records) => {
        if (!cancelled) setInstallments(records);
      })
      .catch((error) => {
        console.error(error);
        if (!cancelled) setInstallments([]);
      });

    return () => {
      cancelled = true;
    };
  }, [id, fetchInstallments]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    const fetchBillingHistory = async () => {
      try {
        const res = await fetch(`${apiUrl}/api/oportunidades/${id}/faturamentos`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) {
          setBillingHistory(mapBillingRecords(data));
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setBillingHistory([]);
        }
      }
    };

    fetchBillingHistory();

    return () => {
      cancelled = true;
    };
  }, [apiUrl, id]);

  useEffect(() => {
    let cancelled = false;

    const fetchStatuses = async () => {
      try {
        setStatusLoading(true);
        const data = await fetchList(`${apiUrl}/api/situacao-propostas`);
        if (cancelled) return;

        let options = parseSituacaoOptions(data);

        const currentStatusId =
          opportunity?.status_id === null || opportunity?.status_id === undefined
            ? null
            : String(opportunity.status_id);

        if (
          currentStatusId &&
          !options.some((option) => option.id === currentStatusId)
        ) {
          const currentStatusLabel =
            typeof opportunity?.status === "string" &&
            opportunity.status.trim().length > 0
              ? opportunity.status.trim()
              : currentStatusId;
          options = sortStatusOptions([
            ...options,
            { id: currentStatusId, name: currentStatusLabel },
          ]);
        }

        if (!cancelled) {
          setStatusOptions(options);
        }
      } catch (e) {
        console.error("Falha ao buscar situações da proposta.", e);
        if (!cancelled) {
          setStatusOptions([]);
          setSnack({
            open: true,
            message: "Não foi possível carregar as situações da proposta.",
          });
        }
      } finally {
        if (!cancelled) {
          setStatusLoading(false);
        }
      }
    };

    void fetchStatuses();
    return () => {
      cancelled = true;
    };
  }, [apiUrl, opportunity?.status_id, opportunity?.status]);

  useEffect(() => {
    if (!documentDialogOpen || documentType !== "modelo") return;

    let cancelled = false;

    const fetchTemplates = async () => {
      try {
        setDocumentTemplatesLoading(true);
        setDocumentTemplatesError(null);
        const data = await fetchList(`${apiUrl}/api/templates`);
        if (cancelled) return;
        const options = (data as unknown[]).flatMap((item) => {
          if (!item || typeof item !== "object") return [];
          const record = item as Record<string, unknown>;
          const id = record["id"];
          if (id === undefined || id === null) return [];
          const rawLabel = record["title"] ?? record["nome"] ?? record["name"];
          const label =
            typeof rawLabel === "string" && rawLabel.trim().length > 0
              ? rawLabel.trim()
              : `Modelo ${id}`;
          return [{ value: String(id), label }];
        });
        setDocumentTemplates(options);
        setSelectedTemplate((prev) =>
          options.some((option) => option.value === prev) ? prev : "",
        );
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setDocumentTemplates([]);
          setDocumentTemplatesError("Não foi possível carregar os modelos.");
        }
      } finally {
        if (!cancelled) {
          setDocumentTemplatesLoading(false);
        }
      }
    };

    void fetchTemplates();

    return () => {
      cancelled = true;
    };
  }, [apiUrl, documentDialogOpen, documentType]);

  useEffect(() => {
    if (!opportunity || (opportunity as { _namesLoaded?: boolean })._namesLoaded)
      return;
    const loadNames = async () => {
      try {
        const updated: OpportunityData = { ...opportunity };

        if (opportunity.solicitante_id) {
          const res = await fetch(
            `${apiUrl}/api/clientes/${opportunity.solicitante_id}`
          );
          if (res.ok) {
            const c = await res.json();
            updated.solicitante_nome = c.nome;
            updated.solicitante_cpf_cnpj = c.documento;
            updated.solicitante_email = c.email;
            updated.solicitante_telefone = c.telefone;
            updated.cliente_tipo =
              c.tipo === 1 || c.tipo === "1"
                ? "Pessoa Física"
                : c.tipo === 2 || c.tipo === "2"
                ? "Pessoa Jurídica"
                : undefined;
          }
        }

        if (opportunity.responsavel_id) {
          const res = await fetch(
            `${apiUrl}/api/usuarios/${opportunity.responsavel_id}`
          );
          if (res.ok) {
            const r = await res.json();
            updated.responsible = r.nome_completo ?? r.nome;
          }
        }

        if (
          updated.criado_por_nome === undefined &&
          opportunity.criado_por !== null &&
          opportunity.criado_por !== undefined
        ) {
          if (typeof opportunity.criado_por === "string") {
            const trimmed = opportunity.criado_por.trim();
            if (trimmed.length > 0) {
              const parsed = Number.parseInt(trimmed, 10);
              if (Number.isNaN(parsed)) {
                updated.criado_por_nome = trimmed;
              } else {
                const res = await fetch(`${apiUrl}/api/usuarios/${parsed}`);
                if (res.ok) {
                  const user = await res.json();
                  updated.criado_por_nome = user.nome_completo ?? user.nome ?? String(parsed);
                }
              }
            }
          } else if (
            typeof opportunity.criado_por === "number" &&
            Number.isFinite(opportunity.criado_por)
          ) {
            const res = await fetch(
              `${apiUrl}/api/usuarios/${opportunity.criado_por}`
            );
            if (res.ok) {
              const user = await res.json();
              updated.criado_por_nome =
                user.nome_completo ?? user.nome ?? String(opportunity.criado_por);
            }
          }
        }

        if (opportunity.tipo_processo_id) {
          const tipos = (await fetchList(
            `${apiUrl}/api/tipo-processos`
          )) as Array<{ id: unknown; nome?: string }>;
          const tipo = tipos.find(
            (t) => Number(t.id) === Number(opportunity.tipo_processo_id)
          );
          if (tipo) updated.tipo_processo_nome = tipo.nome;
        }

        if (opportunity.area_atuacao_id) {
          const res = await fetch(
            `${apiUrl}/api/areas/${opportunity.area_atuacao_id}`
          );
          if (res.ok) {
            const a = await res.json();
            updated.area = a.nome;
          }
        }

        if (opportunity.fase_id) {
          const fases = (await fetchList(
            `${apiUrl}/api/fluxos-trabalho`
          )) as Array<{ id: unknown; nome?: string }>;
          const fase = fases.find(
            (f) => Number(f.id) === Number(opportunity.fase_id)
          );
          if (fase) updated.fase = fase.nome;

          if (opportunity.etapa_id) {
            try {
              const etapas = (await fetchList(
                `${apiUrl}/api/etiquetas/fluxos-trabalho/${opportunity.fase_id}`
              )) as Array<{ id: unknown; nome?: string }>;
              const etapa = etapas.find(
                (e) => Number(e.id) === Number(opportunity.etapa_id)
              );
              if (etapa) updated.etapa_nome = etapa.nome;
            } catch (e) {
              console.error(e);
            }
          }
        }


        if (opportunity.status_id) {
          const situacoes = (await fetchList(
            `${apiUrl}/api/situacao-propostas`
          )) as Array<{ id: unknown; nome?: string }>;
          const situacao = situacoes.find(
            (s) => Number(s.id) === Number(opportunity.status_id)
          );
          if (situacao) updated.status = situacao.nome;
        }

        Object.defineProperty(updated, "_namesLoaded", {
          value: true,
          enumerable: false,
        });
        setOpportunity(updated);
      } catch (e) {
        console.error(e);
      }
    };
    loadNames();
  }, [opportunity, apiUrl]);

  // mapeamento de rótulos
  const fieldLabels: Record<string, string> = {
    solicitante_nome: "Cliente",
    tipo_processo_nome: "Tipo de Processo",
    tipo_processo_id: "Tipo de Processo ID",
    area_atuacao_id: "Área de Atuação ID",
    area: "Área de Atuação",
    responsavel_id: "Responsável ID",
    responsible: "Responsável",
    numero_processo_cnj: "Número do Processo",
    numero_protocolo: "Número do Protocolo",
    vara_ou_orgao: "Vara/Órgão",
    comarca: "Comarca",
    autor: "Autor",
    reu: "Réu",
    terceiro_interessado: "Terceiro Interessado",
    fase: "Fase",
    fase_id: "Fase ID",
    etapa_nome: "Etapa",
    etapa_id: "Etapa ID",
    prazo_proximo: "Prazo Próximo",
    status: "Status",
    status_id: "Status ID",
    solicitante_id: "Solicitante ID",
    solicitante_cpf_cnpj: "CPF/CNPJ",
    solicitante_email: "Email",
    solicitante_telefone: "Telefone",
    cliente_tipo: "Tipo de Cliente",
    valor_causa: "Valor da Causa",
    valor_honorarios: "Valor dos Honorários",
    percentual_honorarios: "% Honorários",
    forma_pagamento: "Forma de Pagamento",
    qtde_parcelas: "Número de Parcelas",
    contingenciamento: "Contingenciamento",
    detalhes: "Detalhes",
    documentos_anexados: "Documentos Anexados",
    criado_por: "Criado por",
    data_criacao: "Data de Criação",
    ultima_atualizacao: "Última Atualização",
  };

  const participantLabels: Record<string, string> = {
    nome: "Nome",
    documento: "CPF/CNPJ",
    telefone: "Telefone",
    endereco: "Endereço",
    relacao: "Relação",
  };

  const formatLabel = (key: string) =>
    fieldLabels[key] ||
    key
      .replace(/_/g, " ")
      .replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1));

  const formatDate = (value: unknown) => {
    if (!value) return "—";
    try {
      const d = typeof value === "string" ? parseISO(value) : new Date(String(value));
      return dfFormat(d, "dd/MM/yyyy HH:mm");
    } catch {
      try {
        return new Date(String(value)).toLocaleString();
      } catch {
        return String(value);
      }
    }
  };

  const formatCurrency = (value: unknown) => {
    if (value === null || value === undefined || value === "") return "—";
    const number = Number(value);
    if (Number.isNaN(number)) return String(value);
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 2,
    }).format(number);
  };

  const formatPercent = (value: unknown) => {
    if (value === null || value === undefined || value === "") return "—";
    const number = Number(value);
    if (Number.isNaN(number)) return String(value);
    return `${Math.round(number)}%`;
  };

  const parseToNumber = (value: unknown): number | null => {
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : null;
    }

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length === 0) return null;

      const sanitized = trimmed.replace(/[^0-9,.-]/g, "");
      if (sanitized.length === 0) return null;

      const hasComma = sanitized.includes(",");
      const hasDot = sanitized.includes(".");
      let normalized = sanitized;

      if (hasComma && hasDot) {
        if (sanitized.lastIndexOf(",") > sanitized.lastIndexOf(".")) {
          normalized = sanitized.replace(/\./g, "").replace(/,/g, ".");
        } else {
          normalized = sanitized.replace(/,/g, "");
        }
      } else if (hasComma) {
        normalized = sanitized.replace(/\./g, "").replace(/,/g, ".");
      } else if (hasDot) {
        const parts = sanitized.split(".");
        if (parts.length > 2) {
          normalized = parts.join("");
        }
      }

      const parsed = Number(normalized);
      return Number.isNaN(parsed) ? null : parsed;
    }

    return null;
  };

  const formatNumberForInput = useCallback((value: number | null) => {
    if (value === null || !Number.isFinite(value)) return "";
    return value.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }, []);

  // lista de chaves que podem ser copiadas (removi valor_causa e valor_honorarios conforme pedido)
  const shouldShowCopy = (key: string) =>
    [
      "numero_processo_cnj",
      "numero_processo",
      "numero_processo_cn",
      "numero_protocolo",
      // outras chaves curtas que fazem sentido copiar podem ser adicionadas aqui
    ].includes(key);

  const sortedInstallments = useMemo(() => {
    if (installments.length === 0) return [] as InstallmentRecord[];
    return [...installments].sort((a, b) => a.numero_parcela - b.numero_parcela);
  }, [installments]);

  const pendingInstallments = useMemo(() => {
    if (sortedInstallments.length === 0) return [] as InstallmentRecord[];
    return sortedInstallments.filter((installment) => {
      const statusText =
        typeof installment.status === "string" ? installment.status.toLowerCase() : "";
      return statusText !== "quitado" && statusText !== "quitada";
    });
  }, [sortedInstallments]);

  const hasPendingInstallments = pendingInstallments.length > 0;

  const pendingInstallmentsById = useMemo(() => {
    const map = new Map<number, InstallmentRecord>();
    pendingInstallments.forEach((installment) => {
      map.set(installment.id, installment);
    });
    return map;
  }, [pendingInstallments]);

  const areInstallmentArraysEqual = (a: number[], b: number[]): boolean => {
    if (a === b) return true;
    if (a.length !== b.length) return false;
    for (let index = 0; index < a.length; index += 1) {
      if (a[index] !== b[index]) {
        return false;
      }
    }
    return true;
  };

  const sumInstallmentsById = (ids: number[]): number | null => {
    if (ids.length === 0) {
      return null;
    }
    let total = 0;
    for (const id of ids) {
      const installment = pendingInstallmentsById.get(id);
      if (!installment) {
        return null;
      }
      const value = parseToNumber(installment.valor);
      if (value === null) {
        return null;
      }
      total += value;
    }
    return total;
  };

  const calculateInstallmentTotal = useCallback(
    (count: number): number | null => {
      if (!Number.isFinite(count) || count <= 0) return null;
      if (pendingInstallments.length === 0 || count > pendingInstallments.length) {
        return null;
      }
      let total = 0;
      for (let index = 0; index < count; index += 1) {
        const installment = pendingInstallments[index];
        const value = installment ? parseToNumber(installment.valor) : null;
        if (value === null) {
          return null;
        }
        total += value;
      }
      return total;
    },
    [pendingInstallments],
  );

  // seções conforme print fornecido
  const sectionsDef: { key: string; label: string; fields: string[] }[] = [
    {
      key: "fluxo",
      label: "DADOS DA PROPOSTA",
      fields: ["fase", "etapa_nome", "prazo_proximo", "status"],
    },
    {
      key: "solicitante",
      label: "CLIENTE SOLICITANTE",
      fields: [
        "solicitante_nome",
        "solicitante_cpf_cnpj",
        "solicitante_email",
        "solicitante_telefone",
        "cliente_tipo",
      ],
    },
    {
      key: "honorarios",
      label: "HONORÁRIOS",
      fields: [
        "valor_causa",
        "valor_honorarios",
        "percentual_honorarios",
        "forma_pagamento",
        "qtde_parcelas",
        "contingenciamento",
      ],
    },
    {
      key: "processo",
      label: "DADOS DO PROCESSO",
      fields: [
        "numero_processo_cnj",
        "numero_protocolo",
        "tipo_processo_nome",
        "area",
        "vara_ou_orgao",
        "comarca",
      ],
    },
    {
      key: "detalhes",
      label: "DETALHES",
      fields: ["detalhes"],
    },
  ];

  const sectionContainerClass =
    "rounded-lg border border-border bg-muted/40 p-5 shadow-sm";
  const sectionTitleClass =
    "mb-4 text-lg font-semibold tracking-wide text-primary";

  // cria um mapa das entradas por chave para fácil consulta
  const entriesMap = useMemo(() => {
    if (!opportunity) return new Map<string, unknown>();
    return new Map(Object.entries(opportunity));
  }, [opportunity]);

  const copyToClipboard = async (text: string) => {
    if (!navigator.clipboard) {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        setSnack({ open: true, message: "Copiado" });
      } catch {
        setSnack({ open: true, message: "Erro ao copiar" });
      } finally {
        document.body.removeChild(ta);
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setSnack({ open: true, message: "Copiado" });
    } catch {
      setSnack({ open: true, message: "Erro ao copiar" });
    }
  };

  const handleAttachmentChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    if (files.length > 0) {
      setPendingAttachments((prev) => [...prev, ...files]);
      event.target.value = "";
    }
  };

  const removePendingAttachment = (index: number) => {
    setPendingAttachments((prev) => prev.filter((_, idx) => idx !== index));
  };

  const formatFileSize = (size: number) => {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result === "string" && result.trim().length > 0) {
          resolve(result);
        } else {
          reject(new Error("FileReader returned an empty result"));
        }
      };
      reader.onerror = () => {
        reject(reader.error ?? new Error("Erro ao ler arquivo"));
      };
      reader.readAsDataURL(file);
    });

  const handleInteractionSubmit = async () => {
    const trimmedComment = commentText.trim();
    if (!trimmedComment && pendingAttachments.length === 0) {
      setSnack({ open: true, message: "Adicione um comentário ou anexo" });
      return;
    }

    let hadAttachmentErrors = false;
    let attachments: InteractionEntry["attachments"] = [];

    if (pendingAttachments.length > 0) {
      attachments = await Promise.all(
        pendingAttachments.map(async (file) => {
          const mimeType = file.type && file.type.trim().length > 0 ? file.type : undefined;
          try {
            const dataUrl = await readFileAsDataUrl(file);
            const attachment: InteractionAttachment = {
              name: file.name,
              size: file.size,
              ...(mimeType ? { mimeType } : {}),
              dataUrl,
            };
            return attachment;
          } catch (error) {
            console.error(error);
            hadAttachmentErrors = true;
            const attachment: InteractionAttachment = {
              name: file.name,
              size: file.size,
              ...(mimeType ? { mimeType } : {}),
            };
            return attachment;
          }
        }),
      );
    }

    const entry: InteractionEntry = {
      id: Date.now(),
      comment: trimmedComment,
      attachments,
      createdAt: new Date().toISOString(),
    };

    setInteractionHistory((prev) => [entry, ...prev]);
    setPendingAttachments([]);
    setCommentText("");
    setSnack({
      open: true,
      message: hadAttachmentErrors
        ? "Comentário registrado, mas alguns anexos não puderam ser processados"
        : "Comentário registrado",
    });
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    skipInteractionPersistenceRef.current = interactionStorageKey ?? null;

    if (!interactionStorageKey) {
      setInteractionHistory([]);
      return;
    }

    try {
      const stored = window.localStorage.getItem(interactionStorageKey);
      if (!stored) {
        setInteractionHistory([]);
        return;
      }

      const parsed = JSON.parse(stored) as unknown;
      setInteractionHistory(sanitizeInteractionEntries(parsed));
    } catch (error) {
      console.error("Falha ao carregar interações locais", error);
      setInteractionHistory([]);
    }
  }, [interactionStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!interactionStorageKey) return;

    if (skipInteractionPersistenceRef.current === interactionStorageKey) {
      skipInteractionPersistenceRef.current = null;
      return;
    }

    try {
      if (interactionHistory.length === 0) {
        window.localStorage.removeItem(interactionStorageKey);
      } else {
        window.localStorage.setItem(
          interactionStorageKey,
          JSON.stringify(interactionHistory),
        );
      }
    } catch (error) {
      console.error("Falha ao persistir interações locais", error);
    }
  }, [interactionHistory, interactionStorageKey]);

  // auto-close do snackbar para não ficar cortando o rodapé
  useEffect(() => {
    if (!snack.open) return;
    const t = setTimeout(() => setSnack({ open: false }), 1800); // fecha automaticamente após 1.8s
    return () => clearTimeout(t);
  }, [snack.open]);

  const onEdit = () => {
    navigate(`/pipeline/editar-oportunidade/${id}`);
  };
  // REMOVIDO onDuplicate conforme solicitado
  const onDelete = () => {
    if (!window.confirm("Confirma exclusão desta oportunidade?")) return;
    setSnack({ open: true, message: "Excluído (stub)" });
    console.log("Excluir", opportunity?.id);
  };
  const onPrint = () => window.print();

  const onCreateTask = () => {
    navigate(`/tarefas?oportunidade=${id}`);
  };

  const onCreateDocument = () => {
    resetDocumentDialog();
    setDocumentDialogOpen(true);
  };

  useEffect(() => {
    if (!billingDialogOpen) return;

    setBillingForm((prev) => {
      if (!hasPendingInstallments) {
        if (prev.selectedInstallmentIds.length === 0) {
          return prev;
        }
        return { ...prev, selectedInstallmentIds: [] };
      }

      const pendingIds = pendingInstallments.map((installment) => installment.id);
      const filteredIds = prev.selectedInstallmentIds.filter((id) =>
        pendingIds.includes(id),
      );

      if (filteredIds.length === 0) {
        const firstId = pendingIds[0];
        if (firstId === undefined) {
          return { ...prev, selectedInstallmentIds: [] };
        }
        if (
          prev.selectedInstallmentIds.length === 1 &&
          prev.selectedInstallmentIds[0] === firstId
        ) {
          return prev;
        }
        return { ...prev, selectedInstallmentIds: [firstId] };
      }

      if (filteredIds.length !== prev.selectedInstallmentIds.length) {
        return { ...prev, selectedInstallmentIds: filteredIds };
      }

      const sameOrder = filteredIds.every(
        (id, index) => id === prev.selectedInstallmentIds[index],
      );
      if (!sameOrder) {
        return { ...prev, selectedInstallmentIds: filteredIds };
      }

      return prev;
    });
  }, [billingDialogOpen, hasPendingInstallments, pendingInstallments]);

  const openBillingDialog = () => {
    const registeredForma =
      typeof opportunity?.forma_pagamento === "string"
        ? opportunity.forma_pagamento.trim()
        : "";
    const matchedOption =
      registeredForma.length > 0
        ? BILLING_PAYMENT_OPTIONS.find(
            (option) => option.toLowerCase() === registeredForma.toLowerCase(),
          )
        : undefined;
    const honorarios = parseToNumber(opportunity?.valor_honorarios);
    const parcelasRegistradas = parseToNumber(opportunity?.qtde_parcelas);
    const pendingCount = pendingInstallments.length;
    const defaultCondition: BillingCondition = hasPendingInstallments
      ? "Parcelado"
      : pendingCount > 1 || (parcelasRegistradas && parcelasRegistradas > 1)
        ? "Parcelado"
        : "À vista";

    const defaultSelectedIds = hasPendingInstallments
      ? pendingInstallments.slice(0, 1).map((installment) => installment.id)
      : [];

    const parcelasBase =
      defaultCondition === "Parcelado"
        ? hasPendingInstallments
          ? Math.max(defaultSelectedIds.length, 1)
          : pendingCount > 0
            ? pendingCount
            : parcelasRegistradas && parcelasRegistradas > 0
              ? Math.trunc(parcelasRegistradas)
              : 1
        : pendingCount > 0
          ? pendingCount
          : parcelasRegistradas && parcelasRegistradas > 0
            ? Math.trunc(parcelasRegistradas)
            : 1;

    const parcelasParaValor = Math.max(parcelasBase, 1);

    const computedTotal = hasPendingInstallments
      ? sumInstallmentsById(defaultSelectedIds) ??
        calculateInstallmentTotal(defaultSelectedIds.length || 1)
      : defaultCondition === "Parcelado"
        ? calculateInstallmentTotal(parcelasParaValor) ??
          (honorarios !== null && parcelasRegistradas && parcelasRegistradas > 0
            ? (honorarios / Math.max(Math.trunc(parcelasRegistradas), 1)) * parcelasParaValor
            : null)
        : pendingCount > 0
          ? calculateInstallmentTotal(parcelasParaValor)
          : honorarios;

    setBillingForm({
      formaPagamento: matchedOption ?? (registeredForma ? "Outro" : ""),
      formaPagamentoDescricao:
        matchedOption || registeredForma.length === 0 ? "" : registeredForma,
      condicaoPagamento: defaultCondition,
      parcelas:
        hasPendingInstallments
          ? defaultSelectedIds.length > 0
            ? String(defaultSelectedIds.length)
            : ""
          : defaultCondition === "Parcelado"
            ? String(Math.max(parcelasParaValor, 1))
            : "1",
      valor: formatNumberForInput(computedTotal ?? null),
      juros: "",
      multa: "",
      dataFaturamento: new Date().toISOString().slice(0, 10),
      observacoes: "",
      selectedInstallmentIds: defaultSelectedIds,
    });
    setBillingError(null);
    setBillingDialogOpen(true);
  };

  const handleBillingConfirm = async () => {
    if (!id) return;

    const honorariosRegistrados = parseToNumber(opportunity?.valor_honorarios);
    const totalParcelasRegistradas = parseToNumber(opportunity?.qtde_parcelas);
    const selectedInstallmentIds = hasPendingInstallments
      ? billingForm.selectedInstallmentIds.filter((installmentId) =>
          pendingInstallmentsById.has(installmentId),
        )
      : [];

    if (hasPendingInstallments && selectedInstallmentIds.length === 0) {
      setBillingError("Selecione ao menos uma parcela que deseja faturar.");
      return;
    }

    const formaSelecionada =
      billingForm.formaPagamento === "Outro"
        ? billingForm.formaPagamentoDescricao.trim()
        : billingForm.formaPagamento;

    if (!formaSelecionada) {
      setBillingError("Informe a forma de pagamento.");
      return;
    }

    if (
      billingForm.formaPagamento === "Outro" &&
      billingForm.formaPagamentoDescricao.trim().length === 0
    ) {
      setBillingError("Descreva a forma de pagamento personalizada.");
      return;
    }

    const valorNormalizado = billingForm.valor.trim();
    let valorNumero =
      valorNormalizado.length > 0
        ? Number(valorNormalizado.replace(/\./g, "").replace(",", "."))
        : null;
    if (valorNormalizado.length > 0 && (valorNumero === null || Number.isNaN(valorNumero))) {
      setBillingError("Informe um valor válido para faturamento.");
      return;
    }

    const jurosTexto = billingForm.juros.trim();
    let jurosValor = 0;
    if (jurosTexto.length > 0) {
      const parsedJuros = parseToNumber(jurosTexto);
      if (parsedJuros === null || Number.isNaN(parsedJuros)) {
        setBillingError("Informe um valor válido para os juros.");
        return;
      }
      if (parsedJuros < 0) {
        setBillingError("Os juros não podem ser negativos.");
        return;
      }
      jurosValor = parsedJuros;
    }

    const multaTexto = billingForm.multa.trim();
    let multaValor = 0;
    if (multaTexto.length > 0) {
      const parsedMulta = parseToNumber(multaTexto);
      if (parsedMulta === null || Number.isNaN(parsedMulta)) {
        setBillingError("Informe um valor válido para a multa.");
        return;
      }
      if (parsedMulta < 0) {
        setBillingError("A multa não pode ser negativa.");
        return;
      }
      multaValor = parsedMulta;
    }

    const encargosValor = jurosValor + multaValor;

    let parcelasValor: number | null = null;
    let baseValor: number | null = null;

    if (selectedInstallmentIds.length > 0) {
      const selectedSum = sumInstallmentsById(selectedInstallmentIds);
      if (selectedSum === null) {
        setBillingError("Não foi possível identificar o valor das parcelas selecionadas.");
        return;
      }
      parcelasValor = selectedInstallmentIds.length;
      baseValor = selectedSum;
    } else if (billingForm.condicaoPagamento === "Parcelado") {
      const parsedParcelas = Number.parseInt(billingForm.parcelas, 10);
      if (!parsedParcelas || Number.isNaN(parsedParcelas) || parsedParcelas < 1) {
        setBillingError("Informe a quantidade de parcelas.");
        return;
      }
      if (pendingInstallments.length > 0 && parsedParcelas > pendingInstallments.length) {
        setBillingError("Quantidade de parcelas excede as parcelas pendentes disponíveis.");
        return;
      }
      parcelasValor = parsedParcelas;
      if (parcelasValor) {
        const calculated = calculateInstallmentTotal(parcelasValor);
        if (calculated !== null) {
          baseValor = calculated;
        } else if (
          honorariosRegistrados !== null &&
          totalParcelasRegistradas &&
          totalParcelasRegistradas > 0
        ) {
          baseValor =
            (honorariosRegistrados /
              Math.max(Math.trunc(totalParcelasRegistradas), 1)) * parcelasValor;
        }
      }
    } else {
      const pendingCount = pendingInstallments.length;
      if (pendingCount > 0) {
        const calculated = calculateInstallmentTotal(pendingCount);
        if (calculated !== null) {
          baseValor = calculated;
          parcelasValor = pendingCount;
        }
      }
      if (baseValor === null) {
        baseValor = honorariosRegistrados;
      }
    }

    if (baseValor !== null) {
      valorNumero = baseValor + encargosValor;
    } else if (valorNumero === null && encargosValor > 0) {
      valorNumero = encargosValor;
    }

    if (valorNumero === null) {
      setBillingError("Não foi possível determinar o valor para faturamento.");
      return;
    }

    const payload = {
      forma_pagamento: formaSelecionada,
      condicao_pagamento: billingForm.condicaoPagamento,
      valor: valorNumero ?? undefined,
      parcelas:
        billingForm.condicaoPagamento === "Parcelado"
          ? parcelasValor ?? undefined
          : hasPendingInstallments
            ? pendingInstallments.length
            : undefined,
      parcelas_ids: selectedInstallmentIds.length > 0 ? selectedInstallmentIds : undefined,
      juros: jurosValor > 0 ? jurosValor : undefined,
      multa: multaValor > 0 ? multaValor : undefined,
      observacoes:
        billingForm.observacoes.trim().length > 0
          ? billingForm.observacoes.trim()
          : undefined,
      data_faturamento: billingForm.dataFaturamento
        ? `${billingForm.dataFaturamento}T00:00:00`
        : undefined,
    };

    setBillingSubmitting(true);
    setBillingError(null);
    try {
      const res = await fetch(`${apiUrl}/api/oportunidades/${id}/faturamentos`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const created = await res.json();
      const normalized = mapBillingRecords(
        Array.isArray(created) ? created : [created],
      );
      if (normalized.length > 0) {
        setBillingHistory((prev) => [normalized[0], ...prev]);
      }
      try {
        const updatedInstallments = await fetchInstallments();
        setInstallments(updatedInstallments);
      } catch (installmentError) {
        console.error(installmentError);
      }
      setSnack({ open: true, message: "Faturamento registrado com sucesso" });
      setBillingDialogOpen(false);
    } catch (error) {
      console.error(error);
      setBillingError("Não foi possível registrar o faturamento.");
    } finally {
      setBillingSubmitting(false);
    }
  };

  useEffect(() => {
    if (!billingDialogOpen) return;

    const jurosValor = (() => {
      const trimmed = billingForm.juros.trim();
      if (trimmed.length === 0) return 0;
      const parsed = parseToNumber(trimmed);
      return parsed !== null && Number.isFinite(parsed) ? parsed : 0;
    })();

    const multaValor = (() => {
      const trimmed = billingForm.multa.trim();
      if (trimmed.length === 0) return 0;
      const parsed = parseToNumber(trimmed);
      return parsed !== null && Number.isFinite(parsed) ? parsed : 0;
    })();

    const extrasTotal = jurosValor + multaValor;

    if (hasPendingInstallments) {
      const sanitizedIds = billingForm.selectedInstallmentIds.filter((id) =>
        pendingInstallmentsById.has(id),
      );
      const idsToUse =
        sanitizedIds.length > 0
          ? sanitizedIds
          : pendingInstallments.slice(0, 1).map((installment) => installment.id);
      const selectedTotal = idsToUse.length > 0 ? sumInstallmentsById(idsToUse) : null;
      const formattedTotal =
        selectedTotal !== null
          ? formatNumberForInput(selectedTotal + extrasTotal)
          : null;
      const parcelasValue = idsToUse.length > 0 ? String(idsToUse.length) : "";

      setBillingForm((prev) => {
        let changed = false;

        if (!areInstallmentArraysEqual(prev.selectedInstallmentIds, idsToUse)) {
          changed = true;
        }

        if (prev.parcelas !== parcelasValue) {
          changed = true;
        }

        if (formattedTotal !== null && prev.valor !== formattedTotal) {
          changed = true;
        }

        if (!changed) {
          return prev;
        }

        const updated: BillingFormState = {
          ...prev,
          selectedInstallmentIds: idsToUse,
          parcelas: parcelasValue,
        };

        if (formattedTotal !== null) {
          updated.valor = formattedTotal;
        }

        return updated;
      });
      return;
    }

    if (billingForm.condicaoPagamento === "Parcelado") {
      const parcelasCount = Number.parseInt(billingForm.parcelas, 10);
      if (!Number.isFinite(parcelasCount) || parcelasCount <= 0) {
        return;
      }
      const computed =
        calculateInstallmentTotal(parcelasCount) ??
        (() => {
          const honorariosValue = parseToNumber(opportunity?.valor_honorarios);
          const totalParcelas = parseToNumber(opportunity?.qtde_parcelas);
          if (
            honorariosValue !== null &&
            totalParcelas !== null &&
            totalParcelas > 0
          ) {
            return (
              (honorariosValue / Math.max(Math.trunc(totalParcelas), 1)) * parcelasCount
            );
          }
          return null;
        })();

      if (computed !== null) {
        const formatted = formatNumberForInput(computed + extrasTotal);
        setBillingForm((prev) => (prev.valor === formatted ? prev : { ...prev, valor: formatted }));
      }
    } else if (billingForm.condicaoPagamento === "À vista") {
      const pendingCount = pendingInstallments.length;
      const computed =
        pendingCount > 0
          ? calculateInstallmentTotal(pendingCount)
          : parseToNumber(opportunity?.valor_honorarios);
      if (computed !== null) {
        const formatted = formatNumberForInput(computed + extrasTotal);
        setBillingForm((prev) => (prev.valor === formatted ? prev : { ...prev, valor: formatted }));
      } else if (extrasTotal > 0) {
        const formatted = formatNumberForInput(extrasTotal);
        setBillingForm((prev) => (prev.valor === formatted ? prev : { ...prev, valor: formatted }));
      }
    }
  }, [
    billingDialogOpen,
    billingForm.condicaoPagamento,
    billingForm.parcelas,
    billingForm.selectedInstallmentIds,
    billingForm.juros,
    billingForm.multa,
    calculateInstallmentTotal,
    formatNumberForInput,
    hasPendingInstallments,
    pendingInstallmentsById,
    pendingInstallments,
    opportunity?.valor_honorarios,
    opportunity?.qtde_parcelas,
  ]);

  const handleStatusChange = async (value: string) => {
    if (!id || !opportunity) return;
    const parsedValue = value === STATUS_EMPTY_VALUE ? null : Number(value);
    if (parsedValue !== null && Number.isNaN(parsedValue)) return;

    const currentStatus =
      opportunity.status_id === null || opportunity.status_id === undefined
        ? null
        : Number(opportunity.status_id);

    if (currentStatus === parsedValue) return;

    const previousStatusId = currentStatus;
    setStatusSaving(true);
    try {
      const res = await fetch(`${apiUrl}/api/oportunidades/${id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status_id: parsedValue }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const rawText = await res.text();
      let responseData:
        | { status_id?: unknown; ultima_atualizacao?: unknown }
        | null = null;
      const trimmedText = rawText.trim();
      if (trimmedText.length > 0) {
        try {
          responseData = JSON.parse(trimmedText) as {
            status_id?: unknown;
            ultima_atualizacao?: unknown;
          } | null;
        } catch (parseError) {
          console.warn(
            "Não foi possível interpretar a resposta ao atualizar o status da proposta.",
            parseError,
          );
        }
      }

      const normalizeStatusId = (input: unknown): number | null | undefined => {
        if (input === null || input === undefined) return null;
        const numeric = Number(input);
        return Number.isNaN(numeric) ? undefined : numeric;
      };

      const normalizedStatusId =
        responseData &&
        Object.prototype.hasOwnProperty.call(responseData, "status_id")
          ? normalizeStatusId(responseData?.status_id)
          : undefined;

      const nextStatusId =
        normalizedStatusId === undefined ? parsedValue : normalizedStatusId;
      const statusLabel = getStatusLabel(nextStatusId);

      const nextLastUpdate =
        responseData && typeof responseData?.ultima_atualizacao === "string"
          ? responseData.ultima_atualizacao
          : undefined;

      patchOpportunity((prev) => ({
        ...prev,
        status_id: nextStatusId ?? null,
        status: statusLabel,
        ultima_atualizacao:
          nextLastUpdate ?? prev.ultima_atualizacao,
      }));
      setSnack({ open: true, message: "Status atualizado" });
    } catch (error) {
      console.error(error);
      setSnack({ open: true, message: "Erro ao atualizar status" });
      patchOpportunity((prev) => ({
        ...prev,
        status_id: previousStatusId,
        status:
          previousStatusId === null
            ? undefined
            : getStatusLabel(previousStatusId) ?? prev.status,
      }));
    } finally {
      setStatusSaving(false);
    }
  };

  useEffect(() => {
    if (!opportunity || !statusOptions.length) return;

    const statusId =
      opportunity.status_id === null || opportunity.status_id === undefined
        ? null
        : Number(opportunity.status_id);

    if (statusId === null) return;

    const hasMatchingOption = statusOptions.some(
      (option) => Number(option.id) === statusId
    );

    if (!hasMatchingOption) return;

    const desiredLabel = getStatusLabel(statusId);
    if (!desiredLabel) return;

    const currentLabel =
      typeof opportunity.status === "string"
        ? opportunity.status.trim()
        : "";

    if (currentLabel === desiredLabel) return;

    patchOpportunity((prev) => ({
      ...prev,
      status: desiredLabel,
    }));
  }, [
    opportunity?.status_id,
    opportunity?.status,
    statusOptions,
    patchOpportunity,
  ]);

  const handleDocumentConfirm = async () => {
    if (!documentType) return;

    if (documentType === "modelo") {
      if (!selectedTemplate) return;
      const templateId = Number.parseInt(selectedTemplate, 10);
      if (Number.isNaN(templateId)) return;
      setDocumentSubmitting(true);
      try {
        const response = await fetch(
          `${apiUrl}/api/oportunidades/${id}/documentos`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ templateId }),
          },
        );
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const created = (await response.json()) as { title?: string } | undefined;
        const createdTitle =
          created && typeof created.title === "string" && created.title.trim().length > 0
            ? created.title.trim()
            : "Documento";
        setSnack({
          open: true,
          message: `${createdTitle} criado com sucesso`,
        });
        setDocumentDialogOpen(false);
        await refreshDocuments();
      } catch (error) {
        console.error(error);
        setSnack({ open: true, message: "Erro ao criar documento" });
      } finally {
        setDocumentSubmitting(false);
      }
      return;
    }

    if (
      !processForm.numero ||
      !processForm.uf ||
      !processForm.municipio ||
      !processForm.orgaoJulgador
    )
      return;

    const params = new URLSearchParams();
    if (id) params.set("oportunidade", id);
    params.set("tipo", documentType);
    params.set("numero_processo", processForm.numero);
    params.set("uf", processForm.uf);
    params.set("comarca", processForm.municipio);
    params.set("vara_orgao", processForm.orgaoJulgador);

    setDocumentDialogOpen(false);
    navigate(`/documentos?${params.toString()}`);
  };

  const ensurePdfUrl = useCallback(
    async (doc: OpportunityDocument): Promise<string> => {
      const cached = documentPdfUrlsRef.current.get(doc.id);
      if (cached) return cached;

      if (typeof window === "undefined") {
        throw new Error("Visualização de PDF indisponível neste ambiente");
      }

      const blob = createSimplePdfFromHtml(doc.title ?? `Documento ${doc.id}`, doc.content_html ?? "<p></p>");
      const url = URL.createObjectURL(blob);
      documentPdfUrlsRef.current.set(doc.id, url);
      return url;
    },
    [],
  );

  const closeDocumentPreview = () => {
    setDocumentPreview(null);
    setDocumentPreviewUrl(null);
    setDocumentPreviewError(null);
    setDocumentPreviewLoading(false);
  };

  const handleViewDocument = async (doc: OpportunityDocument) => {
    setDocumentPreview(doc);
    setDocumentPreviewUrl(null);
    setDocumentPreviewError(null);
    setDocumentPreviewLoading(true);

    try {
      const cached = documentPdfUrlsRef.current.get(doc.id);
      if (cached) {
        setDocumentPreviewUrl(cached);
        setDocumentPreviewLoading(false);
        return;
      }

      const url = await ensurePdfUrl(doc);
      setDocumentPreviewUrl(url);
    } catch (error) {
      console.error(error);
      setDocumentPreviewError("Erro ao gerar PDF do documento");
      setSnack({ open: true, message: "Erro ao gerar PDF do documento" });
    } finally {
      setDocumentPreviewLoading(false);
    }
  };

  const handleDownloadDocument = async (doc: OpportunityDocument) => {
    if (typeof document === "undefined") {
      setSnack({ open: true, message: "Função indisponível neste ambiente" });
      return;
    }

    setDocumentActionState({ id: doc.id, type: "download" });
    try {
      const url = await ensurePdfUrl(doc);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${slugifyFilename(doc.title)}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    } catch (error) {
      console.error(error);
      setSnack({ open: true, message: "Erro ao baixar documento" });
    } finally {
      setDocumentActionState(null);
    }
  };

  const handleOpenDocumentInNewTab = async (doc: OpportunityDocument) => {
    if (typeof window === "undefined") {
      setSnack({ open: true, message: "Função indisponível neste ambiente" });
      return;
    }

    setDocumentActionState({ id: doc.id, type: "open" });
    try {
      const url = await ensurePdfUrl(doc);
      window.open(url, "_blank", "noopener");
    } catch (error) {
      console.error(error);
      setSnack({ open: true, message: "Erro ao abrir documento" });
    } finally {
      setDocumentActionState(null);
    }
  };

  const handleDeleteDocument = (doc: OpportunityDocument) => {
    setDocumentToDelete(doc);
  };

  const handleConfirmDeleteDocument = async () => {
    if (!documentToDelete || !id) return;

    setDocumentDeleting(true);
    try {
      const response = await fetch(
        `${apiUrl}/api/oportunidades/${id}/documentos/${documentToDelete.id}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const cachedUrl = documentPdfUrlsRef.current.get(documentToDelete.id);
      if (cachedUrl) {
        try {
          URL.revokeObjectURL(cachedUrl);
        } catch (error) {
          console.warn("Falha ao revogar URL do PDF", error);
        }
        documentPdfUrlsRef.current.delete(documentToDelete.id);
      }

      await refreshDocuments();
      setSnack({ open: true, message: "Documento excluído" });
    } catch (error) {
      console.error(error);
      setSnack({ open: true, message: "Erro ao excluir documento" });
    } finally {
      setDocumentDeleting(false);
      setDocumentToDelete(null);
    }
  };


  const renderFormatted = (key: string, value: unknown) => {
    if (value === null || value === undefined || value === "") {
      return <span className="text-muted-foreground">—</span>;
    }

    if (/data|prazo|data_criacao|ultima_atualizacao|prazo_proximo/i.test(key)) {
      return <span>{formatDate(value)}</span>;
    }

    if (/valor|honorarios|valor_causa|valor_honorarios|valor_total/i.test(key)) {
      return <span>{formatCurrency(value)}</span>;
    }

    if (key === "percentual_honorarios") {
      let percent = value;
      if (
        (percent === null || percent === undefined || percent === "") &&
        entriesMap.get("valor_causa") &&
        entriesMap.get("valor_honorarios")
      ) {
        const vc = Number(entriesMap.get("valor_causa"));
        const vh = Number(entriesMap.get("valor_honorarios"));
        if (vc) percent = (vh / vc) * 100;
      }
      return <span>{formatPercent(percent)}</span>;
    }

    if (/percentual|%|percent/i.test(key)) {
      return <span>{formatPercent(value)}</span>;
    }

    if (key === "detalhes" && typeof value === "string") {
      const text = value;
      const preview = text.length > 240 ? text.slice(0, 240) + "…" : text;
      return (
        <div>
          <div className="text-sm" style={{ whiteSpace: "pre-wrap" }}>
            {expandedDetails ? text : preview}
          </div>
          {text.length > 240 && (
            <button
              className="mt-2 text-sm underline underline-offset-2"
              onClick={() => setExpandedDetails((s) => !s)}
              aria-expanded={expandedDetails}
            >
              {expandedDetails ? "Ver menos" : "Ver mais"}
            </button>
          )}
        </div>
      );
    }

    if (Array.isArray(value) || typeof value === "object") {
      return (
        <pre className="whitespace-pre-wrap text-sm bg-muted px-2 py-1 rounded">
          {JSON.stringify(value, null, 2)}
        </pre>
      );
    }

    if (typeof value === "boolean") {
      return <span>{value ? "Sim" : "Não"}</span>;
    }

    return <span>{String(value)}</span>;
  };

  const hasProcessFieldValue = (value: unknown) => {
    if (value === null || value === undefined) return false;
    if (typeof value === "string") return value.trim().length > 0;
    return true;
  };

  const hasAttachmentValue = (value: unknown) => {
    if (value === null || value === undefined) return false;
    if (typeof value === "number") {
      return !Number.isNaN(value) && value !== 0;
    }
    if (typeof value === "string") {
      return value.trim().length > 0;
    }
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    if (typeof value === "object") {
      return Object.keys(value as Record<string, unknown>).length > 0;
    }
    return true;
  };

  const renderDataSection = (sectionKey: string) => {
    const section = sectionsDef.find((item) => item.key === sectionKey);
    if (!section) return null;

    const fields = section.fields.filter((field) => {
      if (!entriesMap.has(field)) return false;
      if (section.key === "processo") {
        return hasProcessFieldValue(entriesMap.get(field));
      }
      return true;
    });
    if (fields.length === 0) return null;

    return (
      <section
        aria-labelledby={`heading-${section.key}`}
        className={sectionContainerClass}
      >
        <h2 id={`heading-${section.key}`} className={sectionTitleClass}>
          {section.label}
        </h2>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {fields.map((key) => {
            const value = entriesMap.get(key);
            const label = formatLabel(key);
            const formatted = renderFormatted(key, value);

            const copyText =
              shouldShowCopy(key) && value !== undefined && value !== null
                ? String(value)
                : "";

            return (
              <div
                key={key}
                className="rounded-lg border border-border/60 bg-background/60 p-3"
              >
                <dl>
                  <dt className="text-sm font-medium text-muted-foreground">
                    {label}
                  </dt>
                  <dd className="mt-1 flex items-start gap-2">
                    <div className="flex-1 min-w-0">{formatted}</div>

                    {shouldShowCopy(key) && copyText && (
                      <button
                        onClick={() => copyToClipboard(copyText)}
                        title={`Copiar ${label}`}
                        aria-label={`Copiar ${label}`}
                        className="ml-2 inline-flex items-center justify-center rounded px-2 py-1 border text-sm hover:bg-surface"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                        >
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                      </button>
                    )}
                  </dd>
                </dl>
              </div>
            );
          })}
        </div>
      </section>
    );
  };

  if (!opportunity) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Oportunidade</h1>
          <Button variant="outline" onClick={() => navigate(-1)}>
            Voltar
          </Button>
        </div>
        <p className="text-muted-foreground">Carregando ou oportunidade não encontrada.</p>
      </div>
    );
  }

  const isDocumentContinueDisabled =
    documentSubmitting ||
    (documentType === "modelo"
      ? !selectedTemplate
      : documentType === "processo"
      ?
          !processForm.numero ||
          !processForm.uf ||
          !processForm.municipio ||
          !processForm.orgaoJulgador
      : true);

  const statusSelectValue =
    opportunity.status_id === null || opportunity.status_id === undefined
      ? STATUS_EMPTY_VALUE
      : String(opportunity.status_id);
  const statusBadgeText =
    typeof opportunity.status === "string" && opportunity.status.trim().length > 0
      ? opportunity.status
      : getStatusLabel(opportunity.status_id);

  const lastUpdateText = formatDate(opportunity.ultima_atualizacao);
  const createdAtText = formatDate(opportunity.data_criacao);
  const createdByRaw =
    typeof opportunity.criado_por_nome === "string" && opportunity.criado_por_nome.trim().length > 0
      ? opportunity.criado_por_nome
      : opportunity.criado_por;
  const createdByName = (() => {
    if (typeof createdByRaw === "string") {
      const trimmed = createdByRaw.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
    if (typeof createdByRaw === "number") {
      return Number.isFinite(createdByRaw) ? String(createdByRaw) : null;
    }
    return null;
  })();
  const responsibleName = (() => {
    if (typeof opportunity.responsible === "string") {
      const trimmed = opportunity.responsible.trim();
      if (trimmed.length > 0) return trimmed;
    }
    return null;
  })();
  const attachedDocumentsValue = opportunity.documentos_anexados;
  const hasAttachedDocuments = hasAttachmentValue(attachedDocumentsValue);
  const createdInfo = (() => {
    const hasCreatedAt = createdAtText && createdAtText !== "—";
    if (!hasCreatedAt && !createdByName) return null;
    let text = "Cadastrada";
    if (hasCreatedAt) {
      text += ` em ${createdAtText}`;
    }
    if (createdByName) {
      text += ` por ${createdByName}`;
    }
    return text;
  })();
  const lastUpdateInfo =
    lastUpdateText && lastUpdateText !== "—"
      ? `Última atualização em ${lastUpdateText}`
      : null;
  const footerInfoLines = [createdInfo, lastUpdateInfo].filter(
    (line): line is string => Boolean(line),
  );
  const hasFooterMetadata = footerInfoLines.length > 0 || Boolean(responsibleName);
  const proposalNumber = opportunity.sequencial_empresa ?? opportunity.id;
  const headerYearSource = opportunity.data_criacao ?? opportunity.ultima_atualizacao ?? null;
  const headerYear = headerYearSource
    ? new Date(headerYearSource).getFullYear()
    : new Date().getFullYear();
  const headerTitle = opportunity.title ?? `Proposta #${proposalNumber}`;

  return (
    <div className="p-6 space-y-6">
      {/* Header / ações (REMOVIDO Duplicar) */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Visualizar Proposta</h1>
          <p className="text-muted-foreground">Detalhes completos da proposta</p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                aria-label="Ações rápidas da oportunidade"
              >
                Ações
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onSelect={() => onCreateTask()}>
                Criar tarefa
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onCreateDocument()}>
                Criar documento
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="secondary"
            className="w-full sm:w-auto"
            onClick={openBillingDialog}
            disabled={!opportunity}
            aria-label="Registrar faturamento da oportunidade"
          >
            Faturar
          </Button>

          <Button
            className="w-full sm:w-auto"
            onClick={onEdit}
            aria-label="Editar oportunidade"
          >
            Editar
          </Button>

          <Button
            className="w-full sm:w-auto"
            variant="destructive"
            onClick={onDelete}
            aria-label="Excluir oportunidade"
          >
            Excluir
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between md:gap-6">
            <div className="flex flex-col gap-2">
              <CardTitle>
                {headerTitle}/{headerYear}
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                {typeof opportunity.fase === "string" && (
                  <Badge variant="outline">{opportunity.fase}</Badge>
                )}
                {typeof opportunity.etapa_nome === "string" && (
                  <Badge>{opportunity.etapa_nome}</Badge>
                )}
                {statusBadgeText && <Badge variant="secondary">{statusBadgeText}</Badge>}
              </div>
            </div>
            <div className="flex w-full flex-col gap-1 md:w-auto md:items-end">
              <Label
                htmlFor="status-select"
                className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                Status da proposta
              </Label>
              <Select
                value={statusSelectValue}
                onValueChange={handleStatusChange}
                disabled={statusLoading || statusSaving}
              >
                <SelectTrigger
                  id="status-select"
                  className="w-full md:w-56"
                  disabled={statusLoading || statusSaving}
                >
                  <SelectValue
                    placeholder={
                      statusLoading ? "Carregando status..." : "Selecione um status"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={STATUS_EMPTY_VALUE}>Sem status</SelectItem>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {statusSaving ? (
                <span className="text-xs text-muted-foreground">Atualizando status...</span>
              ) : statusLoading ? (
                <span className="text-xs text-muted-foreground">Carregando status...</span>
              ) : null}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <ScrollArea className="max-h-[1300vh]">
            <div className="space-y-6">
              {/* percorre as seções definidas e exibe apenas campos que existam */}
              {renderDataSection("fluxo")}
              {renderDataSection("solicitante")}
              {renderDataSection("honorarios")}
              {renderDataSection("processo")}

              {participants.length > 0 && (
                <section
                  aria-labelledby="heading-envolvidos"
                  className={sectionContainerClass}
                >
                  <h2
                    id="heading-envolvidos"
                    className={sectionTitleClass}
                  >
                    ENVOLVIDOS COM O PROCESSO
                  </h2>
                  <div className="space-y-4">
                    {participants.map((p, idx) => {
                      const participantTitleId = `participant-${idx + 1}`;
                      return (
                        <div
                          key={p.id ?? idx}
                          className="rounded-lg border border-border/60 bg-background p-4 shadow-sm"
                          aria-labelledby={participantTitleId}
                        >
                          <div className="mb-3 flex items-center justify-between">
                            <h3
                              id={participantTitleId}
                              className="text-sm font-semibold uppercase tracking-wide text-muted-foreground"
                            >
                              {`Envolvido ${idx + 1}`}
                            </h3>
                          </div>
                          <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
                            {Object.entries(p).map(([k, v]) => {
                              if (!participantLabels[k]) return null;
                              return (
                                <div
                                  key={k}
                                  className="rounded-lg border border-border/60 bg-background/60 p-3"
                                >
                                  <dl>
                                    <dt className="text-sm font-medium text-muted-foreground">
                                      {participantLabels[k]}
                                    </dt>
                                    <dd className="mt-1">
                                      {v ?? (
                                        <span className="text-muted-foreground">—</span>
                                      )}
                                    </dd>
                                  </dl>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              <section
                aria-labelledby="heading-documents"
                className={sectionContainerClass}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h2 id="heading-documents" className={sectionTitleClass}>
                    DOCUMENTOS DO PROCESSO
                  </h2>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onCreateDocument}
                  >
                    Criar documento
                  </Button>
                </div>
                <div className="space-y-4">
                  {hasAttachedDocuments && (
                    <div className="rounded-lg border border-border/60 bg-background/60 p-3">
                      <dl>
                        <dt className="text-sm font-medium text-muted-foreground">
                          Documentos anexados
                        </dt>
                        <dd className="mt-1 text-sm">
                          {renderFormatted("documentos_anexados", attachedDocumentsValue)}
                        </dd>
                      </dl>
                    </div>
                  )}
                  {documentsLoading && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Carregando documentos...
                    </div>
                  )}
                  {documentsError && !documentsLoading && (
                    <p className="text-sm text-destructive">{documentsError}</p>
                  )}
                  {!documentsLoading && !documentsError && documents.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      Nenhum documento gerado ainda. Utilize o botão acima para criar um documento a partir de um modelo.
                    </p>
                  )}
                  {documents.length > 0 && (
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      {documents.map((doc) => {
                        const title =
                          typeof doc.title === "string" && doc.title.trim().length > 0
                            ? doc.title.trim()
                            : `Documento ${doc.id}`;
                        const createdAtText = formatDate(doc.created_at);
                        const isDownloadLoading =
                          documentActionState?.id === doc.id &&
                          documentActionState?.type === "download";
                        const isOpenLoading =
                          documentActionState?.id === doc.id &&
                          documentActionState?.type === "open";

                        return (
                          <div
                            key={doc.id}
                            className="flex flex-col gap-4 rounded-lg border border-border/60 bg-background/60 p-4"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3">
                                <div className="rounded-md bg-muted p-2 text-muted-foreground">
                                  <FileText className="h-4 w-4" />
                                </div>
                                <div className="space-y-1">
                                  <h3 className="font-semibold leading-none">{title}</h3>
                                  <p className="text-xs text-muted-foreground">
                                    Criado em {createdAtText}
                                  </p>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleDeleteDocument(doc)}
                                disabled={documentDeleting && documentToDelete?.id === doc.id}
                                aria-label={`Excluir ${title}`}
                              >
                                {documentDeleting && documentToDelete?.id === doc.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button size="sm" variant="secondary" onClick={() => handleViewDocument(doc)}>
                                Visualizar
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDownloadDocument(doc)}
                                disabled={isDownloadLoading}
                              >
                                {isDownloadLoading ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <Download className="mr-2 h-4 w-4" />
                                )}
                                Download
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenDocumentInNewTab(doc)}
                                disabled={isOpenLoading}
                              >
                                {isOpenLoading ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <ExternalLink className="mr-2 h-4 w-4" />
                                )}
                                Abrir em nova aba
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>

              {renderDataSection("detalhes")}

              <section
                aria-labelledby="heading-billing"
                className={sectionContainerClass}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h2 id="heading-billing" className={sectionTitleClass}>
                    Faturamentos
                  </h2>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={openBillingDialog}
                    disabled={!opportunity}
                    aria-label="Registrar novo faturamento"
                  >
                    Novo faturamento
                  </Button>
                </div>

                {sortedInstallments.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-muted-foreground">
                      Cronograma de parcelas
                    </h3>
                    <div className="space-y-2">
                      {sortedInstallments.map((installment) => {
                        const valorParcela = parseToNumber(installment.valor);
                        const statusText =
                          typeof installment.status === "string"
                            ? installment.status.toLowerCase()
                            : "";
                        const isPaid = statusText === "quitado" || statusText === "quitada";
                        const quitadoEm =
                          typeof installment.quitado_em === "string" &&
                          installment.quitado_em.trim().length > 0
                            ? formatDate(installment.quitado_em)
                            : null;

                      return (
                        <div
                          key={installment.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/60 p-3"
                        >
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">
                              Parcela {installment.numero_parcela}
                            </p>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold">
                                {valorParcela !== null ? formatCurrency(valorParcela) : "—"}
                              </p>
                              {(() => {
                                const faturamento =
                                  typeof installment.faturamento_id === "number"
                                    ? billingHistoryById.get(installment.faturamento_id)
                                    : null;
                                if (!faturamento) {
                                  return null;
                                }
                                const forma =
                                  typeof faturamento.forma_pagamento === "string" &&
                                  faturamento.forma_pagamento.trim().length > 0
                                    ? faturamento.forma_pagamento.trim()
                                    : null;
                                const condicao =
                                  typeof faturamento.condicao_pagamento === "string" &&
                                  faturamento.condicao_pagamento.trim().length > 0
                                    ? faturamento.condicao_pagamento.trim()
                                    : null;
                                const parcelasValor = parseToNumber(faturamento.parcelas);

                                return (
                                  <>
                                    {forma && <Badge variant="outline">{forma}</Badge>}
                                    {condicao ? (
                                      <Badge variant="outline">{condicao}</Badge>
                                    ) : parcelasValor && parcelasValor > 1 ? (
                                      <Badge variant="secondary">
                                        {parcelasValor} {parcelasValor > 1 ? "parcelas" : "parcela"}
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline">À vista</Badge>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground">
                            <Badge variant={isPaid ? "secondary" : "outline"}>
                              {isPaid ? "Quitada" : "Pendente"}
                            </Badge>
                            {quitadoEm && <span>Quitada em {quitadoEm}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                )}

                {billingHistory.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Nenhum faturamento registrado até o momento.
                  </p>
                )}
              </section>

              <section
                aria-labelledby="heading-interactions"
                className={sectionContainerClass}
              >
                <h2 id="heading-interactions" className={sectionTitleClass}>
                  Anexos e Comentários
                </h2>
                <div className="space-y-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-3">
                      <Label htmlFor="opportunity-attachments">Anexos</Label>
                      <Input
                        id="opportunity-attachments"
                        type="file"
                        multiple
                        onChange={handleAttachmentChange}
                      />
                      {pendingAttachments.length > 0 && (
                        <ul className="space-y-2">
                          {pendingAttachments.map((file, index) => (
                            <li
                              key={`${file.name}-${index}`}
                              className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-medium">{file.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {formatFileSize(file.size)}
                                </p>
                              </div>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => removePendingAttachment(index)}
                                aria-label={`Remover anexo ${file.name}`}
                              >
                                Remover
                              </Button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="space-y-3">
                      <Label htmlFor="opportunity-comment">Comentário</Label>
                      <Textarea
                        id="opportunity-comment"
                        placeholder="Escreva um comentário sobre esta oportunidade"
                        value={commentText}
                        onChange={(event) => setCommentText(event.target.value)}
                        rows={pendingAttachments.length > 0 ? 6 : 4}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <p className="text-xs text-muted-foreground">
                      Os comentários e anexos são armazenados localmente para referência
                      rápida.
                    </p>
                    <Button
                      type="button"
                      onClick={handleInteractionSubmit}
                      aria-label="Registrar comentário e anexos"
                    >
                      Registrar
                    </Button>
                  </div>

                  {interactionHistory.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                        Interações recentes
                      </h3>
                      <ul className="space-y-3">
                        {interactionHistory.map((entry) => (
                          <li
                            key={entry.id}
                            className="rounded-lg border border-border/60 bg-background px-4 py-3 shadow-sm"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                              <span>
                                Registrado em {new Date(entry.createdAt).toLocaleString("pt-BR")}
                              </span>
                              {entry.attachments.length > 0 && (
                                <span>
                                  {entry.attachments.length} {" "}
                                  {entry.attachments.length === 1 ? "anexo" : "anexos"}
                                </span>
                              )}
                            </div>
                            {entry.comment && (
                              <p className="mt-2 whitespace-pre-line text-sm text-foreground">
                                {entry.comment}
                              </p>
                            )}
                            {entry.attachments.length > 0 && (
                              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                                {entry.attachments.map((file, index) => (
                                  <li
                                    key={`${file.name}-${index}`}
                                    className="flex flex-wrap items-center justify-between gap-3 rounded border border-dashed border-border/50 bg-background/50 px-3 py-2"
                                  >
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate font-medium text-foreground">{file.name}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {formatFileSize(file.size)}
                                      </p>
                                    </div>
                                    {file.dataUrl ? (
                                      <div className="flex shrink-0 items-center gap-2">
                                        <Button asChild size="sm" variant="ghost">
                                          <a
                                            href={file.dataUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            aria-label={`Abrir anexo ${file.name}`}
                                          >
                                            Abrir
                                          </a>
                                        </Button>
                                        <Button asChild size="sm" variant="secondary">
                                          <a
                                            href={file.dataUrl}
                                            download={file.name}
                                            aria-label={`Baixar anexo ${file.name}`}
                                          >
                                            Baixar
                                          </a>
                                        </Button>
                                      </div>
                                    ) : (
                                      <span className="text-xs italic text-muted-foreground">
                                        Conteúdo indisponível
                                      </span>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </section>

            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <div className="mt-6 flex flex-col gap-4 border-t pt-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1 text-sm text-muted-foreground">
          {footerInfoLines.map((line, index) => (
            <p key={`${line}-${index}`}>{line}</p>
          ))}
          {responsibleName && <p>Responsável: {responsibleName}</p>}
          {!hasFooterMetadata && (
            <p>Revise ou exporte a proposta conforme necessário.</p>
          )}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => navigate(-1)}
            aria-label="Voltar para a listagem de oportunidades"
          >
            Voltar
          </Button>
          <Button variant="ghost" onClick={onPrint} aria-label="Imprimir proposta">
            Imprimir
          </Button>
        </div>
      </div>

      {/* snackbar / feedback simples com auto-close */}
      {snack.open && (
        <div
          role="status"
          aria-live="polite"
          className="fixed left-1/2 -translate-x-1/2 bottom-6 z-50 transition-opacity"
        >
          <div className="bg-black/90 text-white px-4 py-2 rounded shadow flex items-center gap-4">
            <span>{snack.message ?? "Feito"}</span>
            <button
              onClick={() => setSnack({ open: false })}
              className="underline text-xs"
              aria-label="Fechar notificação"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      <Dialog
        open={Boolean(documentPreview)}
        onOpenChange={(open) => {
          if (!open) {
            closeDocumentPreview();
          }
        }}
      >
        <DialogContent className="sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>{documentPreview?.title ?? "Documento"}</DialogTitle>
            <DialogDescription>
              Visualização do documento em PDF. Faça o download ou abra em uma nova aba para compartilhar.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-[400px] rounded-lg border border-border/60 bg-muted/20 p-2">
            {documentPreviewLoading ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                Gerando PDF do documento...
              </div>
            ) : documentPreviewError ? (
              <p className="p-4 text-sm text-destructive">{documentPreviewError}</p>
            ) : documentPreviewUrl ? (
              <iframe
                title={`Documento ${documentPreview?.title ?? documentPreview?.id ?? ""}`}
                src={documentPreviewUrl}
                className="h-[70vh] w-full rounded-md bg-white"
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-muted-foreground">
                  Pré-visualização indisponível.
                </p>
              </div>
            )}
          </div>
          <DialogFooter className="sm:justify-end">
            <div className="flex flex-wrap gap-2 sm:justify-end">
              {documentPreview && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleDownloadDocument(documentPreview)}
                    disabled={
                      documentActionState?.id === documentPreview.id &&
                      documentActionState?.type === "download"
                    }
                  >
                    {documentActionState?.id === documentPreview.id &&
                    documentActionState?.type === "download" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    Baixar PDF
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleOpenDocumentInNewTab(documentPreview)}
                    disabled={
                      documentActionState?.id === documentPreview.id &&
                      documentActionState?.type === "open"
                    }
                  >
                    {documentActionState?.id === documentPreview.id &&
                    documentActionState?.type === "open" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ExternalLink className="mr-2 h-4 w-4" />
                    )}
                    Abrir em nova aba
                  </Button>
                </>
              )}
              <Button type="button" onClick={closeDocumentPreview}>
                Fechar
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={documentToDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDocumentToDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir documento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza de que deseja excluir "{documentToDelete?.title ?? "Documento"}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={documentDeleting}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteDocument}
              disabled={documentDeleting}
            >
              {documentDeleting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Excluindo...
                </span>
              ) : (
                "Excluir"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={billingDialogOpen}
        onOpenChange={(open) => {
          setBillingDialogOpen(open);
          if (!open) {
            setBillingError(null);
          }
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Faturar oportunidade</DialogTitle>
            <DialogDescription>
              Confirme as condições cadastradas e registre o faturamento desta proposta.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div className="space-y-3 rounded-lg border border-dashed border-border/70 bg-muted/40 p-4">
              <p className="text-sm font-medium text-muted-foreground">
                Condições cadastradas
              </p>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs uppercase text-muted-foreground">Forma cadastrada</dt>
                  <dd className="font-medium text-foreground">
                    {typeof opportunity?.forma_pagamento === "string" &&
                    opportunity.forma_pagamento.trim().length > 0
                      ? opportunity.forma_pagamento
                      : "Não informado"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-muted-foreground">Condição prevista</dt>
                  <dd className="font-medium text-foreground">
                    {(() => {
                      const parcelasRegistradas = parseToNumber(
                        opportunity?.qtde_parcelas,
                      );
                      if (parcelasRegistradas && parcelasRegistradas > 1) {
                        return `${parcelasRegistradas} parcelas`;
                      }
                      return "À vista";
                    })()}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs uppercase text-muted-foreground">Honorários estimados</dt>
                  <dd className="font-medium text-foreground">
                    {(() => {
                      const honorarios = parseToNumber(
                        opportunity?.valor_honorarios,
                      );
                      return honorarios !== null
                        ? formatCurrency(honorarios)
                        : "Não informado";
                    })()}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="billing-forma">Forma de pagamento</Label>
                <Select
                  value={billingForm.formaPagamento || undefined}
                  onValueChange={(value) =>
                    setBillingForm((prev) => ({
                      ...prev,
                      formaPagamento: value,
                      formaPagamentoDescricao:
                        value === "Outro" ? prev.formaPagamentoDescricao : "",
                    }))
                  }
                >
                  <SelectTrigger id="billing-forma">
                    <SelectValue placeholder="Selecione a forma" />
                  </SelectTrigger>
                  <SelectContent>
                    {BILLING_PAYMENT_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {billingForm.formaPagamento === "Outro" && (
                  <Input
                    id="billing-forma-descricao"
                    placeholder="Descreva a forma de pagamento"
                    value={billingForm.formaPagamentoDescricao}
                    onChange={(event) =>
                      setBillingForm((prev) => ({
                        ...prev,
                        formaPagamentoDescricao: event.target.value,
                      }))
                    }
                  />
                )}
              </div>

              {hasPendingInstallments && (
                <div className="space-y-2 sm:col-span-2">
                  <p className="text-sm font-medium text-foreground">Parcelas pendentes</p>
                  <div className="space-y-3 rounded-md border border-border/70 bg-background p-3">
                    {pendingInstallments.map((installment) => {
                      const optionId = `billing-installment-${installment.id}`;
                      const valorParcela = parseToNumber(installment.valor);
                      const isChecked = billingForm.selectedInstallmentIds.includes(
                        installment.id,
                      );
                      return (
                        <div
                          key={installment.id}
                          className="flex items-start gap-3 rounded-md border border-border/40 p-3"
                        >
                          <Checkbox
                            id={optionId}
                            checked={isChecked}
                            onCheckedChange={(checked) => {
                              setBillingForm((prev) => {
                                const nextIds = new Set(prev.selectedInstallmentIds);
                                if (checked === true) {
                                  nextIds.add(installment.id);
                                } else {
                                  nextIds.delete(installment.id);
                                }
                                const ordered = pendingInstallments
                                  .map((item) => item.id)
                                  .filter((id) => nextIds.has(id));
                                return {
                                  ...prev,
                                  selectedInstallmentIds: ordered,
                                };
                              });
                            }}
                          />
                          <div className="flex flex-1 flex-col">
                            <Label
                              htmlFor={optionId}
                              className="cursor-pointer font-medium leading-none"
                            >
                              {`Parcela ${installment.numero_parcela}`}
                            </Label>
                            <span className="text-xs text-muted-foreground">
                              {valorParcela !== null
                                ? formatCurrency(valorParcela)
                                : "Valor não informado"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    As parcelas selecionadas serão atualizadas como pagas após o faturamento.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="billing-condicao">Condição de pagamento</Label>
                <Select
                  value={billingForm.condicaoPagamento}
                  onValueChange={(value) =>
                    setBillingForm((prev) => ({
                      ...prev,
                      condicaoPagamento: value as BillingCondition,
                      parcelas:
                        value === "Parcelado"
                          ? pendingInstallments.length > 0
                            ? "1"
                            : prev.parcelas && Number.parseInt(prev.parcelas, 10) > 0
                              ? prev.parcelas
                              : "1"
                          : "1",
                    }))
                  }
                  disabled={hasPendingInstallments}
                >
                  <SelectTrigger id="billing-condicao">
                    <SelectValue placeholder="Selecione a condição" />
                  </SelectTrigger>
                  <SelectContent>
                    {BILLING_CONDITIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="billing-data">Data de faturamento</Label>
                <Input
                  id="billing-data"
                  type="date"
                  value={billingForm.dataFaturamento}
                  onChange={(event) =>
                    setBillingForm((prev) => ({
                      ...prev,
                      dataFaturamento: event.target.value,
                    }))
                  }
                />
              </div>

              {billingForm.condicaoPagamento === "Parcelado" && (
                <div className="space-y-2">
                  <Label htmlFor="billing-parcelas">Quantidade de parcelas</Label>
                  <Input
                    id="billing-parcelas"
                    type="number"
                    min="1"
                    step="1"
                    value={billingForm.parcelas}
                    onChange={(event) =>
                      setBillingForm((prev) => ({
                        ...prev,
                        parcelas: event.target.value,
                      }))
                    }
                    readOnly={hasPendingInstallments}
                    disabled={hasPendingInstallments}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="billing-valor">Valor a faturar</Label>
                <Input
                  id="billing-valor"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  readOnly={hasPendingInstallments || billingForm.condicaoPagamento === "Parcelado"}
                  value={billingForm.valor}
                  onChange={(event) =>
                    setBillingForm((prev) => ({
                      ...prev,
                      valor: event.target.value,
                    }))
                  }
                />
                {(billingForm.condicaoPagamento === "Parcelado" || hasPendingInstallments) && (
                  <p className="text-xs text-muted-foreground">
                    O valor é calculado automaticamente conforme as parcelas e encargos selecionados.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="billing-juros">Juros</Label>
                <Input
                  id="billing-juros"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={billingForm.juros}
                  onChange={(event) =>
                    setBillingForm((prev) => ({
                      ...prev,
                      juros: event.target.value,
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="billing-multa">Multa</Label>
                <Input
                  id="billing-multa"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={billingForm.multa}
                  onChange={(event) =>
                    setBillingForm((prev) => ({
                      ...prev,
                      multa: event.target.value,
                    }))
                  }
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="billing-observacoes">Observações</Label>
                <Textarea
                  id="billing-observacoes"
                  placeholder="Detalhe informações importantes para o financeiro"
                  value={billingForm.observacoes}
                  onChange={(event) =>
                    setBillingForm((prev) => ({
                      ...prev,
                      observacoes: event.target.value,
                    }))
                  }
                  rows={4}
                />
              </div>
            </div>

            {billingError && (
              <p className="text-sm text-destructive">{billingError}</p>
            )}
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setBillingDialogOpen(false)}
              disabled={billingSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleBillingConfirm}
              disabled={billingSubmitting}
            >
              {billingSubmitting ? "Registrando..." : "Confirmar faturamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={documentDialogOpen}
        onOpenChange={(open) => {
          setDocumentDialogOpen(open);
          if (!open) {
            resetDocumentDialog();
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Criar documento</DialogTitle>
            <DialogDescription>
              Escolha como deseja criar o documento desta oportunidade.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={documentType === "modelo" ? "default" : "outline"}
                onClick={() => setDocumentType("modelo")}
              >
                A partir do modelo
              </Button>
              <Button
                type="button"
                variant={documentType === "processo" ? "default" : "outline"}
                onClick={() => setDocumentType("processo")}
              >
                Vincular processo
              </Button>
            </div>

            {documentType === "modelo" && (
              <div className="space-y-2">
                <Label htmlFor="document-template">Modelo</Label>
                <Select
                  value={selectedTemplate}
                  onValueChange={setSelectedTemplate}
                  disabled={
                    documentTemplatesLoading ||
                    (documentTemplates.length === 0 && !documentTemplatesError)
                  }
                >
                  <SelectTrigger
                    id="document-template"
                    disabled={
                      documentTemplatesLoading ||
                      (documentTemplates.length === 0 && !documentTemplatesError)
                    }
                  >
                    <SelectValue
                      placeholder={
                        documentTemplatesLoading
                          ? "Carregando modelos..."
                          : documentTemplates.length === 0
                          ? documentTemplatesError ?? "Nenhum modelo disponível"
                          : "Selecione um modelo"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {documentTemplates.length > 0 ? (
                      documentTemplates.map((template) => (
                        <SelectItem key={template.value} value={template.value}>
                          {template.label}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="__no_template__" disabled>
                        {documentTemplatesError ?? "Nenhum modelo cadastrado"}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {documentTemplatesError && (
                  <p className="text-sm text-destructive">{documentTemplatesError}</p>
                )}
              </div>
            )}

            {documentType === "processo" && (
              <div className="grid gap-4 sm:grid-cols-2">
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
                  <Label htmlFor="process-orgao">Órgão Julgador</Label>
                  <Input
                    id="process-orgao"
                    placeholder="Informe o órgão julgador"
                    value={processForm.orgaoJulgador}
                    onChange={(event) =>
                      setProcessForm((prev) => ({
                        ...prev,
                        orgaoJulgador: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
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
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDocumentDialogOpen(false)}
              disabled={documentSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void handleDocumentConfirm()}
              disabled={isDocumentContinueDisabled}
            >
              {documentType === "modelo"
                ? documentSubmitting
                  ? "Criando..."
                  : "Criar documento"
                : "Continuar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
