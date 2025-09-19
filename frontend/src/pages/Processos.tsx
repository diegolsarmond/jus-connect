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
import { getApiUrl } from "@/lib/api";
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
import {
  Archive,
  Calendar,
  Clock,
  FileText,
  Gavel as GavelIcon,
  Landmark,
  MapPin,
  Search,
  Users as UsersIcon,
  Eye,
} from "lucide-react";
import {
  DATAJUD_CATEGORIAS,
  DATAJUD_TRIBUNAIS_BY_CATEGORIA,
  getDatajudCategoriaLabel,
  getDatajudTribunalLabel,
  normalizeDatajudAlias,
} from "@/data/datajud";

interface ProcessoCliente {
  id?: number;
  nome: string;
  cpf: string;
  papel: string;
}

interface Processo {
  id: number;
  numero: string;
  dataDistribuicao: string;
  status: string;
  tipo: string;
  cliente: ProcessoCliente;
  advogadoResponsavel: string;
  classeJudicial: string;
  assunto: string;
  jurisdicao: string;
  orgaoJulgador: string;
  datajudTipoJustica: string | null;
  datajudAlias: string | null;
  datajudTribunal: string | null;
  movimentacoes: {
    data: string;
    descricao: string;
    codigo?: number | null;
    nome?: string;
    dataIso?: string | null;
  }[];
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
  criado_em: string;
  atualizado_em: string;
  cliente?: ApiProcessoCliente | null;
  datajud_tipo_justica?: string | null;
  datajud_alias?: string | null;
}

interface ApiProcessoMovimentacao {
  codigo?: number | null;
  nome?: string | null;
  dataHora?: string | null;
  descricao?: string | null;
}

const isApiProcessoMovimentacao = (
  value: unknown,
): value is ApiProcessoMovimentacao =>
  value !== null && typeof value === "object";

type ProcessFormState = {
  numero: string;
  uf: string;
  municipio: string;
  orgaoJulgador: string;
  clienteId: string;
  datajudTipoJustica: string;
  datajudAlias: string;
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
    return "Data não informada";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Data não informada";
  }

  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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

const createEmptyProcessForm = (): ProcessFormState => ({
  numero: "",
  uf: "",
  municipio: "",
  orgaoJulgador: "",
  clienteId: "",
  datajudTipoJustica: "",
  datajudAlias: "",
});

const mapApiProcessoToProcesso = (processo: ApiProcesso): Processo => {
  const clienteResumo = processo.cliente ?? null;
  const documento = clienteResumo?.documento ?? "";
  const jurisdicao =
    processo.jurisdicao ||
    [processo.municipio, processo.uf].filter(Boolean).join(" - ") ||
    "Não informado";
  const rawCategoria = processo.datajud_tipo_justica?.trim() || null;
  const categoriaLabel = getDatajudCategoriaLabel(rawCategoria);
  const datajudAlias = normalizeDatajudAlias(processo.datajud_alias);
  const datajudTribunal = getDatajudTribunalLabel(datajudAlias);

  return {
    id: processo.id,
    numero: processo.numero,
    dataDistribuicao:
      formatDateToPtBR(processo.data_distribuicao || processo.criado_em),
    status: processo.status?.trim() || "Não informado",
    tipo: processo.tipo?.trim() || "Não informado",
    cliente: {
      id: clienteResumo?.id ?? processo.cliente_id,
      nome: clienteResumo?.nome ?? "Cliente não informado",
      cpf: documento,
      papel: resolveClientePapel(clienteResumo?.tipo),
    },
    advogadoResponsavel:
      processo.advogado_responsavel?.trim() || "Não informado",
    classeJudicial: processo.classe_judicial?.trim() || "Não informada",
    assunto: processo.assunto?.trim() || "Não informado",
    jurisdicao,
    orgaoJulgador: processo.orgao_julgador?.trim() || "Não informado",
    datajudTipoJustica: categoriaLabel ?? rawCategoria,
    datajudAlias,
    datajudTribunal,
    movimentacoes: [],
  };
};

