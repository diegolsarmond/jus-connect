import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type FormEvent,
  type UIEventHandler,
} from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, ChevronDown, ChevronUp, Loader2, Sparkles } from "lucide-react";
import { ModernTimeline } from "@/components/ui/modern-timeline";

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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
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

import { getApiUrl } from "@/lib/api";
import { fetchIntegrationApiKeys, generateAiText } from "@/lib/integrationApiKeys";
import { cn } from "@/lib/utils";

import { agruparPorMes, deduplicarMovimentacoes, normalizarTexto } from "./utils/processo-ui";
import { SafeMarkdown } from "@/components/ui/safe-markdown";
import { useToast } from "@/components/ui/use-toast";

const NAO_INFORMADO = "Não informado";
const MOVIMENTACOES_POR_LAJE = 25;
const MESES_INICIAIS = 6;
const ALTURA_ESTIMADA_ITEM = 200;
const LIMITE_CONTEUDO_RESUMO = 400;
const LIMITE_LINHAS_RESUMO = 6;

interface FiltroMovimentacaoOpcoes {
  tipo?: string | null;
  inicio?: string | null;
  fim?: string | null;
}

function normalizarDataFiltro(valor: string | null | undefined, fimDoDia = false): Date | null {
  if (!valor) {
    return null;
  }

  const data = new Date(valor);

  if (Number.isNaN(data.getTime())) {
    return null;
  }

  if (fimDoDia) {
    data.setHours(23, 59, 59, 999);
  } else {
    data.setHours(0, 0, 0, 0);
  }

  return data;
}

function normalizarTipoFiltro(valor?: string | null): string {
  if (typeof valor !== "string") {
    return "";
  }

  return valor.trim().toLowerCase();
}

export function filtrarMovimentacoes(
  movimentacoes: MovimentacaoProcesso[],
  { tipo, inicio, fim }: FiltroMovimentacaoOpcoes,
): MovimentacaoProcesso[] {
  if (!Array.isArray(movimentacoes) || movimentacoes.length === 0) {
    return [];
  }

  const tipoNormalizado = normalizarTipoFiltro(tipo);
  const inicioData = normalizarDataFiltro(inicio, false);
  const fimData = normalizarDataFiltro(fim, true);

  return movimentacoes.filter((mov) => {
    if (tipoNormalizado) {
      const tipoMov = normalizarTipoFiltro(mov.stepType);
      if (!tipoMov || tipoMov !== tipoNormalizado) {
        return false;
      }
    }

    if (inicioData || fimData) {
      if (!mov.data) {
        return false;
      }

      if (inicioData && mov.data < inicioData) {
        return false;
      }

      if (fimData && mov.data > fimData) {
        return false;
      }
    }

    return true;
  });
}

function montarPromptResumoMovimentacao(movimentacao: MovimentacaoProcesso): string {
  const tipoAndamento = movimentacao.stepType?.trim() || "movimentação processual";
  const partes: string[] = [
      `Responda de forma direta ao(à) ${tipoAndamento} descrito abaixo. Traga frases objetivas com decisões, determinações, pedidos e próximos passos, sem introduções ou menções a resumo.`,
  ];


  const conteudoNormalizado = normalizarTexto(movimentacao.conteudo) || "Sem conteúdo textual informado.";
  partes.push(`Conteúdo:\n${conteudoNormalizado}`);

  return partes.filter(Boolean).join("\n\n");
}

function prepararResumoIa(conteudo?: string | null): string | null {
  if (!conteudo) {
    return null;
  }

  const textoNormalizado = normalizarTexto(conteudo);

  if (!textoNormalizado) {
    return null;
  }

  const paragrafoUnico = textoNormalizado
    .split("\n")
    .map((linha) => linha.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (!paragrafoUnico) {
    return null;
  }

  const frases = paragrafoUnico
    .split(/(?<=[.!?])\s+/)
    .filter((frase) => frase.trim().length > 0);
  let frasesParaResumo = frases;

  if (frases.length > 0) {
    const primeiraFraseNormalizada = frases[0].trim().toLowerCase();
    const prefixosRemoviveis = ["resumo", "síntese", "este documento"];

    if (prefixosRemoviveis.some((prefixo) => primeiraFraseNormalizada.startsWith(prefixo))) {
      const restantes = frases.slice(1);
      frasesParaResumo = restantes.length > 0 ? restantes : frases;
    }
  }

  const resumoConciso = frasesParaResumo.slice(0, 10).join(" ") || paragrafoUnico;

  const resumoLimpo = resumoConciso.replace(/\*\*/g, "");

  return resumoLimpo || resumoConciso;
}

interface ApiProcessoCounty {
  name?: string | null;
  city?: string | null;
  state?: string | null;
}

interface ApiProcessoStepTags {
  formatted?: string | null;
  [key: string]: unknown;
}

interface ApiProcessoStep {
  id?: number | string | null;
  step_id?: string | null;
  date?: string | null;
  title?: string | null;
  description?: string | null;
  type?: string | null;
  category?: string | null;
  step_date?: string | null;
  step_type?: string | null;
  tipo_andamento?: string | null;
  content?: string | null;
  private?: boolean | null;
  tags?: ApiProcessoStepTags | null;
}

interface ApiProcessoMovimentacao {
  id?: number | string | null;
  data?: string | null;
  tipo?: string | null;
  tipo_andamento?: string | null;
  tipo_publicacao?: string | null;
  classificacao_predita?: unknown;
  conteudo?: string | null;
  texto_categoria?: string | null;
  sigiloso?: unknown;
}

interface ApiProcessoAttachment {
  id?: number | string | null;
  id_andamento?: number | string | null;
  id_anexo?: number | string | null;
  title?: string | null;
  date?: string | null;
  url?: string | null;
  attachment_id?: number | string | null;
  attachment_name?: string | null;
  attachment_date?: string | null;
  attachment_url?: string | null;
  nome?: string | null;
  tipo?: string | null;
  data_cadastro?: string | null;
  data_andamento?: string | null;
  instancia_processo?: string | null;
  crawl_id?: string | null;
  content?: string | null;
  status?: string | null;
  extension?: string | null;
}

interface ApiCodigoNome {
  code?: string | null;
  name?: string | null;
}

interface ApiProcessoRelatedLawsuit {
  code?: string | null;
  name?: string | null;
  phase?: string | null;
  status?: string | null;
  area?: string | null;
  instance?: string | null;
}

interface ApiProcessoLawyer {
  name?: string | null;
  document?: string | null;
}

interface ApiProcessoRepresentative {
  name?: string | null;
  document?: string | null;
}

interface ApiProcessoParticipant {
  id?: number | string | null;
  name?: string | null;
  document?: string | null;
  role?: string | null;
  side?: string | null;
  type?: string | null;
  person_type?: string | null;
  party_role?: string | null;
  representatives?: ApiProcessoRepresentative[] | null;
  lawyers?: ApiProcessoLawyer[] | null;
}

export interface ApiProcessoResponse {
  id?: number | string | null;
  code?: string | null;
  name?: string | null;
  phase?: string | null;
  status?: string | null;
  area?: string | null;
  tribunal_acronym?: string | null;
  tribunal?: string | null;
  tribunal_name?: string | null;
  county?: ApiProcessoCounty | string | null;
  instance?: string | null;
  instancia?: string | null;
  justice_description?: string | null;
  subjects?: Array<string | ApiCodigoNome | null> | null;
  classifications?: Array<string | ApiCodigoNome | null> | null;
  steps?: ApiProcessoStep[] | null;
  attachments?: ApiProcessoAttachment[] | null;
  related_lawsuits?: ApiProcessoRelatedLawsuit[] | null;
  movimentacoes?: ApiProcessoMovimentacao[] | null;
  tags?:
    | Array<string | null>
    | ({
        list?: Array<string | null> | null;
        precatory?: boolean | string | null;
        free_justice?: boolean | string | null;
        secrecy_level?: string | null;
      } & Record<string, unknown>)
    | null;
  precatory?: boolean | string | null;
  free_justice?: boolean | string | null;
  secrecy_level?: string | null;
  amount?: string | number | null;
  distribution_date?: string | null;
  updated_at?: string | null;
  atualizado_em?: string | null;
  participants?: ApiProcessoParticipant[] | null;
  parties?: ApiProcessoParticipant[] | null;
  metadata?: Record<string, unknown> | null;
  numero?: string | null;
  classe_judicial?: string | null;
  assunto?: string | null;
  jurisdicao?: string | null;
  data_distribuicao?: string | null;
  consultas_api_count?: number | null;
  movimentacoes_count?: number | null;
  ultima_sincronizacao?: string | null;
}

interface MovimentacaoProcesso extends MovimentoComIdEData {
  id: string;
  data: Date | null;
  dataOriginal: string | null;
  dataFormatada: string | null;
  stepType: string | null;
  tipoAndamento: string | null;
  conteudo: string | null;
  privado: boolean;
  tags: ApiProcessoStepTags | null;
  anexos: AnexoProcesso[];
}

interface GrupoMovimentacao {
  chave: string;
  rotulo: string;
  ano: number | null;
  mes: number | null;
  itens: MovimentacaoProcesso[];
}

interface AnexoProcesso {
  id: string;
  titulo: string;
  data: string | null;
  url: string | null;
  idAndamento: string | null;
  instancia: string | null;
  idAnexo: string | null;
  tipo: string | null;
  crawlId: string | null;
}

interface ParteNormalizada {
  nome: string;
  documento?: string | null;
  tipoPessoa?: string | null;
  advogados: string[];
  polo?: "ativo" | "passivo" | null;
  papel?: string | null;
}

interface PartesAgrupadas {
  ativo: ParteNormalizada[];
  passivo: ParteNormalizada[];
  testemunhas: ParteNormalizada[];
  outros: ParteNormalizada[];
  total: number;
}

interface CodigoNomeItem {
  codigo: string;
  nome: string;
}

interface DadosProcesso {
  tribunal: string;
  tribunalSigla: string;
  justiceDescription: string;
  instance: string;
  area: string;
  county: string;
  city: string;
  state: string;
  distributionDate: string;
  amount: string;
  subjects: CodigoNomeItem[];
  classifications: CodigoNomeItem[];
  tags: string[];
  precatory: string;
  freeJustice: string;
  secrecyLevel: string;
  updatedAt: string;
}

interface CabecalhoProcesso {
  codigo: string;
  nome: string;
  status: string;
  fase: string;
  area: string;
  cidadeEstado: string;
  comarca: string;
  tribunal: string;
  distribuidoEm: string;
  valorDaCausa: string;
  instance: string;
  justiceDescription: string;
  ultimaAtualizacao: string | null;
  tags: string[];
  subjects: string[];
}

interface ProcessoRelacionadoView {
  id: string;
  codigo: string;
  nome: string;
  instancia: string;
}

export interface ProcessoViewModel {
  cabecalho: CabecalhoProcesso;
  dados: DadosProcesso;
  partes: PartesAgrupadas;
  movimentacoes: MovimentacaoProcesso[];
  grupos: GrupoMovimentacao[];
  relacionados: ProcessoRelacionadoView[];
  anexos: AnexoProcesso[];
  numeroCnj: string | null;
  instanciaProcesso: string | null;
}

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

  const dia = data.getDate().toString().padStart(2, "0");
  const mes = (data.getMonth() + 1).toString().padStart(2, "0");
  const ano = data.getFullYear().toString();
  const base = `${dia}/${mes}/${ano}`;

  if (tipo === "curta") {
    return base;
  }

  const hora = data.getHours().toString().padStart(2, "0");
  const minuto = data.getMinutes().toString().padStart(2, "0");

  return `${base} ${hora}:${minuto}`;
}

