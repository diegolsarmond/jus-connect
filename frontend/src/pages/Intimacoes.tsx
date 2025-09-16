import { useState } from "react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import TaskCreationDialog, { TaskCreationPrefill } from "@/components/tasks/TaskCreationDialog";
import {
  Download,
  FileText,
  CheckCircle,
  CalendarClock,
  Eye,
  User,
  Clock,
  Tag,
  AlertTriangle,
  Hash,
  MapPin,
  Gavel,
  UserCircle,
  CalendarDays,
  UserCheck,
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

  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [viewingModelo, setViewingModelo] = useState<ModeloIntimacao | null>(null);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [taskPrefill, setTaskPrefill] = useState<TaskCreationPrefill | undefined>();

  const handleViewDialogChange = (open: boolean) => {
    setIsViewDialogOpen(open);
    if (!open) {
      setViewingModelo(null);
    }
  };

  const handleOpenView = (modelo: ModeloIntimacao) => {
    setViewingModelo(modelo);
    setIsViewDialogOpen(true);
  };

  const handleTaskDialogChange = (open: boolean) => {
    setTaskDialogOpen(open);
    if (!open) {
      setTaskPrefill(undefined);
    }
  };

  const handleOpenTaskDialog = (modelo: ModeloIntimacao) => {
    setTaskPrefill({
      title: modelo.titulo,
      description: modelo.descricao,
      processLabel: `${modelo.numeroProcesso} · ${modelo.cliente}`,
    });
    setTaskDialogOpen(true);
  };

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

      

        

      <section className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Modelos de intimação</h2>
            <p className="text-muted-foreground">
              {modelosAtivos} modelos ativos disponíveis para personalização e envio rápido.
            </p>
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
                <div className="grid gap-3 text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Hash className="h-4 w-4" />
                    <span>
                      Nº do processo: <span className="font-medium text-foreground">{modelo.numeroProcesso}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    <span>
                      Comarca: <span className="font-medium text-foreground">{modelo.comarca}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Gavel className="h-4 w-4" />
                    <span>
                      Vara: <span className="font-medium text-foreground">{modelo.vara}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <UserCircle className="h-4 w-4" />
                    <span>
                      Cliente: <span className="font-medium text-foreground">{modelo.cliente}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" />
                    <span>
                      Distribuído em <span className="font-medium text-foreground">{modelo.dataDistribuicao}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <UserCheck className="h-4 w-4" />
                    <span>
                      Advogado responsável: <span className="font-medium text-foreground">{modelo.advogadoResponsavel}</span>
                    </span>
                  </div>
                </div>
                <div className="grid gap-2 border-t border-border/60 pt-4 text-muted-foreground">
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
                    <span>{modelo.prazoResposta}</span>
                  </div>
                </div>
                <div className="flex items-start gap-2 text-muted-foreground">
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
              </CardContent>
              <CardFooter className="flex flex-wrap gap-2">
                <Button size="sm" variant="default" onClick={() => handleOpenView(modelo)}>
                  <Eye className="mr-2 h-4 w-4" />
                  Visualizar intimação
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleOpenTaskDialog(modelo)}>
                  <FileText className="mr-2 h-4 w-4" />
                  Criar Tarefa
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </section>

      <Dialog open={isViewDialogOpen} onOpenChange={handleViewDialogChange}>
        <DialogContent className="max-w-2xl">
          {viewingModelo && (
            <>
              <DialogHeader>
                <DialogTitle>{viewingModelo.titulo}</DialogTitle>
                <DialogDescription>{viewingModelo.descricao}</DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-[70vh] pr-2">
                <div className="space-y-6 py-2">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={getStatusVariant(viewingModelo.status)}>{viewingModelo.status}</Badge>
                    <Badge variant="secondary">{viewingModelo.area}</Badge>
                    {viewingModelo.tags.map((tag) => (
                      <Badge key={tag} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <div className="grid gap-4 text-sm sm:grid-cols-2">
                    {[
                      { label: "Número do processo", value: viewingModelo.numeroProcesso },
                      { label: "Comarca", value: viewingModelo.comarca },
                      { label: "Vara", value: viewingModelo.vara },
                      { label: "Cliente", value: viewingModelo.cliente },
                      { label: "Data de distribuição", value: viewingModelo.dataDistribuicao },
                      { label: "Advogado responsável", value: viewingModelo.advogadoResponsavel },
                    ].map((item) => (
                      <div key={item.label} className="space-y-1">
                        <p className="text-xs font-medium uppercase text-muted-foreground">{item.label}</p>
                        <p className="font-semibold text-foreground">{item.value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="grid gap-4 text-sm sm:grid-cols-2">
                    {[
                      { label: "Juiz responsável", value: viewingModelo.juizResponsavel },
                      { label: "Prazo de resposta", value: viewingModelo.prazoResposta },
                      { label: "Última atualização", value: viewingModelo.ultimaAtualizacao },
                    ].map((item) => (
                      <div key={item.label} className="space-y-1">
                        <p className="text-xs font-medium uppercase text-muted-foreground">{item.label}</p>
                        <p className="font-semibold text-foreground">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>

      <TaskCreationDialog
        open={taskDialogOpen}
        onOpenChange={handleTaskDialogChange}
        prefill={taskPrefill}
      />
    </div>
  );
}
