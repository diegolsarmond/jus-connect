import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Shield, LogOut, User, ArrowLeft, FileText, Calendar, Users, Building2, Gavel, Download, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Movement {
    id: string;
    date: string;
    description: string;
    details?: string;
}

interface ProcessDetail {
    id: string;
    number: string;
    court: string;
    status: string;
    distributionDate: string;
    lastUpdate: string;
    processClass: string;
    subject: string;
    value: string;
    parties: {
        plaintiffs: string[];
        defendants: string[];
    };
    movements: Movement[];
}

const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return "Não informado";
    try {
        const date = new Date(dateString);
        return format(date, "dd/MM/yyyy", { locale: ptBR });
    } catch {
        return dateString;
    }
};

const formatCurrency = (value: number | null | undefined): string => {
    if (!value) return "Não informado";
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
};

const ProcessDetail = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const [userName, setUserName] = useState("");
    const [process, setProcess] = useState<ProcessDetail | null>(null);
    const [expandedMovements, setExpandedMovements] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchProcessDetails = async () => {
            const token = localStorage.getItem("pdpj_access_token");
            if (!token) {
                navigate("/");
                return;
            }

            const name = localStorage.getItem("pdpj_user_name") || "Usuário";
            setUserName(name);

            if (!id) {
                toast({
                    title: "Erro",
                    description: "Número do processo não informado",
                    variant: "destructive",
                });
                navigate("/dashboard");
                return;
            }

            try {
                setLoading(true);

                console.log('Fetching process details for:', id);

                const { data, error } = await supabase.functions.invoke('pdpj-processos', {
                    body: {
                        type: 'numero',
                        value: id,
                        accessToken: token
                    }
                });

                console.log('Response:', { data, error });

                if (error) {
                    console.error('Function invocation error:', error);
                    throw error;
                }

                if (data?.error) {
                    console.error('API returned error:', data.error);
                    if (data.error.includes("Token expirado") || data.error.includes("Token expirado ou inválido") || data.status === 401) {
                        toast({
                            title: "Sessão expirada",
                            description: data.error,
                            variant: "destructive",
                        });
                        setTimeout(() => {
                            handleLogout();
                        }, 2500);
                        return;
                    }
                    throw new Error(data.error);
                }

                // For process number search, API returns a single process object
                // For CPF search, API returns { content: [...] }
                let apiProcess;

                if (data.content && Array.isArray(data.content)) {
                    // From CPF search - get first process
                    apiProcess = data.content[0];
                } else if (data.numeroProcesso) {
                    // Direct process object from number search
                    apiProcess = data;
                } else if (Array.isArray(data)) {
                    // Array of processes
                    apiProcess = data[0];
                } else {
                    throw new Error("Formato de resposta inválido");
                }

                console.log('Processing data:', apiProcess);

                if (!apiProcess) {
                    throw new Error("Processo não encontrado");
                }

                // Get the first (or only) tramitação
                const tramitacao = apiProcess.tramitacoes?.[0] || apiProcess.tramitacaoAtual || {};

                // Extract parties
                const partes = tramitacao.partes || [];
                const plaintiffs = partes
                    .filter((p: any) => p.polo === 'ATIVO')
                    .map((p: any) => p.nome);
                const defendants = partes
                    .filter((p: any) => p.polo === 'PASSIVO')
                    .map((p: any) => p.nome);

                // Extract movements
                const movements = (tramitacao.movimentos || []).map((mov: any, index: number) => ({
                    id: mov.id || `mov-${index}`,
                    date: formatDate(mov.dataHora),
                    description: mov.tipoMovimento?.descricao || "Movimentação",
                    details: mov.complemento || mov.observacao
                })).reverse(); // Reverse to show newest first

                const processDetail: ProcessDetail = {
                    id: apiProcess.id || id,
                    number: apiProcess.numeroProcesso || id,
                    court: tramitacao.orgaoJulgador?.nome || "Não informado",
                    status: tramitacao.ativo ? "Ativo" : "Inativo",
                    distributionDate: formatDate(tramitacao.dataHoraUltimaDistribuicao),
                    lastUpdate: formatDate(tramitacao.ultimoMovimento?.dataHora),
                    processClass: tramitacao.classe?.[0]?.descricao
                        ? `${tramitacao.classe[0].descricao} (${tramitacao.classe[0].codigo || ''})`
                        : "Não informado",
                    subject: tramitacao.assunto?.map((a: any) => a.descricao).join(" | ") || "Não informado",
                    value: formatCurrency(tramitacao.valorAcao),
                    parties: {
                        plaintiffs: plaintiffs.length > 0 ? plaintiffs : ["Não informado"],
                        defendants: defendants.length > 0 ? defendants : ["Não informado"]
                    },
                    movements
                };

                setProcess(processDetail);
            } catch (error) {
                console.error('Error fetching process:', error);
                toast({
                    title: "Erro ao carregar processo",
                    description: error instanceof Error ? error.message : "Erro desconhecido",
                    variant: "destructive",
                });
                navigate("/dashboard");
            } finally {
                setLoading(false);
            }
        };

        fetchProcessDetails();
    }, [navigate, id]);

    const handleLogout = () => {
        localStorage.removeItem("pdpj_access_token");
        localStorage.removeItem("pdpj_refresh_token");
        localStorage.removeItem("pdpj_user_name");
        localStorage.removeItem("pdpj_user_email");
        localStorage.removeItem("pdpj_user_cpf");
        navigate("/");
    };

    const toggleMovement = (movementId: string) => {
        setExpandedMovements(prev =>
            prev.includes(movementId)
                ? prev.filter(id => id !== movementId)
                : [...prev, movementId]
        );
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-accent">
                <header className="bg-white border-b border-border shadow-sm">
                    <div className="container mx-auto px-4 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-primary rounded-lg flex items-center justify-center">
                                    <Shield className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h1 className="text-xl font-bold text-foreground">JusConsult</h1>
                                    <p className="text-xs text-muted-foreground">Consulta em um só lugar</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </header>
                <main className="container mx-auto px-4 py-8">
                    <div className="max-w-6xl mx-auto space-y-6">
                        <Skeleton className="h-10 w-32" />
                        <Card>
                            <CardHeader>
                                <Skeleton className="h-8 w-3/4" />
                                <Skeleton className="h-4 w-1/2 mt-2" />
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <Skeleton className="h-4 w-full" />
                                    <Skeleton className="h-4 w-full" />
                                    <Skeleton className="h-4 w-3/4" />
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </main>
            </div>
        );
    }

    if (!process) return null;

    return (
        <div className="min-h-screen bg-gradient-accent">
            {/* Header */}
            <header className="bg-white border-b border-border shadow-sm">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate("/dashboard")}>
                            <div className="w-10 h-10 bg-gradient-primary rounded-lg flex items-center justify-center">
                                <Shield className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-foreground">JusConsult</h1>
                                <p className="text-xs text-muted-foreground">Consulta em um só lugar</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="hidden md:flex items-center gap-2 text-sm">
                                <User className="w-4 h-4 text-primary" />
                                <span className="font-medium text-foreground">{userName}</span>
                            </div>
                            <Button variant="outline" size="sm" onClick={handleLogout}>
                                <LogOut className="w-4 h-4 mr-2" />
                                Sair
                            </Button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="container mx-auto px-4 py-8">
                <div className="max-w-6xl mx-auto space-y-6">
                    {/* Back Button */}
                    <Button variant="ghost" onClick={() => navigate(-1)}>
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Voltar
                    </Button>

                    {/* Process Header */}
                    <Card className="shadow-lg">
                        <CardHeader className="bg-gradient-primary text-white rounded-t-lg">
                            <div className="flex items-start justify-between">
                                <div>
                                    <CardTitle className="text-2xl mb-2">Processo {process.number}</CardTitle>
                                    <p className="text-sm opacity-90">{process.court}</p>
                                </div>
                                <Badge className="bg-white/20 text-white border-white/30">
                                    {process.status}
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="p-6">
                            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                                <div className="flex gap-3">
                                    <Calendar className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm text-muted-foreground">Data de Distribuição</p>
                                        <p className="font-medium text-foreground">{process.distributionDate}</p>
                                    </div>
                                </div>

                                <div className="flex gap-3">
                                    <Calendar className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm text-muted-foreground">Última Atualização</p>
                                        <p className="font-medium text-foreground">{process.lastUpdate}</p>
                                    </div>
                                </div>

                                <div className="flex gap-3">
                                    <Gavel className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm text-muted-foreground">Classe</p>
                                        <p className="font-medium text-foreground">{process.processClass}</p>
                                    </div>
                                </div>

                                <div className="flex gap-3 md:col-span-2">
                                    <FileText className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm text-muted-foreground">Assunto</p>
                                        <p className="font-medium text-foreground">{process.subject}</p>
                                    </div>
                                </div>

                                <div className="flex gap-3">
                                    <FileText className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm text-muted-foreground">Valor da Causa</p>
                                        <p className="font-medium text-foreground">{process.value}</p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Parties */}
                    <div className="grid md:grid-cols-2 gap-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Users className="w-5 h-5 text-primary" />
                                    Parte Autora
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ul className="space-y-2">
                                    {process.parties.plaintiffs.map((plaintiff, index) => (
                                        <li key={index} className="text-foreground font-medium">
                                            {plaintiff}
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Users className="w-5 h-5 text-primary" />
                                    Parte Ré
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ul className="space-y-2">
                                    {process.parties.defendants.map((defendant, index) => (
                                        <li key={index} className="text-foreground font-medium">
                                            {defendant}
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Movements */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-xl flex items-center gap-2">
                                    <FileText className="w-5 h-5 text-primary" />
                                    Movimentações Processuais
                                </CardTitle>
                                <Button variant="outline" size="sm">
                                    <Download className="w-4 h-4 mr-2" />
                                    Exportar
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y divide-border">
                                {process.movements.map((movement, index) => (
                                    <Collapsible
                                        key={movement.id}
                                        open={expandedMovements.includes(movement.id)}
                                        onOpenChange={() => toggleMovement(movement.id)}
                                    >
                                        <div className="p-4 hover:bg-muted/30 transition-colors">
                                            <CollapsibleTrigger className="w-full">
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="flex gap-4 flex-1 text-left">
                                                        <div className="flex flex-col items-center">
                                                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                                                                {process.movements.length - index}
                                                            </div>
                                                            {index < process.movements.length - 1 && (
                                                                <div className="w-0.5 h-12 bg-border mt-2"></div>
                                                            )}
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="text-sm font-medium text-muted-foreground">
                                                                    {movement.date}
                                                                </span>
                                                                <Badge variant="outline" className="text-xs">
                                                                    {movement.description}
                                                                </Badge>
                                                            </div>
                                                            {movement.details && (
                                                                <CollapsibleContent>
                                                                    <p className="text-sm text-foreground mt-2 leading-relaxed">
                                                                        {movement.details}
                                                                    </p>
                                                                </CollapsibleContent>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {movement.details && (
                                                        <Button variant="ghost" size="sm" className="flex-shrink-0">
                                                            {expandedMovements.includes(movement.id) ? (
                                                                <ChevronUp className="w-4 h-4" />
                                                            ) : (
                                                                <ChevronDown className="w-4 h-4" />
                                                            )}
                                                        </Button>
                                                    )}
                                                </div>
                                            </CollapsibleTrigger>
                                        </div>
                                    </Collapsible>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    );
};

export default ProcessDetail;
