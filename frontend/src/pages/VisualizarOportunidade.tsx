import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

import { Badge } from "@/components/ui/badge";

import { format as dfFormat, parseISO } from "date-fns";

interface Envolvido {
  nome?: string;
  cpf_cnpj?: string;
  telefone?: string;
  endereco?: string;
  relacao?: string;
  [key: string]: unknown;
}

interface OpportunityData {
  id: number;
  title?: string;
  envolvidos?: Envolvido[];
  [key: string]: unknown;
}

interface ParticipantData {
  id?: number;
  nome?: string;
  documento?: string;
  telefone?: string;
  endereco?: string;
  relacao?: string;
}

export default function VisualizarOportunidade() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const apiUrl = (import.meta.env.VITE_API_URL as string) || "http://localhost:3000";

  const [opportunity, setOpportunity] = useState<OpportunityData | null>(null);
  const [snack, setSnack] = useState<{ open: boolean; message?: string }>({ open: false });
  const [expandedDetails, setExpandedDetails] = useState(false);
  const [participants, setParticipants] = useState<ParticipantData[]>([]);

  const fetchList = async (url: string): Promise<unknown[]> => {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: unknown = await res.json();
    if (Array.isArray(data)) return data;
    if (Array.isArray((data as { rows?: unknown[] }).rows))
      return (data as { rows: unknown[] }).rows;
    if (
      Array.isArray(
        (data as { data?: { rows?: unknown[] } }).data?.rows
      )
    )
      return (data as { data: { rows: unknown[] } }).data.rows;
    if (Array.isArray((data as { data?: unknown[] }).data))
      return (data as { data: unknown[] }).data;
    return [];
  };

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const fetchOpportunity = async () => {
      try {
        const res = await fetch(`${apiUrl}/api/oportunidades/${id}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) setOpportunity(data);
      } catch (e) {
        console.error(e);
        if (!cancelled) setSnack({ open: true, message: "Erro ao carregar oportunidade" });
      }
    };
    fetchOpportunity();
    return () => {
      cancelled = true;
    };
  }, [id, apiUrl]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const fetchParticipants = async () => {
      try {
        const res = await fetch(`${apiUrl}/api/oportunidades/${id}/envolvidos`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) setParticipants(data);
      } catch (e) {
        console.error(e);
      }
    };
    fetchParticipants();
    return () => {
      cancelled = true;
    };
  }, [id, apiUrl]);

  useEffect(() => {
    if (!opportunity || (opportunity as { _namesLoaded?: boolean })._namesLoaded)
      return;
    const loadNames = async () => {
      try {
        const updated: OpportunityData = { ...opportunity };

        if (opportunity.solicitante_id) {
          const res = await fetch(
            `${apiUrl}/api/clientes/${opportunity.solicitante_id}`
          );
          if (res.ok) {
            const c = await res.json();
            updated.solicitante_nome = c.nome;
            updated.solicitante_cpf_cnpj = c.documento;
            updated.solicitante_email = c.email;
            updated.solicitante_telefone = c.telefone;
            updated.cliente_tipo =
              c.tipo === 1 || c.tipo === "1"
                ? "Pessoa Física"
                : c.tipo === 2 || c.tipo === "2"
                ? "Pessoa Jurídica"
                : undefined;
          }
        }

        if (opportunity.responsavel_id) {
          const res = await fetch(
            `${apiUrl}/api/usuarios/${opportunity.responsavel_id}`
          );
          if (res.ok) {
            const r = await res.json();
            updated.responsible = r.nome_completo ?? r.nome;
          }
        }

        if (opportunity.tipo_processo_id) {
          const tipos = (await fetchList(
            `${apiUrl}/api/tipo-processos`
          )) as Array<{ id: unknown; nome?: string }>;
          const tipo = tipos.find(
            (t) => Number(t.id) === Number(opportunity.tipo_processo_id)
          );
          if (tipo) updated.tipo_processo_nome = tipo.nome;
        }

        if (opportunity.area_atuacao_id) {
          const res = await fetch(
            `${apiUrl}/api/areas/${opportunity.area_atuacao_id}`
          );
          if (res.ok) {
            const a = await res.json();
            updated.area = a.nome;
          }
        }

        if (opportunity.fase_id) {
          const fases = (await fetchList(
            `${apiUrl}/api/fluxos-trabalho`
          )) as Array<{ id: unknown; nome?: string }>;
          const fase = fases.find(
            (f) => Number(f.id) === Number(opportunity.fase_id)
          );
          if (fase) updated.fase = fase.nome;

          if (opportunity.etapa_id) {
            try {
              const etapas = (await fetchList(
                `${apiUrl}/api/etiquetas/fluxos-trabalho/${opportunity.fase_id}`
              )) as Array<{ id: unknown; nome?: string }>;
              const etapa = etapas.find(
                (e) => Number(e.id) === Number(opportunity.etapa_id)
              );
              if (etapa) updated.etapa_nome = etapa.nome;
            } catch (e) {
              console.error(e);
            }
          }
        }

        if (opportunity.status_id) {
          const situacoes = (await fetchList(
            `${apiUrl}/api/situacoes-processo`
          )) as Array<{ id: unknown; nome?: string }>;
          const situacao = situacoes.find(
            (s) => Number(s.id) === Number(opportunity.status_id)
          );
          if (situacao) updated.status = situacao.nome;
        }

        Object.defineProperty(updated, "_namesLoaded", {
          value: true,
          enumerable: false,
        });
        setOpportunity(updated);
      } catch (e) {
        console.error(e);
      }
    };
    loadNames();
  }, [opportunity, apiUrl]);

  // mapeamento de rótulos
  const fieldLabels: Record<string, string> = {
    solicitante_nome: "Cliente",
    tipo_processo_nome: "Tipo de Processo",
    tipo_processo_id: "Tipo de Processo ID",
    area_atuacao_id: "Área de Atuação ID",
    area: "Área de Atuação",
    responsavel_id: "Responsável ID",
    responsible: "Responsável",
    numero_processo_cnj: "Número do Processo",
    numero_protocolo: "Número do Protocolo",
    vara_ou_orgao: "Vara/Órgão",
    comarca: "Comarca",
    autor: "Autor",
    reu: "Réu",
    terceiro_interessado: "Terceiro Interessado",
    fase: "Fase",
    fase_id: "Fase ID",
    etapa_nome: "Etapa",
    etapa_id: "Etapa ID",
    prazo_proximo: "Prazo Próximo",
    status: "Status",
    status_id: "Status ID",
    solicitante_id: "Solicitante ID",
    solicitante_cpf_cnpj: "CPF/CNPJ",
    solicitante_email: "Email",
    solicitante_telefone: "Telefone",
    cliente_tipo: "Tipo de Cliente",
    valor_causa: "Valor da Causa",
    valor_honorarios: "Valor dos Honorários",
    percentual_honorarios: "% Honorários",
    forma_pagamento: "Forma de Pagamento",
    parcelas: "Número de Parcelas",
    contingenciamento: "Contingenciamento",
    detalhes: "Detalhes",
    documentos_anexados: "Documentos Anexados",
    criado_por: "Criado por",
    data_criacao: "Data de Criação",
    ultima_atualizacao: "Última Atualização",
  };

  const participantLabels: Record<string, string> = {
    nome: "Nome",
    documento: "CPF/CNPJ",
    telefone: "Telefone",
    endereco: "Endereço",
    relacao: "Relação",
  };

  const formatLabel = (key: string) =>
    fieldLabels[key] ||
    key
      .replace(/_/g, " ")
      .replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1));

  const formatDate = (value: unknown) => {
    if (!value) return "—";
    try {
      const d = typeof value === "string" ? parseISO(value) : new Date(String(value));
      return dfFormat(d, "dd/MM/yyyy HH:mm");
    } catch {
      try {
        return new Date(String(value)).toLocaleString();
      } catch {
        return String(value);
      }
    }
  };

  const formatCurrency = (value: unknown) => {
    if (value === null || value === undefined || value === "") return "—";
    const number = Number(value);
    if (Number.isNaN(number)) return String(value);
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 2,
    }).format(number);
  };

  const formatPercent = (value: unknown) => {
    if (value === null || value === undefined || value === "") return "—";
    const number = Number(value);
    if (Number.isNaN(number)) return String(value);
    return `${Math.round(number)}%`;
  };

  // lista de chaves que podem ser copiadas (removi valor_causa e valor_honorarios conforme pedido)
  const shouldShowCopy = (key: string) =>
    [
      "numero_processo_cnj",
      "numero_processo",
      "numero_processo_cn",
      "numero_protocolo",
      // outras chaves curtas que fazem sentido copiar podem ser adicionadas aqui
    ].includes(key);

  // ordem preferencial (mantive para apresentação)
  const preferredOrder = [
    "numero_processo_cnj",
    "numero_protocolo",
    "vara_ou_orgao",
    "comarca",
    "prazo_proximo",
    "valor_causa",
    "valor_honorarios",
    "percentual_honorarios",
    "forma_pagamento",
    "contingenciamento",
    "detalhes",
    "data_criacao",
    "ultima_atualizacao",
  ];

  const orderedEntries = useMemo(() => {
    if (!opportunity) return [];
    const entries = Object.entries(opportunity);
    const ordered: Array<[string, unknown]> = [];
    const used = new Set<string>();
    for (const k of preferredOrder) {
      const match = entries.find(([key]) => key === k);
      if (match) {
        ordered.push(match);
        used.add(match[0]);
      }
    }
    for (const [k, v] of entries) {
      if (!used.has(k)) ordered.push([k, v]);
    }
    return ordered;
  }, [opportunity]);

  // seções conforme print fornecido
  const sectionsDef: { key: string; label: string; fields: string[] }[] = [
    {
      key: "processo",
      label: "Dados do Processo",
      fields: ["numero_processo_cnj", "numero_protocolo", "tipo_processo_nome", "vara_ou_orgao", "comarca"],
    },
    {
      key: "fluxo",
      label: "Fluxo do Processo",
      fields: ["fase", "etapa_nome", "prazo_proximo", "status"],
    },
    {
      key: "solicitante",
      label: "Dados do Solicitante",
      fields: ["solicitante_nome", "solicitante_cpf_cnpj", "solicitante_email", "solicitante_telefone", "cliente_tipo"],
    },

    {
      key: "detalhes",
      label: "Detalhes",
      fields: ["detalhes"],
    },
    {
      key: "honorarios",
      label: "Honorários",
      fields: ["valor_causa", "valor_honorarios", "percentual_honorarios", "forma_pagamento", "parcelas", "contingenciamento"],
    },
    {
      key: "metadados",
      label: "Metadados",
      fields: ["data_criacao", "ultima_atualizacao", "criado_por", "id", "title"],
    },
  ];

  // cria um mapa das entradas por chave para fácil consulta
  const entriesMap = useMemo(() => {
    if (!opportunity) return new Map<string, unknown>();
    return new Map(Object.entries(opportunity));
  }, [opportunity]);

  const copyToClipboard = async (text: string) => {
    if (!navigator.clipboard) {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        setSnack({ open: true, message: "Copiado" });
      } catch {
        setSnack({ open: true, message: "Erro ao copiar" });
      } finally {
        document.body.removeChild(ta);
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setSnack({ open: true, message: "Copiado" });
    } catch {
      setSnack({ open: true, message: "Erro ao copiar" });
    }
  };

  // auto-close do snackbar para não ficar cortando o rodapé
  useEffect(() => {
    if (!snack.open) return;
    const t = setTimeout(() => setSnack({ open: false }), 1800); // fecha automaticamente após 1.8s
    return () => clearTimeout(t);
  }, [snack.open]);

  const onEdit = () => {
    navigate(`/pipeline/editar-oportunidade/${id}`);
  };
  // REMOVIDO onDuplicate conforme solicitado
  const onDelete = () => {
    if (!window.confirm("Confirma exclusão desta oportunidade?")) return;
    setSnack({ open: true, message: "Excluído (stub)" });
    console.log("Excluir", opportunity?.id);
  };
  const onPrint = () => window.print();

  const onCreateTask = () => {
    navigate(`/tarefas?oportunidade=${id}`);
  };

  const onCreateDocument = () => {
    navigate(`/documentos?oportunidade=${id}`);
  };

  const renderFormatted = (key: string, value: unknown) => {
    if (value === null || value === undefined || value === "") {
      return <span className="text-muted-foreground">—</span>;
    }

    if (/data|prazo|data_criacao|ultima_atualizacao|prazo_proximo/i.test(key)) {
      return <span>{formatDate(value)}</span>;
    }

    if (/valor|honorarios|valor_causa|valor_honorarios|valor_total/i.test(key)) {
      return <span>{formatCurrency(value)}</span>;
    }

    if (key === "percentual_honorarios") {
      let percent = value;
      if (
        (percent === null || percent === undefined || percent === "") &&
        entriesMap.get("valor_causa") &&
        entriesMap.get("valor_honorarios")
      ) {
        const vc = Number(entriesMap.get("valor_causa"));
        const vh = Number(entriesMap.get("valor_honorarios"));
        if (vc) percent = (vh / vc) * 100;
      }
      return <span>{formatPercent(percent)}</span>;
    }

    if (/percentual|%|percent/i.test(key)) {
      return <span>{formatPercent(value)}</span>;
    }

    if (key === "detalhes" && typeof value === "string") {
      const text = value;
      const preview = text.length > 240 ? text.slice(0, 240) + "…" : text;
      return (
        <div>
          <div className="text-sm" style={{ whiteSpace: "pre-wrap" }}>
            {expandedDetails ? text : preview}
          </div>
          {text.length > 240 && (
            <button
              className="mt-2 text-sm underline underline-offset-2"
              onClick={() => setExpandedDetails((s) => !s)}
              aria-expanded={expandedDetails}
            >
              {expandedDetails ? "Ver menos" : "Ver mais"}
            </button>
          )}
        </div>
      );
    }

    if (Array.isArray(value) || typeof value === "object") {
      return (
        <pre className="whitespace-pre-wrap text-sm bg-muted px-2 py-1 rounded">
          {JSON.stringify(value, null, 2)}
        </pre>
      );
    }

    if (typeof value === "boolean") {
      return <span>{value ? "Sim" : "Não"}</span>;
    }

    return <span>{String(value)}</span>;
  };

  if (!opportunity) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Oportunidade</h1>
          <Button variant="outline" onClick={() => navigate(-1)}>
            Voltar
          </Button>
        </div>
        <p className="text-muted-foreground">Carregando ou oportunidade não encontrada.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header / ações (REMOVIDO Duplicar) */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Visualizar Oportunidade</h1>
          <p className="text-muted-foreground">Detalhes completos da oportunidade</p>
        </div>

        <div className="flex gap-2 items-center">
          <Button variant="ghost" onClick={() => navigate(-1)} aria-label="Voltar">
            Voltar
          </Button>
          <Button onClick={onEdit} aria-label="Editar oportunidade">
            Editar
          </Button>
          <Button variant="destructive" onClick={onDelete} aria-label="Excluir oportunidade">
            Excluir
          </Button>
          <Button onClick={onCreateTask} aria-label="Criar tarefa">
            Criar Tarefa
          </Button>
          <Button onClick={onCreateDocument} aria-label="Criar documento">
            Criar Documento
          </Button>
          <Button variant="ghost" onClick={onPrint} aria-label="Imprimir">
            Imprimir
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2">
            <CardTitle>{opportunity.title ?? `Oportunidade ${opportunity.id}`}</CardTitle>
            <div className="flex flex-wrap gap-2">
              {typeof opportunity.fase === "string" && (
                <Badge variant="outline">{opportunity.fase}</Badge>
              )}
              {typeof opportunity.etapa_nome === "string" && (
                <Badge>{opportunity.etapa_nome}</Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <ScrollArea className="max-h-[130vh]">
            <div className="space-y-6">
              {/* percorre as seções definidas e exibe apenas campos que existam */}
              {sectionsDef.map((section) => {
                // filtra campos da seção que existam no objeto
                const fields = section.fields.filter((f) => entriesMap.has(f));
                if (fields.length === 0) return null;
                return (
                  <section key={section.key} aria-labelledby={`heading-${section.key}`} className="p-4 bg-transparent rounded border border-transparent md:border-0">
                    <h2 id={`heading-${section.key}`} className="text-lg font-semibold mb-3">
                      {section.label}
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                      {fields.map((key) => {
                        const value = entriesMap.get(key);
                        const label = formatLabel(key);
                        const formatted = renderFormatted(key, value);

                        // valor para copiar apenas se chave permitida
                        const copyText = shouldShowCopy(key) && value !== undefined && value !== null ? String(value) : "";

                        return (
                          <div key={key} className="p-2">
                            <dl>
                              <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
                              <dd className="mt-1 flex items-start gap-2">
                                <div className="flex-1 min-w-0">{formatted}</div>

                                {shouldShowCopy(key) && copyText && (
                                  <button
                                    onClick={() => copyToClipboard(copyText)}
                                    title={`Copiar ${label}`}
                                    aria-label={`Copiar ${label}`}
                                    className="ml-2 inline-flex items-center justify-center rounded px-2 py-1 border text-sm hover:bg-surface"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                    </svg>
                                  </button>
                                )}
                              </dd>
                            </dl>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })}

              {participants.length > 0 && (
                <section
                  aria-labelledby="heading-envolvidos"
                  className="p-4 bg-transparent rounded border border-transparent md:border-0"
                >
                  <h2
                    id="heading-envolvidos"
                    className="text-lg font-semibold mb-3"
                  >
                    Dados dos Envolvidos
                  </h2>
                  <div className="space-y-4">
                    {participants.map((p, idx) => (
                      <div
                        key={p.id ?? idx}
                        className="border p-4 rounded-md"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                          {Object.entries(p).map(([k, v]) => {
                            if (!participantLabels[k]) return null;
                            return (
                              <div key={k} className="p-2">
                                <dl>
                                  <dt className="text-sm font-medium text-muted-foreground">
                                    {participantLabels[k]}
                                  </dt>
                                  <dd className="mt-1">
                                    {v ?? (
                                      <span className="text-muted-foreground">—</span>
                                    )}
                                  </dd>
                                </dl>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Metadados extras: campos que não estão nas seções acima */}
              <section aria-labelledby="heading-extras" className="p-4">
                <h2 id="heading-extras" className="text-lg font-semibold mb-3">
                  Metadados
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                  {orderedEntries
                    .filter(([k]) => {
                      // já apresentados nas seções? se não, mostrará aqui (e exclui id/title já mostrados se preferir)
                      const inAnySection = sectionsDef.some((s) => s.fields.includes(k));
                      return (
                        !inAnySection &&
                        k !== "id" &&
                        k !== "title" &&
                        !k.endsWith("_id")
                      );
                    })
                    .map(([k, v]) => (
                      <div key={k} className="p-2">
                        <dl>
                          <dt className="text-sm font-medium text-muted-foreground">{formatLabel(k)}</dt>
                          <dd className="mt-1">{renderFormatted(k, v)}</dd>
                        </dl>
                      </div>
                    ))}
                </div>
              </section>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>


      

      {/* snackbar / feedback simples com auto-close */}
      {snack.open && (
        <div
          role="status"
          aria-live="polite"
          className="fixed left-1/2 -translate-x-1/2 bottom-6 z-50 transition-opacity"
        >
          <div className="bg-black/90 text-white px-4 py-2 rounded shadow flex items-center gap-4">
            <span>{snack.message ?? "Feito"}</span>
            <button
              onClick={() => setSnack({ open: false })}
              className="underline text-xs"
              aria-label="Fechar notificação"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
