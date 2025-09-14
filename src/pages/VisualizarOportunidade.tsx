import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calendar, FileText, History, Layers, ListChecks } from "lucide-react";

/* =========================
   Types
========================= */
interface AnyObj { [key: string]: unknown }

interface OpportunityData extends AnyObj {
  id: number;
  title?: string;
  solicitante_id?: number | string;
  responsavel_id?: number | string;
  tipo_processo_id?: number | string;
  area_atuacao_id?: number | string;
  fase_id?: number | string;
  etapa_id?: number | string;
  status_id?: number | string;
  envolvidos?: Array<AnyObj>;
}

interface TaskItem extends AnyObj {
  id: number | string;
  titulo?: string;
  descricao?: string;
  data?: string | null;
  hora?: string | null;
  prioridade?: number | string | null;
  concluido?: boolean | number;
}

interface DocItem extends AnyObj {
  id: number | string;
  nome?: string;
  tipo?: string;
  criado_em?: string;
  atualizado_em?: string;
}

interface ProcessoItem extends AnyObj {
  id: number | string;
  numero_processo_cnj?: string;
  status?: string;
  vara_ou_orgao?: string;
  comarca?: string;
}

interface HistoricoItem extends AnyObj {
  id?: number | string;
  quando?: string;        // ISO
  usuario?: string;
  acao?: string;          // ex: "atualizou etapa", "criou tarefa"
  detalhes?: string;
}

