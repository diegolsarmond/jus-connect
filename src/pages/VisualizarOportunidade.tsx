import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";

interface OpportunityData {
  id: number;
  title?: string;
  [key: string]: unknown; // allow additional fields
}

export default function VisualizarOportunidade() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const apiUrl = (import.meta.env.VITE_API_URL as string) || "http://localhost:3000";
  const [opportunity, setOpportunity] = useState<OpportunityData | null>(null);

  useEffect(() => {
    if (!id) return;
    const fetchOpportunity = async () => {
      try {
        const res = await fetch(`${apiUrl}/api/oportunidades/${id}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setOpportunity(data);
      } catch (e) {
        console.error(e);
      }
    };
    fetchOpportunity();
  }, [id, apiUrl]);

  const fieldLabels: Record<string, string> = {
    solicitante_nome: "Cliente",
    tipo_processo_nome: "Tipo de Processo",
    area: "Área de Atuação",
    responsible: "Responsável",
    numero_processo_cnj: "Número do Processo",
    numero_protocolo: "Número do Protocolo",
    vara_ou_orgao: "Vara/Órgão",
    comarca: "Comarca",
    autor: "Autor",
    reu: "Réu",
    terceiro_interessado: "Terceiro Interessado",
    fase: "Fase",
    etapa_nome: "Etapa",
    prazo_proximo: "Prazo Próximo",
    status: "Status",
    solicitante_cpf_cnpj: "CPF/CNPJ",
    solicitante_email: "Email",
    solicitante_telefone: "Telefone",
    cliente_tipo: "Tipo de Cliente",
    valor_causa: "Valor da Causa",
    valor_honorarios: "Valor dos Honorários",
    percentual_honorarios: "% Honorários",
    forma_pagamento: "Forma de Pagamento",
    contingenciamento: "Contingenciamento",
    detalhes: "Detalhes",
    criado_por: "Criado por",
    data_criacao: "Data de Criação",
    ultima_atualizacao: "Última Atualização",
  };

  const formatLabel = (key: string) =>
    fieldLabels[key] ||
    key
      .replace(/_/g, " ")
      .replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1));

  const renderValue = (value: unknown) => {
    if (value === null || value === undefined || value === "") {
      return <span className="text-muted-foreground">—</span>;
    }
    if (typeof value === "object") {
      return (
        <pre className="whitespace-pre-wrap text-sm">
          {JSON.stringify(value, null, 2)}
        </pre>
      );
    }
    return String(value);
  };

  if (!opportunity) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Oportunidade</h1>
          <Button variant="outline" onClick={() => navigate(-1)}>
            Voltar
          </Button>
        </div>
        <p className="text-muted-foreground">Oportunidade não encontrada.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Visualizar Oportunidade</h1>
          <p className="text-muted-foreground">
            Detalhes completos da oportunidade
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate(-1)}>
          Voltar
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {opportunity.title || `Oportunidade ${opportunity.id}`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-[70vh]">
            <Table>
              <TableBody>
                {Object.entries(opportunity)
                  .filter(([key]) => key !== "envolvidos")
                  .map(([key, value]) => (
                    <TableRow key={key}>
                      <TableCell className="font-medium w-[40%]">
                        {formatLabel(key)}
                      </TableCell>
                      <TableCell>{renderValue(value)}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {Array.isArray(opportunity.envolvidos) && opportunity.envolvidos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Envolvidos</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                {opportunity.envolvidos.map((env, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium w-[40%]">
                      {formatLabel(env.relacao as string)}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1 text-sm">
                        {env.nome && <div>Nome: {env.nome as string}</div>}
                        {env.cpf_cnpj && (
                          <div>CPF/CNPJ: {env.cpf_cnpj as string}</div>
                        )}
                        {env.telefone && (
                          <div>Telefone: {env.telefone as string}</div>
                        )}
                        {env.endereco && (
                          <div>Endereço: {env.endereco as string}</div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

