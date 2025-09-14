import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Client } from "@/types/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Mail, Phone, User, Building2, Trash } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";


const apiUrl = (import.meta.env.VITE_API_URL as string) || "http://localhost:3000";

function joinUrl(base: string, path = "") {
  const b = base.replace(/\/+$/, "");
  const p = path ? (path.startsWith("/") ? path : `/${path}`) : "";
  return `${b}${p}`;
}

interface ApiClient {
  id: number;
  nome: string;
  tipo: string;
  documento: string;
  email: string;
  telefone: string;
  cep: string;
  rua: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  ativo: boolean;
  foto: string | null;
  datacadastro: string;
}

interface ApiDocumento {
  id: number;
  nome_arquivo: string;
  tipo_nome: string;
}

type LocalClient = Client & {
  history?: Array<{ id: number; date: string; action: string; note?: string }>;
  cep?: string;
};

const mapApiClientToClient = (c: ApiClient): LocalClient => ({
  id: c.id,
  name: c.nome,
  email: c.email,
  phone: c.telefone,
  type: c.tipo === "J" || c.tipo === "PJ" ? "Pessoa Jurídica" : "Pessoa Física",
  document: c.documento,
  address: `${c.rua}, ${c.numero} - ${c.bairro}, ${c.cidade} - ${c.uf}`,
  area: "",
  status: c.ativo ? "Ativo" : "Inativo",
  lastContact: c.datacadastro,
  processes: [],
  history: [],
  cep: c.cep,
});

