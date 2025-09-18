import { useEffect, useMemo, useState, type ChangeEvent } from "react";
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

import { format as dfFormat, parseISO } from "date-fns";

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

interface InteractionEntry {
  id: number;
  comment: string;
  attachments: { name: string; size: number }[];
  createdAt: string;
}

const PREFERRED_ORDER = [
  "numero_processo_cnj",
  "numero_protocolo",
  "vara_ou_orgao",
  "comarca",
  "prazo_proximo",
  "valor_causa",
  "valor_honorarios",
  "percentual_honorarios",
  "forma_pagamento",
  "contingenciamento",
  "detalhes",
  "data_criacao",
  "ultima_atualizacao",
] as const;

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

  const resetDocumentDialog = () => {
    setDocumentType(null);
    setSelectedTemplate("");
    setProcessForm({ numero: "", uf: "", municipio: "", orgaoJulgador: "" });
    setMunicipios([]);
    setMunicipiosLoading(false);
    setDocumentTemplatesError(null);
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

  useEffect(() => {
    let cancelled = false;

    const fetchStatuses = async () => {
      try {
        setStatusLoading(true);
        const data = await fetchList(`${apiUrl}/api/situacoes-processo`);
        if (cancelled) return;
        const options: StatusOption[] = (data as unknown[]).flatMap((item) => {
          if (!item || typeof item !== "object") return [];
          const record = item as Record<string, unknown>;
          const value = record["id"];
          if (value === undefined || value === null) return [];
          const labelRaw = record["nome"] ?? record["name"];
          const label =
            typeof labelRaw === "string" && labelRaw.trim().length > 0
              ? labelRaw
              : String(value);
          return [{ id: String(value), name: label }];
        });
        if (!cancelled) {
          setStatusOptions(options);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) {
          setStatusLoading(false);
        }
      }
    };

    fetchStatuses();
    return () => {
      cancelled = true;
    };
  }, [apiUrl]);

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
            `${apiUrl}/api/situacoes-processo`
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

  // lista de chaves que podem ser copiadas (removi valor_causa e valor_honorarios conforme pedido)
  const shouldShowCopy = (key: string) =>
    [
      "numero_processo_cnj",
      "numero_processo",
      "numero_processo_cn",
      "numero_protocolo",
      // outras chaves curtas que fazem sentido copiar podem ser adicionadas aqui
    ].includes(key);

  // ordem preferencial (mantive para apresentação)
  const orderedEntries = useMemo(() => {
    if (!opportunity) return [];
    const entries = Object.entries(opportunity);
    const ordered: Array<[string, unknown]> = [];
    const used = new Set<string>();
    for (const k of PREFERRED_ORDER) {
      const match = entries.find(([key]) => key === k);
      if (match) {
        ordered.push(match);
        used.add(match[0]);
      }
    }
    for (const [k, v] of entries) {
      if (!used.has(k)) ordered.push([k, v]);
    }
    return ordered;
  }, [opportunity]);

  // seções conforme print fornecido
  const sectionsDef: { key: string; label: string; fields: string[] }[] = [
    {
      key: "processo",
      label: "DADOS DO PROCESSO",
      fields: ["numero_processo_cnj", "numero_protocolo", "tipo_processo_nome", "vara_ou_orgao", "comarca"],
    },
    {
      key: "fluxo",
      label: "DADOS DA PROPOSTA",
      fields: ["fase", "etapa_nome", "prazo_proximo", "status"],
    },
    {
      key: "solicitante",
      label: "CLIENTE SOLICITANTE",
      fields: ["solicitante_nome", "solicitante_cpf_cnpj", "solicitante_email", "solicitante_telefone", "cliente_tipo"],
    },

    {
      key: "detalhes",
      label: "DETALHES",
      fields: ["detalhes"],
    },
    {
      key: "honorarios",
      label: "HONORÁRIOS",
      fields: ["valor_causa", "valor_honorarios", "percentual_honorarios", "forma_pagamento", "qtde_parcelas", "contingenciamento"],
    },
    {
      key: "metadados",
      label: "SISTEMA",
      fields: ["data_criacao", "ultima_atualizacao", "criado_por", "id", "title"],
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

  const handleInteractionSubmit = () => {
    const trimmedComment = commentText.trim();
    if (!trimmedComment && pendingAttachments.length === 0) {
      setSnack({ open: true, message: "Adicione um comentário ou anexo" });
      return;
    }

    const entry: InteractionEntry = {
      id: Date.now(),
      comment: trimmedComment,
      attachments: pendingAttachments.map((file) => ({
        name: file.name,
        size: file.size,
      })),
      createdAt: new Date().toISOString(),
    };

    setInteractionHistory((prev) => [entry, ...prev]);
    setPendingAttachments([]);
    setCommentText("");
    setSnack({ open: true, message: "Comentário registrado" });
  };

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
      const data: { status_id: number | null; ultima_atualizacao?: string } =
        await res.json();

      const nextStatusId =
        data.status_id === undefined ? parsedValue : data.status_id;
      const statusLabel = getStatusLabel(nextStatusId);

      setOpportunity((prev) =>
        prev
          ? {
              ...prev,
              status_id: nextStatusId ?? null,
              status: statusLabel,
              ultima_atualizacao:
                data.ultima_atualizacao ?? prev.ultima_atualizacao,
            }
          : prev
      );
      setSnack({ open: true, message: "Status atualizado" });
    } catch (error) {
      console.error(error);
      setSnack({ open: true, message: "Erro ao atualizar status" });
      setOpportunity((prev) =>
        prev
          ? {
              ...prev,
              status_id: previousStatusId,
              status:
                previousStatusId === null
                  ? undefined
                  : getStatusLabel(previousStatusId) ?? prev.status,
            }
          : prev
      );
    } finally {
      setStatusSaving(false);
    }
  };

  const handleDocumentConfirm = () => {
    if (!documentType) return;

    const params = new URLSearchParams();
    if (id) params.set("oportunidade", id);
    params.set("tipo", documentType);

    if (documentType === "modelo") {
      if (!selectedTemplate) return;
      params.set("modelo", selectedTemplate);
    } else {
      if (
        !processForm.numero ||
        !processForm.uf ||
        !processForm.municipio ||
        !processForm.orgaoJulgador
      )
        return;
      params.set("numero_processo", processForm.numero);
      params.set("uf", processForm.uf);
      params.set("comarca", processForm.municipio);
      params.set("vara_orgao", processForm.orgaoJulgador);
    }

    setDocumentDialogOpen(false);
    navigate(`/documentos?${params.toString()}`);
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
    documentType === "modelo"
      ? !selectedTemplate
      : documentType === "processo"
      ?
          !processForm.numero ||
          !processForm.uf ||
          !processForm.municipio ||
          !processForm.orgaoJulgador
      : true;

  const statusSelectValue =
    opportunity.status_id === null || opportunity.status_id === undefined
      ? STATUS_EMPTY_VALUE
      : String(opportunity.status_id);
  const statusBadgeText =
    typeof opportunity.status === "string" && opportunity.status.trim().length > 0
      ? opportunity.status
      : getStatusLabel(opportunity.status_id);

  return (
    <div className="p-6 space-y-6">
      {/* Header / ações (REMOVIDO Duplicar) */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Visualizar Proposta</h1>
          <p className="text-muted-foreground">Detalhes completos da proposta</p>
        </div>

        <div className="flex gap-2 items-center">
          <Button variant="ghost" onClick={() => navigate(-1)} aria-label="Voltar">
            Voltar
          </Button>
          <Button onClick={onEdit} aria-label="Editar oportunidade">
            Editar
          </Button>
          <Button variant="destructive" onClick={onDelete} aria-label="Excluir oportunidade">
            Excluir
          </Button>
          <Button onClick={onCreateTask} aria-label="Criar tarefa">
            Criar Tarefa
          </Button>
          <Button onClick={onCreateDocument} aria-label="Criar documento">
            Criar Documento
          </Button>
          <Button variant="ghost" onClick={onPrint} aria-label="Imprimir">
            Imprimir
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between md:gap-6">
            <div className="flex flex-col gap-2">
              <CardTitle>
                {opportunity.title ?? `Proposta #${opportunity.id}`}/{new Date().getFullYear()}
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
              {sectionsDef.map((section) => {
                // filtra campos da seção que existam no objeto
                const fields = section.fields.filter((f) => entriesMap.has(f));
                if (fields.length === 0) return null;
                return (
                  <section
                    key={section.key}
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

                        // valor para copiar apenas se chave permitida
                        const copyText = shouldShowCopy(key) && value !== undefined && value !== null ? String(value) : "";

                        return (
                          <div
                            key={key}
                            className="rounded-lg border border-border/60 bg-background/60 p-3"
                          >
                            <dl>
                              <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
                              <dd className="mt-1 flex items-start gap-2">
                                <div className="flex-1 min-w-0">{formatted}</div>

                                {shouldShowCopy(key) && copyText && (
                                  <button
                                    onClick={() => copyToClipboard(copyText)}
                                    title={`Copiar ${label}`}
                                    aria-label={`Copiar ${label}`}
                                    className="ml-2 inline-flex items-center justify-center rounded px-2 py-1 border text-sm hover:bg-surface"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
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
              })}

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
                    {participants.map((p, idx) => (
                      <div
                        key={p.id ?? idx}
                        className="rounded-lg border border-border/60 bg-background p-4 shadow-sm"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
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
                    ))}
                  </div>
                </section>
              )}

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
                                    className="flex items-center justify-between gap-3 rounded border border-dashed border-border/50 bg-background/50 px-3 py-2"
                                  >
                                    <span className="truncate">{file.name}</span>
                                    <span className="text-xs">{formatFileSize(file.size)}</span>
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

              {/* Metadados extras: campos que não estão nas seções acima */}
              <section aria-labelledby="heading-extras" className={sectionContainerClass}>
                <h2 id="heading-extras" className={sectionTitleClass}>
                  Metadados
                </h2>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {orderedEntries
                    .filter(([k]) => {
                      // já apresentados nas seções? se não, mostrará aqui (e exclui id/title já mostrados se preferir)
                      const inAnySection = sectionsDef.some((s) => s.fields.includes(k));
                      return (
                        !inAnySection &&
                        k !== "id" &&
                        k !== "title" &&
                        !k.endsWith("_id")
                      );
                    })
                    .map(([k, v]) => (
                      <div
                        key={k}
                        className="rounded-lg border border-border/60 bg-background/60 p-3"
                      >
                        <dl>
                          <dt className="text-sm font-medium text-muted-foreground">{formatLabel(k)}</dt>
                          <dd className="mt-1">{renderFormatted(k, v)}</dd>
                        </dl>
                      </div>
                    ))}
                </div>
              </section>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>




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
            >
              Cancelar
            </Button>
            <Button type="button" onClick={handleDocumentConfirm} disabled={isDocumentContinueDisabled}>
              Continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
