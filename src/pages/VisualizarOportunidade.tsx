import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";

interface OpportunityData {
  id: number;
  title?: string;
  [key: string]: unknown; // allow additional fields
}

export default function VisualizarOportunidade() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const apiUrl = (import.meta.env.VITE_API_URL as string) || "http://localhost:3000";
  const [opportunity, setOpportunity] = useState<OpportunityData | null>(null);

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
    const fetchOpportunity = async () => {
      try {
        const res = await fetch(`${apiUrl}/api/oportunidades/${id}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setOpportunity(data);
      } catch (e) {
        console.error(e);
      }
    };
    fetchOpportunity();
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

  const renderValue = (value: unknown) => {
    if (value === null || value === undefined || value === "") {
      return <span className="text-muted-foreground">—</span>;
    }
    if (typeof value === "object") {
      return (
        <pre className="whitespace-pre-wrap text-sm">
          {JSON.stringify(value, null, 2)}
        </pre>
      );
    }
    return String(value);
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
        <p className="text-muted-foreground">Oportunidade não encontrada.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Visualizar Oportunidade</h1>
          <p className="text-muted-foreground">
            Detalhes completos da oportunidade
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate(-1)}>
          Voltar
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {opportunity.title || `Oportunidade ${opportunity.id}`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-[90vh]">
            <Table>
              <TableBody>
                {Object.entries(opportunity)
                  .filter(
                    ([key]) => key !== "envolvidos" && !key.endsWith("_id")
                  )
                  .map(([key, value]) => (
                    <TableRow key={key}>
                      <TableCell className="font-medium w-[40%]">
                        {formatLabel(key)}
                      </TableCell>
                      <TableCell>{renderValue(value)}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {Array.isArray(opportunity.envolvidos) && opportunity.envolvidos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Envolvidos</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                {opportunity.envolvidos.map((env, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium w-[40%]">
                      {formatLabel(env.relacao as string)}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1 text-sm">
                        {env.nome && <div>Nome: {env.nome as string}</div>}
                        {env.cpf_cnpj && (
                          <div>CPF/CNPJ: {env.cpf_cnpj as string}</div>
                        )}
                        {env.telefone && (
                          <div>Telefone: {env.telefone as string}</div>
                        )}
                        {env.endereco && (
                          <div>Endereço: {env.endereco as string}</div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

