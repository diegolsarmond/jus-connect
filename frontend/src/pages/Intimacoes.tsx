import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Download,
  FileText,
  CheckCircle,
  CalendarClock,
  Layers,
  Eye,
  User,
  Clock,
  Tag,
  AlertTriangle,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  intimacoesMensais,
  intimacoesPorStatus,
  intimacoesPorTipo,
  modelosIntimacao,
  type ModeloIntimacao,
} from "@/data/mockIntimacoes";

const PIE_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--secondary))",
  "hsl(var(--accent))",
];

const getStatusVariant = (status: ModeloIntimacao["status"]) => {
  switch (status) {
    case "Ativo":
      return "secondary" as const;
    case "Em revisão":
      return "outline" as const;
    case "Arquivado":
      return "destructive" as const;
    default:
      return "outline" as const;
  }
};

const formatPrazoTooltip = (value: number | string) => {
  const formatted = typeof value === "number" ? value.toFixed(1) : value;
  return [`${formatted} dias`, "Prazo médio"] as const;
};

export default function Intimacoes() {
  const totalEnviadas = intimacoesMensais.reduce((total, item) => total + item.enviadas, 0);
  const totalCumpridas = intimacoesMensais.reduce((total, item) => total + item.cumpridas, 0);
  const totalPendentes = intimacoesMensais.reduce((total, item) => total + item.pendentes, 0);
  const taxaCumprimento = Math.round((totalCumpridas / totalEnviadas) * 100);
  const prazoMedioResposta =
    intimacoesMensais.reduce((total, item) => total + item.prazoMedio, 0) / intimacoesMensais.length;
  const modelosAtivos = modelosIntimacao.filter((modelo) => modelo.status === "Ativo").length;

  return (
    <div className="p-6 space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">Intimações</h1>
          <p className="text-muted-foreground">
            Acompanhe os indicadores das intimações e utilize modelos padronizados elaborados por juízes.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Exportar dados
          </Button>
          <Button>
            <FileText className="mr-2 h-4 w-4" />
            Nova intimação
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Intimações enviadas</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEnviadas}</div>
            <p className="text-xs text-muted-foreground">Registradas nos últimos 6 meses</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de cumprimento</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{taxaCumprimento}%</div>
            <p className="text-xs text-muted-foreground">Proporção de intimações cumpridas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Prazo médio de resposta</CardTitle>
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{prazoMedioResposta.toFixed(1)} dias</div>
            <p className="text-xs text-muted-foreground">Tempo médio entre envio e cumprimento</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Intimações pendentes</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPendentes}</div>
            <p className="text-xs text-muted-foreground">Aguardando providências</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Volume mensal de intimações</CardTitle>
            <CardDescription>Comparativo entre intimações enviadas e situação atual</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={intimacoesMensais}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" />
                <YAxis allowDecimals={false} />
                <Tooltip formatter={(value: number | string) => [`${value}`, "Quantidade"]} />
                <Legend />
                <Bar dataKey="cumpridas" name="Cumpridas" stackId="a" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="emAndamento" name="Em andamento" stackId="a" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="pendentes" name="Pendentes" stackId="a" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Distribuição por status</CardTitle>
            <CardDescription>Situação atual das intimações</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={intimacoesPorStatus}
                  dataKey="value"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={4}
                >
                  {intimacoesPorStatus.map((entry, index) => (
                    <Cell key={entry.status} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number | string) => [`${value}`, "Intimações"]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Tipos de intimação</CardTitle>
            <CardDescription>Principais categorias utilizadas</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={intimacoesPorTipo} layout="vertical" margin={{ left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="tipo" width={160} />
                <Tooltip formatter={(value: number | string) => [`${value}`, "Intimações"]} />
                <Bar dataKey="value" name="Total" fill="hsl(var(--accent))" radius={[4, 4, 4, 4]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Prazo médio por mês</CardTitle>
            <CardDescription>Tempo médio de resposta em dias úteis</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={intimacoesMensais}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" />
                <YAxis domain={[0, "dataMax + 1"]} />
                <Tooltip formatter={(value: number | string) => formatPrazoTooltip(value)} />
                <Line
                  type="monotone"
                  dataKey="prazoMedio"
                  name="Prazo médio"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <section className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Modelos de intimação</h2>
            <p className="text-muted-foreground">
              {modelosAtivos} modelos ativos elaborados por juízes para uso em diferentes situações
              processuais.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Exportar modelos
            </Button>
            <Button size="sm">
              <Layers className="mr-2 h-4 w-4" />
              Gerenciar biblioteca
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {modelosIntimacao.map((modelo) => (
            <Card key={modelo.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-lg">{modelo.titulo}</CardTitle>
                    <CardDescription>{modelo.descricao}</CardDescription>
                  </div>
                  <Badge variant={getStatusVariant(modelo.status)}>{modelo.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-4 text-sm">
                <div className="grid gap-2 text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span>
                      Juiz responsável: <span className="font-medium text-foreground">{modelo.juizResponsavel}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CalendarClock className="h-4 w-4" />
                    <span>
                      Atualizado em <span className="font-medium text-foreground">{modelo.ultimaAtualizacao}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <span>
                      {modelo.prazoResposta}
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Tag className="mt-1 h-4 w-4" />
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">{modelo.area}</Badge>
                      {modelo.tags.map((tag) => (
                        <Badge key={tag} variant="outline">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex flex-wrap gap-2">
                <Button size="sm" variant="default">
                  <Eye className="mr-2 h-4 w-4" />
                  Visualizar modelo
                </Button>
                <Button size="sm" variant="outline">
                  <FileText className="mr-2 h-4 w-4" />
                  Usar modelo
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
