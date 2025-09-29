import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type UIEventHandler,
} from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Info,
} from "lucide-react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { getApiUrl } from "@/lib/api";
import { cn } from "@/lib/utils";

import {
  agruparPorMes,
  deduplicarMovimentacoes,
  diasDesde,
  normalizarTexto,
} from "./utils/processo-ui";
import {
  mapApiJuditRequest,
  parseOptionalString,
  parseResponseDataFromResult,
  type ProcessoJuditRequest,
  type ProcessoResponseData,
} from "./utils/judit";

const NAO_INFORMADO = "Não informado";
const MOVIMENTACOES_POR_LAJE = 25;
const MESES_INICIAIS = 3;
const ALTURA_ESTIMADA_ITEM = 160;

interface ApiProcessoCliente {
  id?: number | string | null;
  nome?: string | null;
  documento?: string | null;
  tipo?: string | null;
}

interface ApiProcessoMovimentacao {
  id?: number | string | null;
  data?: string | null;
  tipo?: string | null;
  tipo_publicacao?: string | null;
  conteudo?: string | null;
  texto_categoria?: string | null;
  atualizado_em?: string | null;
  criado_em?: string | null;
}

interface ApiProcessoParte {
  id?: number | string | null;
  nome?: string | null;
  documento?: string | null;
  cpf?: string | null;
  cnpj?: string | null;
  tipo?: string | null;
  papel?: string | null;
  polo?: string | null;
  categoria?: string | null;
  advogado?: string | null;
  advogado_nome?: string | null;
  advogados?: Array<{ nome?: string | null }> | null;
}

interface ApiProcessoRelacionado {
  id?: number | string | null;
  numero?: string | null;
  grau?: string | null;
  classe?: string | null;
}

export interface ApiProcessoResponse {
  id?: number | string | null;
  numero?: string | null;
  status?: string | null;
  tipo?: string | null;
  classe_judicial?: string | null;
  assunto?: string | null;
  orgao_julgador?: string | null;
  jurisdicao?: string | null;
  advogado_responsavel?: string | null;
  data_distribuicao?: string | null;
  movimentacoes?: ApiProcessoMovimentacao[] | null;
  partes?: ApiProcessoParte[] | null;
  relacionados?: ApiProcessoRelacionado[] | null;
  consultas_api_count?: number | string | null;
  ultima_sincronizacao?: string | null;
  judit_tracking_id?: string | null;
  judit_tracking_hour_range?: string | null;
  judit_last_request?: ProcessoJuditRequest | null;
  uf?: string | null;
  municipio?: string | null;
  orgao_julgador_nome?: string | null;
  classe?: string | null;
  cliente?: ApiProcessoCliente | null;
  status_processo?: string | null;
  fase?: string | null;
  metadata?: Record<string, unknown> | null;
}

interface MovimentoLinha {
  texto: string;
  negrito?: boolean;
}

interface MovimentoNormalizado {
  id: string;
  data: Date | null;
  dataCurta: string | null;
  dataLonga: string | null;
  dias: number | null;
  linhas: MovimentoLinha[];
  observacao?: string | null;
}

interface GrupoMovimentacao {
  chave: string;
  rotulo: string;
  ano: number | null;
  mes: number | null;
  itens: MovimentoNormalizado[];
}

interface ParteNormalizada {
  nome: string;
  documento?: string | null;
  advogado?: string | null;
}

interface PartesAgrupadas {
  ativo: ParteNormalizada[];
  passivo: ParteNormalizada[];
  outros: Array<ParteNormalizada & { rotulo: string }>;
  total: number;
}

interface DadosProcesso {
  tribunalDeOrigem: string;
  comarca: string;
  cidade: string;
  estado: string;
  segmento: string;
  fase: string;
  distribuidoEm: string;
  valorDaCausa: string;
  classeProcessual: string;
  juizRelator: string;
  grau: string;
  orgaoJulgador: string;
  assuntos: string;
}

interface CabecalhoProcesso {
  numero: string;
  grau: string;
  ultimaMovimentacao: string | null;
  chips: string[];
  tribunal: string;
  valorDaCausa: string;
  distribuidoEm: string;
  partesResumo: ParteNormalizada[];
  classeProcessual: string;
}

interface ProcessoRelacionadoView {
  id: string;
  numero: string;
  grau: string;
  classe: string;
}

interface JuditResumo {
  requestId: string | null;
  status: string | null;
  atualizadoEm: string | null;
  origem: string | null;
  consultas: number;
  ultimaSincronizacao: string | null;
  trackingId: string | null;
  janela: string | null;
  anexos: Array<{ titulo: string; data: string | null; url: string | null }>;
}

export interface ProcessoViewModel {
  cabecalho: CabecalhoProcesso;
  dados: DadosProcesso;
  partes: PartesAgrupadas;
  movimentacoes: MovimentoNormalizado[];
  grupos: GrupoMovimentacao[];
  relacionados: ProcessoRelacionadoView[];
  judit: JuditResumo;
  responseData: ProcessoResponseData | null;
}

const TEXTO_DICA =
  "Use filtros avançados para identificar rapidamente decisões, despachos e publicações relevantes para o seu cliente.";

const KEYWORDS_ATIVO = [
  "ATIVO",
  "AUTOR",
  "REQUERENTE",
  "EXEQUENTE",
  "IMPETRANTE",
  "RECORRENTE",
  "AGRAVANTE",
];

const KEYWORDS_PASSIVO = [
  "PASSIVO",
  "RÉU",
  "REU",
  "REQUERIDO",
  "EXECUTADO",
  "IMPUGNADO",
  "RECORRIDO",
  "AGRAVADO",
];

const DATA_LONGA_OPCOES: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
};

const DATA_CURTA_OPCOES: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
};