function obterChaveDia(valor: string | Date | null | undefined): string | null {
  if (!valor) {
    return null;
  }

  const data = valor instanceof Date ? valor : new Date(valor);

  if (Number.isNaN(data.getTime())) {
    return null;
  }

  const ano = data.getFullYear().toString().padStart(4, "0");
  const mes = (data.getMonth() + 1).toString().padStart(2, "0");
  const dia = data.getDate().toString().padStart(2, "0");

  return `${ano}-${mes}-${dia}`;
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

  const textoNormalizado = normalizarTexto(documento);
  const numeros = textoNormalizado.replace(/\D+/g, "");

  if (!numeros) {
    return textoNormalizado || null;
  }

  if (numeros.length <= 4) {
    return numeros;
  }

  return numeros.replace(/\d(?=\d{4})/g, "*");
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

function normalizarTipoPessoa(tipo?: string | null): string | null {
  const texto = normalizarTexto(tipo ?? "");

  if (!texto) {
    return null;
  }

  const upper = texto.replace(/\s+/g, "_").toUpperCase();

  if (["NATURAL_PERSON", "PESSOA_FISICA", "FISICA", "INDIVIDUAL"].includes(upper)) {
    return "Pessoa física";
  }

  if (["LEGAL_ENTITY", "LEGAL_PERSON", "PESSOA_JURIDICA", "JURIDICA", "COMPANY"].includes(upper)) {
    return "Pessoa jurídica";
  }

  if (["PUBLIC_AGENCY", "PUBLIC_ENTITY", "ORGAO_PUBLICO", "ENTIDADE_PUBLICA"].includes(upper)) {
    return "Órgão público";
  }

  return texto
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letra) => letra.toUpperCase());
}

function normalizarSide(side?: string | null): "ativo" | "passivo" | null {
  const texto = normalizarTexto(side ?? "");

  if (!texto) {
    return null;
  }

  const upper = texto.replace(/\s+/g, "_").toUpperCase();

  if (
    [
      "ATIVO",
      "PLAINTIFF",
      "AUTHOR",
      "CLAIMANT",
      "REQUERENTE",
      "EXEQUENTE",
      "IMPETRANTE",
      "RECORRENTE",
      "AGRAVANTE",
      "APPELLANT",
    ].includes(upper)
  ) {
    return "ativo";
  }

  if (
    [
      "PASSIVO",
      "DEFENDANT",
      "RESPONDENT",
      "REQUERIDO",
      "EXECUTADO",
      "IMPUGNADO",
      "RECORRIDO",
      "AGRAVADO",
      "APPELLEE",
    ].includes(upper)
  ) {
    return "passivo";
  }

  return null;
}

function formatarRole(role?: string | null): string | null {
  const texto = normalizarTexto(role ?? "");

  if (!texto) {
    return null;
  }

  return texto
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letra) => letra.toUpperCase());
}

function ehTestemunha(role?: string | null): boolean {
  const texto = normalizarTexto(role ?? "");

  if (!texto) {
    return false;
  }

  const upper = texto.replace(/\s+/g, "_").toUpperCase();

  return upper.includes("TESTEMUNHA") || upper.includes("WITNESS");
}

