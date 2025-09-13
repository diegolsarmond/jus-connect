import { useNavigate, useParams } from "react-router-dom";
import { clients } from "@/lib/clients";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function VisualizarProcesso() {
  const { id, processoId } = useParams();
  const navigate = useNavigate();

  const client = clients.find((c) => c.id === Number(id));
  const processo = client?.processes.find((p) => p.id === Number(processoId));

  if (!client || !processo) {
    return (
      <div className="p-6">
        <p>Processo não encontrado</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => navigate(-1)}>
          Voltar
        </Button>
        <div className="flex gap-2">
          <Button
            onClick={() =>
              navigate(`/clientes/${id}/processos/${processoId}/contrato`)
            }
          >
            Gerar contrato
          </Button>
          <Button>Gerar termo de hipossuficiência</Button>
          <Button>Anexar documentos</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {processo.number ? `Processo ${processo.number}` : "Processo"}
          </CardTitle>
          {processo.tipo && (
            <p className="text-sm text-muted-foreground">{processo.tipo}</p>
          )}
        </CardHeader>
        <CardContent>
          <Badge>{processo.status}</Badge>
        </CardContent>
      </Card>
    </div>
  );
}
