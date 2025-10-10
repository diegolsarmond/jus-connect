import { useCallback, useEffect, useState } from "react";
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

type SearchType = "cpf" | "numero" | "oab";

const formatProcessNumber = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 20);
  const part1 = digits.slice(0, 7);
  const part2 = digits.slice(7, 9);
  const part3 = digits.slice(9, 13);
  const part4 = digits.slice(13, 14);
  const part5 = digits.slice(14, 16);
  const part6 = digits.slice(16, 20);

  let result = part1;
  if (part2) result += `-${part2}`;
  if (part3) result += `.${part3}`;
  if (part4) result += `.${part4}`;
  if (part5) result += `.${part5}`;
  if (part6) result += `.${part6}`;

  return result;
};

const formatCpfCnpj = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 14);

  if (digits.length <= 11) {
    const part1 = digits.slice(0, 3);
    const part2 = digits.slice(3, 6);
    const part3 = digits.slice(6, 9);
    const part4 = digits.slice(9, 11);

    let result = part1;
    if (part2) result += `.${part2}`;
    if (part3) result += `.${part3}`;
    if (part4) result += `-${part4}`;

    return result;
  }

  const part1 = digits.slice(0, 2);
  const part2 = digits.slice(2, 5);
  const part3 = digits.slice(5, 8);
  const part4 = digits.slice(8, 12);
  const part5 = digits.slice(12, 14);

  let result = part1;
  if (part2) result += `.${part2}`;
  if (part3) result += `.${part3}`;
  if (part4) result += `/${part4}`;
  if (part5) result += `-${part5}`;

  return result;
};

const formatOab = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 6);
  const letters = value.replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase();
  const hasSlash = value.includes("/");

  if (!digits) {
    return letters ? `${hasSlash ? "/" : ""}${letters}` : "";
  }

  let result = digits;

  if (hasSlash || letters) {
    result += "/";
  }

  if (letters) {
    result += letters;
  }

  return result;
};

const maskSearchValue = (type: SearchType, value: string) => {
  if (type === "numero") {
    return formatProcessNumber(value);
  }

  if (type === "cpf") {
    return formatCpfCnpj(value);
  }

  return formatOab(value);
};

const sanitizeSearchValue = (type: SearchType, value: string) => {
  if (type === "numero") {
    return value.replace(/\D/g, "").slice(0, 20);
  }

  if (type === "cpf") {
    return value.replace(/\D/g, "").slice(0, 14);
  }

  const digits = value.replace(/\D/g, "").slice(0, 6);
  const letters = value.replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase();
  if (!digits) {
    return "";
  }
  return letters ? `${digits}/${letters}` : digits;
};

const getPlaceholder = (type: SearchType) => {
  if (type === "numero") {
    return "0000000-00.0000.0.00.0000";
  }

  if (type === "cpf") {
    return "000.000.000-00 ou 00.000.000/0000-00";
  }

  return "000000/UF";
};

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

type ApiErrorPayload = {
  error?: unknown;
};

