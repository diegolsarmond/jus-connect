import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface OpportunityData {
  id: number;
  title?: string;
  [key: string]: unknown; // allow additional fields
}

export default function VisualizarOportunidade() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [opportunity, setOpportunity] = useState<OpportunityData | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("opportunities");
    if (stored) {
      const list: OpportunityData[] = JSON.parse(stored);
      const found = list.find((o) => String(o.id) === id);
      if (found) setOpportunity(found);
    }
  }, [id]);

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

  const fields: { label: string; key: string }[] = [
    { label: "Cliente", key: "solicitante_nome" },
    { label: "Tipo de Processo", key: "tipo_processo_nome" },
    { label: "Área de Atuação", key: "area" },
    { label: "Responsável", key: "responsible" },
    { label: "Número do Processo", key: "numero_processo_cnj" },
    { label: "Número do Protocolo", key: "numero_protocolo" },
    { label: "Vara/Órgão", key: "vara_ou_orgao" },
    { label: "Comarca", key: "comarca" },
    { label: "Autor", key: "autor" },
    { label: "Réu", key: "reu" },
    { label: "Terceiro Interessado", key: "terceiro_interessado" },
    { label: "Fase", key: "fase" },
    { label: "Etapa", key: "etapa_nome" },
    { label: "Prazo Próximo", key: "prazo_proximo" },
    { label: "Status", key: "status" },
    { label: "CPF/CNPJ", key: "solicitante_cpf_cnpj" },
    { label: "Email", key: "solicitante_email" },
    { label: "Telefone", key: "solicitante_telefone" },
    { label: "Tipo de Cliente", key: "cliente_tipo" },
    { label: "Valor da Causa", key: "valor_causa" },
    { label: "Valor dos Honorários", key: "valor_honorarios" },
    { label: "% Honorários", key: "percentual_honorarios" },
    { label: "Forma de Pagamento", key: "forma_pagamento" },
    { label: "Contingenciamento", key: "contingenciamento" },
    { label: "Detalhes", key: "detalhes" },
    { label: "Criado por", key: "criado_por" },
    { label: "Data de Criação", key: "data_criacao" },
    { label: "Última Atualização", key: "ultima_atualizacao" },
  ];

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Visualizar Oportunidade</h1>
        <Button variant="outline" onClick={() => navigate(-1)}>
          Voltar
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{opportunity.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {fields.map((f) => {
            const value = opportunity[f.key];
            if (!value) return null;
            return (
              <div key={f.key} className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <span className="font-medium">{f.label}:</span>
                <span>{value}</span>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