export default function VisualizarCliente() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState<LocalClient | null>(null);
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<
    Array<{ id: number; filename: string; type: string; base64: string }>
  >([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedType, setSelectedType] = useState("");
  const [documentTypes, setDocumentTypes] = useState<
    Array<{ id: number; nome: string }>
  >([]);
  const [previewDoc, setPreviewDoc] = useState<{
    filename: string;
    base64: string;
  } | null>(null);

  const handleAddDocument = async () => {
    if (selectedFile && selectedType) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = (reader.result as string).split(',')[1];
        try {
          const url = joinUrl(apiUrl, `/api/clientes/${id}/documentos`);
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tipo_documento_id: Number(selectedType),
              nome_arquivo: selectedFile.name,
              arquivo_base64: base64,
            }),
          });
          if (res.ok) {
            const doc = await res.json();
            setDocuments((prev) => [
              ...prev,
              {
                id: doc.id,
                filename: doc.nome_arquivo,
                type: doc.tipo_nome,
                base64,
              },
            ]);
            setSelectedFile(null);
            setSelectedType('');
          }
        } catch (error) {
          console.error('Erro ao enviar documento:', error);
        }
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const handleRemoveDocument = async (docId: number) => {
    try {
      const url = joinUrl(apiUrl, `/api/clientes/${id}/documentos/${docId}`);
      await fetch(url, { method: 'DELETE' });
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    } catch (error) {
      console.error('Erro ao remover documento:', error);
    }
  };

  const downloadBase64 = (
    filename: string,
    base64: string,
    mime = 'application/octet-stream'
  ) => {
    const link = document.createElement('a');
    link.href = `data:${mime};base64,${base64}`;
    link.download = filename;
    link.click();
  };

  const handleViewDocument = (doc: { filename: string; base64: string }) => {
    if (doc.filename.toLowerCase().endsWith('.pdf')) {
      setPreviewDoc(doc);
    } else {
      downloadBase64(doc.filename, doc.base64);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [clientRes, typesRes, docsRes] = await Promise.all([
          fetch(joinUrl(apiUrl, `/api/clientes/${id}`), {
            headers: { Accept: "application/json" },
          }),
          fetch(joinUrl(apiUrl, `/api/tipo-documentos`)),
          fetch(joinUrl(apiUrl, `/api/clientes/${id}/documentos`)),
        ]);

        if (clientRes.ok) {
          const json: ApiClient = await clientRes.json();
          setClient(mapApiClientToClient(json));
        }

        if (typesRes.ok) {
          const types = await typesRes.json();
          setDocumentTypes(types);
        }

        if (docsRes.ok) {
          const docs: ApiDocumento[] = await docsRes.json();
          setDocuments(
            docs.map((d) => ({
              id: d.id,
              filename: d.nome_arquivo,
              type: d.tipo_nome,
              base64: d.arquivo_base64,
            }))
          );
        }
      } catch (error) {
        console.error("Erro ao buscar dados do cliente:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const formatDate = (iso?: string) =>
    iso ? new Date(iso).toLocaleDateString("pt-BR") : "";

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Carregando…</p>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="p-6">
        <p>Cliente não encontrado</p>
      </div>
    );
  }

  const processosPorStatus = client.processes.reduce<Record<string, typeof client.processes>>(
    (acc, processo) => {
      (acc[processo.status] = acc[processo.status] || []).push(processo);
      return acc;
    },
    {}
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => navigate(-1)}>
          Voltar
        </Button>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => navigate(`/clientes/${id}/editar`)}
          >
            Editar
          </Button>
          <Button onClick={() => navigate(`/clientes/${id}/novo-processo`)}>
            Nova Oportunidade
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="bg-primary/10 text-primary">
                {client.type === "Pessoa Física" ? (
                  <User className="h-6 w-6" />
                ) : (
                  <Building2 className="h-6 w-6" />
                )}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle>{client.name}</CardTitle>
              <Badge variant="outline" className="mt-1">
                {client.type}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Mail className="h-4 w-4" /> {client.email}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Phone className="h-4 w-4" /> {client.phone}
          </div>
          <div className="text-sm text-muted-foreground">
            {client.type === "Pessoa Física" ? "CPF" : "CNPJ"}: {client.document}
          </div>
          <div className="text-sm text-muted-foreground">Endereço: {client.address}</div>
          <div className="text-sm text-muted-foreground">Área: {client.area}</div>
          <div className="text-sm text-muted-foreground">Status: {client.status}</div>
          <div className="text-sm text-muted-foreground">
            Último contato: {formatDate(client.lastContact)}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="documentos" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="documentos">Documentos</TabsTrigger>

          <TabsTrigger value="processos">Processos</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="documentos" className="mt-4">
          <Card>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4 sm:items-end">
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger className="sm:w-1/4">
                    <SelectValue placeholder="Tipo de documento" />
                  </SelectTrigger>
                  <SelectContent>
                    {documentTypes.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="file"
                  onChange={(e) =>
                    setSelectedFile(e.target.files?.[0] ?? null)
                  }
                  className="sm:w-1/2"
                />
                <Button
                  onClick={handleAddDocument}
                  disabled={!selectedFile || !selectedType}
                >
                  Adicionar
                </Button>
              </div>
              {documents.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {documents.map((doc) => (
                    <Card key={doc.id} className="relative">
                      <CardContent className="p-4 space-y-2">
                        <p className="text-sm font-medium">{doc.filename}</p>
                        <p className="text-sm text-muted-foreground">{doc.type}</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDocument(doc)}
                        >
                          Visualizar
                        </Button>
                        <Button
                          variant="destructive"
                          size="icon"
                          className="absolute top-2 right-2"
                          onClick={() => handleRemoveDocument(doc.id)}
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="processos" className="mt-4">
          {Object.keys(processosPorStatus).length === 0 ? (
            <Card>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Nenhum processo encontrado para este cliente.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {Object.entries(processosPorStatus).map(([status, processos]) => (
                <div key={status} className="space-y-2">
                  <h2 className="text-xl font-semibold">{status}</h2>
                  {processos.map((processo) => (
                    <Card
                      key={processo.id}
                      className="cursor-pointer"
                      onClick={() =>
                        navigate(`/clientes/${id}/processos/${processo.id}`)
                      }
                    >
                      <CardContent className="flex justify-between items-center py-4">
                        <div>
                          <p className="font-medium">
                            {processo.number
                              ? `Processo ${processo.number}`
                              : "Processo"}
                          </p>
                          {processo.tipo && (
                            <p className="text-sm text-muted-foreground">
                              {processo.tipo}
                            </p>
                          )}
                        </div>
                        <Badge>{processo.status}</Badge>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="historico" className="mt-4">
          {client.history && client.history.length > 0 ? (
            <div className="space-y-3">
              {client.history.map((h) => (
                <Card key={h.id}>
                  <CardContent className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium">{h.action}</p>
                      {h.note && (
                        <p className="text-sm text-muted-foreground">{h.note}</p>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatDate(h.date)}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Sem histórico por enquanto.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
      <Dialog open={!!previewDoc} onOpenChange={(o) => !o && setPreviewDoc(null)}>
        <DialogContent className="max-w-3xl w-[90vw] h-[90vh] p-0">
          {previewDoc && (
            <iframe
              src={`data:application/pdf;base64,${previewDoc.base64}`}
              className="w-full h-full"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