function extrairAdvogados(parte: ApiProcessoParticipant): string[] {
  const listaPrincipais = Array.isArray(parte.lawyers) ? parte.lawyers : [];
  const advogados = listaPrincipais
    .map((advogado) => {
      const nome = normalizarTexto(advogado?.name ?? "");
      const documento = mascararDocumento(advogado?.document ?? null);

      if (!nome && !documento) {
        return null;
      }

      if (nome && documento) {
        return `${nome} (${documento})`;
      }

      return nome || documento;
    })
    .filter((valor): valor is string => Boolean(valor));

  if (advogados.length > 0) {
    return advogados;
  }

  if (Array.isArray(parte.representatives)) {
    return parte.representatives
      .map((representante) => normalizarTexto(representante?.name ?? ""))
      .filter((nome): nome is string => Boolean(nome));
  }

  return [];
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

function mapearPartes(partes: ApiProcessoParticipant[] | null | undefined): PartesAgrupadas {
  if (!Array.isArray(partes) || partes.length === 0) {
    return { ativo: [], passivo: [], testemunhas: [], outros: [], total: 0 };
  }

  const agrupado: PartesAgrupadas = {
    ativo: [],
    passivo: [],
    testemunhas: [],
    outros: [],
    total: 0,
  };

  partes.forEach((parte) => {
    const nome = normalizarTexto(parte.name ?? "");
    if (!nome) {
      return;
    }

    const documento = mascararDocumento(parte.document ?? null);
    const tipoPessoa = normalizarTipoPessoa(parte.person_type);
    const advogados = extrairAdvogados(parte);
    const polo = normalizarSide(parte.side ?? parte.type ?? parte.role ?? "");
    const papel = formatarRole(parte.party_role ?? parte.role ?? parte.type ?? parte.side ?? "");

    const registro: ParteNormalizada = {
      nome,
      documento: documento || undefined,
      tipoPessoa: tipoPessoa || undefined,
      advogados,
      polo,
      papel: papel || undefined,
    };

    agrupado.total += 1;

    if (ehTestemunha(parte.party_role)) {
      agrupado.testemunhas.push(registro);
      return;
    }

    if (polo === "ativo") {
      agrupado.ativo.push(registro);
      return;
    }

    if (polo === "passivo") {
      agrupado.passivo.push(registro);
      return;
    }

    agrupado.outros.push(registro);
  });

  return agrupado;
}

function normalizarListaDeStrings(valores?: Array<string | null> | null): string[] {
  if (!Array.isArray(valores)) {
    return [];
  }

  return valores
    .map((valor) => normalizarTexto(valor ?? ""))
    .filter((valor): valor is string => Boolean(valor));
}

function interpretarBooleano(valor: unknown): boolean | null {
  if (typeof valor === "boolean") {
    return valor;
  }

  if (typeof valor === "number") {
    if (valor === 1) {
      return true;
    }

    if (valor === 0) {
      return false;
    }
  }

  if (typeof valor === "string") {
    const texto = normalizarTexto(valor);

    if (!texto) {
      return null;
    }

    const comparacao = texto.toLowerCase();

    if (["sim", "s", "true", "1", "yes"].includes(comparacao)) {
      return true;
    }

    if (["não", "nao", "n", "false", "0", "no"].includes(comparacao)) {
      return false;
    }
  }

  return null;
}

function formatarIndicadorBooleano(valor: unknown): string {
  const booleano = interpretarBooleano(valor);

  if (booleano === true) {
    return "Sim";
  }

  if (booleano === false) {
    return "Não";
  }

  if (typeof valor === "string") {
    const texto = normalizarTexto(valor);
    return texto || NAO_INFORMADO;
  }

  if (typeof valor === "number") {
    return String(valor);
  }

  return NAO_INFORMADO;
}

function formatarSecrecyLevel(valor: unknown): string {
  if (typeof valor === "string") {
    const texto = normalizarTexto(valor);
    return texto || NAO_INFORMADO;
  }

  return NAO_INFORMADO;
}

function mapearCodigoNomeLista(
  valores: Array<string | ApiCodigoNome | null> | null | undefined,
  prefixoFallback: string,
): CodigoNomeItem[] {
  if (!Array.isArray(valores)) {
    return [];
  }

  return valores
    .map((valor, index) => {
      if (!valor) {
        return null;
      }

      if (typeof valor === "string") {
        const texto = normalizarTexto(valor);

        if (!texto) {
          return null;
        }

        const marcador = " - ";
        const posicaoSeparador = texto.indexOf(marcador);

        if (posicaoSeparador > -1) {
          const codigo = normalizarTexto(texto.slice(0, posicaoSeparador));
          const nome = normalizarTexto(texto.slice(posicaoSeparador + marcador.length));

          return {
            codigo: codigo || `${prefixoFallback} ${index + 1}`,
            nome: nome || codigo || NAO_INFORMADO,
          };
        }

        return {
          codigo: `${prefixoFallback} ${index + 1}`,
          nome: texto,
        };
      }

      const codigo = normalizarTexto(valor.code ?? "");
      const nome = normalizarTexto(valor.name ?? "");

      if (!codigo && !nome) {
        return null;
      }

      return {
        codigo: codigo || `${prefixoFallback} ${index + 1}`,
        nome: nome || codigo || NAO_INFORMADO,
      };
    })
    .filter((item): item is CodigoNomeItem => Boolean(item));
}

function extrairTagsEIndicadores(processo: ApiProcessoResponse): {
  tags: string[];
  precatory: string;
  freeJustice: string;
  secrecyLevel: string;
} {
  const bruto = processo.tags;
  let precatoryFonte: unknown = processo.precatory;
  let freeJusticeFonte: unknown = processo.free_justice;
  let secrecyFonte: unknown = processo.secrecy_level;
  const lista: string[] = [];

  if (Array.isArray(bruto)) {
    lista.push(...normalizarListaDeStrings(bruto));
  } else if (bruto && typeof bruto === "object") {
    const objeto = bruto as Record<string, unknown>;

    if (Array.isArray(objeto.list)) {
      lista.push(...normalizarListaDeStrings(objeto.list as Array<string | null>));
    }

    if (precatoryFonte === undefined || precatoryFonte === null) {
      precatoryFonte = objeto.precatory;
    }

    if (freeJusticeFonte === undefined || freeJusticeFonte === null) {
      freeJusticeFonte = objeto.free_justice;
    }

    if (secrecyFonte === undefined || secrecyFonte === null) {
      secrecyFonte = objeto.secrecy_level;
    }

    const extras: Array<string | null> = [];

    Object.entries(objeto).forEach(([chave, valor]) => {
      if (["list", "precatory", "free_justice", "secrecy_level"].includes(chave)) {
        return;
      }

      if (typeof valor === "string" || typeof valor === "number") {
        extras.push(String(valor));
      }
    });

    if (extras.length) {
      lista.push(...normalizarListaDeStrings(extras));
    }
  }

  const tagsUnicas = Array.from(new Set(lista));

  return {
    tags: tagsUnicas,
    precatory: formatarIndicadorBooleano(precatoryFonte),
    freeJustice: formatarIndicadorBooleano(freeJusticeFonte),
    secrecyLevel: formatarSecrecyLevel(secrecyFonte),
  };
}

function extrairLocalidade(valor: ApiProcessoResponse["county"]): {
  comarca: string;
  cidade: string;
  estado: string;
  cidadeEstado: string;
} {
  const padrao = {
    comarca: NAO_INFORMADO,
    cidade: NAO_INFORMADO,
    estado: NAO_INFORMADO,
    cidadeEstado: NAO_INFORMADO,
  };

  if (!valor) {
    return padrao;
  }

  if (typeof valor === "string") {
    const texto = normalizarTexto(valor);
    if (!texto) {
      return padrao;
    }

    let cidade = texto;
    let estado = "";

    ["/", "-", "–", ","].some((separador) => {
      if (!texto.includes(separador)) {
        return false;
      }

      const partes = texto.split(separador).map((parte) => normalizarTexto(parte));
      if (partes.length < 2) {
        return false;
      }

      const ultimaParte = partes[partes.length - 1];
      if (ultimaParte && ultimaParte.length === 2) {
        estado = ultimaParte.toUpperCase();
        cidade = partes.slice(0, -1).join(" ") || cidade;
      } else {
        cidade = partes[0] ?? cidade;
        estado = partes[1] ?? estado;
      }

      return true;
    });

    const estadoNormalizado = normalizarTexto(estado).toUpperCase();
    const cidadeNormalizada = normalizarTexto(cidade);
    const cidadeEstado = cidadeNormalizada
      ? estadoNormalizado
        ? `${cidadeNormalizada}/${estadoNormalizado}`
        : cidadeNormalizada
      : estadoNormalizado || NAO_INFORMADO;

    return {
      comarca: texto,
      cidade: cidadeNormalizada || NAO_INFORMADO,
      estado: estadoNormalizado || NAO_INFORMADO,
      cidadeEstado,
    };
  }

  const cidade = primeiroTextoValido(valor.city, valor.name) || NAO_INFORMADO;
  const estado = primeiroTextoValido(valor.state) || NAO_INFORMADO;
  const comarca = primeiroTextoValido(valor.name, valor.city) || NAO_INFORMADO;
  const cidadeEstado =
    cidade !== NAO_INFORMADO && estado !== NAO_INFORMADO
      ? `${cidade}/${estado}`
      : cidade !== NAO_INFORMADO
        ? cidade
        : estado !== NAO_INFORMADO
          ? estado
          : NAO_INFORMADO;

  return { comarca, cidade, estado, cidadeEstado };
}

function parseMovimentacaoTags(valor: unknown): ApiProcessoStepTags | null {
  if (!valor) {
    return null;
  }

  if (typeof valor === "string") {
    try {
      const parsed = JSON.parse(valor);
      if (parsed && typeof parsed === "object") {
        return parsed as ApiProcessoStepTags;
      }
    } catch {
      return null;
    }

    return null;
  }

  if (typeof valor === "object") {
    return valor as ApiProcessoStepTags;
  }

  return null;
}

export function mapApiProcessoToViewModel(processo: ApiProcessoResponse): ProcessoViewModel {
  const codigo =
    primeiroTextoValido(processo.code, processo.numero) || NAO_INFORMADO;
  const nome = primeiroTextoValido(processo.name) || NAO_INFORMADO;
  const status = primeiroTextoValido(processo.status) || NAO_INFORMADO;
  const fase = primeiroTextoValido(processo.phase) || NAO_INFORMADO;
  const area = primeiroTextoValido(processo.area) || NAO_INFORMADO;

  const tribunalSigla =
    primeiroTextoValido(
      processo.tribunal_acronym,
      processo.tribunal,
    ) || NAO_INFORMADO;
  const tribunalNome =
    primeiroTextoValido(
      processo.tribunal_name,
      processo.tribunal,
      tribunalSigla,
    ) || tribunalSigla;

  const localidade = extrairLocalidade(
    processo.county ?? processo.jurisdicao ?? null,
  );
  const valorCausa = formatarMoeda(processo.amount ?? null);
  const distribuidoEm =
    formatarData(
      processo.distribution_date ??
        processo.data_distribuicao ??
        null,
      "hora",
    ) ?? NAO_INFORMADO;
  const justiceDescription =
    primeiroTextoValido(processo.justice_description) ||
    NAO_INFORMADO;
  const numeroCnj = primeiroTextoValido(processo.numero) || null;
  const instanciaBruta = primeiroTextoValido(processo.instance ?? processo.instancia) || null;
  const instance = normalizarGrau(instanciaBruta || NAO_INFORMADO);

  const subjectsFonte =
    (Array.isArray(processo.subjects) && processo.subjects.length > 0
      ? processo.subjects
      : null) ?? null;
  const classificationsFonte =
    (Array.isArray(processo.classifications) && processo.classifications.length > 0
      ? processo.classifications
      : null) ?? null;

  const subjectsDetalhados = mapearCodigoNomeLista(subjectsFonte, "Assunto");
  const classificationsDetalhadas = mapearCodigoNomeLista(
    classificationsFonte,
    "Classificação",
  );

  const tagsInfo = extrairTagsEIndicadores(processo);
  const tagsCabecalho = tagsInfo.tags;

  const passosOriginais: ApiProcessoStep[] =
    Array.isArray(processo.steps) && processo.steps.length > 0
      ? processo.steps
      : [];

  const movimentacoesOriginais =
    Array.isArray(processo.movimentacoes) && processo.movimentacoes.length > 0
      ? processo.movimentacoes
      : [];

  const passosDeduplicados = deduplicarMovimentacoes(
    [...passosOriginais, ...movimentacoesOriginais.map((mov) => ({
      id: mov.id,
      step_id: typeof mov.id === "string" ? mov.id : null,
      date: mov.data ?? null,
      step_date: mov.data ?? null,
      step_type: mov.tipo ?? mov.tipo_publicacao ?? null,
      type: mov.tipo ?? mov.tipo_publicacao ?? null,
      title: mov.tipo ?? mov.tipo_publicacao ?? null,
      tipo_andamento: mov.tipo_andamento ?? null,
      content: mov.conteudo ?? null,
      description: mov.conteudo ?? null,
      category: mov.texto_categoria ?? null,
      private: interpretarBooleano(mov.sigiloso),
      tags: parseMovimentacaoTags(mov.classificacao_predita),
    }))].map((step, index) => ({
      id: step.id ?? step.step_id ?? `${index}-${step.step_date ?? step.date ?? ""}`,
      data: step.step_date ?? step.date ?? null,
      tipo: step.step_type ?? step.type ?? step.title ?? null,
      conteudo: step.content ?? step.description ?? null,
      texto_categoria: step.category ?? null,
      original: step,
    })),
  );

  const anexosFonte: ApiProcessoAttachment[] =
    Array.isArray(processo.attachments) && processo.attachments.length > 0
      ? processo.attachments
      : [];

  const normalizarIdentificador = (valor: unknown): string | null => {
    if (typeof valor === "number" && Number.isFinite(valor)) {
      return String(Math.trunc(valor));
    }

    if (typeof valor === "string") {
      const texto = valor.trim();
      return texto.length > 0 ? texto : null;
    }

    return null;
  };

  const anexosPorMovimentacao = new Map<string, AnexoProcesso[]>();
  const anexosSemIdentificador: Array<{
    anexo: AnexoProcesso;
    dataReferenciaIso: string | null;
    dataReferenciaDia: string | null;
  }> = [];

  const anexos: AnexoProcesso[] = anexosFonte
    .map((anexo, index) => {
      const titulo =
        primeiroTextoValido(anexo.nome, anexo.attachment_name, anexo.title, anexo.content) ||
        `Documento ${index + 1}`;

      if (!titulo) {
        return null;
      }

      const idIdentificador =
        normalizarIdentificador(anexo.id ?? anexo.id_anexo ?? anexo.attachment_id) ??
        `${index}-${titulo}`;
      const dataOriginal =
        anexo.data_cadastro ?? anexo.date ?? anexo.attachment_date ?? null;
      const dataOrganizacaoBruta =
        primeiroTextoValido(
          anexo.data_cadastro,
          anexo.data_andamento,
          anexo.date,
          anexo.attachment_date,
        ) || null;
      const dataOrganizacaoIso = (() => {
        if (!dataOrganizacaoBruta) {
          return null;
        }

        const dataReferencia = new Date(dataOrganizacaoBruta);
        return Number.isNaN(dataReferencia.getTime()) ? null : dataReferencia.toISOString();
      })();
      const idAnexo = normalizarIdentificador(
        anexo.id_anexo ?? anexo.attachment_id ?? anexo.id,
      );
      const idAndamentoBase = normalizarIdentificador(
        anexo.id_andamento ?? anexo.attachment_id,
      );
      const idAndamento = idAndamentoBase
        ? normalizarTexto(idAndamentoBase) || idAndamentoBase
        : null;
      const instanciaProcesso = primeiroTextoValido(anexo.instancia_processo) || null;
      const url = primeiroTextoValido(anexo.url, anexo.attachment_url) || null;
      const tipo = primeiroTextoValido(anexo.tipo) || null;
      const crawlId = primeiroTextoValido(anexo.crawl_id) || null;

      const model: AnexoProcesso = {
        id: idIdentificador,
        titulo,
        data: formatarData(dataOriginal ?? dataOrganizacaoBruta, "hora"),
        url,
        idAndamento,
        instancia: instanciaProcesso,
        idAnexo,
        tipo,
        crawlId,
      };

      if (model.idAndamento) {
        const existentes = anexosPorMovimentacao.get(model.idAndamento) ?? [];
        anexosPorMovimentacao.set(model.idAndamento, [...existentes, model]);
      } else {
        anexosSemIdentificador.push({
          anexo: model,
          dataReferenciaIso: dataOrganizacaoIso,
          dataReferenciaDia: dataOrganizacaoIso ? dataOrganizacaoIso.slice(0, 10) : null,
        });
      }

      return model;
    })
    .filter((anexo): anexo is AnexoProcesso => Boolean(anexo));

  const movimentacoes = passosDeduplicados
    .map((item, index) => {
      const original = (item as typeof item & { original?: ApiProcessoStep }).original ?? {
        id: item.id,
        step_id: typeof item.id === "string" ? item.id : undefined,
        step_date: item.data,
        step_type: item.tipo,
        content: item.conteudo,
        category: item.texto_categoria,
      };

      const fallbackId = `${index}-${item.data ?? ""}`;
      const identificador = (() => {
        const candidatos = [
          original?.id,
          original?.step_id,
          typeof item.id === "string" ? item.id : null,
        ]
          .map((valor) =>
            typeof valor === "number" || typeof valor === "string" ? String(valor) : "",
          )
          .map((valor) => normalizarTexto(valor));

        const escolhido = candidatos.find((valor) => Boolean(valor));

        return escolhido && escolhido.length > 0 ? escolhido : fallbackId;
      })();

      const textoData = original?.step_date ?? original?.date ?? item.data ?? null;
      const dataObjeto = textoData ? new Date(textoData) : null;
      const dataValida = dataObjeto && !Number.isNaN(dataObjeto.getTime()) ? dataObjeto : null;

      const conteudoBruto =
        typeof original?.content === "string" && original.content.trim().length > 0
          ? original.content.trim()
          : typeof original?.description === "string" && original.description.trim().length > 0
            ? normalizarTexto(original.description)
            : typeof item.conteudo === "string" && item.conteudo.trim().length > 0
              ? normalizarTexto(item.conteudo)
              : null;

      const tipoPasso = primeiroTextoValido(
        original?.step_type,
        original?.type,
        item.tipo,
        original?.title,
      );

      const tipoAndamento = primeiroTextoValido(
        original?.tipo_andamento,
        item.tipo_andamento,
      );

      if (!tipoPasso && !conteudoBruto) {
        return null;
      }

      const anexosRelacionados = anexosPorMovimentacao.get(identificador) ?? [];

      return {
        id: identificador,
        data: dataValida,
        dataOriginal: textoData ?? null,
        dataFormatada: formatarData(dataValida ?? textoData ?? null, "hora"),
        stepType: tipoPasso || null,
        tipoAndamento: tipoAndamento || null,
        conteudo: conteudoBruto,
        privado: Boolean(original?.private),
        tags: original?.tags ?? null,
        anexos: anexosRelacionados,
      } satisfies MovimentacaoProcesso;
    })
    .filter((mov): mov is MovimentacaoProcesso => mov !== null)
    .sort((a, b) => {
      const dataA = a.data ? a.data.getTime() : Number.NEGATIVE_INFINITY;
      const dataB = b.data ? b.data.getTime() : Number.NEGATIVE_INFINITY;

      if (dataA === dataB) {
        return a.id.localeCompare(b.id);
      }

      return dataB - dataA;
    });

  if (anexosSemIdentificador.length > 0 && movimentacoes.length > 0) {
    const movimentacoesPorTimestamp = new Map<string, MovimentacaoProcesso>();
    const movimentacoesPorDia = new Map<string, MovimentacaoProcesso>();

    movimentacoes.forEach((movimentacao) => {
      if (movimentacao.data) {
        const iso = movimentacao.data.toISOString();
        movimentacoesPorTimestamp.set(iso, movimentacao);
        movimentacoesPorDia.set(iso.slice(0, 10), movimentacao);
      }

      if (movimentacao.dataOriginal) {
        const dataBruta = new Date(movimentacao.dataOriginal);
        if (!Number.isNaN(dataBruta.getTime())) {
          const iso = dataBruta.toISOString();
          movimentacoesPorTimestamp.set(iso, movimentacao);
          movimentacoesPorDia.set(iso.slice(0, 10), movimentacao);
        }
      }
    });

    anexosSemIdentificador.forEach(({ anexo, dataReferenciaIso, dataReferenciaDia }) => {
      if (dataReferenciaIso) {
        const destino = movimentacoesPorTimestamp.get(dataReferenciaIso);
        if (destino) {
          destino.anexos.push(anexo);
          return;
        }
      }

      if (dataReferenciaDia) {
        const destino = movimentacoesPorDia.get(dataReferenciaDia);
        if (destino) {
          destino.anexos.push(anexo);
        }
      }
    });
  }

  const grupos = agruparPorMes(movimentacoes);

  const ultimaMovimentacaoData = movimentacoes.reduce<Date | null>((acc, mov) => {
    if (mov.data && (!acc || mov.data > acc)) {
      return mov.data;
    }
    return acc;
  }, null);

  const ultimaAtualizacao = formatarData(
    ultimaMovimentacaoData ??
      processo.updated_at ??
      processo.atualizado_em ??
      null,
    "hora",
  );

  const partes = mapearPartes(
    processo.participants ??
      processo.parties ??
      null,
  );

  const relacionadosFonte: ApiProcessoRelatedLawsuit[] =
    Array.isArray(processo.related_lawsuits) && processo.related_lawsuits.length > 0
      ? processo.related_lawsuits
      : [];

  const relacionados: ProcessoRelacionadoView[] = relacionadosFonte
    .map((item, index) => {
      const codigoRelacionado = primeiroTextoValido(item.code) || NAO_INFORMADO;
      const id = codigoRelacionado !== NAO_INFORMADO ? codigoRelacionado : `relacionado-${index}`;

      return {
        id,
        codigo: codigoRelacionado,
        nome: primeiroTextoValido(item.name) || NAO_INFORMADO,
        instancia: normalizarGrau(primeiroTextoValido(item.instance) || NAO_INFORMADO),
      };
    })
    .filter((rel): rel is ProcessoRelacionadoView => Boolean(rel));

  const cabecalho: CabecalhoProcesso = {
    codigo,
    nome,
    status,
    fase,
    area,
    cidadeEstado: localidade.cidadeEstado,
    comarca: localidade.comarca,
    tribunal: tribunalNome,
    distribuidoEm,
    valorDaCausa: valorCausa,
    instance,
    justiceDescription,
    ultimaAtualizacao,
    tags: tagsCabecalho,
    subjects: subjectsDetalhados.map((item) => item.nome || item.codigo),
  };

  const dados: DadosProcesso = {
    tribunal: tribunalNome,
    tribunalSigla: tribunalSigla,
    justiceDescription,
    instance,
    area,
    county: localidade.comarca,
    city: localidade.cidade,
    state: localidade.estado,
    distributionDate: distribuidoEm,
    amount: valorCausa,
    subjects: subjectsDetalhados,
    classifications: classificationsDetalhadas,
    tags: tagsCabecalho,
    precatory: tagsInfo.precatory,
    freeJustice: tagsInfo.freeJustice,
    secrecyLevel: tagsInfo.secrecyLevel,
    updatedAt: ultimaAtualizacao ?? NAO_INFORMADO,
  };

  return {
    cabecalho,
    dados,
    partes,
    movimentacoes,
    grupos,
    relacionados,
    anexos,
    numeroCnj,
    instanciaProcesso: instanciaBruta,
  };
}

interface TimelineMesProps {
  grupo: GrupoMovimentacao;
  aberto: boolean;
  onToggle: (chave: string) => void;
  movimentacoesVisiveis: number;
  onVerMais: (chave: string) => void;
  virtualizado: boolean;
  onMostrarConteudo: (movimentacao: MovimentacaoProcesso) => void;
  onAbrirAnexo?: (anexo: AnexoProcesso) => void;
  podeAbrirAnexo?: (anexo: AnexoProcesso) => boolean;
}

export const TimelineMes = memo(function TimelineMes({
  grupo,
  aberto,
  onToggle,
  movimentacoesVisiveis,
  onVerMais,
  virtualizado,
  onMostrarConteudo,
  onAbrirAnexo,
  podeAbrirAnexo,
}: TimelineMesProps) {
  const [intervalo, setIntervalo] = useState({ inicio: 0, fim: movimentacoesVisiveis });

  useEffect(() => {
    if (!virtualizado) {
      setIntervalo({ inicio: 0, fim: movimentacoesVisiveis });
      return;
    }

    setIntervalo((atual) => {
      if (movimentacoesVisiveis <= atual.fim) {
        return atual;
      }

      const fim = Math.min(grupo.itens.length, movimentacoesVisiveis);
      return { inicio: atual.inicio, fim };
    });
  }, [movimentacoesVisiveis, grupo.chave, virtualizado, grupo.itens.length]);

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
    <div className="rounded-xl border border-muted-foreground/10 bg-card shadow-sm">
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

              const conteudo = item.conteudo ?? "";
              const linhasConteudo = conteudo ? conteudo.split(/\n+/) : [];
              const isMarkdown =
                typeof item.tags?.formatted === "string" &&
                item.tags.formatted.trim().toLowerCase() === "md";
              const isLongo =
                conteudo.length > LIMITE_CONTEUDO_RESUMO || linhasConteudo.length > LIMITE_LINHAS_RESUMO;
              return (
                <div key={item.id} className="relative flex gap-6 pb-8 last:pb-2">
                  <div className="w-28 text-right">
                    <p className="text-sm font-semibold text-primary">
                      {item.dataFormatada ?? "Data não informada"}
                    </p>
                  </div>
                  <div className="relative flex-1">
                    {!isUltimo && (
                      <span
                        className="absolute -left-6 top-4 h-[calc(100%+1rem)] w-px bg-primary/30"
                        aria-hidden
                      />
                    )}
                    <span className="absolute -left-[1.6rem] top-3 h-3 w-3 rounded-full border-2 border-background bg-primary shadow" />
                    <div className="rounded-2xl border border-muted-foreground/10 bg-card p-4 shadow-sm">
                      <div className="space-y-3 text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          {item.stepType ? (
                            <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/10 text-primary">
                              {item.stepType}
                            </Badge>
                          ) : null}
                          <Badge
                            variant="secondary"
                            className={cn(
                              "rounded-full",
                              item.privado
                                ? "border-transparent bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-100"
                                : "border-transparent bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-foreground",
                            )}
                          >
                            {item.privado ? "Privado" : "Público"}
                          </Badge>
                        </div>

                        {conteudo ? (
                          <div
                            className={cn(
                              "relative text-muted-foreground",
                              isLongo ? "max-h-48 overflow-hidden" : "",
                            )}
                          >
                            {isMarkdown ? (
                              <SafeMarkdown
                                content={conteudo}
                                className={cn(
                                  "prose prose-sm max-w-none text-muted-foreground",
                                  "dark:prose-invert",
                                )}
                              />
                            ) : (
                              <p className="whitespace-pre-wrap leading-relaxed">{conteudo}</p>
                            )}
                            {isLongo ? (
                              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-muted/90 via-muted/40 to-transparent" />
                            ) : null}
                          </div>
                        ) : null}

                        {isLongo ? (
                          <div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="px-0 text-primary hover:text-primary/80"
                              onClick={() => onMostrarConteudo(item)}
                              data-testid={`detalhes-${item.id}`}
                            >
                              Ver conteúdo completo
                            </Button>
                          </div>
                        ) : null}

                        {item.anexos.length ? (
                          <div className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                              Anexos
                            </p>
                            <ul className="space-y-3">
                              {item.anexos.map((anexo) => (
                                <li
                                  key={`${item.id}-anexo-${anexo.id}`}
                                  className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                                >
                                  <div className="space-y-1">
                                    <p className="text-sm font-semibold text-foreground">{anexo.titulo}</p>
                                    {anexo.data ? (
                                      <p className="text-xs text-muted-foreground">{anexo.data}</p>
                                    ) : null}
                                  </div>
                                  {(() => {
                                    const habilitado = podeAbrirAnexo
                                      ? podeAbrirAnexo(anexo)
                                      : Boolean(onAbrirAnexo);
                                    return habilitado ? (
                                      <Button
                                        variant="link"
                                        size="sm"
                                        className="h-auto px-0 text-primary hover:text-primary/80"
                                        onClick={() => onAbrirAnexo?.(anexo)}
                                      >
                                        Abrir documento
                                      </Button>
                                    ) : (
                                      <span className="text-xs text-muted-foreground">Link indisponível</span>
                                    );
                                  })()}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
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
  });
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
            <TableHead>INSTÂNCIA</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {itens.map((item) => (
            <TableRow
              key={item.id}
              className="cursor-pointer hover:bg-muted/40"
              onClick={() => onAbrir(item.codigo)}
            >
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium text-foreground">{item.codigo}</span>
                  <span className="text-xs text-muted-foreground">{item.nome}</span>
                </div>
              </TableCell>
              <TableCell>{item.instancia}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

interface InformacoesProcessoProps {
  dados: DadosProcesso;
  partes: PartesAgrupadas;
  anexos: AnexoProcesso[];
  onVerTodosAnexos?: () => void;
  onAbrirAnexo?: (anexo: AnexoProcesso) => void;
  podeAbrirAnexo?: (anexo: AnexoProcesso) => boolean;
  anexoEmCarregamentoId?: string | number | null;
}

export function InformacoesProcesso({
  dados,
  partes,
  anexos,
  onVerTodosAnexos,
  onAbrirAnexo,
  podeAbrirAnexo,
  anexoEmCarregamentoId,
}: InformacoesProcessoProps) {
  const anexosVisiveis = anexos.slice(0, 5);
  const possuiMaisAnexos = anexos.length > anexosVisiveis.length;

  return (
    <div className="space-y-8">
      <section aria-labelledby="anexos-processo" className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 id="anexos-processo" className="text-lg font-semibold text-foreground">
            Anexos
          </h2>
          <Badge variant="outline" className="border-muted-foreground/30 text-xs">
            {anexos.length}
          </Badge>
        </div>
        {anexos.length === 0 ? (
          <p className="rounded-lg border border-dashed border-muted-foreground/40 p-4 text-sm text-muted-foreground">
            Nenhum anexo disponível.
          </p>
        ) : (
          <div className="space-y-3">
            {anexosVisiveis.map((anexo) => (
              <div
                key={anexo.id}
                className="flex flex-col gap-2 rounded-lg border border-muted-foreground/10 bg-muted/30 p-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="text-sm font-semibold text-foreground">{anexo.titulo}</p>
                  <p className="text-xs text-muted-foreground">{anexo.data ?? NAO_INFORMADO}</p>
                </div>
                {(() => {
                  const habilitado = podeAbrirAnexo ? podeAbrirAnexo(anexo) : Boolean(onAbrirAnexo);
                  const identificador = anexo.idAnexo ?? anexo.id;
                  const carregando =
                    identificador != null && anexoEmCarregamentoId === identificador;
                  return (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full md:w-auto"
                      onClick={() => onAbrirAnexo?.(anexo)}
                      disabled={!habilitado || carregando}
                    >
                      {habilitado ? (carregando ? "Abrindo..." : "Abrir documento") : "Link indisponível"}
                    </Button>
                  );
                })()}
              </div>
            ))}
            {possuiMaisAnexos && onVerTodosAnexos ? (
              <div className="pt-2">
                <Button variant="secondary" size="sm" onClick={onVerTodosAnexos}>
                  Ver todos os anexos
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </section>

      <section aria-labelledby="dados-processo" className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 id="dados-processo" className="text-lg font-semibold text-foreground">
            Dados do processo
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <CampoInformacao rotulo="Tribunal" valor={dados.tribunal} />
          <CampoInformacao rotulo="Sigla do tribunal" valor={dados.tribunalSigla} />
          <CampoInformacao rotulo="Justiça" valor={dados.justiceDescription} />
          <CampoInformacao rotulo="Instância" valor={dados.instance} />
          <CampoInformacao rotulo="Área" valor={dados.area} />
          <CampoInformacao rotulo="Comarca" valor={dados.county} />
          <CampoInformacao rotulo="Cidade" valor={dados.city} />
          <CampoInformacao rotulo="Estado" valor={dados.state} />
          <CampoInformacao rotulo="Valor da causa" valor={dados.amount} />
          <CampoInformacao rotulo="Distribuído em" valor={dados.distributionDate} />
          <CampoInformacaoLista rotulo="Assuntos" itens={dados.subjects} className="md:col-span-2" />
          <CampoInformacaoLista rotulo="Classificações" itens={dados.classifications} className="md:col-span-2" />
          <CampoInformacao rotulo="Precatorio" valor={dados.precatory} />
          <CampoInformacao rotulo="Justiça gratuita" valor={dados.freeJustice} />
          <CampoInformacao rotulo="Nível de sigilo" valor={dados.secrecyLevel} />
          <CampoInformacao
            rotulo="Tags"
            valor={dados.tags.length ? dados.tags.join(", ") : null}
            className="md:col-span-2"
          />
          <CampoInformacao rotulo="Última atualização" valor={dados.updatedAt} />
        </div>
      </section>

      <section aria-labelledby="partes-processo" className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 id="partes-processo" className="text-lg font-semibold text-foreground">
            Envolvidos do processo
          </h2>
        </div>
        <div className="space-y-6">
          <SubsecaoPartes titulo="Polo ativo" itens={partes.ativo} mostrarPolo />
          <SubsecaoPartes titulo="Polo passivo" itens={partes.passivo} mostrarPolo />
          {partes.testemunhas.length ? (
            <SubsecaoPartes
              titulo="Testemunhas"
              itens={partes.testemunhas}
              mostrarPolo
              mostrarPapel
            />
          ) : null}
          {partes.outros.length ? (
            <SubsecaoPartes
              titulo="Outras partes"
              itens={partes.outros}
              mostrarPolo
              mostrarPapel
            />
          ) : null}
        </div>
      </section>
    </div>
  );
}

interface CampoInformacaoProps {
  rotulo: string;
  valor: string | null | undefined;
  className?: string;
}

function CampoInformacao({ rotulo, valor, className }: CampoInformacaoProps) {
  const exibicao = typeof valor === "string" && valor.trim() ? valor : valor ?? "";

  return (
    <div className={cn("rounded-lg border border-muted-foreground/10 bg-muted/30 p-4", className)}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{rotulo}</p>
      <p className="mt-1 text-sm text-foreground">{exibicao || NAO_INFORMADO}</p>
    </div>
  );
}

interface CampoInformacaoListaProps {
  rotulo: string;
  itens: CodigoNomeItem[];
  className?: string;
}

function CampoInformacaoLista({ rotulo, itens, className }: CampoInformacaoListaProps) {
  const possuiItens = itens.length > 0;

  return (
    <div className={cn("rounded-lg border border-muted-foreground/10 bg-muted/30 p-4", className)}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{rotulo}</p>
      {possuiItens ? (
        <ul className="mt-2 space-y-2">
          {itens.map((item, index) => (
            <li key={`${rotulo}-${item.codigo}-${index}`} className="flex flex-col text-sm text-foreground">
              <span className="font-semibold">{item.codigo}</span>
              <span className="text-xs text-muted-foreground">{item.nome}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">{NAO_INFORMADO}</p>
      )}
    </div>
  );
}

interface SubsecaoPartesProps {
  titulo: string;
  itens: ParteNormalizada[];
  mostrarPolo?: boolean;
  mostrarPapel?: boolean;
}

function SubsecaoPartes({ titulo, itens, mostrarPolo, mostrarPapel }: SubsecaoPartesProps) {
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
              {mostrarPolo && parte.polo ? (
                <p className="text-xs text-muted-foreground">
                  Polo: {parte.polo === "ativo" ? "Ativo" : "Passivo"}
                </p>
              ) : null}
              {parte.tipoPessoa ? (
                <p className="text-xs text-muted-foreground">Tipo de pessoa: {parte.tipoPessoa}</p>
              ) : null}
              {parte.documento ? (
                <p className="text-xs text-muted-foreground">Documento: {parte.documento}</p>
              ) : null}
              {mostrarPapel && parte.papel ? (
                <p className="text-xs text-muted-foreground">Papel: {parte.papel}</p>
              ) : null}
              {parte.advogados.length ? (
                <p className="text-xs text-muted-foreground">
                  Advogad{parte.advogados.length > 1 ? "os" : "o"}: {parte.advogados.join(", ")}
                </p>
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
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [viewModel, setViewModel] = useState<ProcessoViewModel | null>(null);
  const [abaAtiva, setAbaAtiva] = useState("movimentacao");
  const [mesesVisiveis, setMesesVisiveis] = useState(MESES_INICIAIS);
  const [mesesAbertos, setMesesAbertos] = useState<string[]>([]);
  const [movimentosPorMes, setMovimentosPorMes] = useState<Record<string, number>>({});
  const [mostrarTodosAnexos, setMostrarTodosAnexos] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroInicio, setFiltroInicio] = useState("");
  const [filtroFim, setFiltroFim] = useState("");
  const [mostrarDialogMovimentacao, setMostrarDialogMovimentacao] = useState(false);
  const [formMovimentacao, setFormMovimentacao] = useState({
    data: "",
    tipo: "",
    tipoPublicacao: "",
    textoCategoria: "",
    conteudo: "",
  });
  const [errosMovimentacao, setErrosMovimentacao] = useState<{
    data?: string;
    tipo?: string;
    conteudo?: string;
  }>({});
  const [erroMovimentacao, setErroMovimentacao] = useState<string | null>(null);
  const [salvandoMovimentacao, setSalvandoMovimentacao] = useState(false);
  const [movimentacaoSelecionada, setMovimentacaoSelecionada] = useState<MovimentacaoProcesso | null>(null);
  const [resumoIa, setResumoIa] = useState<string | null>(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [carregandoResumo, setCarregandoResumo] = useState(false);
  const [erroResumo, setErroResumo] = useState<string | null>(null);
  const [gerarResumoAoAbrir, setGerarResumoAoAbrir] = useState(false);
  const [anexoEmCarregamentoId, setAnexoEmCarregamentoId] = useState<string | number | null>(null);
  const [anexoVisualizado, setAnexoVisualizado] = useState<{
    titulo: string;
    conteudo: string;
    tipo: string | null;
  } | null>(null);
  const [, startTransition] = useTransition();

  const numeroCnjProcesso = viewModel?.numeroCnj ?? null;
  const instanciaProcessoPadrao = viewModel?.instanciaProcesso ?? null;

  const podeAbrirAnexo = useCallback(
    (anexo: AnexoProcesso) => {
      if (!anexo) {
        return false;
      }

      if (anexo.url) {
        return true;
      }

      if (!numeroCnjProcesso) {
        return false;
      }

      const idDestino = anexo.idAnexo ?? anexo.id;
      const instanciaDestino = anexo.instancia;

      return Boolean(idDestino && instanciaDestino);
    },
    [numeroCnjProcesso],
  );

  const handleAbrirAnexo = useCallback(
    async (anexo: AnexoProcesso) => {
      const numero = numeroCnjProcesso;
      const instanciaDestino = anexo.instancia;
      const idDestino = anexo.idAnexo ?? anexo.id;
      const identificador = idDestino ?? anexo.id ?? anexo.idAnexo ?? null;

      setAnexoVisualizado(null);
      setAnexoEmCarregamentoId(identificador ?? null);

      const apresentarNoModal = (conteudo: string, tipo: string | null, tituloPadrao?: string | null) => {
        const titulo =
          tituloPadrao ??
          anexo.titulo ??
          (typeof anexo.idAnexo === "string" ? anexo.idAnexo : null) ??
          (typeof anexo.id === "string" ? anexo.id : null) ??
          "Anexo";
        setAnexoVisualizado({
          titulo,
          conteudo,
          tipo,
        });
      };

      if (!numero || !instanciaDestino || !idDestino) {
        if (anexo.url) {
          apresentarNoModal(anexo.url, null);
        } else {
          toast({
            variant: "destructive",
            description: "Não foi possível abrir o anexo.",
          });
        }
        setAnexoEmCarregamentoId(null);
        return;
      }

      const requestUrl = `https://lawsuits.production.judit.io/lawsuits/${encodeURIComponent(numero)}/${encodeURIComponent(instanciaDestino)}/attachments/${encodeURIComponent(idDestino)}`;

      const extrairNomeArquivo = (valor: string | null): string | null => {
        if (!valor) {
          return null;
        }

        const matchEstendido = valor.match(/filename\*=UTF-8''([^;]+)/i);
        if (matchEstendido && matchEstendido[1]) {
          try {
            return decodeURIComponent(matchEstendido[1]);
          } catch {
            return matchEstendido[1];
          }
        }

        const matchPadrao = valor.match(/filename="?([^";]+)"?/i);
        if (matchPadrao && matchPadrao[1]) {
          return matchPadrao[1];
        }

        return null;
      };

      const sanitizarNome = (valor: string | null | undefined): string | null => {
        if (!valor) {
          return null;
        }

        const texto = valor.replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, " ").trim();
        return texto.length > 0 ? texto : null;
      };

      const lerComoDataUrl = (blob: Blob) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            resolve(typeof reader.result === "string" ? reader.result : "");
          };
          reader.onerror = () => {
            reject(reader.error ?? new Error("Falha ao ler anexo"));
          };
          reader.readAsDataURL(blob);
        });

      try {
        const resposta = await fetch(requestUrl, {
          headers: {
            "api-key": "37c7486a-1757-4b67-9c2c-cb8585bcce2d",
          },
        });

        if (!resposta.ok) {
          throw new Error(`Falha ao carregar anexo (${resposta.status})`);
        }

        const contentType = resposta.headers.get("content-type");
        const blob = await resposta.blob();
        const nomeArquivo =
          sanitizarNome(extrairNomeArquivo(resposta.headers.get("content-disposition"))) ??
          sanitizarNome(anexo.titulo) ??
          sanitizarNome(anexo.idAnexo) ??
          sanitizarNome(anexo.id) ??
          `anexo-${Date.now()}`;

        const dataUrl = await lerComoDataUrl(blob);
        apresentarNoModal(dataUrl, contentType, nomeArquivo);
      } catch (error) {
        console.error(error);
        toast({
          variant: "destructive",
          description: "Não foi possível exibir o anexo. Tentando link alternativo...",
        });

        if (anexo.url) {
          apresentarNoModal(anexo.url, null);
        }
      } finally {
        setAnexoEmCarregamentoId(null);
      }
    },
    [numeroCnjProcesso, toast],

  );

  const handleAlterarVisualizadorAnexo = useCallback((aberto: boolean) => {
    if (!aberto) {
      setAnexoVisualizado(null);
    }
  }, []);

  const aplicarModelo = useCallback(
    (modelo: ProcessoViewModel) => {
      startTransition(() => {
        setViewModel(modelo);
        setMesesAbertos(modelo.grupos.length ? [modelo.grupos[0].chave] : []);
        const inicial: Record<string, number> = {};
        modelo.grupos.forEach((grupo) => {
          inicial[grupo.chave] = MOVIMENTACOES_POR_LAJE;
        });
        setMovimentosPorMes(inicial);
        setMesesVisiveis(Math.min(MESES_INICIAIS, modelo.grupos.length));
      });
    },
    [startTransition],
  );

  const carregarProcesso = useCallback(
    async (
      options: {
        comLoading?: boolean;
        sinalCancelamento?: { cancelado: boolean };
      } = {},
    ) => {
      const { comLoading = true, sinalCancelamento } = options;

      if (!processoId) {
        if (!sinalCancelamento?.cancelado) {
          setErro("Processo não encontrado");
          if (comLoading) {
            setLoading(false);
          }
        }
        return;
      }

      if (!sinalCancelamento?.cancelado) {
        setErro(null);
        if (comLoading) {
          setLoading(true);
        }
      }

      try {
        const resposta = await fetch(getApiUrl(`processos/${processoId}`), {
          headers: { Accept: "application/json" },
        });

        if (!resposta.ok) {
          throw new Error(`Não foi possível carregar o processo (${resposta.status})`);
        }

        const json = (await resposta.json()) as ApiProcessoResponse;
        const modelo = mapApiProcessoToViewModel(json);

        if (!sinalCancelamento?.cancelado) {
          aplicarModelo(modelo);
        }
      } catch (error) {
        const mensagem = error instanceof Error ? error.message : "Erro ao carregar o processo";
        if (!sinalCancelamento?.cancelado) {
          setErro(mensagem);
          setViewModel(null);
        }
      } finally {
        if (comLoading && !sinalCancelamento?.cancelado) {
          setLoading(false);
        }
      }
    },
    [aplicarModelo, processoId],
  );

  const resetarFormularioMovimentacao = useCallback(() => {
    setFormMovimentacao({
      data: "",
      tipo: "",
      tipoPublicacao: "",
      textoCategoria: "",
      conteudo: "",
    });
    setErrosMovimentacao({});
    setErroMovimentacao(null);
  }, []);

  const handleAlterarDialogoMovimentacao = useCallback(
    (aberto: boolean) => {
      setMostrarDialogMovimentacao(aberto);
      if (!aberto) {
        resetarFormularioMovimentacao();
        setSalvandoMovimentacao(false);
      }
    },
    [resetarFormularioMovimentacao],
  );

  const handleSubmitMovimentacao = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const erros: { data?: string; tipo?: string; conteudo?: string } = {};

      if (!formMovimentacao.data) {
        erros.data = "Informe a data da movimentação.";
      }

      if (!formMovimentacao.tipo.trim()) {
        erros.tipo = "Informe o tipo da movimentação.";
      }

      if (!formMovimentacao.conteudo.trim()) {
        erros.conteudo = "Informe o conteúdo da movimentação.";
      }

      setErrosMovimentacao(erros);

      if (Object.keys(erros).length > 0) {
        return;
      }

      if (!processoId) {
        setErroMovimentacao("Processo não encontrado.");
        return;
      }

      setSalvandoMovimentacao(true);
      setErroMovimentacao(null);

      try {
        const resposta = await fetch(getApiUrl(`processos/${processoId}/movimentacoes`), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            data: formMovimentacao.data,
            tipo: formMovimentacao.tipo.trim(),
            tipo_publicacao: formMovimentacao.tipoPublicacao.trim() || null,
            texto_categoria: formMovimentacao.textoCategoria.trim() || null,
            conteudo: formMovimentacao.conteudo.trim(),
          }),
        });

        if (!resposta.ok) {
          let mensagem = "Não foi possível registrar a movimentação.";
          try {
            const erroResposta = (await resposta.json()) as { error?: string };
            if (erroResposta?.error) {
              mensagem = erroResposta.error;
            }
          } catch {
            // Ignora erros ao interpretar a resposta
          }
          throw new Error(mensagem);
        }

        await carregarProcesso({ comLoading: false });
        handleAlterarDialogoMovimentacao(false);
      } catch (error) {
        const mensagem =
          error instanceof Error ? error.message : "Não foi possível registrar a movimentação.";
        setErroMovimentacao(mensagem);
      } finally {
        setSalvandoMovimentacao(false);
      }
    },
    [
      carregarProcesso,
      formMovimentacao.conteudo,
      formMovimentacao.data,
      formMovimentacao.textoCategoria,
      formMovimentacao.tipo,
      formMovimentacao.tipoPublicacao,
      processoId,
      handleAlterarDialogoMovimentacao,
    ],
  );

  useEffect(() => {
    if (location.state?.initialTab) {
      setAbaAtiva(location.state.initialTab);
    }
  }, [location.state]);

  useEffect(() => {
    const sinal = { cancelado: false };

    void carregarProcesso({ comLoading: true, sinalCancelamento: sinal });

    return () => {
      sinal.cancelado = true;
    };
  }, [carregarProcesso]);

  const tiposDisponiveis = useMemo(() => {
    if (!viewModel) {
      return [] as string[];
    }

    const conjunto = new Set<string>();
    viewModel.movimentacoes.forEach((mov) => {
      if (mov.stepType) {
        conjunto.add(mov.stepType);
      }
    });

    return Array.from(conjunto).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [viewModel]);

  const movimentacoesFiltradas = useMemo(() => {
    if (!viewModel) {
      return [] as MovimentacaoProcesso[];
    }

    const tipoFiltro = filtroTipo === "todos" ? null : filtroTipo;

    return filtrarMovimentacoes(viewModel.movimentacoes, {
      tipo: tipoFiltro,
      inicio: filtroInicio || null,
      fim: filtroFim || null,
    });
  }, [viewModel, filtroTipo, filtroInicio, filtroFim]);

  const gruposFiltrados = useMemo(
    () => agruparPorMes(movimentacoesFiltradas),
    [movimentacoesFiltradas],
  );

  const totalMovimentacoes = movimentacoesFiltradas.length;
  const usarVirtualizacao = false;

  const gruposVisiveis = useMemo(
    () => gruposFiltrados.slice(0, mesesVisiveis),
    [gruposFiltrados, mesesVisiveis],
  );
  const totalGruposFiltrados = gruposFiltrados.length;

  useEffect(() => {
    if (!viewModel) {
      setMesesAbertos([]);
      setMovimentosPorMes({});
      setMesesVisiveis(0);
      return;
    }

    if (gruposFiltrados.length === 0) {
      setMesesAbertos([]);
      setMovimentosPorMes({});
      setMesesVisiveis(0);
      return;
    }

    setMesesAbertos((anteriores) => {
      const chavesValidas = new Set(gruposFiltrados.map((grupo) => grupo.chave));
      const ativos = anteriores.filter((chave) => chavesValidas.has(chave));
      if (ativos.length) {
        return ativos;
      }
      return [gruposFiltrados[0].chave];
    });

    setMovimentosPorMes((anteriores) => {
      const atualizado: Record<string, number> = {};
      gruposFiltrados.forEach((grupo) => {
        atualizado[grupo.chave] = anteriores[grupo.chave] ?? MOVIMENTACOES_POR_LAJE;
      });
      return atualizado;
    });

    setMesesVisiveis((valor) => {
      if (valor === 0) {
        return Math.min(MESES_INICIAIS, gruposFiltrados.length);
      }

      return valor;
    });
  }, [viewModel, gruposFiltrados]);

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
    setMesesVisiveis((valor) => Math.min(totalGruposFiltrados, valor + 2));
  }, [totalGruposFiltrados]);

  const handleLimparFiltros = useCallback(() => {
    setFiltroTipo("todos");
    setFiltroInicio("");
    setFiltroFim("");
  }, []);

  const handleAbrirRelacionado = useCallback(
    (identificador: string) => {
      navigate(`/processos/${identificador}`);
    },
    [navigate],
  );

  const handleVerTodosAnexos = useCallback(() => {
    setAbaAtiva("informacoes");
    setMostrarTodosAnexos(true);
  }, []);

  const handleMostrarConteudo = useCallback((movimentacao: MovimentacaoProcesso) => {
    setMovimentacaoSelecionada(movimentacao);
    setResumoIa(null);
    setErroResumo(null);
    setCarregandoResumo(false);
    setModalAberto(true);
  }, []);

  const handleMostrarResumoIa = useCallback(
    (movimentacao: MovimentacaoProcesso) => {
      setGerarResumoAoAbrir(true);
      handleMostrarConteudo(movimentacao);
    },
    [handleMostrarConteudo],
  );

  const handleAlterarModalConteudo = useCallback((aberto: boolean) => {
    setModalAberto(aberto);
    if (!aberto) {
      setMovimentacaoSelecionada(null);
      setResumoIa(null);
      setErroResumo(null);
      setCarregandoResumo(false);
      setGerarResumoAoAbrir(false);
    }
  }, []);

  const handleGerarResumoIa = useCallback(async () => {
    if (!movimentacaoSelecionada) {
      return;
    }

    setCarregandoResumo(true);
    setErroResumo(null);
    setResumoIa(null);

    try {
      const integracoes = await fetchIntegrationApiKeys();
      const integracaoAtiva = integracoes.find(
        (integracao) =>
          integracao.active &&
          ["gemini", "openai"].includes(integracao.provider.trim().toLowerCase()),
      );

      if (!integracaoAtiva) {
        throw new Error("Nenhuma integração de IA ativa disponível.");
      }

      const promptResumo = montarPromptResumoMovimentacao(movimentacaoSelecionada);
      const resposta = await generateAiText({
        integrationId: integracaoAtiva.id,
        documentType: "Resumo:",
        prompt: promptResumo,
        mode: "summary",
      });

      const conteudoResumo = resposta.content?.trim();
      const resumoFormatado = prepararResumoIa(conteudoResumo);
      setResumoIa(resumoFormatado);
      setErroResumo(null);

      const providerLabel =
        integracaoAtiva.provider.trim().toLowerCase() === "gemini"
          ? "Gemini"
          : integracaoAtiva.provider.trim().toLowerCase() === "openai"
            ? "OpenAI"
            : integracaoAtiva.provider;

      toast({
        title: "Resumo gerado",
        description: `Resumo criado com ${providerLabel}.`,
      });
    } catch (error) {
      const mensagem =
        error instanceof Error ? error.message : "Não foi possível gerar o resumo.";
      setErroResumo(mensagem);
      toast({
        title: "Falha ao gerar resumo",
        description: mensagem,
        variant: "destructive",
      });
    } finally {
      setCarregandoResumo(false);
    }
  }, [movimentacaoSelecionada, toast]);

  useEffect(() => {
    if (gerarResumoAoAbrir && movimentacaoSelecionada && modalAberto) {
      setGerarResumoAoAbrir(false);
      void handleGerarResumoIa();
    }
  }, [gerarResumoAoAbrir, movimentacaoSelecionada, modalAberto, handleGerarResumoIa]);

  const conteudoMovimentacoes = useMemo(() => {
    if (!viewModel) {
      return null;
    }

    const temResultados = gruposFiltrados.length > 0;

    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <Button
            type="button"
            onClick={() => {
              setErroMovimentacao(null);
              setErrosMovimentacao({});
              setMostrarDialogMovimentacao(true);
            }}
            className="w-full sm:w-auto"
          >
            Registrar movimentação
          </Button>
        </div>
        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
          <div className="space-y-4 lg:sticky lg:top-24">
            <Card className="border border-muted-foreground/10 bg-card shadow-sm dark:border-muted/30 dark:bg-muted/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground">
                  Refinar resultados
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label
                    htmlFor="filtro-tipo"
                    className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    Tipo
                  </Label>
                  <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                    <SelectTrigger id="filtro-tipo" className="w-full">
                      <SelectValue placeholder="Todos os tipos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os tipos</SelectItem>
                      {tiposDisponiveis.map((tipo) => (
                        <SelectItem key={tipo} value={tipo}>
                          {tipo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="filtro-inicio"
                    className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    Data inicial
                  </Label>
                  <Input
                    id="filtro-inicio"
                    type="date"
                    value={filtroInicio}
                    onChange={(event) => setFiltroInicio(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="filtro-fim"
                    className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    Data final
                  </Label>
                  <Input
                    id="filtro-fim"
                    type="date"
                    value={filtroFim}
                    onChange={(event) => setFiltroFim(event.target.value)}
                  />
                </div>
                <Button type="button" variant="outline" className="w-full" onClick={handleLimparFiltros}>
                  Limpar filtros
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            {temResultados ? (
              <>
                <ModernTimeline
                  groups={gruposVisiveis.map((grupo, grupoIndex) => ({
                    label: grupo.rotulo,
                    defaultExpanded: grupoIndex === 0,
                    events: grupo.itens
                      .slice(0, movimentosPorMes[grupo.chave] ?? MOVIMENTACOES_POR_LAJE)
                      .map((item) => {
                        const temTipoAndamento =
                          typeof item.tipoAndamento === "string" && item.tipoAndamento.trim().length > 0;
                        const podeResumir = Boolean(
                          temTipoAndamento && item.conteudo && item.conteudo.trim().length > 0,
                        );

                        return {
                          id: item.id,
                          date: item.dataFormatada,
                          title: item.stepType || "Movimentação",
                          description: item.conteudo,
                          type: item.stepType,
                          isPrivate: item.privado,
                          onGenerateSummary: podeResumir
                            ? () => handleMostrarResumoIa(item)
                            : undefined,
                        };
                      }),

                  }))}
                />

                {totalGruposFiltrados > gruposVisiveis.length ? (
                  <div className="text-center">
                    <Button
                      onClick={handleCarregarMaisMeses}
                      aria-expanded={gruposVisiveis.length < totalGruposFiltrados}
                      className="font-semibold"
                    >
                      Carregar mais meses
                    </Button>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="rounded-xl border border-dashed border-muted-foreground/40 bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                Nenhuma movimentação encontrada para os filtros selecionados.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }, [
    viewModel,
    gruposFiltrados,
    gruposVisiveis,
    movimentosPorMes,
    handleCarregarMaisMeses,
    handleLimparFiltros,
    handleMostrarResumoIa,
    filtroTipo,
    filtroInicio,
    filtroFim,
    tiposDisponiveis,
    totalGruposFiltrados,
  ]);

  const conteudoInformacoes = viewModel ? (
    <InformacoesProcesso
      dados={viewModel.dados}
      partes={viewModel.partes}
      anexos={viewModel.anexos}
      onVerTodosAnexos={() => setMostrarTodosAnexos(true)}
      onAbrirAnexo={handleAbrirAnexo}
      podeAbrirAnexo={podeAbrirAnexo}
      anexoEmCarregamentoId={anexoEmCarregamentoId}
    />
  ) : null;

  const conteudoRelacionados = viewModel ? (
    <ProcessosRelacionadosTabela itens={viewModel.relacionados} onAbrir={handleAbrirRelacionado} />
  ) : null;

  const primeiroAnexoDisponivel =
    movimentacaoSelecionada?.anexos.find((anexo) => podeAbrirAnexo(anexo)) ??
    movimentacaoSelecionada?.anexos[0] ??
    null;
  const podeAbrirPrimeiroAnexo =
    primeiroAnexoDisponivel ? podeAbrirAnexo(primeiroAnexoDisponivel) : false;
  const identificadorPrimeiroAnexo =
    primeiroAnexoDisponivel?.idAnexo ?? primeiroAnexoDisponivel?.id ?? null;
  const carregandoPrimeiroAnexo =
    identificadorPrimeiroAnexo != null && anexoEmCarregamentoId === identificadorPrimeiroAnexo;
  const isMarkdownSelecionado = Boolean(
    movimentacaoSelecionada &&
      typeof movimentacaoSelecionada.tags?.formatted === "string" &&
      movimentacaoSelecionada.tags.formatted.trim().toLowerCase() === "md",
  );
  const conteudoSelecionado = movimentacaoSelecionada?.conteudo ?? "";
  const podeResumirMovimentacaoSelecionada = Boolean(
    movimentacaoSelecionada &&
      typeof movimentacaoSelecionada.tipoAndamento === "string" &&
      movimentacaoSelecionada.tipoAndamento.trim().length > 0 &&
      movimentacaoSelecionada.conteudo &&
      movimentacaoSelecionada.conteudo.trim().length > 0,
  );

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col space-y-6 px-4 lg:px-0">
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
          <Card className="border-none bg-card shadow-sm">
            <CardContent className="space-y-4 p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                    {viewModel.cabecalho.codigo}
                  </p>
                  <h1 className="text-3xl font-semibold text-foreground">{viewModel.cabecalho.nome}</h1>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <span>{viewModel.cabecalho.cidadeEstado}</span>
                    <span className="hidden sm:inline">•</span>
                    <span>{viewModel.cabecalho.tribunal}</span>
                    <span className="hidden sm:inline">•</span>
                    <span>{viewModel.cabecalho.instance}</span>
                    {viewModel.cabecalho.ultimaAtualizacao ? (
                      <>
                        <span className="hidden sm:inline">•</span>
                        <span>Atualizado em {viewModel.cabecalho.ultimaAtualizacao}</span>
                      </>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <Badge className="bg-primary/10 text-primary">{viewModel.cabecalho.status}</Badge>
                  <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">
                    {viewModel.cabecalho.fase}
                  </Badge>
                  <Badge variant="secondary" className="bg-muted text-foreground">
                    {viewModel.cabecalho.area}
                  </Badge>
                </div>
              </div>
              {viewModel.cabecalho.tags.length || viewModel.cabecalho.subjects.length ? (
                <div className="flex flex-wrap gap-2">
                  {viewModel.cabecalho.tags.map((tag) => (
                    <Badge key={`tag-${tag}`} variant="secondary" className="bg-primary/10 text-primary">
                      {tag}
                    </Badge>
                  ))}
                  {viewModel.cabecalho.subjects.map((subject) => (
                    <Badge key={`subject-${subject}`} variant="outline" className="border-muted-foreground/30">
                      {subject}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {viewModel ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            <Card className="border border-muted-foreground/10 bg-card text-foreground shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Tribunal
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xl font-semibold">{viewModel.cabecalho.tribunal}</CardContent>
            </Card>
            <Card className="border border-muted-foreground/10 bg-card text-foreground shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Cidade / Estado
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xl font-semibold">{viewModel.cabecalho.cidadeEstado}</CardContent>
            </Card>
            <Card className="border border-muted-foreground/10 bg-card text-foreground shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Instância
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xl font-semibold">{viewModel.cabecalho.instance}</CardContent>
            </Card>
            <Card className="border border-muted-foreground/10 bg-card text-foreground shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Justiça
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xl font-semibold">{viewModel.cabecalho.justiceDescription}</CardContent>
            </Card>
            <Card className="border border-muted-foreground/10 bg-card text-foreground shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Valor da causa
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xl font-semibold">{viewModel.cabecalho.valorDaCausa}</CardContent>
            </Card>
            <Card className="border border-muted-foreground/10 bg-card text-foreground shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Distribuído em
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xl font-semibold">{viewModel.cabecalho.distribuidoEm}</CardContent>
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
        </Tabs>
      </section>

      <Dialog open={modalAberto} onOpenChange={handleAlterarModalConteudo}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
            <DialogTitle>
              {movimentacaoSelecionada?.stepType || "Movimentação selecionada"}
            </DialogTitle>
            {podeResumirMovimentacaoSelecionada ? (
              <Button
                type="button"
                onClick={handleGerarResumoIa}
                disabled={carregandoResumo}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg transition-all hover:bg-primary/90 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {carregandoResumo ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Resumindo...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Resumir com IA
                  </>
                )}
              </Button>
            ) : null}
          </DialogHeader>
          {movimentacaoSelecionada ? (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                {movimentacaoSelecionada.dataFormatada ?? "Data não informada"}
              </div>
              {carregandoResumo ? (
                <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm text-primary">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Gerando resumo com IA...
                </div>
              ) : null}
              {resumoIa ? (
                <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-4">
                  <h3 className="text-sm font-semibold text-primary">Resumo com IA</h3>
                  <SafeMarkdown content={resumoIa} className="text-primary" />
                </div>
              ) : null}
              {erroResumo ? <p className="text-sm text-destructive">{erroResumo}</p> : null}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Conteúdo
                </h3>
                <div className="rounded-lg border border-muted-foreground/10 bg-muted/40 p-4">
                  {conteudoSelecionado ? (
                    isMarkdownSelecionado ? (
                      <SafeMarkdown content={conteudoSelecionado} className="text-foreground" />
                    ) : (
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                        {conteudoSelecionado.replace(/\*\*/g, "")}
                      </p>
                    )
                  ) : (
                    <p className="text-sm text-muted-foreground">Sem conteúdo disponível.</p>
                  )}
                </div>
              </div>
              {movimentacaoSelecionada.anexos.length ? (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Anexos
                  </h3>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {movimentacaoSelecionada.anexos.map((anexo) => (
                      <li key={`${movimentacaoSelecionada.id}-anexo-${anexo.id}`}>
                        {anexo.titulo}
                        {anexo.data ? ` • ${anexo.data}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Selecione uma movimentação para visualizar.</p>
          )}
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:items-center">
            {primeiroAnexoDisponivel ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full sm:mr-auto sm:w-auto"
                onClick={() => handleAbrirAnexo(primeiroAnexoDisponivel)}
                disabled={!podeAbrirPrimeiroAnexo || carregandoPrimeiroAnexo}
              >
                {podeAbrirPrimeiroAnexo
                  ? carregandoPrimeiroAnexo
                    ? "Abrindo..."
                    : "Abrir documento"
                  : "Link indisponível"}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              onClick={() => handleAlterarModalConteudo(false)}
              className="w-full sm:w-auto"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={mostrarDialogMovimentacao} onOpenChange={handleAlterarDialogoMovimentacao}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Registrar movimentação</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmitMovimentacao} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="movimentacao-data" className="text-sm font-medium">
                  Data
                </Label>
                <Input
                  id="movimentacao-data"
                  type="date"
                  value={formMovimentacao.data}
                  onChange={(event) =>
                    setFormMovimentacao((anterior) => ({
                      ...anterior,
                      data: event.target.value,
                    }))
                  }
                />
                {errosMovimentacao.data ? (
                  <p className="text-sm text-destructive">{errosMovimentacao.data}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="movimentacao-tipo" className="text-sm font-medium">
                  Tipo
                </Label>
                <Input
                  id="movimentacao-tipo"
                  value={formMovimentacao.tipo}
                  onChange={(event) =>
                    setFormMovimentacao((anterior) => ({
                      ...anterior,
                      tipo: event.target.value,
                    }))
                  }
                />
                {errosMovimentacao.tipo ? (
                  <p className="text-sm text-destructive">{errosMovimentacao.tipo}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="movimentacao-tipo-publicacao" className="text-sm font-medium">
                  Tipo de publicação
                </Label>
                <Input
                  id="movimentacao-tipo-publicacao"
                  value={formMovimentacao.tipoPublicacao}
                  onChange={(event) =>
                    setFormMovimentacao((anterior) => ({
                      ...anterior,
                      tipoPublicacao: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="movimentacao-texto-categoria" className="text-sm font-medium">
                  Categoria
                </Label>
                <Input
                  id="movimentacao-texto-categoria"
                  value={formMovimentacao.textoCategoria}
                  onChange={(event) =>
                    setFormMovimentacao((anterior) => ({
                      ...anterior,
                      textoCategoria: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="movimentacao-conteudo" className="text-sm font-medium">
                Conteúdo
              </Label>
              <Textarea
                id="movimentacao-conteudo"
                rows={6}
                value={formMovimentacao.conteudo}
                onChange={(event) =>
                  setFormMovimentacao((anterior) => ({
                    ...anterior,
                    conteudo: event.target.value,
                  }))
                }
              />
              {errosMovimentacao.conteudo ? (
                <p className="text-sm text-destructive">{errosMovimentacao.conteudo}</p>
              ) : null}
            </div>
            {erroMovimentacao ? (
              <p className="text-sm text-destructive">{erroMovimentacao}</p>
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleAlterarDialogoMovimentacao(false)}
                disabled={salvandoMovimentacao}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={salvandoMovimentacao}>
                {salvandoMovimentacao ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Salvar movimentação"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={mostrarTodosAnexos} onOpenChange={setMostrarTodosAnexos}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Anexos do processo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {viewModel && viewModel.anexos.length ? (
              viewModel.anexos.map((anexo) => (
                <div
                  key={anexo.id}
                  className="flex flex-col gap-2 rounded-lg border border-muted-foreground/10 bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold text-foreground">{anexo.titulo}</p>
                    <p className="text-xs text-muted-foreground">{anexo.data ?? NAO_INFORMADO}</p>
                  </div>
                  {(() => {
                    const habilitado = podeAbrirAnexo(anexo);
                    const identificador = anexo.idAnexo ?? anexo.id;
                    const carregando = identificador != null && anexoEmCarregamentoId === identificador;
                    return (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full sm:w-auto"
                        onClick={() => handleAbrirAnexo(anexo)}
                        disabled={!habilitado || carregando}
                      >
                        {habilitado ? (carregando ? "Abrindo..." : "Abrir documento") : "Link indisponível"}
                      </Button>
                    );
                  })()}
                </div>
              ))
            ) : (
              <p className="rounded-lg border border-dashed border-muted-foreground/40 p-4 text-sm text-muted-foreground">
                Nenhum anexo disponível.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(anexoVisualizado)} onOpenChange={handleAlterarVisualizadorAnexo}>
        <DialogContent className="max-h-[90vh] w-full max-w-5xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>{anexoVisualizado?.titulo ?? "Anexo"}</DialogTitle>
          </DialogHeader>
          {anexoVisualizado ? (
            <div className="h-[75vh] w-full overflow-hidden">
              <iframe
                title={anexoVisualizado.titulo}
                src={anexoVisualizado.conteudo}
                className="h-full w-full rounded-md border border-muted-foreground/20 bg-background"
                allowFullScreen
              />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
