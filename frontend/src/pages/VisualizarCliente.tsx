import { useNavigate, useParams } from "react-router-dom";
import { clients } from "@/lib/clients";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Mail, Phone, User, Building2 } from "lucide-react";

export default function VisualizarCliente() {
  const { id } = useParams();
  const navigate = useNavigate();
  const client = clients.find((c) => c.id === Number(id));

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
        <Button onClick={() => navigate(`/clientes/${id}/novo-processo`)}>
          Novo Processo
        </Button>
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
            Último contato: {new Date(client.lastContact).toLocaleDateString("pt-BR")}
          </div>
        </CardContent>
      </Card>

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
                      {processo.number ? `Processo ${processo.number}` : "Processo"}
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
    </div>
  );
}
