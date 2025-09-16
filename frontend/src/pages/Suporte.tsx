import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Download, Eye, FileText, Loader2, Paperclip, X } from "lucide-react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { toast } from "@/components/ui/use-toast";
import { getApiBaseUrl, joinUrl } from "@/lib/api";

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

type SupportRequestMessageSender = "requester" | "support";

interface SupportRequestMessageAttachmentApi {
  id: number;
  messageId: number;
  filename: string;
  contentType: string | null;
  fileSize: number | null;
  createdAt: string;
}

interface SupportRequestMessageApi {
  id: number;
  supportRequestId: number;
  sender: SupportRequestMessageSender;
  message: string;
  createdAt: string;
  attachments?: SupportRequestMessageAttachmentApi[];
}

interface SupportRequestMessageListResponse {
  items?: SupportRequestMessageApi[];
}

interface SupportRequestMessageAttachment extends SupportRequestMessageAttachmentApi {
  downloadUrl: string;
}

interface SupportRequestMessage extends Omit<SupportRequestMessageApi, "attachments"> {
  attachments: SupportRequestMessageAttachment[];
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

const MAX_ATTACHMENTS_PER_MESSAGE = 5;

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

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const formatted = value >= 10 ? value.toFixed(0) : value.toFixed(1);
  return `${formatted} ${units[unitIndex]}`;
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        const base64 = result.includes(",") ? result.slice(result.indexOf(",") + 1) : result;
        resolve(base64);
      } else {
        reject(new Error("Formato de arquivo inválido"));
      }
    };
    reader.onerror = () => {
      reject(new Error("Falha ao ler o arquivo selecionado"));
    };
    reader.readAsDataURL(file);
  });
}

