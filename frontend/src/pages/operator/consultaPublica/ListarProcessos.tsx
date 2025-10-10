import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Eye, Search } from "lucide-react";
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

        let processData: Process[] = [];

        if (data && typeof data === "object" && "content" in data && Array.isArray((data as { content?: unknown }).content)) {
          processData = (data as { content: Process[] }).content;
        } else if (Array.isArray(data)) {
          processData = data as Process[];
        } else if (data && typeof data === "object" && "numeroProcesso" in data) {
          processData = [data as Process];
        }

        setProcesses(processData);

        if (processData.length === 0) {
          toast({ title: "Nenhum processo encontrado" });
        } else {
          toast({ title: "Consulta realizada", description: `${processData.length} processo(s) encontrado(s).` });
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