const normalizeSearchType = (value: string | null): SearchType => {
  if (value === "numero") {
    return "numero";
  }

  if (value === "oab") {
    return "oab";
  }

  return "cpf";
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
  const [totalResults, setTotalResults] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 10;

  const handleTypeChange = (value: SearchType) => {
    setSearchType(value);
    setSearchValue("");
  };

  const performSearch = useCallback(
    async (type: SearchType, value: string, page = 1) => {
      const sanitizedValue = sanitizeSearchValue(type, value);

      if (!sanitizedValue) {
        toast({
          title: "Informe um valor para busca",
          description: "Digite o número do processo, o CPF/CNPJ da parte ou a OAB do advogado antes de continuar.",
        });
        return;
      }

      const params = new URLSearchParams();
      if (type === "cpf") {
        params.set("cpfCnpjParte", sanitizedValue);
      } else if (type === "numero") {
        params.set("numeroProcesso", sanitizedValue);
      } else {
        params.set("oab", sanitizedValue);
      }
      params.set("page", String(page));
      params.set("pageSize", String(itemsPerPage));

      setIsLoading(true);

      try {
        const response = await fetch(getApiUrl(`consulta-publica/processos?${params.toString()}`), {
          headers: { Accept: "application/json" },
        });
        let data: unknown = null;

        if (response.status !== 404) {
          data = await response.json().catch(() => null);
        }

        if (response.status === 404) {
          setProcesses([]);
          setCurrentPage(1);
          setTotalResults(0);
          setTotalPages(1);
          toast({ title: "Nenhum processo encontrado", description: "A consulta não retornou processos para os parâmetros informados." });
          return;
        }

        if (!response.ok) {
          const message =
            data && typeof data === "object" && data !== null && "error" in data
              ? String((data as ApiErrorPayload).error ?? "Falha ao consultar processos.")
              : "Não foi possível consultar processos.";
          throw new Error(message);
        }

        let rawProcessData: unknown[] = [];
        let totalCount: number | null = null;
        let totalPagesFromResponse: number | null = null;
        let pageFromResponse: number | null = null;

        if (data && typeof data === "object" && "content" in data && Array.isArray((data as { content?: unknown }).content)) {
          rawProcessData = (data as { content: unknown[] }).content;
          if ("total" in data && typeof (data as { total?: unknown }).total === "number") {
            totalCount = (data as { total: number }).total;
          } else if ("totalElements" in data && typeof (data as { totalElements?: unknown }).totalElements === "number") {
            totalCount = (data as { totalElements: number }).totalElements;
          }
          if ("totalPages" in data && typeof (data as { totalPages?: unknown }).totalPages === "number") {
            totalPagesFromResponse = (data as { totalPages: number }).totalPages;
          }
          if ("page" in data && typeof (data as { page?: unknown }).page === "number") {
            pageFromResponse = (data as { page: number }).page;
          } else if ("number" in data && typeof (data as { number?: unknown }).number === "number") {
            pageFromResponse = (data as { number: number }).number + 1;
          }
        } else if (Array.isArray(data)) {
          rawProcessData = data as unknown[];
        } else if (data && typeof data === "object" && "numeroProcesso" in data) {
          rawProcessData = [data];
        }

        const normalizedTotal = typeof totalCount === "number" ? totalCount : rawProcessData.length;
        const normalizedTotalPages =
          typeof totalPagesFromResponse === "number" && totalPagesFromResponse > 0
            ? totalPagesFromResponse
            : Math.max(1, Math.ceil(Math.max(1, normalizedTotal) / itemsPerPage));
        const normalizedPage =
          typeof pageFromResponse === "number" && pageFromResponse > 0
            ? Math.min(pageFromResponse, normalizedTotalPages)
            : Math.min(Math.max(1, page), normalizedTotalPages);

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
        setCurrentPage(normalizedPage);
        setTotalResults(normalizedTotal);
        setTotalPages(normalizedTotalPages);

        if (normalizedProcesses.length === 0) {
          toast({ title: "Nenhum processo encontrado" });
        } else {
          toast({
            title: "Consulta realizada",
            description: `${normalizedTotal} processo(s) encontrado(s).`,
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro ao consultar processos.";
        toast({ title: "Erro na consulta", description: message, variant: "destructive" });
        setProcesses([]);
        setTotalResults(0);
        setTotalPages(1);
        setCurrentPage(1);
      } finally {
        setIsLoading(false);
      }
    },
    [itemsPerPage, toast],
  );

  useEffect(() => {
    const typeParam = normalizeSearchType(searchParams.get("type"));
    const valueParam = searchParams.get("value") ?? "";
    const sanitizedValue = sanitizeSearchValue(typeParam, valueParam);
    const pageParam = searchParams.get("page");
    const parsedPage = pageParam ? Number.parseInt(pageParam, 10) : 1;
    const normalizedPage = Number.isNaN(parsedPage) || parsedPage <= 0 ? 1 : parsedPage;

    setSearchType(typeParam);
    setSearchValue(maskSearchValue(typeParam, sanitizedValue));

    if (sanitizedValue) {
      void performSearch(typeParam, sanitizedValue, normalizedPage);
    } else {
      setProcesses([]);
      setTotalResults(0);
      setTotalPages(1);
      setCurrentPage(1);
    }
  }, [performSearch, searchParams]);

  const handleSearch = () => {
    const sanitizedValue = sanitizeSearchValue(searchType, searchValue);

    if (!sanitizedValue) {
      toast({ title: "Informe um valor para busca" });
      return;
    }

    const params = new URLSearchParams();
    params.set("type", searchType);
    params.set("value", sanitizedValue);
    params.set("page", "1");

    navigate({ pathname: "/consulta-publica/processos", search: params.toString() });
  };

  const changePage = (page: number) => {
    const nextPage = Math.max(1, Math.min(totalPages, page));
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(nextPage));
    navigate({ pathname: "/consulta-publica/processos", search: params.toString() });
  };

  const hasResults = totalResults > 0 && processes.length > 0;
  const rangeStart = hasResults ? (currentPage - 1) * itemsPerPage + 1 : 0;
  const rangeEnd = hasResults ? Math.min(totalResults, rangeStart + processes.length - 1) : 0;
  const rangeLabelStart = hasResults ? rangeStart : 0;
  const rangeLabelEnd = hasResults ? rangeEnd : 0;

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
          <Select value={searchType} onValueChange={(value) => handleTypeChange(value as SearchType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="numero">Número do processo</SelectItem>
              <SelectItem value="cpf">CPF/CNPJ da parte</SelectItem>
              <SelectItem value="oab">OAB do advogado</SelectItem>
            </SelectContent>
          </Select>

          <Input
            placeholder={getPlaceholder(searchType)}
            value={searchValue}
            onChange={(event) => setSearchValue(maskSearchValue(searchType, event.target.value))}
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
                {processes.map((process) => (
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
                {rangeLabelStart} - {rangeLabelEnd} de {totalResults}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => changePage(currentPage - 1)}
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
                  onClick={() => changePage(currentPage + 1)}
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
