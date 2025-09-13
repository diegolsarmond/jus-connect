import { useState, useEffect, useRef } from "react";
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
import { refreshGoogleToken } from "@/lib/googleAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

interface Opportunity {
  id: number;
  title: string;
  client: string;
  processType: string;
  value: number;
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

interface Flow {
  id: string;
  name: string;
}

export default function Pipeline() {
  const apiUrl = (import.meta.env.VITE_API_URL as string) || "http://localhost:3000";
  const navigate = useNavigate();
  const { fluxoId } = useParams<{ fluxoId?: string }>();

  const [pipelineName, setPipelineName] = useState<string>("Vendas");
  const [stages, setStages] = useState<Stage[]>([]);
  const [flows, setFlows] = useState<Flow[]>([]);
  const [selectedFlow, setSelectedFlow] = useState<string>("");
  const [moveStages, setMoveStages] = useState<Stage[]>([]);
  const [selectedStage, setSelectedStage] = useState<string>("");
  const [moveModalOpen, setMoveModalOpen] = useState(false);

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

  useEffect(() => {
    const fetchFlows = async () => {
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
        setFlows(parsed.map((m) => ({ id: String(m.id), name: m.nome ?? "" })));
      } catch (e) {
        console.error(e);
      }
    };
    fetchFlows();
  }, [apiUrl]);

