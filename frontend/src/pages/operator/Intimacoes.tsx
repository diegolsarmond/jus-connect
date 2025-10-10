import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchIntimacoes, type Intimacao } from "@/services/intimacoes";
import { ExternalLink, Loader2, RotateCcw } from "lucide-react";

type NormalizedDestinatario = {
  nome: string;
  polo?: string;
};

type NormalizedAdvogado = {
  nome: string;
  numeroOab?: string;
  ufOab?: string;
};

function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return value;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function normalizeDestinatarios(raw: unknown): NormalizedDestinatario[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((item) => parseMaybeJson(item))
    .map((item) => {
      if (typeof item === "string") {
        const nome = item.trim();
        return nome ? { nome } : null;
      }

      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        const nome = typeof record.nome === "string" ? record.nome.trim() : undefined;
        const polo = typeof record.polo === "string" ? record.polo.trim() : undefined;

        if (nome) {
          return {
            nome,
            polo: polo && polo.length > 0 ? polo : undefined,
          };
        }
      }

      return null;
    })
    .filter((value): value is NormalizedDestinatario => value !== null);
}

function normalizeDestinatariosAdvogados(raw: unknown): NormalizedAdvogado[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((item) => parseMaybeJson(item))
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as Record<string, unknown>;
      const advogadoValue = "advogado" in record ? parseMaybeJson(record.advogado) : record;

      if (!advogadoValue || typeof advogadoValue !== "object") {
        return null;
      }

      const advogado = advogadoValue as Record<string, unknown>;
      const nome = typeof advogado.nome === "string" ? advogado.nome.trim() : undefined;

      const numero =
        typeof advogado.numero_oab === "string" || typeof advogado.numero_oab === "number"
          ? String(advogado.numero_oab).trim()
          : typeof advogado.numeroOab === "string"
          ? advogado.numeroOab.trim()
          : undefined;

      const uf =
        typeof advogado.uf_oab === "string"
          ? advogado.uf_oab.trim()
          : typeof advogado.ufOab === "string"
          ? advogado.ufOab.trim()
          : undefined;

      if (!nome) {
        return null;
      }

      return {
        nome,
        numeroOab: numero && numero.length > 0 ? numero : undefined,
        ufOab: uf && uf.length > 0 ? uf : undefined,
      };
    })
    .filter((value): value is NormalizedAdvogado => value !== null);
}

function formatDateTime(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return format(date, "dd/MM/yyyy HH:mm", { locale: ptBR });
}

function formatDateOrText(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (!Number.isNaN(date.getTime())) {
    return format(date, "dd/MM/yyyy", { locale: ptBR });
  }

  return value;
}

function hasContent(value: ReactNode): boolean {
  if (value === null || value === undefined || value === false) {
    return false;
  }

  if (Array.isArray(value)) {
    return value.some((item) => hasContent(item));
  }

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  if (typeof value === "number") {
    return true;
  }

  if (typeof value === "boolean") {
    return true;
  }

  return true;
}

function InfoItem({ label, children }: { label: string; children?: ReactNode }) {
  if (!hasContent(children ?? null)) {
    return null;
  }

  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  );
}

