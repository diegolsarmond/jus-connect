import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Client } from "@/types/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Phone, User, Building2 } from "lucide-react";

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

  useEffect(() => {
    const fetchClient = async () => {
      try {
        const url = joinUrl(apiUrl, `/api/clientes/${id}`);
        const response = await fetch(url, {
          headers: { Accept: "application/json" },
        });
        if (!response.ok) {
          throw new Error("Failed to fetch client");
        }
        const json: ApiClient = await response.json();
        setClient(mapApiClientToClient(json));
      } catch (error) {
        console.error("Erro ao buscar cliente:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchClient();
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

      <Tabs defaultValue="dados" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="dados">Dados do Cliente</TabsTrigger>
          <TabsTrigger value="processos">Processos</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="dados" className="mt-4">
          <Card>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium">Contato</h3>
                <p className="text-sm text-muted-foreground">{client.email}</p>
                <p className="text-sm text-muted-foreground">{client.phone}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium">Endereço</h3>
                <p className="text-sm text-muted-foreground">{client.address}</p>
                <p className="text-sm text-muted-foreground">CEP: {client.cep ?? "-"}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium">Status</h3>
                <p className="text-sm text-muted-foreground">{client.status}</p>
                <p className="text-sm text-muted-foreground">
                  Último contato: {formatDate(client.lastContact)}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium">Outros</h3>
                <p className="text-sm text-muted-foreground">Área: {client.area || "-"}</p>
              </div>
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
    </div>
  );
}
