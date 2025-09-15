import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Check } from "lucide-react";

export default function MeuPlano() {
  const plano = {
    nome: "Profissional",
    valor: "R$ 99,00/mês",
    proximaCobranca: "10/02/2025",
  };

  const limites = [
    { label: "Usuários ativos", atual: 8, limite: 10 },
    { label: "Clientes", atual: 150, limite: 200 },
    { label: "Processos", atual: 80, limite: 100 },
  ];

  const beneficios = [
    "Suporte prioritário",
    "Relatórios avançados",
    "Integrações com APIs",
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Meu Plano</h1>
        <p className="text-muted-foreground">Acompanhe os detalhes do seu plano atual</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-2xl">{plano.nome}</CardTitle>
            <p className="text-muted-foreground">{plano.valor}</p>
          </div>
          <Badge variant="secondary">Ativo</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Próxima cobrança em {plano.proximaCobranca}
          </p>
          <Button>Alterar plano</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Utilização</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {limites.map((item) => (
            <div key={item.label}>
              <div className="flex justify-between mb-1 text-sm">
                <span>{item.label}</span>
                <span>
                  {item.atual}/{item.limite}
                </span>
              </div>
              <Progress value={(item.atual / item.limite) * 100} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Benefícios Inclusos</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {beneficios.map((b) => (
              <li key={b} className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