/* =========================
   Component
========================= */
export default function VisualizarOportunidade() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const apiUrl = (import.meta.env.VITE_API_URL as string) || "http://localhost:3000";

  const [opportunity, setOpportunity] = useState<OpportunityData | null>(null);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [processos, setProcessos] = useState<ProcessoItem[]>([]);
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);

  const [loading, setLoading] = useState({ dados: true, tarefas: true, documentos: true, processos: true, historico: true });

  /* ------------------------- utils ------------------------- */
  const fetchList = async (url: string): Promise<unknown[]> => {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: unknown = await res.json();
    if (Array.isArray(data)) return data;
    if (Array.isArray((data as { rows?: unknown[] }).rows)) return (data as { rows: unknown[] }).rows;
    if (Array.isArray((data as { data?: { rows?: unknown[] } }).data?.rows)) return (data as { data: { rows: unknown[] } }).data.rows;
    if (Array.isArray((data as { data?: unknown[] }).data)) return (data as { data: unknown[] }).data;
    return [];
  };

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

  const formatLabel = (key: string) => fieldLabels[key] || key.replace(/_/g, " ").replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1));

  const renderValue = (value: unknown) => {
    if (value === null || value === undefined || value === "") {
      return <span className="text-muted-foreground">—</span>;
    }
    if (typeof value === "object") {
      return <pre className="whitespace-pre-wrap text-sm">{JSON.stringify(value, null, 2)}</pre>;
    }
    return String(value);
  };

  /* ------------------------- dados principais ------------------------- */
  useEffect(() => {
    if (!id) return;
    const fetchOpportunity = async () => {
      try {
        setLoading((s) => ({ ...s, dados: true }));
        const res = await fetch(`${apiUrl}/api/oportunidades/${id}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setOpportunity(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading((s) => ({ ...s, dados: false }));
      }
    };
    fetchOpportunity();
  }, [id, apiUrl]);

  /* ------------------------- enriquecer nomes ------------------------- */
  useEffect(() => {
    if (!opportunity || (opportunity as { _namesLoaded?: boolean })._namesLoaded) return;

    const loadNames = async () => {
      try {
        const updated: OpportunityData = { ...opportunity };

        if (opportunity.solicitante_id) {
          const res = await fetch(`${apiUrl}/api/clientes/${opportunity.solicitante_id}`);
          if (res.ok) {
            const c = await res.json();
            updated.solicitante_nome = c.nome;
            updated.solicitante_cpf_cnpj = c.documento;
            updated.solicitante_email = c.email;
            updated.solicitante_telefone = c.telefone;
            updated.cliente_tipo = c.tipo === 1 || c.tipo === "1" ? "Pessoa Física" : c.tipo === 2 || c.tipo === "2" ? "Pessoa Jurídica" : undefined;
          }
        }

        if (opportunity.responsavel_id) {
          const res = await fetch(`${apiUrl}/api/usuarios/${opportunity.responsavel_id}`);
          if (res.ok) {
            const r = await res.json();
            updated.responsible = r.nome_completo ?? r.nome;
          }
        }

        if (opportunity.tipo_processo_id) {
          const tipos = (await fetchList(`${apiUrl}/api/tipo-processos`)) as Array<{ id: unknown; nome?: string }>;
          const tipo = tipos.find((t) => Number(t.id) === Number(opportunity.tipo_processo_id));
          if (tipo) updated.tipo_processo_nome = tipo.nome;
        }

        if (opportunity.area_atuacao_id) {
          const res = await fetch(`${apiUrl}/api/areas/${opportunity.area_atuacao_id}`);
          if (res.ok) {
            const a = await res.json();
            updated.area = a.nome;
          }
        }

        if (opportunity.fase_id) {
          const fases = (await fetchList(`${apiUrl}/api/fluxos-trabalho`)) as Array<{ id: unknown; nome?: string }>;
          const fase = fases.find((f) => Number(f.id) === Number(opportunity.fase_id));
          if (fase) updated.fase = fase.nome;

          if (opportunity.etapa_id) {
            try {
              const etapas = (await fetchList(`${apiUrl}/api/etiquetas/fluxos-trabalho/${opportunity.fase_id}`)) as Array<{ id: unknown; nome?: string }>;
              const etapa = etapas.find((e) => Number(e.id) === Number(opportunity.etapa_id));
              if (etapa) updated.etapa_nome = etapa.nome;
            } catch (e) {
              console.error(e);
            }
          }
        }

        if (opportunity.status_id) {
          const situacoes = (await fetchList(`${apiUrl}/api/situacoes-processo`)) as Array<{ id: unknown; nome?: string }>;
          const situacao = situacoes.find((s) => Number(s.id) === Number(opportunity.status_id));
          if (situacao) updated.status = situacao.nome;
        }

        Object.defineProperty(updated, "_namesLoaded", { value: true, enumerable: false });
        setOpportunity(updated);
      } catch (e) {
        console.error(e);
      }
    };

    loadNames();
  }, [opportunity, apiUrl]);

  /* ------------------------- coleções por aba ------------------------- */
  useEffect(() => {
    if (!id) return;

    const q = new URLSearchParams({ oportunidade: String(id) }).toString();

    const loadTarefas = async () => {
      try {
        setLoading((s) => ({ ...s, tarefas: true }));
        const list = await fetchList(`${apiUrl}/api/tarefas?${q}`);
        setTasks((list as TaskItem[]) || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading((s) => ({ ...s, tarefas: false }));
      }
    };

    const loadDocs = async () => {
      try {
        setLoading((s) => ({ ...s, documentos: true }));
        const list = await fetchList(`${apiUrl}/api/documentos?${q}`);
        setDocs((list as DocItem[]) || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading((s) => ({ ...s, documentos: false }));
      }
    };

    const loadProcessos = async () => {
      try {
        setLoading((s) => ({ ...s, processos: true }));
        // tenta endpoint dedicado, senão cai no próprio recurso da oportunidade
        let list = await fetchList(`${apiUrl}/api/processos?${q}`).catch(() => []);
        if (!Array.isArray(list) || list.length === 0) {
          const res = await fetch(`${apiUrl}/api/oportunidades/${id}`);
          if (res.ok) {
            const data = await res.json();
            list = (data?.processos && Array.isArray(data.processos)) ? data.processos : [];
          }
        }
        setProcessos((list as ProcessoItem[]) || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading((s) => ({ ...s, processos: false }));
      }
    };

    const loadHistorico = async () => {
      try {
        setLoading((s) => ({ ...s, historico: true }));
        let list = await fetchList(`${apiUrl}/api/historico?${q}`).catch(() => []);
        if (!Array.isArray(list) || list.length === 0) {
          const res = await fetch(`${apiUrl}/api/oportunidades/${id}/historico`).catch(() => null);
          if (res && res.ok) list = await res.json();
        }
        setHistorico((list as HistoricoItem[]) || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading((s) => ({ ...s, historico: false }));
      }
    };

    loadTarefas();
    loadDocs();
    loadProcessos();
    loadHistorico();
  }, [id, apiUrl]);

  /* ------------------------- helpers UI ------------------------- */
  const prioridadeLabel = (p?: number | string | null) => {
    const v = Number(p);
    if (Number.isNaN(v)) return "—";
    if (v <= 1) return "Baixa";
    if (v === 2) return "Média";
    return "Alta";
  };

  const conclLabel = (c?: boolean | number) => (Number(c) ? "Concluída" : "Pendente");

  const dataHora = (d?: string | null, h?: string | null) => {
    if (!d && !h) return "—";
    return [d, h].filter(Boolean).join(" ");
  };

  const orderedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      const ac = Number(a.concluido) ? 1 : 0;
      const bc = Number(b.concluido) ? 1 : 0;
      if (ac !== bc) return ac - bc; // false(0) primeiro
      const ad = (a.data || "");
      const bd = (b.data || "");
      if (ad !== bd) return ad.localeCompare(bd);
      const ap = Number(a.prioridade || 0);
      const bp = Number(b.prioridade || 0);
      return ap - bp;
    });
  }, [tasks]);

  /* ------------------------- actions ------------------------- */
  const onCreateTask = () => navigate(`/tarefas?oportunidade=${id}`);
  const onCreateDocument = () => navigate(`/documentos?oportunidade=${id}`);

  /* ------------------------- render ------------------------- */
  if (!opportunity) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Oportunidade</h1>
          <Button variant="outline" onClick={() => navigate(-1)}>Voltar</Button>
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
          <p className="text-muted-foreground">Detalhes completos da oportunidade</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate(-1)}>Voltar</Button>
          <Button onClick={onCreateTask}>Criar Tarefa</Button>
          <Button onClick={onCreateDocument}>Criar Documento</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{opportunity.title || `Oportunidade ${opportunity.id}`}</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="dados" className="w-full">
            <TabsList className="flex flex-wrap gap-2">
              <TabsTrigger value="dados" className="flex items-center gap-2"><Layers className="h-4 w-4" /> Dados</TabsTrigger>
              <TabsTrigger value="tarefas" className="flex items-center gap-2"><ListChecks className="h-4 w-4" /> Tarefas</TabsTrigger>
              <TabsTrigger value="documentos" className="flex items-center gap-2"><FileText className="h-4 w-4" /> Documentos</TabsTrigger>
              <TabsTrigger value="processos" className="flex items-center gap-2"><Calendar className="h-4 w-4" /> Processos</TabsTrigger>
              <TabsTrigger value="historico" className="flex items-center gap-2"><History className="h-4 w-4" /> Histórico</TabsTrigger>
            </TabsList>

            {/* ===== DADOS ===== */}
            <TabsContent value="dados">
              <ScrollArea className="max-h-[70vh] pr-2">
                <Table>
                  <TableBody>
                    {Object.entries(opportunity)
                      .filter(([key]) => key !== "envolvidos" && !key.endsWith("_id") && key !== "processos" && key !== "historico")
                      .map(([key, value]) => (
                        <TableRow key={key}>
                          <TableCell className="font-medium w-[40%]">{formatLabel(key)}</TableCell>
                          <TableCell>{renderValue(value)}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>

                {Array.isArray(opportunity.envolvidos) && opportunity.envolvidos.length > 0 && (
                  <div className="mt-6">
                    <Separator className="mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Envolvidos</h3>
                    <Table>
                      <TableBody>
                        {opportunity.envolvidos.map((env: AnyObj, idx: number) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium w-[40%]">{formatLabel(String(env.relacao ?? `Parte ${idx + 1}`))}</TableCell>
                            <TableCell>
                              <div className="space-y-1 text-sm">
                                {env.nome && <div>Nome: {String(env.nome)}</div>}
                                {env.cpf_cnpj && <div>CPF/CNPJ: {String(env.cpf_cnpj)}</div>}
                                {env.telefone && <div>Telefone: {String(env.telefone)}</div>}
                                {env.endereco && <div>Endereço: {String(env.endereco)}</div>}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            {/* ===== TAREFAS ===== */}
            <TabsContent value="tarefas">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold">Tarefas vinculadas</h3>
                <Button size="sm" onClick={onCreateTask}>Nova tarefa</Button>
              </div>
              {loading.tarefas ? (
                <p className="text-muted-foreground">Carregando tarefas…</p>
              ) : orderedTasks.length === 0 ? (
                <EmptyState message="Nenhuma tarefa cadastrada" />
              ) : (
                <ScrollArea className="max-h-[70vh] pr-2">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Título</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Data/Hora</TableHead>
                        <TableHead>Prioridade</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orderedTasks.map((t) => (
                        <TableRow key={String(t.id)}>
                          <TableCell className="font-medium">{t.titulo ?? `Tarefa ${t.id}`}</TableCell>
                          <TableCell>
                            <Badge variant={Number(t.concluido) ? "secondary" : "default"}>{conclLabel(t.concluido)}</Badge>
                          </TableCell>
                          <TableCell>{dataHora(t.data as string | null, t.hora as string | null)}</TableCell>
                          <TableCell>{prioridadeLabel(t.prioridade)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </TabsContent>

            {/* ===== DOCUMENTOS ===== */}
            <TabsContent value="documentos">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold">Documentos</h3>
                <Button size="sm" onClick={onCreateDocument}>Novo documento</Button>
              </div>
              {loading.documentos ? (
                <p className="text-muted-foreground">Carregando documentos…</p>
              ) : docs.length === 0 ? (
                <EmptyState message="Nenhum documento encontrado" />
              ) : (
                <ScrollArea className="max-h-[70vh] pr-2">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Criado em</TableHead>
                        <TableHead>Atualizado em</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {docs.map((d) => (
                        <TableRow key={String(d.id)}>
                          <TableCell className="font-medium">{d.nome ?? `Documento ${d.id}`}</TableCell>
                          <TableCell>{d.tipo ?? "—"}</TableCell>
                          <TableCell>{d.criado_em ?? "—"}</TableCell>
                          <TableCell>{d.atualizado_em ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </TabsContent>

            {/* ===== PROCESSOS ===== */}
            <TabsContent value="processos">
              {loading.processos ? (
                <p className="text-muted-foreground">Carregando processos…</p>
              ) : processos.length === 0 ? (
                <EmptyState message="Nenhum processo vinculado" />
              ) : (
                <ScrollArea className="max-h-[70vh] pr-2">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nº CNJ</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Vara/Órgão</TableHead>
                        <TableHead>Comarca</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {processos.map((p) => (
                        <TableRow key={String(p.id)}>
                          <TableCell className="font-medium">{p.numero_processo_cnj ?? "—"}</TableCell>
                          <TableCell>{p.status ?? "—"}</TableCell>
                          <TableCell>{p.vara_ou_orgao ?? "—"}</TableCell>
                          <TableCell>{p.comarca ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </TabsContent>

            {/* ===== HISTÓRICO ===== */}
            <TabsContent value="historico">
              {loading.historico ? (
                <p className="text-muted-foreground">Carregando histórico…</p>
              ) : historico.length === 0 ? (
                <EmptyState message="Sem eventos de histórico ainda" />
              ) : (
                <ScrollArea className="max-h-[70vh] pr-2">
                  <ul className="space-y-4">
                    {historico.map((h, idx) => (
                      <li key={String(h.id ?? idx)} className="flex items-start gap-3">
                        <div className="mt-1 h-2 w-2 rounded-full bg-primary" />
                        <div>
                          <div className="text-sm text-muted-foreground">{h.quando ?? "—"}</div>
                          <div className="text-base font-medium">{h.acao ?? "Evento"}</div>
                          {h.usuario && <div className="text-sm">por {h.usuario}</div>}
                          {h.detalhes && <div className="text-sm text-muted-foreground">{h.detalhes}</div>}
                        </div>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

/* =========================
   Auxiliares
========================= */
function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}
