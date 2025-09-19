import { useMemo, useState } from "react";
import { Activity, AlertTriangle, Search as SearchIcon, Server, Timer } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { mockServerLogs, type ServerLog } from "@/data/mockData";
import { cn } from "@/lib/utils";

type LevelFilter = "all" | ServerLog["level"];

const levelLabels: Record<ServerLog["level"], string> = {
  info: "Info",
  warn: "Alerta",
  error: "Erro",
};

const levelBadgeStyles: Record<ServerLog["level"], string> = {
  info: "border-blue-200 bg-blue-100 text-blue-800 dark:border-blue-400/30 dark:bg-blue-500/10 dark:text-blue-200",
  warn: "border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-100",
  error: "border-red-200 bg-red-100 text-red-800 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-100",
};

const getStatusBadgeClass = (status: number) => {
  if (status >= 500) {
    return "border-red-200 bg-red-100 text-red-800 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-100";
  }

  if (status >= 400) {
    return "border-orange-200 bg-orange-100 text-orange-800 dark:border-orange-400/30 dark:bg-orange-500/10 dark:text-orange-100";
  }

  if (status >= 300) {
    return "border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-100";
  }

  return "border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-100";
};

const formatDateTime = (timestamp: string) =>
  new Date(timestamp).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "medium" });

const formatDuration = (durationMs: number) => {
  if (durationMs >= 1000) {
    return `${(durationMs / 1000).toFixed(2)} s`;
  }

  if (durationMs >= 100) {
    return `${durationMs.toFixed(0)} ms`;
  }

  if (durationMs >= 10) {
    return `${durationMs.toFixed(1)} ms`;
  }

  if (durationMs >= 1) {
    return `${durationMs.toFixed(2)} ms`;
  }

  return `${durationMs.toFixed(3)} ms`;
};

const buildMetadataSummary = (log: ServerLog) => {
  if (!log.metadata) {
    return null;
  }

  const entries = Object.entries(log.metadata).map(([key, value]) => {
    if (Array.isArray(value)) {
      return `${key}: ${value.join(", ")}`;
    }

    if (typeof value === "object" && value !== null) {
      return `${key}: ${JSON.stringify(value)}`;
    }

    return `${key}: ${value}`;
  });

  if (entries.length === 0) {
    return null;
  }

  return entries.slice(0, 2).join(" • ");
};