const DATA_HORA_OPCOES: Intl.DateTimeFormatOptions = {
  ...DATA_LONGA_OPCOES,
  hour: "2-digit",
  minute: "2-digit",
};

const formatadorMoeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
});

function primeiroTextoValido(...valores: Array<string | null | undefined>): string {
  for (const valor of valores) {
    if (typeof valor === "string") {
      const texto = normalizarTexto(valor);
      if (texto) {
        return texto;
      }
    }
  }

  return "";
}

function formatarData(
  value: string | Date | null | undefined,
  tipo: "curta" | "longa" | "hora" = "longa",
): string | null {
  if (!value) {
    return null;
  }

  const data = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(data.getTime())) {
    return null;
  }

  const opcoes =
    tipo === "curta" ? DATA_CURTA_OPCOES : tipo === "hora" ? DATA_HORA_OPCOES : DATA_LONGA_OPCOES;

  return data.toLocaleDateString("pt-BR", opcoes);
}

function formatarMoeda(valor?: string | number | null): string {
  if (typeof valor === "number") {
    return formatadorMoeda.format(valor);
  }

  if (typeof valor === "string") {
    const numero = Number.parseFloat(valor.replace(/[^\d,-]/g, "").replace(",", "."));
    if (Number.isFinite(numero)) {
      return formatadorMoeda.format(numero);
    }
  }

  return NAO_INFORMADO;
}

function mascararDocumento(documento?: string | null): string | null {
  if (!documento) {
    return null;
  }

  const numeros = documento.replace(/\D+/g, "");

  if (numeros.length === 11) {
    return numeros.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }

  if (numeros.length === 14) {
    return numeros.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }

  return documento;
}

function normalizarGrau(valor?: string | null): string {
  if (!valor) {
    return NAO_INFORMADO;
  }

  const texto = normalizarTexto(valor).toUpperCase();

  if (!texto) {
    return NAO_INFORMADO;
  }

  if (/1/.test(texto) || texto.includes("PRIMEIRO")) {
    return "1º Grau";
  }

  if (/2/.test(texto) || texto.includes("SEGUNDO")) {
    return "2º Grau";
  }

  return valor;
}

function resolverChips(
  status?: string | null,
  fase?: string | null,
  etiquetas?: unknown,
): string[] {
  const chips = new Set<string>();
  const statusTexto = normalizarTexto(status ?? "");
  const faseTexto = normalizarTexto(fase ?? "");

  if (statusTexto) {
    chips.add(statusTexto);
  }

  if (faseTexto) {
    chips.add(faseTexto);
  }

  const statusFinal = `${statusTexto} ${faseTexto}`.toLowerCase();

  if (
    statusFinal.includes("final") ||
    statusFinal.includes("encerr") ||
    faseTexto.toLowerCase() === "arquivado"
  ) {
    chips.add("Finalizado");
  }

  if (Array.isArray(etiquetas)) {
    etiquetas.forEach((etiqueta) => {
      if (typeof etiqueta === "string" && etiqueta.trim()) {
        chips.add(etiqueta.trim());
      }
    });
  }

  return Array.from(chips);
}

function extrairAdvogado(parte: ApiProcessoParte): string | null {
  if (parte.advogado_nome) {
    const texto = normalizarTexto(parte.advogado_nome);
    if (texto) {
      return texto;
    }
  }

  if (parte.advogado) {
    const texto = normalizarTexto(parte.advogado);
    if (texto) {
      return texto;
    }
  }

  if (Array.isArray(parte.advogados) && parte.advogados.length > 0) {
    const primeiro = parte.advogados.find((adv) => normalizarTexto(adv?.nome));
    if (primeiro?.nome) {
      return normalizarTexto(primeiro.nome);
    }
  }

  return null;
}

function classificarParte(parte: ApiProcessoParte): "ativo" | "passivo" | "outros" {
  const polo = normalizarTexto(parte.polo ?? parte.tipo ?? parte.papel ?? parte.categoria).toUpperCase();

  if (KEYWORDS_ATIVO.some((palavra) => polo.includes(palavra))) {
    return "ativo";
  }

  if (KEYWORDS_PASSIVO.some((palavra) => polo.includes(palavra))) {
    return "passivo";
  }

  return "outros";
}

function formatarListaAssuntos(valor?: unknown): string {
  if (Array.isArray(valor)) {
    const itens = valor
      .map((item) => (typeof item === "string" ? normalizarTexto(item) : ""))
      .filter(Boolean);

    return itens.length > 0 ? itens.join(", ") : NAO_INFORMADO;
  }

  if (typeof valor === "string") {
    const texto = normalizarTexto(valor);
    return texto || NAO_INFORMADO;
  }

  return NAO_INFORMADO;
}

function mapearPartes(partes: ApiProcessoParte[] | null | undefined): PartesAgrupadas {
  if (!Array.isArray(partes) || partes.length === 0) {
    return { ativo: [], passivo: [], outros: [], total: 0 };
  }

  const agrupado: PartesAgrupadas = { ativo: [], passivo: [], outros: [], total: 0 };

  partes.forEach((parte) => {
    const nome = normalizarTexto(parte.nome ?? "");
    if (!nome) {
      return;
    }

    const documento = mascararDocumento(parte.documento ?? parte.cpf ?? parte.cnpj ?? null);
    const advogado = extrairAdvogado(parte);
    const categoria = classificarParte(parte);

    agrupado.total += 1;

    if (categoria === "ativo") {
      agrupado.ativo.push({ nome, documento, advogado });
      return;
    }

    if (categoria === "passivo") {
      agrupado.passivo.push({ nome, documento, advogado });
      return;
    }

    agrupado.outros.push({
      nome,
      documento,
      advogado,
      rotulo: normalizarTexto(parte.tipo ?? parte.papel ?? parte.categoria ?? "") || "OUTROS",
    });
  });

  return agrupado;
}