  useEffect(() => {
    if (!selectedFlow) return;
    const fetchStagesForFlow = async () => {
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
        const filtered = parsed.filter(
          (r) =>
            String((r as { id_fluxo_trabalho?: number | string }).id_fluxo_trabalho) ===
            selectedFlow,
        );
        setMoveStages(
          filtered.map((r) => {
            const item = r as { id: number | string; nome?: string };
            return { id: String(item.id), name: item.nome ?? "", color: "" };
          }),
        );
      } catch (e) {
        console.error(e);
      }
    };
    fetchStagesForFlow();
  }, [selectedFlow, apiUrl]);

  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const isDragging = useRef(false);

  useEffect(() => {
    const fetchOpportunities = async () => {
      try {
        const url = fluxoId
          ? `${apiUrl}/api/oportunidades/fase/${fluxoId}`
          : `${apiUrl}/api/oportunidades`;

        const [
          oppRes,
          areasRes,
          usersRes,
          clientsRes,
          typesRes,
        ] = await Promise.all([
          fetch(url, { headers: { Accept: "application/json" } }),
          fetch(`${apiUrl}/api/areas`, { headers: { Accept: "application/json" } }),
          fetch(`${apiUrl}/api/usuarios`, {
            headers: { Accept: "application/json" },
          }),
          fetch(`${apiUrl}/api/clientes`, {
            headers: { Accept: "application/json" },
          }),
          fetch(`${apiUrl}/api/tipo-processos`, {
            headers: { Accept: "application/json" },
          }),
        ]);

        if (!oppRes.ok)
          throw new Error(`HTTP ${oppRes.status}: ${await oppRes.text()}`);
        if (!areasRes.ok)
          throw new Error(`HTTP ${areasRes.status}: ${await areasRes.text()}`);
        if (!usersRes.ok)
          throw new Error(`HTTP ${usersRes.status}: ${await usersRes.text()}`);
        if (!clientsRes.ok)
          throw new Error(`HTTP ${clientsRes.status}: ${await clientsRes.text()}`);
        if (!typesRes.ok)
          throw new Error(`HTTP ${typesRes.status}: ${await typesRes.text()}`);

        const data = await oppRes.json();
        const areasData = await areasRes.json();
        const usersData = await usersRes.json();
        const clientsData = await clientsRes.json();
        const typesData = await typesRes.json();

        const parsedOpps: unknown[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.rows)
          ? data.rows
          : Array.isArray(data?.data?.rows)
          ? data.data.rows
          : Array.isArray(data?.data)
          ? data.data
          : [];

        const parsedAreas: unknown[] = Array.isArray(areasData)
          ? areasData
          : Array.isArray(areasData?.rows)
          ? areasData.rows
          : Array.isArray(areasData?.data?.rows)
          ? areasData.data.rows
          : Array.isArray(areasData?.data)
          ? areasData.data
          : [];

        const parsedUsers: unknown[] = Array.isArray(usersData)
          ? usersData
          : Array.isArray(usersData?.rows)
          ? usersData.rows
          : Array.isArray(usersData?.data?.rows)
          ? usersData.data.rows
          : Array.isArray(usersData?.data)
          ? usersData.data
          : [];

        const parsedClients: unknown[] = Array.isArray(clientsData)
          ? clientsData
          : Array.isArray(clientsData?.rows)
          ? clientsData.rows
          : Array.isArray(clientsData?.data?.rows)
          ? clientsData.data.rows
          : Array.isArray(clientsData?.data)
          ? clientsData.data
          : [];

        const parsedTypes: unknown[] = Array.isArray(typesData)
          ? typesData
          : Array.isArray(typesData?.rows)
          ? typesData.rows
          : Array.isArray(typesData?.data?.rows)
          ? typesData.data.rows
          : Array.isArray(typesData?.data)
          ? typesData.data
          : [];

        const areaMap: Record<string, string> = {};
        parsedAreas.forEach((a) => {
          const item = a as { id?: number | string; nome?: string };
          if (item.id) areaMap[String(item.id)] = item.nome ?? "";
        });

        const userMap: Record<string, string> = {};
        parsedUsers.forEach((u) => {
          const item = u as {
            id?: number | string;
            nome_completo?: string;
            nome?: string;
          };
          if (item.id)
            userMap[String(item.id)] = item.nome_completo ?? item.nome ?? "";
        });

        const clientMap: Record<string, string> = {};
        parsedClients.forEach((c) => {
          const item = c as { id?: number | string; nome?: string };
          if (item.id) clientMap[String(item.id)] = item.nome ?? "";
        });

        const typeMap: Record<string, string> = {};
        parsedTypes.forEach((t) => {
          const item = t as { id?: number | string; nome?: string };
          if (item.id) typeMap[String(item.id)] = item.nome ?? "";
        });

        setOpportunities(
          parsedOpps.map((o) => {
            const item = o as Record<string, unknown>;
            const responsibleId = item.responsavel_id
              ? String(item.responsavel_id)
              : "";
            const clientId = item.solicitante_id ? String(item.solicitante_id) : "";
            return {
              id: Number(item.id),
              title:
                (item.detalhes as string) ||
                (item.numero_processo_cnj as string) ||
                `Oportunidade ${item.id}`,
              client: clientId ? clientMap[clientId] || clientId : "",
              processType: item.tipo_processo_id
                ? typeMap[String(item.tipo_processo_id)] || ""
                : "",
              value: item.valor_honorarios ? Number(item.valor_honorarios) : 0,
              probability: item.percentual_honorarios
                ? Number(item.percentual_honorarios)
                : 0,
              stage: item.etapa_id ? String(item.etapa_id) : "",
              dueDate: (item.prazo_proximo as string) || "",
              area: item.area_atuacao_id
                ? areaMap[String(item.area_atuacao_id)] || ""
                : "",
              responsible: responsibleId
                ? userMap[responsibleId] || responsibleId
                : "",
            };
          })
        );
      } catch (e) {
        console.error(e);
      }
    };
    fetchOpportunities();
  }, [apiUrl, fluxoId]);

  const getOpportunitiesByStage = (stageId: string) => {
    return opportunities.filter(opp => opp.stage === stageId);
  };

  const getTotalValueByStage = (stageId: string) => {
    return getOpportunitiesByStage(stageId)
      .reduce((total, opp) => total + opp.value, 0);
  };

  const getProbabilityColor = (probability: number) => {
    if (probability >= 80) return "text-success";
    if (probability >= 60) return "text-warning";
    return "text-muted-foreground";
  };

  const handleDragStart = (
    event: React.DragEvent<HTMLDivElement>,
    opportunityId: number,
  ) => {
    isDragging.current = true;
    event.dataTransfer.setData("text/plain", opportunityId.toString());
  };

  const handleDragEnd = () => {
    setTimeout(() => {
      isDragging.current = false;
    }, 0);
  };

  const handleDrop = async (
    event: React.DragEvent<HTMLDivElement>,
    stageId: string
  ) => {
    event.preventDefault();
    const id = Number(event.dataTransfer.getData("text/plain"));

    try {
      const storedRefresh = localStorage.getItem('google_refresh_token');
      if (storedRefresh) {
        try {
          await refreshGoogleToken(storedRefresh);
        } catch (err) {
          console.error('Erro ao renovar token do Google', err);
        }
      }

      const res = await fetch(`${apiUrl}/api/oportunidades/${id}/etapa`, {
        method: "PATCH",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ etapa_id: Number(stageId) }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      }

      setOpportunities((prev) =>
        prev.map((opp) => (opp.id === id ? { ...opp, stage: stageId } : opp))
      );
    } catch (e) {
      console.error(e);
    }
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
                  total + opp.value, 0
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
                  total + (opp.value * opp.probability / 100), 0
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
                    onDragEnd={handleDragEnd}
                    onDragOver={handleDragOver}
                    onClick={() => {
                      if (isDragging.current) return;
                      navigate(`/pipeline/oportunidade/${opportunity.id}`);
                    }}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-sm font-medium leading-tight">
                            {opportunity.title}
                          </CardTitle>
                          {opportunity.processType && (
                            <span className="text-xs text-muted-foreground">
                              {opportunity.processType}
                            </span>
                          )}
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>Editar</DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={(e) => {
                                e.stopPropagation();
                                setSelectedFlow("");
                                setSelectedStage("");
                                setMoveStages([]);
                                setMoveModalOpen(true);
                              }}
                            >
                              Mover para...
                            </DropdownMenuItem>
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
                            R$ {opportunity.value.toLocaleString('pt-BR')}
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

      <Dialog open={moveModalOpen} onOpenChange={setMoveModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mover oportunidade</DialogTitle>
            <DialogDescription>
              Selecione o fluxo e a etapa de destino
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Select
              value={selectedFlow}
              onValueChange={(value) => {
                setSelectedFlow(value);
                setSelectedStage("");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um fluxo" />
              </SelectTrigger>
              <SelectContent>
                {flows.map((flow) => (
                  <SelectItem key={flow.id} value={flow.id}>
                    {flow.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={selectedStage}
              onValueChange={setSelectedStage}
              disabled={!moveStages.length}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma etapa" />
              </SelectTrigger>
              <SelectContent>
                {moveStages.map((stage) => (
                  <SelectItem key={stage.id} value={stage.id}>
                    {stage.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => setMoveModalOpen(false)}>Mover</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}