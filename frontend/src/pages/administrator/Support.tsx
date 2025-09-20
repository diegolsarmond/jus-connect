import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { getApiBaseUrl } from "@/lib/api";
import { toast } from "@/components/ui/use-toast";
import { AlertCircle, CheckCircle, Clock, Headphones, Loader2, Plus, Search, XCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type SupportRequestStatus = "open" | "in_progress" | "resolved" | "closed" | "cancelled";

interface SupportRequest {
  id: number;
  subject: string;
  description: string | null;
  status: SupportRequestStatus;
  supportAgentId: number | null;
  supportAgentName: string | null;
  requesterName: string | null;
  requesterEmail: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SupportRequestListResponse {
  items?: SupportRequest[];
  total?: number;
}

const statusLabels: Record<SupportRequestStatus, string> = {
  open: "Aberto",
  in_progress: "Em andamento",
  resolved: "Resolvido",
  closed: "Fechado",
  cancelled: "Cancelado",
};

const statusVariants: Record<SupportRequestStatus, "destructive" | "secondary" | "default" | "outline"> = {
  open: "destructive",
  in_progress: "secondary",
  resolved: "default",
  closed: "outline",
  cancelled: "destructive",
};

const statusIcons: Record<SupportRequestStatus, typeof AlertCircle> = {
  open: AlertCircle,
  in_progress: Clock,
  resolved: CheckCircle,
  closed: XCircle,
  cancelled: XCircle,
};

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("pt-BR");
}

function formatAverageHandlingTime(requests: SupportRequest[]): string | null {
  const differences = requests
    .map((request) => {
      const created = new Date(request.createdAt).getTime();
      const updated = new Date(request.updatedAt).getTime();

      if (!Number.isFinite(created) || !Number.isFinite(updated) || updated <= created) {
        return null;
      }

      return updated - created;
    })
    .filter((value): value is number => value !== null && value > 0);

  if (differences.length === 0) {
    return null;
  }

  const averageMs = differences.reduce((total, value) => total + value, 0) / differences.length;

  if (!Number.isFinite(averageMs) || averageMs <= 0) {
    return null;
  }

  const averageHours = averageMs / 3_600_000;

  if (averageHours < 1) {
    const minutes = Math.max(1, Math.round(averageMs / 60_000));
    return `${minutes} min`;
  }

  if (averageHours < 24) {
    return `${averageHours.toFixed(1)} h`;
  }

  const days = averageHours / 24;
  return `${days.toFixed(1)} dias`;
}

export default function Support() {
  const [searchTerm, setSearchTerm] = useState("");
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [totalRequests, setTotalRequests] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [responseDialogRequest, setResponseDialogRequest] = useState<SupportRequest | null>(null);
  const [responseMessage, setResponseMessage] = useState("");
  const [isSendingResponse, setIsSendingResponse] = useState(false);
  const [resolvingRequestId, setResolvingRequestId] = useState<number | null>(null);

  const apiUrl = getApiBaseUrl();

  const fetchRequests = useCallback(
    async (signal?: AbortSignal) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`${apiUrl}/api/support`, { signal });

        if (!response.ok) {
          throw new Error("Falha ao carregar solicitações de suporte");
        }

        const payload = (await response.json()) as SupportRequestListResponse;
        const items = Array.isArray(payload.items) ? payload.items : [];

        setRequests(items);
        setTotalRequests(typeof payload.total === "number" ? payload.total : items.length);
      } catch (requestError) {
        if ((requestError as { name?: string })?.name === "AbortError" || signal?.aborted) {
          return;
        }

        console.error("Erro ao carregar solicitações de suporte:", requestError);
        setError("Não foi possível carregar as solicitações de suporte. Tente novamente.");
      } finally {
        if (!signal?.aborted) {
          setIsLoading(false);
        }
      }
    },
    [apiUrl],
  );

  useEffect(() => {
    const controller = new AbortController();

    void fetchRequests(controller.signal);

    return () => {
      controller.abort();
    };
  }, [fetchRequests]);

  const filteredRequests = useMemo(() => {
    const normalizedTerm = searchTerm.trim().toLowerCase();

    if (!normalizedTerm) {
      return requests;
    }

    return requests.filter((request) => {
      const subject = request.subject?.toLowerCase() ?? "";
      const description = request.description?.toLowerCase() ?? "";
      const requesterName = request.requesterName?.toLowerCase() ?? "";
      const requesterEmail = request.requesterEmail?.toLowerCase() ?? "";

      return (
        subject.includes(normalizedTerm) ||
        description.includes(normalizedTerm) ||
        requesterName.includes(normalizedTerm) ||
        requesterEmail.includes(normalizedTerm)
      );
    });
  }, [requests, searchTerm]);

  const openTickets = useMemo(
    () => requests.filter((request) => request.status === "open").length,
    [requests],
  );
  const inProgressTickets = useMemo(
    () => requests.filter((request) => request.status === "in_progress").length,
    [requests],
  );
  const resolvedTickets = useMemo(
    () => requests.filter((request) => request.status === "resolved").length,
    [requests],
  );

  const distributionTotal = requests.length || 1;
  const averageHandlingTime = useMemo(() => formatAverageHandlingTime(requests), [requests]);

  const getStatusBadge = (status: SupportRequestStatus) => (
    <Badge variant={statusVariants[status]}>{statusLabels[status]}</Badge>
  );

  const getStatusIcon = (status: SupportRequestStatus) => {
    const Icon = statusIcons[status];
    return Icon ? <Icon className="h-4 w-4" /> : null;
  };

  const canResolveRequest = (request: SupportRequest) =>
    request.status !== "resolved" && request.status !== "closed" && request.status !== "cancelled";

  const handleOpenResponseDialog = (request: SupportRequest) => {
    setResponseDialogRequest(request);
    setResponseMessage("");
  };

  const handleResponseDialogOpenChange = (open: boolean) => {
    if (!open) {
      setResponseDialogRequest(null);
      setResponseMessage("");
      setIsSendingResponse(false);
    }
  };

  const handleSendResponse = async () => {
    if (!responseDialogRequest) {
      return;
    }

    const trimmedMessage = responseMessage.trim();

    if (!trimmedMessage) {
      toast({
        title: "Digite uma mensagem para responder",
        description: "Adicione algum conteúdo para enviar ao cliente.",
        variant: "destructive",
      });
      return;
    }

    setIsSendingResponse(true);

    try {
      const response = await fetch(`${apiUrl}/api/support/${responseDialogRequest.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmedMessage,
          sender: "support",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send support response");
      }

      toast({
        title: "Resposta enviada",
        description: "O solicitante será notificado sobre a mensagem.",
      });

      setResponseDialogRequest(null);
      setResponseMessage("");
      void fetchRequests();
    } catch (sendError) {
      console.error("Erro ao enviar resposta do ticket de suporte:", sendError);
      toast({
        title: "Não foi possível enviar a resposta",
        description: "Tente novamente em instantes.",
        variant: "destructive",
      });
    } finally {
      setIsSendingResponse(false);
    }
  };

  const handleResolveRequest = async (request: SupportRequest) => {
    if (!canResolveRequest(request)) {
      return;
    }

    setResolvingRequestId(request.id);

    try {
      const response = await fetch(`${apiUrl}/api/support/${request.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "resolved" }),
      });

      if (!response.ok) {
        throw new Error("Failed to resolve support request");
      }

      toast({
        title: "Solicitação marcada como resolvida",
        description: "O solicitante será notificado sobre a resolução.",
      });

      void fetchRequests();
    } catch (resolveError) {
      console.error("Erro ao resolver ticket de suporte:", resolveError);
      toast({
        title: "Não foi possível resolver o ticket",
        description: "Tente novamente em instantes.",
        variant: "destructive",
      });
    } finally {
      setResolvingRequestId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Suporte ao Cliente</h1>
          <p className="text-muted-foreground">Gerencie tickets de suporte e solicitações dos clientes</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Novo Ticket
        </Button>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro ao carregar solicitações</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tickets Abertos</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{openTickets}</div>
            <p className="text-xs text-muted-foreground">Requerem atenção</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Andamento</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inProgressTickets}</div>
            <p className="text-xs text-muted-foreground">Sendo processados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolvidos Hoje</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{resolvedTickets}</div>
            <p className="text-xs text-muted-foreground">Problemas solucionados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tempo Médio</CardTitle>
            <Headphones className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{averageHandlingTime ?? "—"}</div>
            <p className="text-xs text-muted-foreground">Primeira resposta</p>
          </CardContent>
        </Card>
      </div>

      {/* Support Tickets Table */}
      <Card>
        <CardHeader>
          <CardTitle>Tickets de Suporte</CardTitle>
          <CardDescription>
            Visualize e gerencie todas as solicitações de suporte
            {totalRequests > 0 ? ` (${totalRequests})` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar tickets..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <Button variant="outline" size="sm" onClick={() => void fetchRequests()} disabled={isLoading}>
              Atualizar
            </Button>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Assunto</TableHead>
                  <TableHead>Solicitante</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criado</TableHead>
                  <TableHead>Atualizado</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && requests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                      Carregando solicitações de suporte...
                    </TableCell>
                  </TableRow>
                ) : null}
                {!isLoading && filteredRequests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                      {searchTerm
                        ? "Nenhuma solicitação encontrada para o termo informado."
                        : "Nenhuma solicitação de suporte registrada."}
                    </TableCell>
                  </TableRow>
                ) : null}
                {filteredRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{request.subject}</div>
                        {request.description ? (
                          <div className="text-sm text-muted-foreground line-clamp-1">
                            {request.description}
                          </div>
                        ) : null}
                        {request.supportAgentName ? (
                          <div className="text-xs text-muted-foreground">
                            Responsável: {request.supportAgentName}
                          </div>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{request.requesterName ?? "—"}</div>
                      {request.requesterEmail ? (
                        <div className="text-sm text-muted-foreground">{request.requesterEmail}</div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(request.status)}
                        {getStatusBadge(request.status)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{formatDate(request.createdAt)}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{formatDate(request.updatedAt)}</div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" size="sm" onClick={() => handleOpenResponseDialog(request)}>
                          Responder
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-emerald-600"
                          onClick={() => handleResolveRequest(request)}
                          disabled={!canResolveRequest(request) || resolvingRequestId === request.id}
                        >
                          {resolvingRequestId === request.id ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" /> Resolvendo
                            </>
                          ) : (
                            <>
                              <CheckCircle className="h-4 w-4" /> Resolver
                            </>
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Support Analytics */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Distribuição por Status</CardTitle>
            <CardDescription>Breakdown dos tickets por status atual</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <span className="text-sm">Abertos</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{openTickets}</span>
                <div className="w-16 bg-muted rounded-full h-2">
                  <div
                    className="bg-destructive h-2 rounded-full"
                    style={{ width: `${(openTickets / distributionTotal) * 100}%` }}
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-secondary-foreground" />
                <span className="text-sm">Em Andamento</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{inProgressTickets}</span>
                <div className="w-16 bg-muted rounded-full h-2">
                  <div
                    className="bg-secondary h-2 rounded-full"
                    style={{ width: `${(inProgressTickets / distributionTotal) * 100}%` }}
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm">Resolvidos</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{resolvedTickets}</span>
                <div className="w-16 bg-muted rounded-full h-2">
                  <div
                    className="bg-green-600 h-2 rounded-full"
                    style={{ width: `${(resolvedTickets / distributionTotal) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Métricas de Performance</CardTitle>
            <CardDescription>Indicadores de qualidade do suporte</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm">Taxa de Resolução</span>
              <span className="font-medium text-green-600">92.3%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Satisfação Cliente</span>
              <span className="font-medium">4.7/5.0</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Tempo Primeira Resposta</span>
              <span className="font-medium">{averageHandlingTime ?? "—"}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Tempo Resolução</span>
              <span className="font-medium">18.5 horas</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Reaberturas</span>
              <span className="font-medium text-destructive">3.1%</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={responseDialogRequest !== null} onOpenChange={handleResponseDialogOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Responder ticket</DialogTitle>
            <DialogDescription>
              Envie uma resposta ao solicitante para manter o acompanhamento do ticket.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {responseDialogRequest ? (
              <div className="rounded-md border bg-muted/40 p-3 text-left text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="font-medium text-foreground">{responseDialogRequest.subject}</div>
                    {responseDialogRequest.requesterName || responseDialogRequest.requesterEmail ? (
                      <p className="text-xs text-muted-foreground">
                        {responseDialogRequest.requesterName ?? responseDialogRequest.requesterEmail}
                        {responseDialogRequest.requesterEmail && responseDialogRequest.requesterName
                          ? ` • ${responseDialogRequest.requesterEmail}`
                          : ""}
                      </p>
                    ) : null}
                  </div>
                  <div className="shrink-0">{getStatusBadge(responseDialogRequest.status)}</div>
                </div>
                {responseDialogRequest.description ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {responseDialogRequest.description}
                  </p>
                ) : null}
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="support-response-message">Mensagem</Label>
              <Textarea
                id="support-response-message"
                value={responseMessage}
                onChange={(event) => setResponseMessage(event.target.value)}
                placeholder="Escreva sua resposta ao cliente"
                rows={5}
                disabled={isSendingResponse}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleResponseDialogOpenChange(false)}
              disabled={isSendingResponse}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={handleSendResponse} disabled={isSendingResponse}>
              {isSendingResponse ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando
                </>
              ) : (
                "Enviar resposta"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