function extrairTribunal(
  cover: ProcessoResponseData["cover"] | undefined,
  uf?: string | null,
): string {
  const tribunalDireto = primeiroTextoValido(cover?.tribunal_sigla, cover?.tribunal);
  if (tribunalDireto) {
    return tribunalDireto;
  }

  if (uf) {
    const textoUf = normalizarTexto(uf).toUpperCase();
    if (textoUf.length === 2) {
      return `TJ${textoUf}`;
    }
  }

  return NAO_INFORMADO;
}

function construirMovimento(mov: ApiProcessoMovimentacao): MovimentoNormalizado | null {
  const id = mov.id !== null && mov.id !== undefined ? String(mov.id) : null;
  if (!id) {
    return null;
  }

  const dataBase = primeiroTextoValido(mov.data, mov.criado_em, mov.atualizado_em);
  const dataBruta = dataBase ? new Date(dataBase) : null;
  const data = dataBruta && !Number.isNaN(dataBruta.getTime()) ? dataBruta : null;
  const dataLonga = formatarData(data, "longa");
  const dataCurta = formatarData(data, "curta");
  const dias = diasDesde(data);

  const linhas: MovimentoLinha[] = [];
  const titulo = normalizarTexto(mov.tipo ?? "");
  if (titulo) {
    linhas.push({ texto: titulo, negrito: true });
  }

  const subtitulo = normalizarTexto(mov.tipo_publicacao ?? "");
  if (subtitulo) {
    linhas.push({ texto: subtitulo });
  }

  const conteudo = normalizarTexto(mov.conteudo ?? "");
  if (conteudo) {
    linhas.push(...conteudo.split("\n").map((texto) => ({ texto })));
  }

  const observacao = normalizarTexto(mov.texto_categoria ?? "");

  return {
    id,
    data,
    dataCurta: dataCurta,
    dataLonga: dataLonga,
    dias,
    linhas,
    observacao: observacao || null,
  };
}

