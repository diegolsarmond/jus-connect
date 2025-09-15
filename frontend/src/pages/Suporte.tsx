import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { toast } from "@/components/ui/use-toast";
import { getApiBaseUrl } from "@/lib/api";

const apiUrl = getApiBaseUrl();

type SupportRequestStatus = "open" | "in_progress" | "resolved" | "closed";

interface SupportRequest {
  id: number;
  subject: string;
  description: string;
  status: SupportRequestStatus;
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
  open: "Aberta",
  in_progress: "Em andamento",
  resolved: "Resolvida",
  closed: "Encerrada",
};

const statusStyles: Record<SupportRequestStatus, string> = {
  open: "border-blue-200 bg-blue-50 text-blue-700",
  in_progress: "border-amber-200 bg-amber-50 text-amber-700",
  resolved: "border-emerald-200 bg-emerald-50 text-emerald-700",
  closed: "border-slate-200 bg-slate-100 text-slate-700",
};

function formatDateTime(isoString: string): string {
  if (!isoString) {
    return "-";
  }

  const date = new Date(isoString);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRequesterInfo({
  requesterName,
  requesterEmail,
}: Pick<SupportRequest, "requesterName" | "requesterEmail">): string {
  if (requesterName && requesterEmail) {
    return `${requesterName} (${requesterEmail})`;
  }

  if (requesterName) {
    return requesterName;
  }

  if (requesterEmail) {
    return requesterEmail;
  }

  return "—";
}

const formSchema = z.object({
  subject: z.string().min(1, "Assunto é obrigatório"),
  message: z.string().min(1, "Mensagem é obrigatória"),
});

export default function Suporte() {
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [totalRequests, setTotalRequests] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { subject: "", message: "" },
  });

  const fetchRequests = useCallback(
    async (signal?: AbortSignal) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`${apiUrl}/api/support`, { signal });

        if (!response.ok) {
          throw new Error("Falha ao carregar solicitações de suporte");
        }

        const data = (await response.json()) as SupportRequestListResponse;

        if (!data || !Array.isArray(data.items)) {
          throw new Error("Resposta inválida do servidor");
        }

        setRequests(data.items);

        const total =
          typeof data.total === "number"
            ? data.total
            : data.items.length;

        setTotalRequests(total);
      } catch (requestError) {
        if (signal?.aborted) {
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
    [],
  );

  useEffect(() => {
    const controller = new AbortController();

    fetchRequests(controller.signal);

    return () => {
      controller.abort();
    };
  }, [fetchRequests]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      const res = await fetch(`${apiUrl}/api/support`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: values.subject,
          description: values.message,
        }),
      });
      if (!res.ok) {
        throw new Error("Failed to send support request");
      }
      toast({ title: "Solicitação enviada com sucesso" });
      form.reset();
      await fetchRequests();
    } catch (error) {
      console.error("Erro ao enviar solicitação de suporte:", error);
      toast({ title: "Erro ao enviar solicitação", variant: "destructive" });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Suporte</h1>
        <p className="text-muted-foreground">
          Envie novas solicitações e acompanhe o andamento das existentes.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Nova Solicitação</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="subject"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assunto</FormLabel>
                    <FormControl>
                      <Input placeholder="Digite o assunto" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="message"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mensagem</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Descreva sua solicitação"
                        className="min-h-[150px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Enviando..." : "Enviar"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Solicitações Enviadas</CardTitle>
            <CardDescription>
              Visualize o histórico das solicitações já registradas e seus status.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => fetchRequests()} disabled={isLoading}>
            Atualizar lista
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && requests.length > 0 && (
            <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[160px]">Criado em</TableHead>
                <TableHead>Assunto</TableHead>
                <TableHead className="w-[150px]">Status</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="w-[220px]">Solicitante</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && requests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    Carregando solicitações...
                  </TableCell>
                </TableRow>
              ) : error && requests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-destructive">
                    {error}
                  </TableCell>
                </TableRow>
              ) : !isLoading && requests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    Nenhuma solicitação encontrada.
                  </TableCell>
                </TableRow>
              ) : (
                requests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="whitespace-nowrap font-medium text-foreground">
                      {formatDateTime(request.createdAt)}
                    </TableCell>
                    <TableCell className="font-medium text-foreground">{request.subject}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Badge variant="outline" className={statusStyles[request.status]}>
                        {statusLabels[request.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <p className="max-w-xl whitespace-pre-line text-sm text-muted-foreground">
                        {request.description}
                      </p>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatRequesterInfo(request)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {!isLoading && totalRequests > 0 && (
            <p className="text-sm text-muted-foreground">
              Exibindo {requests.length} de {totalRequests}{" "}
              {totalRequests === 1 ? "solicitação" : "solicitações"} de suporte.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
