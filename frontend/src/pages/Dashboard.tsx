import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Target, Calendar, DollarSign, Clock, AlertTriangle } from "lucide-react";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const apiUrl = (import.meta.env.VITE_API_URL as string) || "http://localhost:3000";

function joinUrl(base: string, path = "") {
  const b = base.replace(/\/+$/, "");
  const p = path ? (path.startsWith("/") ? path : `/${path}`) : "";
  return `${b}${p}`;
}

export default function Dashboard() {
  const [totalClientes, setTotalClientes] = useState(0);
  const [compromissosHoje, setCompromissosHoje] = useState(0);
  const [upcomingEvents, setUpcomingEvents] = useState<{
    title: string;
    time: string;
    date: string;
    type: string;
  }[]>([]);
  const navigate = useNavigate();

  const recentClients = [
    { name: "João Silva", type: "Pessoa Física", area: "Trabalhista", status: "Ativo" },
    { name: "Tech Solutions Ltda", type: "Pessoa Jurídica", area: "Empresarial", status: "Proposta" },
    { name: "Maria Santos", type: "Pessoa Física", area: "Família", status: "Ativo" },
    { name: "Construtora ABC", type: "Pessoa Jurídica", area: "Tributário", status: "Negociação" },
  ];

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const clientesRes = await fetch(joinUrl(apiUrl, "/api/clientes/ativos/total"), {
          headers: { Accept: "application/json" },
        });
        if (clientesRes.ok) {
          const json = await clientesRes.json();
          setTotalClientes(Number(json.total_clientes_ativos) || 0);
        }

        const compromissosRes = await fetch(joinUrl(apiUrl, "/api/agendas/total-hoje"), {
          headers: { Accept: "application/json" },
        });
        if (compromissosRes.ok) {
          const json = await compromissosRes.json();
          setCompromissosHoje(Number(json.total_compromissos_hoje) || 0);
        }
      } catch (error) {
        console.error("Erro ao buscar métricas:", error);
      }
    };

    const fetchUpcomingEvents = async () => {
      try {
        const res = await fetch(joinUrl(apiUrl, "/api/agendas"), {
          headers: { Accept: "application/json" },
        });
        if (res.ok) {
          const json = await res.json();
          const rows: unknown[] =
            Array.isArray(json)
              ? json
              : Array.isArray(json?.data)
                ? json.data
                : Array.isArray(json?.rows)
                  ? json.rows
                  : Array.isArray(json?.agendas)
                    ? json.agendas
                    : [];
          interface AgendaItem {
            titulo?: string;
            hora_inicio: string;
            data: string;
            tipo_evento?: string;
          }
          const events = (rows as AgendaItem[])
            .map((r) => ({
              title: r.titulo ?? "(sem título)",
              time: r.hora_inicio,
              date: r.data,
              type: r.tipo_evento || "Compromisso",
            }))
            .slice(0, 3);
          setUpcomingEvents(events);
        }
      } catch (error) {
        console.error("Erro ao buscar compromissos:", error);
      }
    };

    fetchMetrics();
    fetchUpcomingEvents();
  }, []);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Visão geral do escritório</p>
        </div>
        <Button className="bg-primary hover:bg-primary-hover">
          Novo Cliente
        </Button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total de Clientes"
          value={totalClientes}
          icon={Users}
        />
        <MetricCard
          title="Oportunidades Ativas"
          value="23"
          change="+5 esta semana"
          changeType="positive"
          icon={Target}
        />
        <MetricCard
          title="Compromissos Hoje"
          value={compromissosHoje}
          icon={Calendar}
        />
        <MetricCard
          title="Receita Este Mês"
          value="R$ 47.500"
          change="+18% vs mês anterior"
          changeType="positive"
          icon={DollarSign}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Clients */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold">Clientes Recentes</CardTitle>
            <Button variant="ghost" size="sm">Ver Todos</Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentClients.map((client, index) => (
              <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div className="space-y-1">
                  <p className="font-medium text-foreground">{client.name}</p>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {client.type}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{client.area}</span>
                  </div>
                </div>
                <Badge 
                  variant={
                    client.status === "Ativo" ? "default" : 
                    client.status === "Proposta" ? "secondary" : 
                    "outline"
                  }
                  className={
                    client.status === "Ativo" ? "bg-success text-success-foreground" : ""
                  }
                >
                  {client.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Upcoming Events */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold">Próximos Compromissos</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/agenda")}
            >
              Ver Agenda
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {upcomingEvents.map((event, index) => (
              <div key={index} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                <div className={`p-2 rounded-full ${
                  event.type === "Audiência" ? "bg-primary/10" :
                  event.type === "Reunião" ? "bg-success/10" :
                  "bg-warning/10"
                }`}>
                  {event.type === "Audiência" ? (
                    <AlertTriangle className={`h-4 w-4 ${
                      event.type === "Audiência" ? "text-primary" :
                      event.type === "Reunião" ? "text-success" :
                      "text-warning"
                    }`} />
                  ) : event.type === "Reunião" ? (
                    <Users className="h-4 w-4 text-success" />
                  ) : (
                    <Clock className="h-4 w-4 text-warning" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">{event.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {event.date} às {event.time}
                  </p>
                </div>
                <Badge variant="outline" className="text-xs">
                  {event.type}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}