export function mapApiProcessoToViewModel(processo: ApiProcessoResponse): ProcessoViewModel {
  const juditLastRequest = processo.judit_last_request
    ? mapApiJuditRequest(processo.judit_last_request)
    : null;
  const responseData = juditLastRequest
    ? parseResponseDataFromResult(juditLastRequest.result)
    : null;
  const cover = responseData?.cover ?? undefined;
  const metadata = (responseData?.metadata as Record<string, unknown> | undefined) ?? undefined;

  const juditMovimentacoes: ApiProcessoMovimentacao[] = Array.isArray(responseData?.movimentacoes)
    ? responseData!.movimentacoes
        .map((entrada, index) => {
          const data =
            parseOptionalString(
              entrada.data ??
                entrada.data_hora ??
                entrada.datahora ??
                entrada.occurred_at ??
                entrada.occurredAt ??
                entrada.created_at ??
                entrada.createdAt ??
                entrada.updated_at ??
                entrada.updatedAt,
            ) ?? null;

          const tipo =
            parseOptionalString(entrada.tipo) ??
            parseOptionalString(entrada.titulo) ??
            parseOptionalString(entrada.title) ??
            parseOptionalString(entrada.nome) ??
            parseOptionalString(entrada.name) ??
            parseOptionalString(entrada.evento) ??
            parseOptionalString(entrada.event) ??
            parseOptionalString(entrada.tipo_evento) ??
            null;

          const tipoPublicacao =
            parseOptionalString(entrada.tipo_publicacao) ??
            parseOptionalString(entrada.subtitulo) ??
            parseOptionalString(entrada.subtitle) ??
            parseOptionalString(entrada.categoria) ??
            parseOptionalString(entrada.category) ??
            null;

          const conteudo =
            parseOptionalString(entrada.conteudo) ??
            parseOptionalString(entrada.descricao) ??
            parseOptionalString(entrada.description) ??
            parseOptionalString(entrada.detalhes) ??
            parseOptionalString(entrada.details) ??
            parseOptionalString(entrada.mensagem) ??
            parseOptionalString(entrada.message) ??
            null;

          const textoCategoria =
            parseOptionalString(entrada.texto_categoria) ??
            parseOptionalString(entrada.observacao) ??
            parseOptionalString(entrada.observacoes) ??
            parseOptionalString(entrada.observation) ??
            null;

          const updatedAt =
            parseOptionalString(
              entrada.atualizado_em ??
                entrada.atualizadoEm ??
                entrada.updated_at ??
                entrada.updatedAt,
            ) ?? null;

          const createdAt =
            parseOptionalString(
              entrada.criado_em ??
                entrada.criadoEm ??
                entrada.created_at ??
                entrada.createdAt,
            ) ?? updatedAt ?? data ?? null;

          const idBase =
            parseOptionalString(entrada.id) ??
            parseOptionalString(entrada.identificador) ??
            parseOptionalString(entrada.reference) ??
            parseOptionalString(entrada.referencia) ??
            parseOptionalString(entrada.codigo) ??
            parseOptionalString(entrada.code) ??
            parseOptionalString(entrada.event_id) ??
            parseOptionalString(entrada.evento_id) ??
            parseOptionalString(entrada.numero) ??
            null;

          const fallbackIdSource = [data ?? "", tipo ?? "", tipoPublicacao ?? "", conteudo ?? "", textoCategoria ?? ""]
            .map((parte) => parte.toLowerCase())
            .join("|");

          const id = idBase ?? (fallbackIdSource ? `judit-${fallbackIdSource}` : `judit-${index}`);

          return {
            id,
            data,
            tipo,
            tipo_publicacao: tipoPublicacao,
            conteudo,
            texto_categoria: textoCategoria,
            atualizado_em: updatedAt,
            criado_em: createdAt,
          } satisfies ApiProcessoMovimentacao;
        })
        .filter((mov) => Boolean(mov.id))
    : [];

  const numero = primeiroTextoValido(cover?.numero, processo.numero) || NAO_INFORMADO;
  const grau =
    primeiroTextoValido(
      cover?.grau_processual,
      typeof metadata?.grau === "string" ? (metadata.grau as string) : null,
      processo.metadata && typeof processo.metadata.grau === "string"
        ? (processo.metadata.grau as string)
        : null,
    ) || processo.status_processo || NAO_INFORMADO;

  const movimentacoesOriginais = [
    ...(Array.isArray(processo.movimentacoes) ? processo.movimentacoes : []),
    ...juditMovimentacoes,
  ];
  const movimentacoesDeduplicadas = deduplicarMovimentacoes(movimentacoesOriginais);
  const movimentos = movimentacoesDeduplicadas
    .map(construirMovimento)
    .filter((mov): mov is MovimentoNormalizado => mov !== null);

  const grupos = agruparPorMes(movimentos);

  const ultimaMovimentacaoData = movimentos.reduce<Date | null>((acc, mov) => {
    if (mov.data && (!acc || mov.data > acc)) {
      return mov.data;
    }
    return acc;
  }, null);

  const ultimaMovimentacao = ultimaMovimentacaoData
    ? formatarData(ultimaMovimentacaoData, "curta")
    : null;

  const distribuicao =
    formatarData(
      primeiroTextoValido(cover?.data_distribuicao, processo.data_distribuicao),
      "curta",
    ) ?? NAO_INFORMADO;

  const valorCausa = formatarMoeda(
    cover?.valor_da_causa ??
      (typeof metadata?.valor_causa === "string" || typeof metadata?.valor_causa === "number"
        ? (metadata.valor_causa as string | number)
        : undefined),
  );

  const partes = mapearPartes((responseData?.partes as ApiProcessoParte[] | undefined) ?? processo.partes ?? []);

  const dados: DadosProcesso = {
    tribunalDeOrigem:
      primeiroTextoValido(cover?.tribunal, metadata?.tribunal as string | undefined) ||
      (processo.uf ? `${normalizarTexto(processo.uf)} — Tribunal não informado` : NAO_INFORMADO),
    comarca:
      primeiroTextoValido(cover?.comarca, metadata?.comarca as string | undefined) || NAO_INFORMADO,
    cidade: primeiroTextoValido(cover?.cidade, processo.municipio) || NAO_INFORMADO,
    estado: primeiroTextoValido(cover?.estado, processo.uf) || NAO_INFORMADO,
    segmento:
      primeiroTextoValido(
        cover?.segmento_justica,
        metadata?.segmento as string | undefined,
      ) || NAO_INFORMADO,
    fase: primeiroTextoValido(cover?.fase, processo.fase) || NAO_INFORMADO,
    distribuidoEm: distribuicao,
    valorDaCausa: valorCausa,
    classeProcessual:
      primeiroTextoValido(
        processo.classe_judicial,
        cover?.classe_processual,
        processo.classe,
      ) || NAO_INFORMADO,
    juizRelator:
      primeiroTextoValido(
        cover?.juiz_relator,
        metadata?.juiz as string | undefined,
        processo.advogado_responsavel,
      ) || NAO_INFORMADO,
    grau: normalizarGrau(
      primeiroTextoValido(
        cover?.grau_processual,
        metadata?.grau as string | undefined,
        processo.status_processo,
      ) || grau,
    ),
    orgaoJulgador:
      primeiroTextoValido(cover?.orgao_julgador, processo.orgao_julgador, processo.orgao_julgador_nome) ||
      NAO_INFORMADO,
    assuntos:
      formatarListaAssuntos(
        cover?.assuntos ?? metadata?.assuntos ?? processo.assunto ?? processo.metadata?.assunto,
      ),
  };

  const cabecalho: CabecalhoProcesso = {
    numero,
    grau: normalizarGrau(grau),
    ultimaMovimentacao,
    chips: resolverChips(
      processo.status ?? processo.status_processo,
      cover?.fase,
      metadata?.etiquetas,
    ),
    tribunal: extrairTribunal(cover, processo.uf),
    valorDaCausa: valorCausa,
    distribuidoEm: distribuicao,
    partesResumo: [...partes.ativo, ...partes.passivo].slice(0, 5),
    classeProcessual:
      primeiroTextoValido(
        processo.classe_judicial,
        cover?.classe_processual,
        processo.classe,
      ) || NAO_INFORMADO,
  };

  const relacionadosArray = (responseData?.relacionados as ApiProcessoRelacionado[] | undefined) ??
    (processo.relacionados ?? []);

  const relacionados: ProcessoRelacionadoView[] = Array.isArray(relacionadosArray)
    ? relacionadosArray
        .map((item, index) => {
          const numeroProcesso = primeiroTextoValido(item.numero) || NAO_INFORMADO;
          const id =
            item.id !== null && item.id !== undefined
              ? String(item.id)
              : numeroProcesso !== NAO_INFORMADO
                ? `${numeroProcesso}-${index}`
                : `relacionado-${index}`;
          return {
            id,
            numero: numeroProcesso,
            grau: normalizarGrau(item.grau ?? ""),
            classe: primeiroTextoValido(item.classe) || NAO_INFORMADO,
          };
        })
        .filter(Boolean)
    : [];

  const anexos = Array.isArray(responseData?.anexos)
    ? responseData!.anexos.map((anexo: any) => ({
        titulo: primeiroTextoValido(anexo.titulo, anexo.nome) || "Anexo",
        data: formatarData(
          primeiroTextoValido(anexo.attachment_date, anexo.created_at, anexo.updated_at),
          "hora",
        ),
        url: primeiroTextoValido(anexo.link, anexo.url, anexo.href),
      }))
    : [];

  const judit: JuditResumo = {
    requestId: juditLastRequest?.requestId ?? null,
    status: juditLastRequest?.status ?? null,
    atualizadoEm: formatarData(juditLastRequest?.updatedAt ?? null, "hora"),
    origem: juditLastRequest?.source ?? null,
    consultas: Number(processo.consultas_api_count ?? 0) || 0,
    ultimaSincronizacao: formatarData(processo.ultima_sincronizacao ?? null, "hora"),
    trackingId: processo.judit_tracking_id ?? null,
    janela: processo.judit_tracking_hour_range ?? null,
    anexos,
  };

  return {
    cabecalho,
    dados,
    partes,
    movimentacoes: movimentos,
    grupos,
    relacionados,
    judit,
    responseData,
  };
}
interface TimelineMesProps {
  grupo: GrupoMovimentacao;
  aberto: boolean;
  onToggle: (chave: string) => void;
  movimentacoesVisiveis: number;
  onVerMais: (chave: string) => void;
  virtualizado: boolean;
}

