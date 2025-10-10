import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ChevronLeft, ChevronRight, Eye, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { getApiUrl } from "@/lib/api";

interface Process {
  numeroProcesso: string;
  dataAjuizamento?: string;
  dataUltimaMovimentacao?: string;
  classe?: string;
  assuntos?: Array<{ nome: string }>;
  partes?: Array<{ nome: string; polo: string }>;
  orgaoJulgador?: string;
  situacao?: string;
}

type SearchType = "cpf" | "numero";

type ApiErrorPayload = {
  error?: unknown;
};

const normalizeSearchType = (value: string | null): SearchType => {
  return value === "numero" ? "numero" : "cpf";
};

const ProcessList = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [processes, setProcesses] = useState<Process[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchType, setSearchType] = useState<SearchType>("cpf");
  const [searchValue, setSearchValue] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const performSearch = useCallback(
    async (type: SearchType, value: string) => {
      const trimmedValue = value.trim();

      if (!trimmedValue) {
        toast({
          title: "Informe um valor para busca",
          description: "Digite o número do processo ou o CPF/CNPJ da parte antes de continuar.",
        });
        return;
      }

      const params = new URLSearchParams();
      if (type === "cpf") {
        params.set("cpfCnpjParte", trimmedValue);
      } else {
        params.set("numeroProcesso", trimmedValue);
      }

      setIsLoading(true);
      setCurrentPage(1);

      try {
        const response = await fetch(getApiUrl(`consulta-publica/processos?${params.toString()}`), {
          headers: { Accept: "application/json" },
        });
        const data = (await response.json().catch(() => null)) as unknown;

        if (!response.ok) {
          const message =
            data && typeof data === "object" && data !== null && "error" in data
              ? String((data as ApiErrorPayload).error ?? "Falha ao consultar processos.")
              : "Não foi possível consultar processos.";
          throw new Error(message);
        }

        let rawProcessData: unknown[] = [];

        if (data && typeof data === "object" && "content" in data && Array.isArray((data as { content?: unknown }).content)) {
          rawProcessData = (data as { content: unknown[] }).content;
        } else if (Array.isArray(data)) {
          rawProcessData = data as unknown[];
        } else if (data && typeof data === "object" && "numeroProcesso" in data) {
          rawProcessData = [data];
        }

        const normalizeDate = (value: unknown) => {
          if (!value) return "";

          const dateString = typeof value === "string" || value instanceof Date ? value : String(value);
          const parsed = new Date(dateString);

          if (Number.isNaN(parsed.getTime())) {
            return "";
          }

          return parsed.toLocaleDateString("pt-BR");
        };

        const normalizedProcesses = rawProcessData
          .map((entry) => {
            if (!entry || typeof entry !== "object") {
              return null;
            }

            const record = entry as Record<string, unknown>;
            const numeroProcesso = typeof record.numeroProcesso === "string" ? record.numeroProcesso : "";

            if (!numeroProcesso) {
              return null;
            }

            const tramitacoes = Array.isArray(record.tramitacoes)
              ? (record.tramitacoes as Array<Record<string, unknown>>)
              : [];
            const tramitacaoAtual =
              record.tramitacaoAtual && typeof record.tramitacaoAtual === "object"
                ? (record.tramitacaoAtual as Record<string, unknown>)
                : undefined;
            const tramitacao =
              tramitacaoAtual && Object.keys(tramitacaoAtual).length > 0
                ? tramitacaoAtual
                : tramitacoes[0] ?? {};

            const ultimoMovimento =
              tramitacao && typeof tramitacao.ultimoMovimento === "object" && tramitacao.ultimoMovimento
                ? (tramitacao.ultimoMovimento as Record<string, unknown>)
                : undefined;

            const classes = Array.isArray(tramitacao?.classe)
              ? (tramitacao.classe as Array<Record<string, unknown>>)
              : [];
            const assuntos = Array.isArray(tramitacao?.assunto)
              ? (tramitacao.assunto as Array<Record<string, unknown>>)
              : [];
            const partes = Array.isArray(tramitacao?.partes)
              ? (tramitacao.partes as Array<Record<string, unknown>>)
              : [];

            const classeRegistro = classes[0] ?? {};
            const classeDescricao =
              typeof classeRegistro.descricao === "string" && classeRegistro.descricao
                ? `${classeRegistro.descricao}${classeRegistro.codigo ? ` (${classeRegistro.codigo})` : ""}`
                : typeof classeRegistro.nome === "string" && classeRegistro.nome
                ? `${classeRegistro.nome}${classeRegistro.codigo ? ` (${classeRegistro.codigo})` : ""}`
                : "";

            const normalizedAssuntos = assuntos
              .map((item) => {
                if (!item || typeof item !== "object") {
                  return null;
                }

                const nome =
                  typeof item.nome === "string" && item.nome
                    ? item.nome
                    : typeof item.descricao === "string" && item.descricao
                    ? item.descricao
                    : null;

                if (!nome) {
                  return null;
                }

                return { nome };
              })
              .filter((item): item is { nome: string } => Boolean(item));

            const normalizedPartes = partes
              .map((item) => {
                if (!item || typeof item !== "object") {
                  return null;
                }

                const nome = typeof item.nome === "string" && item.nome ? item.nome : null;

                if (!nome) {
                  return null;
                }

                return {
                  nome,
                  polo: typeof item.polo === "string" ? item.polo : "",
                };
              })
              .filter((item): item is { nome: string; polo: string } => Boolean(item));

            const orgaoDireto = Array.isArray(tramitacao?.orgaoJulgador)
              ? (tramitacao.orgaoJulgador as Array<Record<string, unknown>>)[0]
              : typeof tramitacao?.orgaoJulgador === "object" && tramitacao.orgaoJulgador
              ? (tramitacao.orgaoJulgador as Record<string, unknown>)
              : undefined;

            let orgaoJulgador =
              orgaoDireto && typeof orgaoDireto.nome === "string" && orgaoDireto.nome ? orgaoDireto.nome : "";

            if (!orgaoJulgador) {
              const distribuicoes = Array.isArray(tramitacao?.distribuicao)
                ? (tramitacao.distribuicao as Array<Record<string, unknown>>)
                : [];

              for (const distribuicao of distribuicoes) {
                if (!distribuicao || typeof distribuicao !== "object") {
                  continue;
                }

                const orgaoDistribuicao = Array.isArray(distribuicao.orgaoJulgador)
                  ? (distribuicao.orgaoJulgador as Array<Record<string, unknown>>)[0]
                  : typeof distribuicao.orgaoJulgador === "object" && distribuicao.orgaoJulgador
                  ? (distribuicao.orgaoJulgador as Record<string, unknown>)
                  : undefined;

                if (orgaoDistribuicao && typeof orgaoDistribuicao.nome === "string" && orgaoDistribuicao.nome) {
                  orgaoJulgador = orgaoDistribuicao.nome;
                  break;
                }
              }

              if (!orgaoJulgador && tramitacao && typeof tramitacao.orgaoJulgadorLocal === "object" && tramitacao.orgaoJulgadorLocal) {
                const local = tramitacao.orgaoJulgadorLocal as Record<string, unknown>;

                if (typeof local.nome === "string" && local.nome) {
                  orgaoJulgador = local.nome;
                }
              }
            }

            const situacao =
              typeof record.situacao === "string" && record.situacao.trim()
                ? record.situacao
                : tramitacao && "ativo" in tramitacao && tramitacao.ativo === false
                ? "Inativo"
                : tramitacao && "ativo" in tramitacao
                ? "Ativo"
                : "";

            return {
              numeroProcesso,
              dataAjuizamento: normalizeDate(
                tramitacao?.dataHoraUltimaDistribuicao ??
                  tramitacao?.dataHoraAjuizamento ??
                  tramitacao?.dataDistribuicao ??
                  tramitacao?.dataDistribuicaoInicial ??
                  (Array.isArray(tramitacao?.distribuicao) && tramitacao.distribuicao.length > 0
                    ? (tramitacao.distribuicao[0] as Record<string, unknown>).dataHora
                    : undefined),
              ),
              dataUltimaMovimentacao: normalizeDate(ultimoMovimento?.dataHora ?? tramitacao?.dataHoraUltimoMovimento),
              classe: classeDescricao,
              assuntos: normalizedAssuntos,
              partes: normalizedPartes,
              orgaoJulgador,
              situacao,
            } satisfies Process;
          })
          .filter((item): item is Process => Boolean(item));

        setProcesses(normalizedProcesses);

        if (normalizedProcesses.length === 0) {
          toast({ title: "Nenhum processo encontrado" });
        } else {
          toast({
            title: "Consulta realizada",
            description: `${normalizedProcesses.length} processo(s) encontrado(s).`,
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro ao consultar processos.";
        toast({ title: "Erro na consulta", description: message, variant: "destructive" });
        setProcesses([]);
      } finally {
        setIsLoading(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    const typeParam = normalizeSearchType(searchParams.get("type"));
    const valueParam = searchParams.get("value") ?? "";

    setSearchType(typeParam);
    setSearchValue(valueParam);

    if (valueParam.trim()) {
      void performSearch(typeParam, valueParam);
    } else {
      setProcesses([]);
    }
  }, [performSearch, searchParams]);

  const handleSearch = () => {
    const trimmedValue = searchValue.trim();

    if (!trimmedValue) {
      toast({ title: "Informe um valor para busca" });
      return;
    }

    const params = new URLSearchParams();
    params.set("type", searchType);
    params.set("value", trimmedValue);

    navigate({ pathname: "/consulta-publica/processos", search: params.toString() });
  };

  const totalPages = useMemo(() => Math.max(1, Math.ceil(processes.length / itemsPerPage)), [processes.length]);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentProcesses = processes.slice(startIndex, endIndex);

  const getStatusBadge = (situacao?: string) => {
    if (!situacao) {
      return <Badge variant="outline">Não informado</Badge>;
    }

    const normalized = situacao.toLowerCase();

    if (normalized === "ativo") {
      return <Badge className="bg-success/10 text-success border-success/20">{situacao}</Badge>;
    }

    if (normalized === "arquivado") {
      return <Badge className="bg-muted text-muted-foreground border-border">{situacao}</Badge>;
    }

    if (normalized === "suspenso") {
      return <Badge className="bg-warning/10 text-warning border-warning/20">{situacao}</Badge>;
    }

    return <Badge variant="outline">{situacao}</Badge>;
  };

  const getParties = (process: Process) => {
    if (!process.partes || process.partes.length === 0) return "Não informado";
    return process.partes.map((party) => party.nome).join(" x ");
  };

  const getSubjects = (process: Process) => {
    if (!process.assuntos || process.assuntos.length === 0) return "Não informado";
    return process.assuntos.map((subject) => subject.nome).join(" | ");
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <Button variant="ghost" onClick={() => navigate("/consulta-publica")} className="w-fit">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Voltar
      </Button>

      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-foreground">Resultados da consulta</h1>
        <p className="text-muted-foreground">
          Ajuste os filtros para localizar processos específicos e visualize os detalhes quando necessário.
        </p>
      </div>

      <Card className="p-6 space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <Select value={searchType} onValueChange={(value) => setSearchType(value as SearchType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="numero">Número do processo</SelectItem>
              <SelectItem value="cpf">CPF/CNPJ da parte</SelectItem>
            </SelectContent>
          </Select>

          <Input
            placeholder={searchType === "numero" ? "0000000-00.0000.0.00.0000" : "000.000.000-00"}
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                handleSearch();
              }
            }}
          />

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setSearchValue("")}>
              Limpar
            </Button>
            <Button className="flex-1" onClick={handleSearch} disabled={isLoading}>
              <Search className="mr-2 h-4 w-4" />
              {isLoading ? "Buscando..." : "Buscar"}
            </Button>
          </div>
        </div>
      </Card>

      {processes.length > 0 ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Processo</TableHead>
                  <TableHead>Data de ajuizamento</TableHead>
                  <TableHead>Última movimentação</TableHead>
                  <TableHead>Classe</TableHead>
                  <TableHead>Assunto</TableHead>
                  <TableHead>Partes</TableHead>
                  <TableHead>Órgão julgador</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentProcesses.map((process) => (
                  <TableRow key={process.numeroProcesso} className="hover:bg-muted/30">
                    <TableCell className="font-medium text-primary">{process.numeroProcesso}</TableCell>
                    <TableCell>{process.dataAjuizamento || "-"}</TableCell>
                    <TableCell>{process.dataUltimaMovimentacao || "-"}</TableCell>
                    <TableCell className="max-w-xs">
                      <div className="truncate" title={process.classe}>
                        {process.classe || "Não informado"}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-sm">
                      <div className="line-clamp-2 text-sm" title={getSubjects(process)}>
                        {getSubjects(process)}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <div className="truncate" title={getParties(process)}>
                        {getParties(process)}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <div className="truncate text-sm" title={process.orgaoJulgador}>
                        {process.orgaoJulgador || "Não informado"}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(process.situacao)}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => navigate(`/consulta-publica/processos/${encodeURIComponent(process.numeroProcesso)}`)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border p-4 text-sm text-muted-foreground">
              <span>
                {startIndex + 1} - {Math.min(endIndex, processes.length)} de {processes.length}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="font-medium">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      ) : (
        <Card className="p-10 text-center text-muted-foreground">
          Informe os dados da consulta para visualizar os processos disponíveis.
        </Card>
      )}
    </div>
  );
};

export default ProcessList;