function getMessageSenderLabel(
  sender: SupportRequestMessageSender,
  request?: SupportRequest | null,
): string {
  if (sender === "support") {
    return "Equipe de suporte";
  }

  if (!request) {
    return "Solicitante";
  }

  const formatted = formatRequesterInfo({
    requesterName: request.requesterName,
    requesterEmail: request.requesterEmail,
  });

  return formatted === "—" ? "Solicitante" : formatted;
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
  const [selectedRequest, setSelectedRequest] = useState<SupportRequest | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [messages, setMessages] = useState<SupportRequestMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  const fetchRequestMessages = useCallback(
    async (requestId: number) => {
      setIsLoadingMessages(true);
      setMessagesError(null);

      try {
        const response = await fetch(`${apiUrl}/api/support/${requestId}/messages`);

        if (!response.ok) {
          throw new Error("Failed to load support request messages");
        }

        const payload = (await response.json()) as
          | SupportRequestMessageListResponse
          | SupportRequestMessageApi[];

        const items = Array.isArray(payload)
          ? payload
          : Array.isArray(payload.items)
            ? payload.items
            : [];

        const parsedMessages: SupportRequestMessage[] = items.map((message) => ({
          ...message,
          attachments: (message.attachments ?? []).map((attachment) => ({
            ...attachment,
            downloadUrl: joinUrl(
              apiUrl,
              `/api/support/messages/${message.id}/attachments/${attachment.id}`,
            ),
          })),
        }));

        setMessages(parsedMessages);
      } catch (messageError) {
        console.error(
          "Erro ao carregar mensagens da solicitação de suporte:",
          messageError,
        );
        setMessagesError(
          "Não foi possível carregar as mensagens desta solicitação. Tente novamente.",
        );
      } finally {
        setIsLoadingMessages(false);
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

  useEffect(() => {
    if (!isDialogOpen || !selectedRequest?.id) {
      return;
    }

    fetchRequestMessages(selectedRequest.id);
  }, [fetchRequestMessages, isDialogOpen, selectedRequest?.id]);

  const handleDialogChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setSelectedRequest(null);
      setMessages([]);
      setMessagesError(null);
      setNewMessage("");
      setSelectedFiles([]);
      setIsSendingMessage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleOpenRequest = (request: SupportRequest) => {
    setSelectedRequest(request);
    setMessages([]);
    setMessagesError(null);
    setNewMessage("");
    setSelectedFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setIsDialogOpen(true);
  };

  const handleFileSelection = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) {
      return;
    }

    setSelectedFiles((previous) => {
      const remainingSlots = Math.max(0, MAX_ATTACHMENTS_PER_MESSAGE - previous.length);
      const filesToAdd = files.slice(0, remainingSlots);

      if (filesToAdd.length < files.length) {
        toast({
          title: `É possível anexar no máximo ${MAX_ATTACHMENTS_PER_MESSAGE} arquivos por mensagem.`,
          variant: "destructive",
        });
      }

      return [...previous, ...filesToAdd];
    });

    event.target.value = "";
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((previous) => previous.filter((_, fileIndex) => fileIndex !== index));
  };

  const handleSendMessage = async () => {
    if (!selectedRequest) {
      return;
    }

    const trimmedMessage = newMessage.trim();
    const hasContent = trimmedMessage.length > 0 || selectedFiles.length > 0;

    if (!hasContent) {
      toast({
        title: "Adicione uma mensagem ou anexo para enviar",
        variant: "destructive",
      });
      return;
    }

    setIsSendingMessage(true);

    try {
      const attachmentsPayload = await Promise.all(
        selectedFiles.map(async (file) => ({
          filename: file.name,
          contentType: file.type,
          size: file.size,
          data: await readFileAsBase64(file),
        })),
      );

      const response = await fetch(`${apiUrl}/api/support/${selectedRequest.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmedMessage,
          attachments: attachmentsPayload,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send support request message");
      }

      setNewMessage("");
      setSelectedFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      toast({ title: "Mensagem enviada" });
      await fetchRequestMessages(selectedRequest.id);
    } catch (sendError) {
      console.error("Erro ao enviar mensagem da solicitação de suporte:", sendError);
      toast({
        title: "Não foi possível enviar a mensagem",
        description: "Tente novamente em instantes.",
        variant: "destructive",
      });
    } finally {
      setIsSendingMessage(false);
    }
  };

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
              <TableHead className="w-[140px] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
            <TableBody>
              {isLoading && requests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    Carregando solicitações...
                  </TableCell>
                </TableRow>
              ) : error && requests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-destructive">
                    {error}
                  </TableCell>
                </TableRow>
              ) : !isLoading && requests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
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
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="inline-flex items-center gap-2"
                        onClick={() => handleOpenRequest(request)}
                      >
                        <Eye className="h-4 w-4" />
                        Visualizar
                      </Button>
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
      <Dialog open={isDialogOpen} onOpenChange={handleDialogChange}>
        <DialogContent className="max-w-3xl space-y-6">
          <DialogHeader>
            <DialogTitle>Detalhes da solicitação</DialogTitle>
            <DialogDescription>
              Visualize o histórico de mensagens e envie novas atualizações para a equipe de
              suporte.
            </DialogDescription>
          </DialogHeader>
          {selectedRequest ? (
            <div className="space-y-6">
              <div className="grid gap-4 rounded-lg border border-border p-4 text-sm">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold text-foreground">{selectedRequest.subject}</p>
                    <p className="text-muted-foreground">
                      Criada em {formatDateTime(selectedRequest.createdAt)}
                    </p>
                  </div>
                  <Badge variant="outline" className={statusStyles[selectedRequest.status]}>
                    {statusLabels[selectedRequest.status]}
                  </Badge>
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs font-medium uppercase text-muted-foreground">
                    Descrição
                  </Label>
                  <p className="whitespace-pre-line text-sm text-foreground">
                    {selectedRequest.description}
                  </p>
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs font-medium uppercase text-muted-foreground">
                    Solicitante
                  </Label>
                  <p className="text-sm text-foreground">{formatRequesterInfo(selectedRequest)}</p>
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs font-medium uppercase text-muted-foreground">
                    Última atualização
                  </Label>
                  <p className="text-sm text-foreground">{formatDateTime(selectedRequest.updatedAt)}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="text-base font-semibold text-foreground">Histórico de mensagens</h3>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => selectedRequest && fetchRequestMessages(selectedRequest.id)}
                    disabled={isLoadingMessages}
                    className="inline-flex items-center gap-2"
                  >
                    {isLoadingMessages ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Atualizando
                      </>
                    ) : (
                      <>Atualizar histórico</>
                    )}
                  </Button>
                </div>
                <Separator />
                {messagesError ? (
                  <p className="text-sm text-destructive">{messagesError}</p>
                ) : isLoadingMessages ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Carregando mensagens...
                  </div>
                ) : messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma mensagem registrada para esta solicitação.
                  </p>
                ) : (
                  <ScrollArea className="max-h-[320px] pr-4">
                    <div className="space-y-4">
                      {messages.map((message) => (
                        <div
                          key={message.id}
                          className="rounded-lg border border-border bg-muted/40 p-4"
                        >
                          <div className="flex flex-col gap-1 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                            <span className="font-medium text-foreground">
                              {getMessageSenderLabel(message.sender, selectedRequest)}
                            </span>
                            <span>{formatDateTime(message.createdAt)}</span>
                          </div>
                          {message.message && (
                            <p className="mt-3 whitespace-pre-line text-sm text-foreground">
                              {message.message}
                            </p>
                          )}
                          {message.attachments.length > 0 && (
                            <div className="mt-3 space-y-2">
                              <p className="text-xs font-medium uppercase text-muted-foreground">
                                Anexos
                              </p>
                              <ul className="space-y-1">
                                {message.attachments.map((attachment) => (
                                  <li key={attachment.id}>
                                    <a
                                      href={attachment.downloadUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                                    >
                                      <Paperclip className="h-4 w-4" />
                                      <span>{attachment.filename}</span>
                                      {attachment.fileSize !== null && (
                                        <span className="text-xs text-muted-foreground">
                                          ({formatFileSize(attachment.fileSize)})
                                        </span>
                                      )}
                                      <Download className="h-4 w-4" />
                                    </a>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>

              <div className="space-y-3">
                <Label htmlFor="support-new-message" className="text-sm font-medium text-foreground">
                  Enviar nova mensagem
                </Label>
                <Textarea
                  id="support-new-message"
                  placeholder="Escreva sua mensagem para a equipe de suporte"
                  value={newMessage}
                  onChange={(event) => setNewMessage(event.target.value)}
                  className="min-h-[120px]"
                  disabled={isSendingMessage}
                />
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={
                          isSendingMessage || selectedFiles.length >= MAX_ATTACHMENTS_PER_MESSAGE
                        }
                        className="inline-flex items-center gap-2"
                      >
                        <Paperclip className="h-4 w-4" />
                        Anexar arquivos
                      </Button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={handleFileSelection}
                      />
                    </div>
                    {selectedFiles.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {selectedFiles.map((file, index) => (
                          <span
                            key={`${file.name}-${index}`}
                            className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs text-foreground"
                          >
                            <FileText className="h-3 w-3" />
                            <span className="max-w-[160px] truncate" title={file.name}>
                              {file.name}
                            </span>
                            <span className="text-muted-foreground">
                              {formatFileSize(file.size)}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveFile(index)}
                              className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full border border-transparent text-muted-foreground hover:text-foreground"
                              disabled={isSendingMessage}
                            >
                              <X className="h-3 w-3" />
                              <span className="sr-only">Remover anexo</span>
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <DialogFooter className="w-full sm:w-auto">
                    <Button
                      type="button"
                      onClick={handleSendMessage}
                      disabled={
                        isSendingMessage ||
                        (newMessage.trim().length === 0 && selectedFiles.length === 0)
                      }
                      className="min-w-[160px]"
                    >
                      {isSendingMessage ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        "Enviar mensagem"
                      )}
                    </Button>
                  </DialogFooter>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Selecione uma solicitação para visualizar os detalhes.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
