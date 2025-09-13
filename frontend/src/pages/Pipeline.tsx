import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Plus, MoreHorizontal, DollarSign, Calendar, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Opportunity {
  id: number;
  title: string;
  client: string;
  value: string;
  probability: number;
  stage: string;
  dueDate: string;
  area: string;
  responsible: string;
}

interface Stage {
  id: string;
  name: string;
  color: string;
}

export default function Pipeline() {
  const apiUrl = (import.meta.env.VITE_API_URL as string) || "http://localhost:3000";
  const navigate = useNavigate();
  const { fluxoId } = useParams<{ fluxoId?: string }>();

  const [pipelineName, setPipelineName] = useState<string>("Vendas");
  const [stages, setStages] = useState<Stage[]>([]);

  useEffect(() => {
    const fetchStages = async () => {
      try {
        const res = await fetch(`${apiUrl}/api/etiquetas`, {
          headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        const data = await res.json();
        const parsed: unknown[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.rows)
          ? data.rows
          : Array.isArray(data?.data?.rows)
          ? data.data.rows
          : Array.isArray(data?.data)
          ? data.data
          : [];
        const filtered = fluxoId
          ? parsed.filter(
              (r) => String((r as { id_fluxo_trabalho?: number | string }).id_fluxo_trabalho) === fluxoId
            )
          : parsed;
        const colors = [
          "bg-blue-100 text-blue-800",
          "bg-yellow-100 text-yellow-800",
          "bg-orange-100 text-orange-800",
          "bg-green-100 text-green-800",
          "bg-purple-100 text-purple-800",
          "bg-pink-100 text-pink-800",
        ];
        setStages(
          filtered.map((r, idx) => {
            const item = r as { id: number | string; nome?: string };
            return {
              id: String(item.id),
              name: item.nome ?? "",
              color: colors[idx % colors.length],
            };
          })
        );
      } catch (e) {
        console.error(e);
      }
    };
    fetchStages();
  }, [apiUrl, fluxoId]);

  useEffect(() => {
    if (!fluxoId) return;
    const fetchName = async () => {
      try {
        const res = await fetch(`${apiUrl}/api/fluxos-trabalho/menus`, {
          headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        const data = await res.json();
        type MenuApiItem = { id: number | string; nome?: string };
        const parsed: MenuApiItem[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.rows)
          ? data.rows
          : Array.isArray(data?.data?.rows)
          ? data.data.rows
          : Array.isArray(data?.data)
          ? data.data
          : [];
        const current = parsed.find((m) => String(m.id) === fluxoId);
        if (current?.nome) setPipelineName(current.nome);
      } catch (e) {
        console.error(e);
      }
    };
    fetchName();
  }, [apiUrl, fluxoId]);

  const [opportunities, setOpportunities] = useState<Opportunity[]>(() => {
    const stored = localStorage.getItem("opportunities");
    if (stored) return JSON.parse(stored);
    return [
    {
      id: 1,
      title: "Consultoria Tributária - Tech Solutions",
      client: "Tech Solutions Ltda",
      value: "R$ 15.000",
      probability: 80,
      stage: "3",
      dueDate: "2024-01-20",
      area: "Tributário",
      responsible: "Dr. Ana Beatriz"
    },
    {
      id: 2,
      title: "Ação Trabalhista - João Silva",
      client: "João Silva",
      value: "R$ 8.500",
      probability: 90,
      stage: "4",
      dueDate: "2024-01-18",
      area: "Trabalhista",
      responsible: "Dr. Carlos Mendes"
    },
    {
      id: 3,
      title: "Divórcio Consensual - Maria Santos",
      client: "Maria Santos",
      value: "R$ 3.200",
      probability: 60,
      stage: "2",
      dueDate: "2024-01-25",
      area: "Família",
      responsible: "Dra. Lucia Ferreira"
    },
    {
      id: 4,
      title: "Regularização Empresarial - ABC Ltda",
      client: "Construtora ABC Ltda",
      value: "R$ 25.000",
      probability: 40,
      stage: "1",
      dueDate: "2024-01-30",
      area: "Empresarial",
      responsible: "Dr. Roberto Silva"
    },
    {
      id: 5,
      title: "Recuperação de Crédito - XYZ Corp",
      client: "XYZ Corporation",
      value: "R$ 12.000",
      probability: 70,
      stage: "3",
      dueDate: "2024-01-22",
      area: "Civil",
      responsible: "Dr. Ana Beatriz"
    },
    ];
  });

  useEffect(() => {
    localStorage.setItem("opportunities", JSON.stringify(opportunities));
  }, [opportunities]);

  const getOpportunitiesByStage = (stageId: string) => {
    return opportunities.filter(opp => opp.stage === stageId);
  };

  const getTotalValueByStage = (stageId: string) => {
    return getOpportunitiesByStage(stageId)
      .reduce((total, opp) => total + parseFloat(opp.value.replace('R$ ', '').replace('.', '')), 0);
  };

  const getProbabilityColor = (probability: number) => {
    if (probability >= 80) return "text-success";
    if (probability >= 60) return "text-warning";
    return "text-muted-foreground";
  };

  const handleDragStart = (event: React.DragEvent<HTMLDivElement>, opportunityId: number) => {
    event.dataTransfer.setData("text/plain", opportunityId.toString());
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>, stageId: string) => {
    event.preventDefault();
    const id = Number(event.dataTransfer.getData("text/plain"));
    setOpportunities(prev =>
      prev.map(opp =>
        opp.id === id ? { ...opp, stage: stageId } : opp
      )
    );
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Pipeline de {pipelineName}</h1>
          <p className="text-muted-foreground">Acompanhe suas oportunidades</p>
        </div>
        <Button
          className="bg-primary hover:bg-primary-hover"
          onClick={() => navigate("/pipeline/nova-oportunidade")}
        >
          <Plus className="mr-2 h-4 w-4" />
          Nova Oportunidade
        </Button>
      </div>


       {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Resumo do Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">{opportunities.length}</p>
              <p className="text-sm text-muted-foreground">Total Oportunidades</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-success">
                R$ {opportunities.reduce((total, opp) => 
                  total + parseFloat(opp.value.replace('R$ ', '').replace('.', '')), 0
                ).toLocaleString('pt-BR')}
              </p>
              <p className="text-sm text-muted-foreground">Valor Total</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">
                {Math.round(opportunities.reduce((total, opp) => total + opp.probability, 0) / opportunities.length)}%
              </p>
              <p className="text-sm text-muted-foreground">Probabilidade Média</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-warning">
                R$ {Math.round(opportunities.reduce((total, opp) => 
                  total + (parseFloat(opp.value.replace('R$ ', '').replace('.', '')) * opp.probability / 100), 0
                )).toLocaleString('pt-BR')}
              </p>
              <p className="text-sm text-muted-foreground">Receita Prevista</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pipeline Kanban */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {stages.map((stage) => {
          const stageOpportunities = getOpportunitiesByStage(stage.id);
          const totalValue = getTotalValueByStage(stage.id);

          return (
            <div key={stage.id} className="space-y-4">
              {/* Stage Header */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Badge className={stage.color}>
                    {stage.name}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {stageOpportunities.length}
                  </span>
                </div>
                <p className="text-sm font-medium text-foreground">
                  R$ {totalValue.toLocaleString('pt-BR')}
                </p>
              </div>



              {/* Opportunities */}
              <div
                className="space-y-3 min-h-[400px]"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, stage.id)}
              >
                {stageOpportunities.map((opportunity) => (
                  <Card
                    key={opportunity.id}
                    className="cursor-pointer hover:shadow-md transition-all duration-200"
                    draggable
                    onDragStart={(e) => handleDragStart(e, opportunity.id)}
                    onClick={() => navigate(`/pipeline/oportunidade/${opportunity.id}`)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-sm font-medium leading-tight">
                          {opportunity.title}
                        </CardTitle>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6">
                              <MoreHorizontal className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>Editar</DropdownMenuItem>
                            <DropdownMenuItem>Mover para...</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">Excluir</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="bg-primary/10 text-primary text-xs">
                            <User className="h-3 w-3" />
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs text-muted-foreground truncate">
                          {opportunity.client}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3 text-success" />
                          <span className="text-sm font-medium text-success">
                            {opportunity.value}
                          </span>
                        </div>
                        <span className={`text-xs font-medium ${getProbabilityColor(opportunity.probability)}`}>
                          {opportunity.probability}%
                        </span>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {new Date(opportunity.dueDate).toLocaleDateString('pt-BR')}
                        </div>
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="text-xs">
                            {opportunity.area}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {opportunity.responsible}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {stageOpportunities.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <p className="text-sm">Nenhuma oportunidade</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

     
    </div>
  );
}