export default function Intimacoes() {
  const [intimacoes, setIntimacoes] = useState<Intimacao[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadIntimacoes = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);

    try {
      const data = await fetchIntimacoes(signal);
      setIntimacoes(data);
    } catch (err) {
      if (signal?.aborted) {
        return;
      }

      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Não foi possível carregar as intimações.");
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadIntimacoes(controller.signal);

    return () => {
      controller.abort();
    };
  }, [loadIntimacoes]);

  const handleRefresh = () => {
    loadIntimacoes();
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">Intimações</h1>
          <p className="text-sm text-muted-foreground">
            Consulte as intimações mais recentes da sua empresa e expanda para visualizar os detalhes completos de cada caso.
          </p>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
          Atualizar
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Erro ao carregar dados</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && intimacoes.length === 0 ? (
        <div className="space-y-3">
          {[0, 1, 2].map((index) => (
            <div key={index} className="rounded-lg border border-border p-4">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="mt-3 h-4 w-full" />
              <Skeleton className="mt-2 h-4 w-3/4" />
            </div>
          ))}
        </div>
      ) : null}

      {!loading && intimacoes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-muted-foreground/30 p-8 text-center text-sm text-muted-foreground">
          Nenhuma intimação encontrada.
        </div>
      ) : null}

      {intimacoes.length > 0 ? (
        <Accordion type="single" collapsible className="space-y-3">
          {intimacoes.map((intimacao, index) => {
            const headerDate =
              formatDateTime(intimacao.data_disponibilizacao) ??
              formatDateTime(intimacao.created_at) ??
              formatDateTime(intimacao.updated_at);
            const destinatarios = normalizeDestinatarios(intimacao.destinatarios);
            const destinatariosAdv = normalizeDestinatariosAdvogados(intimacao.destinatarios_advogados);
            const prazoFormatado = formatDateOrText(intimacao.prazo);
            const cancelamentoFormatado = formatDateTime(intimacao.data_cancelamento);
            const criadaEm = formatDateTime(intimacao.created_at);
            const atualizadaEm = formatDateTime(intimacao.updated_at);
            const disponibilizadaEm = formatDateTime(intimacao.data_disponibilizacao);

            return (
              <AccordionItem
                key={String(intimacao.id ?? index)}
                value={String(intimacao.id ?? index)}
                className="overflow-hidden rounded-lg border"
              >
                <AccordionTrigger className="px-4">
                  <div className="flex w-full flex-col gap-1 text-left">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      {intimacao.numero_processo ? (
                        <Link
                          to="/processos"
                          className="text-sm font-semibold text-primary underline-offset-2 hover:underline"
                        >
                          {intimacao.numero_processo}
                        </Link>
                      ) : (
                        <span className="text-sm font-semibold text-muted-foreground">
                          Número do processo não informado
                        </span>
                      )}
                      {headerDate ? (
                        <span className="text-xs uppercase tracking-wide text-muted-foreground">{headerDate}</span>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                      {intimacao.siglaTribunal ? <span>{intimacao.siglaTribunal}</span> : null}
                      {intimacao.tipoComunicacao ? <span>{intimacao.tipoComunicacao}</span> : null}
                      {intimacao.tipodocumento ? <span>{intimacao.tipodocumento}</span> : null}
                      {intimacao.status ? <span>Status: {intimacao.status}</span> : null}
                      {typeof intimacao.nao_lida === "boolean" ? (
                        <span>{intimacao.nao_lida ? "Não lida" : "Lida"}</span>
                      ) : null}
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4">
                  <div className="space-y-6 py-2">
                    <div className="grid gap-4 md:grid-cols-2">
                      <InfoItem label="Órgão">{intimacao.nomeOrgao}</InfoItem>
                      <InfoItem label="Classe">
                        {intimacao.nomeclasse ? (
                          <>
                            {intimacao.nomeclasse}
                            {intimacao.codigoclasse ? ` (${intimacao.codigoclasse})` : null}
                          </>
                        ) : intimacao.codigoclasse ? (
                          intimacao.codigoclasse
                        ) : null}
                      </InfoItem>
                      <InfoItem label="Meio">{intimacao.meio}</InfoItem>
                      <InfoItem label="Número da comunicação">{intimacao.numerocomunicacao}</InfoItem>
                      <InfoItem label="Prazo">{prazoFormatado}</InfoItem>
                      <InfoItem label="Disponibilizada em">{disponibilizadaEm}</InfoItem>
                      <InfoItem label="Criada em">{criadaEm}</InfoItem>
                      <InfoItem label="Atualizada em">{atualizadaEm}</InfoItem>
                      <InfoItem label="Status">{intimacao.status}</InfoItem>
                      <InfoItem label="Ativa">
                        {typeof intimacao.ativo === "boolean" ? (intimacao.ativo ? "Sim" : "Não") : null}
                      </InfoItem>
                      <InfoItem label="Motivo do cancelamento">{intimacao.motivo_cancelamento}</InfoItem>
                      <InfoItem label="Data do cancelamento">{cancelamentoFormatado}</InfoItem>
                      <InfoItem label="Hash">{intimacao.hash}</InfoItem>
                      <InfoItem label="ID externo">{intimacao.external_id}</InfoItem>
                      <InfoItem label="ID do usuário">{intimacao.idusuario}</InfoItem>
                      <InfoItem label="ID da empresa">{intimacao.idempresa}</InfoItem>
                    </div>

                    <InfoItem label="Texto">
                      {intimacao.texto ? (
                        <div className="whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-sm leading-relaxed">
                          {intimacao.texto}
                        </div>
                      ) : null}
                    </InfoItem>

                    <InfoItem label="Destinatários">
                      {destinatarios.length > 0 ? (
                        <ul className="list-disc space-y-1 pl-5">
                          {destinatarios.map((destinatario, destinatarioIndex) => (
                            <li key={`${destinatario.nome}-${destinatario.polo ?? "p"}-${destinatarioIndex}`}>
                              {destinatario.nome}
                              {destinatario.polo ? ` (${destinatario.polo})` : null}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </InfoItem>

                    <InfoItem label="Advogados">
                      {destinatariosAdv.length > 0 ? (
                        <ul className="list-disc space-y-1 pl-5">
                          {destinatariosAdv.map((advogado, advogadoIndex) => (
                            <li key={`${advogado.nome}-${advogado.numeroOab ?? "adv"}-${advogadoIndex}`}>
                              {advogado.nome}
                              {advogado.ufOab || advogado.numeroOab
                                ? ` (OAB ${advogado.ufOab ?? ""}${
                                    advogado.ufOab && advogado.numeroOab ? " " : ""
                                  }${advogado.numeroOab ?? ""})`
                                : null}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </InfoItem>

                    <InfoItem label="Link">
                      {intimacao.link ? (
                        <a
                          href={intimacao.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-primary underline-offset-2 hover:underline"
                        >
                          Acessar publicação
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      ) : null}
                    </InfoItem>
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      ) : null}
    </div>
  );
}
