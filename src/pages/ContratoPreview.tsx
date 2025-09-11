import { useNavigate, useParams } from "react-router-dom";
import { clients } from "@/lib/clients";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ContratoPreview() {
  const { id, processoId } = useParams();
  const navigate = useNavigate();

  const client = clients.find((c) => c.id === Number(id));
  const processo = client?.processes.find((p) => p.id === Number(processoId));

  const handlePrint = () => {
    window.print();
  };

  const handleEmail = () => {
    const subject = "Minuta de Contrato de Prestação de Serviços";
    const body = `Prezado(a) ${client?.name}, segue a minuta do contrato referente ao processo ${processo?.title}.`;
    window.location.href = `mailto:${client?.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  if (!client || !processo) {
    return (
      <div className="p-6">
        <p>Contrato não encontrado</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <Button variant="outline" onClick={() => navigate(-1)}>
          Voltar
        </Button>
        <div className="flex gap-2">
          <Button onClick={handleEmail}>Enviar por e-mail</Button>
          <Button onClick={handlePrint}>Imprimir</Button>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-center">Contrato de Prestação de Serviços</CardTitle>
        </CardHeader>
        <CardContent className="prose max-w-none">
          <p>
            Contratante: <strong>{client.name}</strong> ({client.document})
          </p>
          <p>
            Processo: <strong>{processo.title}</strong> ({processo.number})
          </p>
          <p>
            Pelo presente instrumento particular, as partes acima identificadas
            têm entre si justo e contratado a prestação de serviços jurídicos,
            que se regerá pelas cláusulas e condições seguintes.
          </p>
          <p>
            <strong>Cláusula 1ª - Do Objeto:</strong> O presente contrato tem como
            objeto a prestação de serviços jurídicos pela contratada ao
            contratante relacionados ao processo mencionado.
          </p>
          <p>
            <strong>Cláusula 2ª - Da Remuneração:</strong> As partes acordam que a
            remuneração pelos serviços será ajustada separadamente, de acordo com
            a complexidade do caso e o tempo despendido.
          </p>
          <p>
            <strong>Cláusula 3ª - Da Vigência:</strong> Este contrato vigerá pelo
            prazo necessário à conclusão dos serviços, podendo ser rescindido por
            qualquer das partes mediante comunicação prévia.
          </p>
          <p>
            E, por estarem assim justos e contratados, firmam o presente
            instrumento.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