const Logs = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("all");

  const sortedLogs = useMemo(
    () =>
      [...mockServerLogs].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      ),
    [],
  );

  const stats = useMemo(() => {
    let info = 0;
    let warn = 0;
    let error = 0;
    let httpCount = 0;
    let totalDuration = 0;
    const uniqueIps = new Set<string>();

    sortedLogs.forEach((log) => {
      if (log.level === "info") info += 1;
      if (log.level === "warn") warn += 1;
      if (log.level === "error") error += 1;

      if (log.request) {
        httpCount += 1;
        totalDuration += log.request.durationMs;
        uniqueIps.add(log.request.clientIp);
      }
    });

    return {
      total: sortedLogs.length,
      info,
      warn,
      error,
      alerts: warn + error,
      httpCount,
      avgDuration: httpCount ? totalDuration / httpCount : 0,
      uniqueClients: uniqueIps.size,
      lastTimestamp: sortedLogs[0]?.timestamp,
    };
  }, [sortedLogs]);

  const filteredLogs = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return sortedLogs.filter((log) => {
      if (levelFilter !== "all" && log.level !== levelFilter) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const haystackParts = [
        log.message,
        log.logger,
        log.request?.method,
        log.request?.uri,
        log.request ? String(log.request.status) : undefined,
        log.request?.clientIp,
        log.request?.host,
        log.request?.userAgent,
        log.metadata ? JSON.stringify(log.metadata) : undefined,
      ];

      return haystackParts
        .filter((part): part is string => typeof part === "string")
        .some((part) => part.toLowerCase().includes(normalizedSearch));
    });
  }, [levelFilter, searchTerm, sortedLogs]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold">Monitoramento de Logs</h1>
        <p className="text-muted-foreground">
          Acompanhe eventos do servidor Caddy e requisições HTTP realizadas na aplicação.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de registros</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            {stats.lastTimestamp ? (
              <p className="text-xs text-muted-foreground">
                Último evento: {formatDateTime(stats.lastTimestamp)}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">Sem registros recentes</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alertas</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.alerts}</div>
            <p className="text-xs text-muted-foreground">
              {stats.warn} avisos • {stats.error} erros
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Requisições HTTP</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.httpCount}</div>
            <p className="text-xs text-muted-foreground">
              IPs monitorados: {stats.uniqueClients}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tempo médio de resposta</CardTitle>
            <Timer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.httpCount ? formatDuration(stats.avgDuration) : "—"}
            </div>
            <p className="text-xs text-muted-foreground">Baseado em requisições registradas</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-1">
              <CardTitle>Registros recentes</CardTitle>
              <CardDescription>Filtre por nível ou procure termos específicos nos eventos.</CardDescription>
            </div>
            <Badge variant="outline" className="self-start bg-muted text-xs font-normal text-muted-foreground md:self-center">
              {filteredLogs.length} registro{filteredLogs.length === 1 ? "" : "s"}
            </Badge>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:max-w-xs">
              <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Buscar por mensagem, IP ou status..."
                className="pl-9"
              />
            </div>
            <div className="flex w-full gap-2 md:w-auto">
              <Select value={levelFilter} onValueChange={(value) => setLevelFilter(value as LevelFilter)}>
                <SelectTrigger className="md:w-[200px]">
                  <SelectValue placeholder="Filtrar por nível" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os níveis</SelectItem>
                  <SelectItem value="info">Informações</SelectItem>
                  <SelectItem value="warn">Alertas</SelectItem>
                  <SelectItem value="error">Erros</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                onClick={() => {
                  setSearchTerm("");
                  setLevelFilter("all");
                }}
                disabled={!searchTerm && levelFilter === "all"}
              >
                Limpar filtros
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[180px]">Horário</TableHead>
                  <TableHead className="min-w-[120px]">Nível</TableHead>
                  <TableHead className="min-w-[200px]">Origem</TableHead>
                  <TableHead className="min-w-[220px]">Mensagem</TableHead>
                  <TableHead className="min-w-[240px]">Detalhes</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                      Nenhum registro encontrado com os filtros atuais.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.map((log) => {
                    const metadataSummary = buildMetadataSummary(log);

                    return (
                      <TableRow key={log.id}>
                        <TableCell>
                          <div className="font-medium">{formatDateTime(log.timestamp)}</div>
                          {log.request ? (
                            <div className="text-xs text-muted-foreground">{formatDuration(log.request.durationMs)}</div>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <Badge className={cn("w-fit", levelBadgeStyles[log.level])}>
                            {levelLabels[log.level]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <span className="font-medium">{log.logger ?? "Aplicação"}</span>
                            {log.request ? (
                              <span className="text-xs text-muted-foreground">{log.request.host}</span>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{log.message}</div>
                          {metadataSummary ? (
                            <p className="text-xs text-muted-foreground">{metadataSummary}</p>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          {log.request ? (
                            <div className="space-y-1 text-xs">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge className={cn("w-fit", getStatusBadgeClass(log.request.status))}>
                                  {log.request.status}
                                </Badge>
                                <span className="font-medium text-foreground">
                                  {log.request.method} {log.request.uri}
                                </span>
                              </div>
                              <div className="text-muted-foreground">
                                {log.request.clientIp} • {log.request.protocol}
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Sem detalhes adicionais</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                Ver detalhes
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>Detalhes do log</DialogTitle>
                                <DialogDescription>
                                  Evento registrado em {formatDateTime(log.timestamp)}
                                </DialogDescription>
                              </DialogHeader>
                              <div className="rounded-md bg-muted p-4 text-left text-xs">
                                <pre className="max-h-[400px] overflow-auto whitespace-pre-wrap">
                                  {JSON.stringify(log, null, 2)}
                                </pre>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Logs;