function TimelineMes({
  grupo,
  aberto,
  onToggle,
  movimentacoesVisiveis,
  onVerMais,
  virtualizado,
}: TimelineMesProps) {
  const [intervalo, setIntervalo] = useState({ inicio: 0, fim: movimentacoesVisiveis });

  useEffect(() => {
    setIntervalo({ inicio: 0, fim: movimentacoesVisiveis });
  }, [movimentacoesVisiveis, grupo.chave]);

  useEffect(() => {
    if (!aberto || !virtualizado) {
      return;
    }

    setIntervalo((atual) => {
      const fim = Math.min(grupo.itens.length, atual.inicio + Math.max(movimentacoesVisiveis, 30));
      return { inicio: atual.inicio, fim };
    });
  }, [aberto, virtualizado, movimentacoesVisiveis, grupo.itens.length]);

  const handleScroll = useCallback<UIEventHandler<HTMLDivElement>>(
    (event) => {
      if (!virtualizado) {
        return;
      }

      const alvo = event.currentTarget;
      const inicio = Math.max(0, Math.floor(alvo.scrollTop / ALTURA_ESTIMADA_ITEM) - 5);
      const capacidade = Math.ceil(alvo.clientHeight / ALTURA_ESTIMADA_ITEM) + 10;
      const fim = Math.min(grupo.itens.length, inicio + capacidade);

      setIntervalo({ inicio, fim });
    },
    [virtualizado, grupo.itens.length],
  );

  const itensRenderizados = virtualizado
    ? grupo.itens.slice(intervalo.inicio, intervalo.fim)
    : grupo.itens.slice(0, movimentacoesVisiveis);

  const paddingSuperior = virtualizado ? intervalo.inicio * ALTURA_ESTIMADA_ITEM : 0;
  const paddingInferior = virtualizado
    ? Math.max(0, (grupo.itens.length - intervalo.fim) * ALTURA_ESTIMADA_ITEM)
    : 0;

  return (
    <div className="rounded-xl border border-muted-foreground/10 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => onToggle(grupo.chave)}
        className="flex w-full items-center justify-between rounded-t-xl bg-muted/60 px-4 py-3 text-left text-sm font-medium text-muted-foreground"
        aria-expanded={aberto}
      >
        <span>{grupo.rotulo}</span>
        {aberto ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {aberto ? (
        <div
          className={cn(
            "relative px-4 py-4",
            virtualizado ? "max-h-[520px] overflow-y-auto" : "",
          )}
          onScroll={handleScroll}
        >
          <div
            className={cn(
              "relative",
              virtualizado ? "space-y-0" : "space-y-6",
            )}
            style={
              virtualizado
                ? { paddingTop: paddingSuperior, paddingBottom: paddingInferior }
                : undefined
            }
          >
            {itensRenderizados.map((item, index) => {
              const isUltimo =
                (!virtualizado && index === itensRenderizados.length - 1 &&
                  movimentacoesVisiveis >= grupo.itens.length) ||
                (virtualizado && intervalo.inicio + index === grupo.itens.length - 1);

              return (
                <div key={item.id} className="relative flex gap-6 pb-8 last:pb-2">
                  <div className="w-28 text-right">
                    <p className="text-sm font-semibold text-emerald-600">
                      {item.dataLonga ?? "Data não informada"}
                    </p>
                    {item.dias !== null && (
                      <p className="text-xs text-muted-foreground">{`${item.dias} dias`}</p>
                    )}
                  </div>
                  <div className="relative flex-1">
                    {!isUltimo && (
                      <span
                        className="absolute -left-6 top-4 h-[calc(100%+1rem)] w-px bg-emerald-200"
                        aria-hidden
                      />
                    )}
                    <span className="absolute -left-[1.6rem] top-3 h-3 w-3 rounded-full border-2 border-white bg-emerald-500 shadow" />
                    <div className="rounded-lg border border-muted-foreground/10 bg-muted/40 p-4">
                      <div className="space-y-2 text-sm">
                        {item.linhas.map((linha, linhaIndex) => (
                          <p
                            key={`${item.id}-linha-${linhaIndex}`}
                            className={cn(
                              "text-muted-foreground",
                              linha.negrito ? "font-semibold text-foreground" : "",
                            )}
                            style={{ whiteSpace: "pre-line" }}
                          >
                            {linha.texto}
                          </p>
                        ))}
                        {item.observacao && (
                          <p className="text-xs text-muted-foreground" style={{ whiteSpace: "pre-line" }}>
                            {item.observacao}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {(!virtualizado && movimentacoesVisiveis < grupo.itens.length) ||
          (virtualizado && intervalo.fim < grupo.itens.length) ? (
            <div className="pt-4 text-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onVerMais(grupo.chave)}
                aria-expanded={movimentacoesVisiveis < grupo.itens.length}
              >
                Ver mais movimentações
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
interface ProcessosRelacionadosProps {
  itens: ProcessoRelacionadoView[];
  onAbrir: (identificador: string) => void;
}

function ProcessosRelacionadosTabela({ itens, onAbrir }: ProcessosRelacionadosProps) {
  if (!itens.length) {
    return (
      <div className="rounded-lg border border-dashed border-muted-foreground/40 p-6 text-center text-sm text-muted-foreground">
        Nenhum processo relacionado
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-muted-foreground/10">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nº PROCESSO</TableHead>
            <TableHead>GRAU</TableHead>
            <TableHead>CLASSE</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {itens.map((item) => (
            <TableRow
              key={item.id}
              className="cursor-pointer hover:bg-muted/40"
              onClick={() => onAbrir(item.id)}
            >
              <TableCell>{item.numero}</TableCell>
              <TableCell>{item.grau}</TableCell>
              <TableCell>{item.classe}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

interface JuditCardProps {
  resumo: JuditResumo;
  onVerTodosAnexos: () => void;
}

function JuditCard({ resumo, onVerTodosAnexos }: JuditCardProps) {
  return (
    <div className="space-y-4">
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Status da última solicitação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="font-semibold text-foreground">ID:</span> {resumo.requestId ?? NAO_INFORMADO}
          </p>
          <p>
            <span className="font-semibold text-foreground">Status:</span> {resumo.status ?? NAO_INFORMADO}
          </p>
          <p>
            <span className="font-semibold text-foreground">Atualizado em:</span> {resumo.atualizadoEm ?? NAO_INFORMADO}
          </p>
          {resumo.origem ? (
            <p>
              <span className="font-semibold text-foreground">Origem:</span> {resumo.origem}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Resumo da automação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            <span className="font-semibold text-foreground">Consultas API:</span> {resumo.consultas}
          </p>
          <p>
            <span className="font-semibold text-foreground">Última sincronização:</span> {resumo.ultimaSincronizacao ?? NAO_INFORMADO}
          </p>
          <p>
            <span className="font-semibold text-foreground">Tracking:</span> {resumo.trackingId ?? NAO_INFORMADO}
          </p>
          <p>
            <span className="font-semibold text-foreground">Janela:</span> {resumo.janela ?? NAO_INFORMADO}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Anexos recebidos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          {resumo.anexos.slice(0, 3).map((anexo, index) => (
            <div key={`${anexo.titulo}-${index}`} className="rounded-md border border-muted-foreground/10 bg-muted/40 p-3">
              <p className="font-medium text-foreground">{anexo.titulo}</p>
              <p className="text-xs">{anexo.data ?? NAO_INFORMADO}</p>
              {anexo.url ? (
                <a
                  href={anexo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-primary underline-offset-2 hover:underline"
                >
                  Abrir documento
                </a>
              ) : null}
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={onVerTodosAnexos}>
            Ver todos
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

interface InformacoesProcessoProps {
  dados: DadosProcesso;
  partes: PartesAgrupadas;
}

export function InformacoesProcesso({ dados, partes }: InformacoesProcessoProps) {
  return (
    <div className="space-y-8">
      <section aria-labelledby="dados-processo" className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 id="dados-processo" className="text-lg font-semibold text-foreground">
            Dados do processo
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <CampoInformacao rotulo="Tribunal de origem" valor={dados.tribunalDeOrigem} />
          <CampoInformacao rotulo="Comarca" valor={dados.comarca} />
          <CampoInformacao rotulo="Cidade" valor={dados.cidade} />
          <CampoInformacao rotulo="Estado" valor={dados.estado} />
          <CampoInformacao rotulo="Segmento da justiça" valor={dados.segmento} />
          <CampoInformacao rotulo="Fase" valor={dados.fase} />
          <CampoInformacao rotulo="Distribuído em" valor={dados.distribuidoEm} />
          <CampoInformacao rotulo="Valor da causa" valor={dados.valorDaCausa} />
          <CampoInformacao rotulo="Classe processual" valor={dados.classeProcessual} />
          <CampoInformacao rotulo="Juiz/Relator" valor={dados.juizRelator} />
          <CampoInformacao rotulo="Grau do processo" valor={dados.grau} />
          <CampoInformacao rotulo="Órgão julgador" valor={dados.orgaoJulgador} />
          <CampoInformacao rotulo="Assuntos" valor={dados.assuntos} className="md:col-span-2" />
        </div>
      </section>

      <section aria-labelledby="partes-processo" className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 id="partes-processo" className="text-lg font-semibold text-foreground">
            Partes do processo
          </h2>
        </div>
        <div className="space-y-6">
          <SubsecaoPartes titulo="Polo ativo" itens={partes.ativo} />
          <SubsecaoPartes titulo="Polo passivo" itens={partes.passivo} mostrarAdvogado />
          {partes.outros.length ? (
            <div className="space-y-3">
              <h3 className="text-base font-semibold text-foreground">Outras partes</h3>
              <div className="space-y-2">
                {partes.outros.map((item, index) => (
                  <div key={`${item.rotulo}-${index}`} className="rounded-lg border border-muted-foreground/10 bg-muted/30 p-3">
                    <p className="text-sm font-semibold text-foreground">
                      {item.rotulo} — {item.nome}
                    </p>
                    {item.documento ? (
                      <p className="text-xs text-muted-foreground">Documento: {item.documento}</p>
                    ) : null}
                    {item.advogado ? (
                      <p className="text-xs text-muted-foreground">Advogado: {item.advogado}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

interface CampoInformacaoProps {
  rotulo: string;
  valor: string;
  className?: string;
}

function CampoInformacao({ rotulo, valor, className }: CampoInformacaoProps) {
  return (
    <div className={cn("rounded-lg border border-muted-foreground/10 bg-muted/30 p-4", className)}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{rotulo}</p>
      <p className="mt-1 text-sm text-foreground">{valor || NAO_INFORMADO}</p>
    </div>
  );
}

interface SubsecaoPartesProps {
  titulo: string;
  itens: ParteNormalizada[];
  mostrarAdvogado?: boolean;
}

function SubsecaoPartes({ titulo, itens, mostrarAdvogado }: SubsecaoPartesProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-base font-semibold text-foreground">{titulo}</h3>
      {itens.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum registro informado.</p>
      ) : (
        <div className="space-y-2">
          {itens.map((parte, index) => (
            <div key={`${titulo}-${parte.nome}-${index}`} className="rounded-lg border border-muted-foreground/10 bg-muted/30 p-3">
              <p className="text-sm font-semibold text-foreground">{parte.nome}</p>
              {parte.documento ? (
                <p className="text-xs text-muted-foreground">Documento: {parte.documento}</p>
              ) : null}
              {mostrarAdvogado && parte.advogado ? (
                <p className="text-xs text-muted-foreground">Advogado: {parte.advogado}</p>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
export default function VisualizarProcesso() {
  const { processoId } = useParams<{ processoId: string }>();
  const navigate = useNavigate();
  const location = useLocation<{ initialTab?: string }>();
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [viewModel, setViewModel] = useState<ProcessoViewModel | null>(null);
  const [abaAtiva, setAbaAtiva] = useState("movimentacao");
  const [mesesVisiveis, setMesesVisiveis] = useState(MESES_INICIAIS);
  const [mesesAbertos, setMesesAbertos] = useState<string[]>([]);
  const [movimentosPorMes, setMovimentosPorMes] = useState<Record<string, number>>({});

  useEffect(() => {
    if (location.state?.initialTab) {
      setAbaAtiva(location.state.initialTab);
    }
  }, [location.state]);

  useEffect(() => {
    let cancelado = false;

    const carregar = async () => {
      if (!processoId) {
        setErro("Processo não encontrado");
        setLoading(false);
        return;
      }

      setLoading(true);
      setErro(null);

      try {
        const resposta = await fetch(getApiUrl(`processos/${processoId}`), {
          headers: { Accept: "application/json" },
        });

        if (!resposta.ok) {
          throw new Error(`Não foi possível carregar o processo (${resposta.status})`);
        }

        const json = (await resposta.json()) as ApiProcessoResponse;
        const modelo = mapApiProcessoToViewModel(json);

        if (!cancelado) {
          setViewModel(modelo);
          setMesesAbertos(modelo.grupos.length ? [modelo.grupos[0].chave] : []);
          const inicial: Record<string, number> = {};
          modelo.grupos.forEach((grupo) => {
            inicial[grupo.chave] = MOVIMENTACOES_POR_LAJE;
          });
          setMovimentosPorMes(inicial);
          setMesesVisiveis(Math.min(MESES_INICIAIS, modelo.grupos.length));
        }
      } catch (error) {
        const mensagem = error instanceof Error ? error.message : "Erro ao carregar o processo";
        if (!cancelado) {
          setErro(mensagem);
          setViewModel(null);
        }
      } finally {
        if (!cancelado) {
          setLoading(false);
        }
      }
    };

    void carregar();

    return () => {
      cancelado = true;
    };
  }, [processoId]);

  const totalMovimentacoes = viewModel?.movimentacoes.length ?? 0;
  const usarVirtualizacao = totalMovimentacoes > 300;

  const gruposVisiveis = useMemo(() => {
    if (!viewModel) {
      return [] as GrupoMovimentacao[];
    }

    return viewModel.grupos.slice(0, mesesVisiveis);
  }, [viewModel, mesesVisiveis]);

  const handleToggleMes = useCallback(
    (chave: string) => {
      setMesesAbertos((anteriores) =>
        anteriores.includes(chave)
          ? anteriores.filter((item) => item !== chave)
          : [...anteriores, chave],
      );
    },
    [],
  );

  const handleVerMaisMovimentos = useCallback(
    (chave: string) => {
      setMovimentosPorMes((anteriores) => ({
        ...anteriores,
        [chave]: (anteriores[chave] ?? MOVIMENTACOES_POR_LAJE) + MOVIMENTACOES_POR_LAJE,
      }));
    },
    [],
  );

  const handleCarregarMaisMeses = useCallback(() => {
    setMesesVisiveis((valor) => (viewModel ? Math.min(viewModel.grupos.length, valor + 2) : valor));
  }, [viewModel]);

  const handleAbrirRelacionado = useCallback(
    (identificador: string) => {
      navigate(`/processos/${identificador}`);
    },
    [navigate],
  );

  const handleVerTodosAnexos = useCallback(() => {
    setAbaAtiva("judit");
  }, []);

  const conteudoMovimentacoes = useMemo(() => {
    if (!viewModel) {
      return null;
    }

    return (
      <div className="space-y-6">
        <Alert className="border-amber-300 bg-amber-50 text-amber-900">
          <AlertTitle className="flex items-center gap-2 text-sm font-semibold">
            <Info className="h-4 w-4" /> Dica
          </AlertTitle>
          <AlertDescription className="text-sm text-amber-900/80">
            {TEXTO_DICA}{" "}
            <Button variant="link" size="sm" className="h-auto p-0 align-baseline">
              Configurar filtros
            </Button>
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          {gruposVisiveis.map((grupo) => (
            <TimelineMes
              key={grupo.chave}
              grupo={{ ...grupo, itens: grupo.itens }}
              aberto={mesesAbertos.includes(grupo.chave)}
              onToggle={handleToggleMes}
              movimentacoesVisiveis={movimentosPorMes[grupo.chave] ?? MOVIMENTACOES_POR_LAJE}
              onVerMais={handleVerMaisMovimentos}
              virtualizado={usarVirtualizacao}
            />
          ))}
        </div>

        {viewModel.grupos.length > gruposVisiveis.length ? (
          <div className="text-center">
            <Button
              variant="outline"
              onClick={handleCarregarMaisMeses}
              aria-expanded={gruposVisiveis.length < viewModel.grupos.length}
            >
              Carregar mais meses
            </Button>
          </div>
        ) : null}
      </div>
    );
  }, [
    viewModel,
    gruposVisiveis,
    mesesAbertos,
    movimentosPorMes,
    usarVirtualizacao,
    handleToggleMes,
    handleVerMaisMovimentos,
    handleCarregarMaisMeses,
  ]);

  const conteudoInformacoes = viewModel ? (
    <InformacoesProcesso dados={viewModel.dados} partes={viewModel.partes} />
  ) : null;

  const conteudoRelacionados = viewModel ? (
    <ProcessosRelacionadosTabela itens={viewModel.relacionados} onAbrir={handleAbrirRelacionado} />
  ) : null;

  const conteudoJudit = viewModel ? (
    <JuditCard resumo={viewModel.judit} onVerTodosAnexos={handleVerTodosAnexos} />
  ) : null;

  return (
    <div className="space-y-6">
      <header className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
            </Button>
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbPage>Processos</BreadcrumbPage>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>Visualizar</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-5 w-1/3" />
          </div>
        ) : erro ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Erro ao carregar o processo</AlertTitle>
            <AlertDescription>{erro}</AlertDescription>
          </Alert>
        ) : viewModel ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold text-foreground">{viewModel.cabecalho.numero}</h1>
              <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                {viewModel.cabecalho.grau}
              </Badge>
              {viewModel.cabecalho.ultimaMovimentacao ? (
                <span className="text-sm text-muted-foreground">
                  Última movimentação em {viewModel.cabecalho.ultimaMovimentacao}
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {viewModel.cabecalho.chips.map((chip) => (
                <Badge key={chip} className="bg-slate-100 text-slate-700">
                  {chip}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}

        {viewModel ? (
          <div className="grid gap-4 lg:grid-cols-[repeat(4,minmax(0,1fr))_240px]">
            <Card className="border-emerald-200 bg-emerald-50 text-emerald-900">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold uppercase tracking-wide text-emerald-800">
                  Tribunal
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xl font-semibold">{viewModel.cabecalho.tribunal}</CardContent>
            </Card>
            <Card className="border-emerald-200 bg-emerald-50 text-emerald-900">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold uppercase tracking-wide text-emerald-800">
                  Valor da causa
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xl font-semibold">{viewModel.cabecalho.valorDaCausa}</CardContent>
            </Card>
            <Card className="border-emerald-200 bg-emerald-50 text-emerald-900">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold uppercase tracking-wide text-emerald-800">
                  Distribuído em
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xl font-semibold">{viewModel.cabecalho.distribuidoEm}</CardContent>
            </Card>
            <Card className="border-emerald-200 bg-emerald-50 text-emerald-900">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold uppercase tracking-wide text-emerald-800">
                  Partes
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <span className="text-xl font-semibold">{viewModel.partes.total}</span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-emerald-800">
                      Ver lista
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    <DropdownMenuLabel>Partes cadastradas</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {viewModel.cabecalho.partesResumo.length ? (
                      viewModel.cabecalho.partesResumo.map((parte, index) => (
                        <DropdownMenuItem key={`${parte.nome}-${index}`} className="flex flex-col items-start">
                          <span className="font-medium text-foreground">{parte.nome}</span>
                          {parte.documento ? (
                            <span className="text-xs text-muted-foreground">{parte.documento}</span>
                          ) : null}
                        </DropdownMenuItem>
                      ))
                    ) : (
                      <DropdownMenuItem className="text-muted-foreground">
                        Nenhuma parte informada
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-primary bg-primary/10 text-primary">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold uppercase tracking-wide">
                  Classe processual
                </CardTitle>
              </CardHeader>
              <CardContent className="text-lg font-semibold text-primary">
                {viewModel.cabecalho.classeProcessual}
              </CardContent>
            </Card>
          </div>
        ) : null}
      </header>

      <section>
        <Tabs value={abaAtiva} onValueChange={setAbaAtiva} className="space-y-4">
          <TabsList>
            <TabsTrigger value="movimentacao">Movimentação processual</TabsTrigger>
            <TabsTrigger value="informacoes">Informações</TabsTrigger>
            <TabsTrigger value="relacionados">Processos relacionados</TabsTrigger>
            <TabsTrigger value="judit">JUDIT IA</TabsTrigger>
          </TabsList>
          <TabsContent value="movimentacao" className="space-y-4">
            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, index) => (
                  <Skeleton key={index} className="h-32 w-full" />
                ))}
              </div>
            ) : erro ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Erro ao carregar movimentações</AlertTitle>
                <AlertDescription>{erro}</AlertDescription>
              </Alert>
            ) : (
              conteudoMovimentacoes
            )}
          </TabsContent>
          <TabsContent value="informacoes">
            {loading ? (
              <Skeleton className="h-96 w-full" />
            ) : erro ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Erro ao carregar informações</AlertTitle>
                <AlertDescription>{erro}</AlertDescription>
              </Alert>
            ) : (
              conteudoInformacoes
            )}
          </TabsContent>
          <TabsContent value="relacionados">
            {loading ? (
              <Skeleton className="h-48 w-full" />
            ) : erro ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Erro ao carregar relacionados</AlertTitle>
                <AlertDescription>{erro}</AlertDescription>
              </Alert>
            ) : (
              conteudoRelacionados
            )}
          </TabsContent>
          <TabsContent value="judit">
            {loading ? (
              <Skeleton className="h-64 w-full" />
            ) : erro ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Erro ao carregar informações da JUDIT</AlertTitle>
                <AlertDescription>{erro}</AlertDescription>
              </Alert>
            ) : (
              conteudoJudit
            )}
          </TabsContent>
        </Tabs>
      </section>
    </div>
  );
}
