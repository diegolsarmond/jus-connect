import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Shield, LogOut, User, Search, Filter, ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Process {
    numeroProcesso: string;
    dataAjuizamento?: string;
    dataUltimaMovimentacao?: string;
    classe?: string;
    assuntos?: Array<{ nome: string }>;
    partes?: Array<{ nome: string; polo: string }>;
    orgaoJulgador?: string;
    situacao?: string;
}

const ProcessList = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [userName, setUserName] = useState("");
    const [processes, setProcesses] = useState<Process[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchType, setSearchType] = useState("cpf");
    const [searchValue, setSearchValue] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    useEffect(() => {
        const token = localStorage.getItem("pdpj_access_token");
        if (!token) {
            navigate("/");
            return;
        }

        const name = localStorage.getItem("pdpj_user_name") || "Usuário";
        const cpf = localStorage.getItem("pdpj_user_cpf") || "";
        setUserName(name);

        // Auto-search by CPF from URL params or user's CPF
        const typeParam = searchParams.get("type");
        const valueParam = searchParams.get("value");

        if (typeParam && valueParam) {
            setSearchType(typeParam);
            setSearchValue(valueParam);
            performSearch(typeParam, valueParam);
        } else if (cpf) {
            setSearchType("cpf");
            setSearchValue(cpf);
            performSearch("cpf", cpf);
        }
    }, [navigate, searchParams]);

    const performSearch = async (type: string, value: string) => {
        if (!value.trim()) {
            toast.error("Por favor, informe um valor para busca");
            return;
        }

        setIsLoading(true);
        try {
            const accessToken = localStorage.getItem("pdpj_access_token");

            if (!accessToken) {
                toast.error("Sessão expirada. Por favor, faça login novamente.");
                handleLogout();
                return;
            }

            console.log('Searching processes:', { type, value });
            console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL);

            const { data, error } = await supabase.functions.invoke('pdpj-processos', {
                body: { type, value, accessToken }
            });

            console.log('Response from pdpj-processos:', { data, error });

            if (error) {
                console.error('Supabase function invocation error:', error);
                throw error;
            }

            if (data?.error) {
                console.error('API returned error:', data.error);
                if (data.error.includes("Token expirado") || data.error.includes("Token expirado ou inválido") || data.status === 401) {
                    toast.error(data.error);
                    setTimeout(() => {
                        handleLogout();
                    }, 2500);
                    return;
                }
                throw new Error(data.error);
            }

            // Handle both single process and array of processes
            // API returns { content: [...] } for CPF search or direct process object for number search
            let processData;
            if (data.content && Array.isArray(data.content)) {
                processData = data.content;
            } else if (Array.isArray(data)) {
                processData = data;
            } else if (data.numeroProcesso) {
                processData = [data];
            } else {
                processData = [];
            }

            setProcesses(processData);

            if (processData.length === 0) {
                toast.info("Nenhum processo encontrado");
            } else {
                toast.success(`${processData.length} processo(s) encontrado(s)`);
            }
        } catch (error) {
            console.error('Search error:', error);
            const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
            toast.error(`Erro ao buscar processos: ${errorMessage}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSearch = () => {
        performSearch(searchType, searchValue);
    };

    const handleLogout = () => {
        localStorage.removeItem("pdpj_access_token");
        localStorage.removeItem("pdpj_refresh_token");
        localStorage.removeItem("pdpj_user_name");
        localStorage.removeItem("pdpj_user_email");
        localStorage.removeItem("pdpj_user_cpf");
        navigate("/");
    };

    const getStatusBadge = (situacao?: string) => {
        if (!situacao) {
            return <Badge variant="outline">Não informado</Badge>;
        }

        const variants: Record<string, string> = {
            'ativo': "bg-success/10 text-success border-success/20",
            'arquivado': "bg-muted text-muted-foreground border-border",
            'suspenso': "bg-warning/10 text-warning border-warning/20"
        };

        const className = variants[situacao.toLowerCase()] || "bg-muted text-muted-foreground border-border";

        return (
            <Badge className={className} variant="outline">
                {situacao}
            </Badge>
        );
    };

    const totalPages = Math.ceil(processes.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentProcesses = processes.slice(startIndex, endIndex);

    const getParties = (process: Process) => {
        if (!process.partes || process.partes.length === 0) return "Não informado";
        return process.partes.map(p => p.nome).join(" X ");
    };

    const getSubjects = (process: Process) => {
        if (!process.assuntos || process.assuntos.length === 0) return "Não informado";
        return process.assuntos.map(a => a.nome).join(" | ");
    };

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
                <div className="space-y-6">
                    {/* Page Title */}
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
                            Página Inicial
                        </Button>
                        <span className="text-muted-foreground">/</span>
                        <span className="text-foreground font-medium">Consultar Processos</span>
                    </div>

                    {/* Search Bar */}
                    <Card className="p-6">
                        <h3 className="text-lg font-semibold text-foreground mb-4">
                            Selecione uma das opções a seguir para consultar processos.
                        </h3>
                        <div className="grid md:grid-cols-3 gap-3">
                            <Select value={searchType} onValueChange={setSearchType}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="numero">Número do Processo</SelectItem>
                                    <SelectItem value="cpf">CPF da Parte</SelectItem>
                                </SelectContent>
                            </Select>

                            <Input
                                placeholder={
                                    searchType === "numero"
                                        ? "0000000-00.0000.0.00.0000"
                                        : "000.000.000-00"
                                }
                                value={searchValue}
                                onChange={(e) => setSearchValue(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                            />

                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() => setSearchValue("")}
                                    className="flex-1"
                                >
                                    Limpar
                                </Button>
                                <Button
                                    onClick={handleSearch}
                                    disabled={isLoading}
                                    className="flex-1 shadow-primary"
                                >
                                    <Search className="w-4 h-4 mr-2" />
                                    {isLoading ? "Buscando..." : "Buscar"}
                                </Button>
                            </div>
                        </div>
                    </Card>

                    {/* Results Table */}
                    {processes.length > 0 && (
                        <Card>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50">
                                            <TableHead className="font-semibold">Processo</TableHead>
                                            <TableHead className="font-semibold">Data Ajuizamento</TableHead>
                                            <TableHead className="font-semibold">Última Movimentação</TableHead>
                                            <TableHead className="font-semibold">Classe</TableHead>
                                            <TableHead className="font-semibold">Assunto</TableHead>
                                            <TableHead className="font-semibold">Partes</TableHead>
                                            <TableHead className="font-semibold">Órgão Julgador</TableHead>
                                            <TableHead className="font-semibold">Status</TableHead>
                                            <TableHead className="font-semibold">Ações</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {currentProcesses.map((process, index) => (
                                            <TableRow key={index} className="hover:bg-muted/30">
                                                <TableCell className="font-medium text-primary">{process.numeroProcesso}</TableCell>
                                                <TableCell>{process.dataAjuizamento || "-"}</TableCell>
                                                <TableCell>{process.dataUltimaMovimentacao || "-"}</TableCell>
                                                <TableCell className="max-w-xs">
                                                    <div className="truncate" title={process.classe}>
                                                        {process.classe || "Não informado"}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="max-w-sm">
                                                    <div className="line-clamp-2 text-sm" title={getSubjects(process)}>
                                                        {getSubjects(process)}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="max-w-xs">
                                                    <div className="truncate" title={getParties(process)}>
                                                        {getParties(process)}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="max-w-xs">
                                                    <div className="truncate text-sm" title={process.orgaoJulgador}>
                                                        {process.orgaoJulgador || "Não informado"}
                                                    </div>
                                                </TableCell>
                                                <TableCell>{getStatusBadge(process.situacao)}</TableCell>
                                                <TableCell>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => navigate(`/processo/${process.numeroProcesso}`)}
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="flex items-center justify-between p-4 border-t border-border">
                                    <div className="text-sm text-muted-foreground">
                                        {startIndex + 1} - {Math.min(endIndex, processes.length)} de {processes.length}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                            disabled={currentPage === 1}
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                        </Button>
                                        <div className="text-sm font-medium">
                                            {currentPage} / {totalPages}
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                            disabled={currentPage === totalPages}
                                        >
                                            <ChevronRight className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </Card>
                    )}
                </div>
            </main>
        </div>
    );
};

export default ProcessList;