const mapApiMovimentacaoToLocal = (
  movimentacao: ApiProcessoMovimentacao,
): Processo["movimentacoes"][number] => {
  const rawCodigo = movimentacao.codigo;
  let codigo: number | null = null;

  if (typeof rawCodigo === "number" && Number.isFinite(rawCodigo)) {
    codigo = rawCodigo;
  } else if (typeof rawCodigo === "string") {
    const parsed = Number.parseInt(rawCodigo, 10);
    codigo = Number.isNaN(parsed) ? null : parsed;
  }

  const nome =
    typeof movimentacao.nome === "string" && movimentacao.nome.trim()
      ? movimentacao.nome.trim()
      : "Movimentação";

  const descricao =
    typeof movimentacao.descricao === "string" &&
    movimentacao.descricao.trim()
      ? movimentacao.descricao.trim()
      : nome;

  return {
    codigo,
    nome,
    descricao,
    data: formatDateTimeToPtBR(movimentacao.dataHora ?? null),
    dataIso: movimentacao.dataHora ?? null,
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
  const [ufs, setUfs] = useState<Uf[]>([]);
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [municipiosLoading, setMunicipiosLoading] = useState(false);
  const [clientes, setClientes] = useState<ClienteResumo[]>([]);
  const [clientesLoading, setClientesLoading] = useState(false);
  const [processosLoading, setProcessosLoading] = useState(false);
  const [processosError, setProcessosError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creatingProcess, setCreatingProcess] = useState(false);

  const fetchProcessMovimentacoes = useCallback(
    async (processo: Processo): Promise<Processo["movimentacoes"]> => {
      if (!processo.datajudAlias) {
        return [];
      }

      try {
        const res = await fetch(
          getApiUrl(`processos/${processo.id}/movimentacoes`),
          {
            headers: { Accept: "application/json" },
          },
        );

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        let json: unknown = null;
        try {
          json = await res.json();
        } catch (error) {
          console.error(
            `Não foi possível interpretar as movimentações do processo ${processo.id}`,
            error,
          );
          return [];
        }

        const movimentos = Array.isArray(json)
          ? json.filter(isApiProcessoMovimentacao)
          : [];

        return movimentos
          .map(mapApiMovimentacaoToLocal)
          .sort((a, b) => {
            const dateA = a.dataIso ? new Date(a.dataIso).getTime() : 0;
            const dateB = b.dataIso ? new Date(b.dataIso).getTime() : 0;
            return dateB - dateA;
          });
      } catch (error) {
        console.error(
          `Erro ao carregar movimentações do processo ${processo.id}`,
          error,
        );
        return [];
      }
    },
    [],
  );

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

  const totalProcessos = useMemo(() => processos.length, [processos]);

  const availableTribunais = useMemo(() => {
    if (!processForm.datajudTipoJustica) {
      return [];
    }

    const key = processForm.datajudTipoJustica as keyof typeof DATAJUD_TRIBUNAIS_BY_CATEGORIA;
    return DATAJUD_TRIBUNAIS_BY_CATEGORIA[key] ?? [];
  }, [processForm.datajudTipoJustica]);

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
    if (statusFilter !== "todos" && !statusOptions.includes(statusFilter)) {
      setStatusFilter("todos");
    }
  }, [statusFilter, statusOptions]);

  useEffect(() => {
    if (tipoFilter !== "todos" && !tipoOptions.includes(tipoFilter)) {
      setTipoFilter("todos");
    }
  }, [tipoFilter, tipoOptions]);

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

    const mapped = data.map(mapApiProcessoToProcesso);

    const movimentacoes = await Promise.all(
      mapped.map((processo) => fetchProcessMovimentacoes(processo)),
    );

    return mapped.map((processo, index) => ({
      ...processo,
      movimentacoes: movimentacoes[index] ?? [],
    }));
  }, [fetchProcessMovimentacoes]);

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

  const resetProcessForm = () => {
    setProcessForm(createEmptyProcessForm());
    setMunicipios([]);
    setMunicipiosLoading(false);
    setCreateError(null);
  };

  const handleDialogOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      resetProcessForm();
    } else {
      setCreateError(null);
    }
  };

  const handleProcessCreate = async () => {
    if (
      !processForm.numero ||
      !processForm.uf ||
      !processForm.municipio ||
      !processForm.orgaoJulgador ||
      !processForm.clienteId ||
      !processForm.datajudTipoJustica ||
      !processForm.datajudAlias
    ) {
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
      const res = await fetch(getApiUrl("processos"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          cliente_id: selectedCliente.id,
          numero: processForm.numero,
          uf: processForm.uf,
          municipio: processForm.municipio,
          orgao_julgador: processForm.orgaoJulgador,
          jurisdicao: `${processForm.municipio} - ${processForm.uf}`,
          datajud_tipo_justica: processForm.datajudTipoJustica,
          datajud_alias: processForm.datajudAlias,
        }),
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
      const movimentacoes = await fetchProcessMovimentacoes(mapped);
      setProcessos((prev) => [
        { ...mapped, movimentacoes },
        ...prev.filter((p) => p.id !== mapped.id),
      ]);
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

  const isCreateDisabled =
    !processForm.numero ||
    !processForm.uf ||
    !processForm.municipio ||
    !processForm.orgaoJulgador ||
    !processForm.clienteId ||
    !processForm.datajudTipoJustica ||
    !processForm.datajudAlias ||
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
        processo.advogadoResponsavel,
        processo.status,
        processo.tipo,
        processo.datajudTribunal ?? undefined,
        processo.datajudTipoJustica ?? undefined,
        processo.orgaoJulgador,
      ];

      const hasTextMatch = searchPool.some((value) => {
        if (!value) return false;
        return value.toLowerCase().includes(normalizedSearch);
      });

      const documento = processo.cliente?.cpf ?? "";
      const hasDocumentoMatch =
        numericSearch.length > 0 && documento
          ? documento.replace(/\D/g, "").includes(numericSearch)
          : false;

      return hasTextMatch || hasDocumentoMatch;
    });
  }, [processos, searchTerm, statusFilter, tipoFilter]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-foreground">Processos</h1>
          <p className="text-sm text-muted-foreground">
            Monitore os processos em andamento, acompanhe movimentações recentes e identifique prioridades com mais clareza.
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
          <CardContent className="space-y-4 pt-6">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      ) : processosError ? (
        <Card className="border-destructive/40 bg-destructive/10">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive-foreground">{processosError}</p>
          </CardContent>
        </Card>
      ) : filteredProcessos.length === 0 ? (
        <Card className="border-border/60 bg-card/60 shadow-sm">
          <CardContent className="space-y-2 pt-6 text-center">
            <p className="text-base font-medium text-foreground">
              Nenhum processo encontrado
            </p>
            <p className="text-sm text-muted-foreground">
              Ajuste os filtros ou refine a busca para visualizar outros resultados.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Accordion type="multiple" className="space-y-4">
          {filteredProcessos.map((processo) => (
            <AccordionItem
              key={processo.id}
              value={String(processo.id)}
              className="overflow-hidden rounded-xl border border-border/60 bg-card/60 text-card-foreground shadow-sm transition hover:border-primary/40 hover:shadow-md data-[state=open]:shadow-md"
            >
              <AccordionTrigger className="items-start border-b border-border/40 px-6 py-6 text-left hover:no-underline">
                <div className="flex w-full flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <CardTitle className="text-xl font-semibold">
                        Processo {processo.numero}
                      </CardTitle>
                      <Badge className={`text-xs ${getStatusBadgeClassName(processo.status)}`}>
                        {processo.status}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-xs ${getTipoBadgeClassName(processo.tipo)}`}
                      >
                        {processo.tipo}
                      </Badge>
                      {processo.datajudTipoJustica ? (
                        <Badge
                          variant="outline"
                          className="text-xs border-violet-200 bg-violet-500/10 text-violet-600"
                        >
                          {processo.datajudTipoJustica}
                        </Badge>
                      ) : null}
                    </div>
                    <CardDescription className="flex flex-wrap items-center gap-3 text-sm">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        Distribuído em {processo.dataDistribuicao}
                      </span>
                      <span className="hidden h-4 w-px bg-border/60 md:block" aria-hidden />
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <FileText className="h-4 w-4" />
                        {processo.classeJudicial}
                      </span>
                      <span className="hidden h-4 w-px bg-border/60 lg:block" aria-hidden />
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        {processo.assunto}
                      </span>
                    </CardDescription>
                  </div>
                  <div className="flex flex-col items-start gap-3 text-sm text-muted-foreground md:items-end">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 md:self-end"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        navigate(`/clientes/${processo.cliente.id}/processos/${processo.id}`);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                      Visualizar processo
                    </Button>
                    <div className="flex items-center gap-2">
                      <UsersIcon className="h-4 w-4" />
                      <span className="font-medium text-foreground">
                        {processo.advogadoResponsavel}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Landmark className="h-4 w-4" />
                      <span>{processo.orgaoJulgador}</span>
                    </div>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6 pt-6">
                <div className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <div className="rounded-lg border border-dashed border-border/60 bg-muted/40 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Cliente
                      </p>
                      <div className="mt-2 flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {processo.cliente.nome}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {processo.cliente.cpf || "Documento não informado"}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className="text-[10px] uppercase tracking-wide text-muted-foreground"
                        >
                          {processo.cliente.papel}
                        </Badge>
                      </div>
                    </div>
                    <div className="rounded-lg border border-dashed border-border/60 bg-muted/40 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Jurisdição
                      </p>
                      <div className="mt-2 flex items-start gap-2 text-sm text-foreground">
                        <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                        <span>{processo.jurisdicao}</span>
                      </div>
                    </div>
                    <div className="rounded-lg border border-dashed border-border/60 bg-muted/40 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Órgão julgador
                      </p>
                      <div className="mt-2 flex items-start gap-2 text-sm text-foreground">
                        <Landmark className="mt-0.5 h-4 w-4 text-muted-foreground" />
                        <span>{processo.orgaoJulgador}</span>
                      </div>
                    </div>
                    {processo.datajudTribunal ? (
                      <div className="rounded-lg border border-dashed border-border/60 bg-muted/40 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Tribunal (DataJud)
                        </p>
                        <div className="mt-2 flex items-start gap-2 text-sm text-foreground">
                          <Archive className="mt-0.5 h-4 w-4 text-muted-foreground" />
                          <div className="flex flex-col gap-1">
                            <span>{processo.datajudTribunal}</span>
                            {processo.datajudAlias ? (
                              <span className="text-xs text-muted-foreground">
                                Alias: {processo.datajudAlias}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ) : null}
                    <div className="rounded-lg border border-dashed border-border/60 bg-muted/40 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Classe judicial
                      </p>
                      <div className="mt-2 flex items-start gap-2 text-sm text-foreground">
                        <GavelIcon className="mt-0.5 h-4 w-4 text-muted-foreground" />
                        <span>{processo.classeJudicial}</span>
                      </div>
                    </div>
                    <div className="rounded-lg border border-dashed border-border/60 bg-muted/40 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Assunto principal
                      </p>
                      <div className="mt-2 flex items-start gap-2 text-sm text-foreground">
                        <FileText className="mt-0.5 h-4 w-4 text-muted-foreground" />
                        <span>{processo.assunto}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 rounded-lg border border-dashed border-border/60 bg-muted/30 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="text-sm font-semibold text-foreground">
                        Últimas movimentações
                      </h4>
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        {processo.movimentacoes.length} registros
                      </Badge>
                    </div>
                    {processo.movimentacoes.length > 0 ? (
                      <ul className="space-y-3 text-sm">
                        {processo.movimentacoes.map((movimentacao, index) => (
                          <li key={`${processo.id}-mov-${index}`} className="flex items-start gap-3">
                            <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
                            <div className="space-y-1">
                              <p className="font-medium text-foreground">{movimentacao.descricao}</p>
                              <p className="text-xs text-muted-foreground">{movimentacao.data}</p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : processo.datajudAlias ? (
                      <p className="text-sm text-muted-foreground">
                        Nenhuma movimentação foi retornada pela API pública para este processo até o momento.
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Informe o tribunal do processo ao cadastrar para carregar as movimentações automaticamente.
                      </p>
                    )}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

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
              <Label htmlFor="process-justica">Tipo de Justiça (DataJud)</Label>
              <Select
                value={processForm.datajudTipoJustica}
                onValueChange={(value) =>
                  setProcessForm((prev) => ({
                    ...prev,
                    datajudTipoJustica: value,
                    datajudAlias: "",
                  }))
                }
              >
                <SelectTrigger id="process-justica">
                  <SelectValue placeholder="Selecione o tipo de justiça" />
                </SelectTrigger>
                <SelectContent>
                  {DATAJUD_CATEGORIAS.map((categoria) => (
                    <SelectItem key={categoria.id} value={categoria.id}>
                      {categoria.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="process-tribunal">Tribunal (DataJud)</Label>
              <Select
                value={processForm.datajudAlias}
                onValueChange={(value) =>
                  setProcessForm((prev) => ({
                    ...prev,
                    datajudAlias: value,
                  }))
                }
              >
                <SelectTrigger
                  id="process-tribunal"
                  disabled={!processForm.datajudTipoJustica}
                >
                  <SelectValue
                    placeholder={
                      !processForm.datajudTipoJustica
                        ? "Selecione o tipo de justiça"
                        : availableTribunais.length > 0
                          ? "Selecione o tribunal"
                          : "Nenhum tribunal disponível"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {availableTribunais.map((tribunal) => (
                    <SelectItem key={tribunal.alias} value={tribunal.alias}>
                      {tribunal.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

