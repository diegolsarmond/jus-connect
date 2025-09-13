import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { format as dfFormat, parseISO } from "date-fns";

interface OpportunityData {
  id: number;
  title?: string;
  [key: string]: unknown;
}

export default function VisualizarOportunidade() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const apiUrl = (import.meta.env.VITE_API_URL as string) || "http://localhost:3000";

  const [opportunity, setOpportunity] = useState<OpportunityData | null>(null);
  const [snack, setSnack] = useState<{ open: boolean; message?: string }>({ open: false });
  const [expandedDetails, setExpandedDetails] = useState(false);

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

  // rótulos conhecidos
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

  const formatLabel = (key: string) =>
    fieldLabels[key] ||
    key
      .replace(/_/g, " ")
      .replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1));

  const formatDate = (value: unknown) => {
    if (!value) return "—";
    try {
      const d = typeof value === "string" ? parseISO(value) : new Date(String(value));
      // se inválido, lança e cai no catch
      return dfFormat(d, "dd/MM/yyyy HH:mm");
    } catch {
      // fallback para locale
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

  const shouldShowCopy = (key: string) =>
    [
      "numero_processo_cnj",
      "numero_processo",
      "numero_processo_cn",
      "numero_processo_cnj",
      "numero_processo_cn",
      "numero_processo", // possíveis variações
      "numero_processo_cnj",
      "numero_protocolo",
      "valor_causa",
      "valor_honorarios",
    ].includes(key);

  // ordem preferencial de exibição — os demais aparecem depois
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

  const copyToClipboard = async (text: string) => {
    if (!navigator.clipboard) {
      // fallback
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

  const onEdit = () => {
    // stub - redirecionar para rota de edição se existir
    setSnack({ open: true, message: "Ação editar (stub)" });
    console.log("Editar", opportunity?.id);
  };
  const onDuplicate = () => {
    setSnack({ open: true, message: "Ação duplicar (stub)" });
    console.log("Duplicar", opportunity?.id);
  };
  const onDelete = () => {
    if (!window.confirm("Confirma exclusão desta oportunidade?")) return;
    setSnack({ open: true, message: "Excluído (stub)" });
    console.log("Excluir", opportunity?.id);
  };
  const onPrint = () => window.print();

  const renderFormatted = (key: string, value: unknown) => {
    if (value === null || value === undefined || value === "") {
      return <span className="text-muted-foreground">—</span>;
    }

    // datas
    if (/data|prazo|data_criacao|ultima_atualizacao|prazo_proximo/i.test(key)) {
      return <span>{formatDate(value)}</span>;
    }

    // currency
    if (/valor|honorarios|valor_causa|valor_honorarios|valor_total/i.test(key)) {
      return <span>{formatCurrency(value)}</span>;
    }

    // percent
    if (/percentual|%|percent/i.test(key)) {
      return <span>{formatPercent(value)}</span>;
    }

    // detalhes (texto longo)
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

    // arrays / objects
    if (Array.isArray(value) || typeof value === "object") {
      return (
        <pre className="whitespace-pre-wrap text-sm bg-muted px-2 py-1 rounded">
          {JSON.stringify(value, null, 2)}
        </pre>
      );
    }

    // boolean
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
      {/* Header / ações */}
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
          <Button variant="outline" onClick={onDuplicate} aria-label="Duplicar oportunidade">
            Duplicar
          </Button>
          <Button variant="destructive" onClick={onDelete} aria-label="Excluir oportunidade">
            Excluir
          </Button>
          <Button variant="ghost" onClick={onPrint} aria-label="Imprimir">
            Imprimir
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{opportunity.title ?? `Oportunidade ${opportunity.id}`}</CardTitle>
        </CardHeader>

        <CardContent>
          <ScrollArea className="max-h-[70vh]">
            {/* layout responsivo: em md duas colunas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {orderedEntries.map(([key, value]) => {
                // esconder campos internos óbvios (id/title) se desejar
                if (key === "id" || key === "title") return null;

                const label = formatLabel(key);
                const formatted = renderFormatted(key, value);

                // valor em string para copiar
                let copyText = "";
                if (shouldShowCopy(key)) {
                  // preferências por tipo
                  if (/valor/i.test(key)) copyText = typeof value === "number" ? String(value) : String(value ?? "");
                  else copyText = String(value ?? "");
                }

                return (
                  <section key={key} aria-labelledby={`label-${key}`} className="p-3 bg-transparent rounded">
                    <dl>
                      <dt id={`label-${key}`} className="text-sm font-medium text-muted-foreground">
                        <span title={label}>{label}</span>
                      </dt>
                      <dd className="mt-1 flex items-start gap-2">
                        <div className="flex-1 min-w-0">{formatted}</div>

                        {shouldShowCopy(key) && value !== null && value !== undefined && value !== "" && (
                          <button
                            onClick={() => copyToClipboard(copyText)}
                            title={`Copiar ${label}`}
                            aria-label={`Copiar ${label}`}
                            className="ml-2 inline-flex items-center justify-center rounded px-2 py-1 border text-sm hover:bg-surface"
                          >
                            {/* small copy icon (inline SVG) */}
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                          </button>
                        )}
                      </dd>
                    </dl>
                  </section>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* snackbar / feedback simples */}
      {snack.open && (
        <div
          role="status"
          aria-live="polite"
          className="fixed left-1/2 -translate-x-1/2 bottom-6 z-50"
          onAnimationEnd={() => {
            // auto-hide after a pequena animação; simples timeout melhor
          }}
        >
          <div className="bg-black/90 text-white px-4 py-2 rounded shadow">
            {snack.message ?? "Feito"}
            <button
              onClick={() => setSnack({ open: false })}
              className="ml-3 underline text-xs"
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
