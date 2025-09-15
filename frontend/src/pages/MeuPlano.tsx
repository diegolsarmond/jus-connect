import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Check, Loader2, AlertTriangle } from "lucide-react";
import { getApiBaseUrl, joinUrl } from "@/lib/api";

type Recorrencia = "mensal" | "anual" | "nenhuma";

type PlanoDetalhe = {
  id: number;
  nome: string;
  preco: string;
  valorNumerico: number | null;
  ativo: boolean;
  descricao: string;
  recorrencia: Recorrencia | null;
  qtdeUsuarios: number | null;
  recursos: string[];
  dataCadastro: Date | null;
};

type UsageMetrics = {
  usuariosAtivos: number | null;
  clientesAtivos: number | null;
};

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
});

const recorrenciaLabels: Record<Recorrencia, string> = {
  mensal: "Mensal",
  anual: "Anual",
  nenhuma: "Sem recorrência",
};

function normalizeApiRows(data: unknown): unknown[] {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray((data as { rows?: unknown[] })?.rows)) {
    return (data as { rows: unknown[] }).rows;
  }

  const nestedData = (data as { data?: unknown })?.data;
  if (Array.isArray(nestedData)) {
    return nestedData;
  }

  if (Array.isArray((nestedData as { rows?: unknown[] })?.rows)) {
    return (nestedData as { rows: unknown[] }).rows;
  }

  return [];
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const sanitized = trimmed.replace(/[^\d,.-]/g, "").replace(/\.(?=.*\.)/g, "");
    const normalized = sanitized.replace(",", ".");
    const result = Number(normalized);
    return Number.isFinite(result) ? result : null;
  }

  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }

  return null;
}

function parseRecursos(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/[\n;,]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function parseRecorrencia(value: unknown): Recorrencia | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "mensal" || normalized === "anual" || normalized === "nenhuma") {
    return normalized;
  }

  return null;
}

function parseDate(value: unknown): Date | null {
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  return null;
}

function formatCurrencyValue(value: unknown): string {
  const numeric = toNumber(value);
  if (numeric !== null) {
    return currencyFormatter.format(numeric);
  }

  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  return "Valor não disponível";
}

function calculateNextBilling(recorrencia: Recorrencia | null, dataCadastro: Date | null): string | null {
  if (!recorrencia || recorrencia === "nenhuma") {
    return null;
  }

  const incrementMonths = recorrencia === "mensal" ? 1 : 12;
  const base = dataCadastro ?? new Date();
  if (Number.isNaN(base.getTime())) {
    return null;
  }

  const now = new Date();
  const next = new Date(base.getTime());
  let iterations = 0;
  const maxIterations = 1000;

  if (next <= now) {
    while (next <= now && iterations < maxIterations) {
      next.setMonth(next.getMonth() + incrementMonths);
      iterations += 1;
    }
  }

  if (iterations >= maxIterations) {
    return null;
  }

  return next.toLocaleDateString("pt-BR");
}

function formatDate(value: Date | null): string | null {
  if (!value) {
    return null;
  }

  return value.toLocaleDateString("pt-BR");
}

type ApiEmpresa = { plano?: unknown; plano_id?: unknown };

function findPlanFromEmpresa(planos: PlanoDetalhe[], empresasRows: unknown[]): PlanoDetalhe | null {
  if (planos.length === 0) {
    return null;
  }

  const identifiers = empresasRows
    .map((row) => row as ApiEmpresa)
    .flatMap((empresa) => {
      const results: { id: number | null; name: string | null }[] = [];
      const idFromPlano = toNumber(empresa.plano);
      if (idFromPlano !== null) {
        results.push({ id: idFromPlano, name: null });
      } else if (typeof empresa.plano === "string" && empresa.plano.trim()) {
        results.push({ id: null, name: empresa.plano.trim() });
      }

      const idFromPlanoId = toNumber(empresa.plano_id);
      if (idFromPlanoId !== null) {
        results.push({ id: idFromPlanoId, name: null });
      }

      return results;
    });

  for (const identifier of identifiers) {
    if (identifier.id !== null) {
      const match = planos.find((plano) => plano.id === identifier.id);
      if (match) {
        return match;
      }
    }

    if (identifier.name) {
      const normalized = identifier.name.toLowerCase();
      const match = planos.find((plano) => plano.nome.toLowerCase() === normalized);
      if (match) {
        return match;
      }
    }
  }

  return null;
}

type UsageItem = {
  label: string;
  current: number | null;
  limit?: number | null;
};

export default function MeuPlano() {
  const apiBaseUrl = getApiBaseUrl();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [plano, setPlano] = useState<PlanoDetalhe | null>(null);
  const [metrics, setMetrics] = useState<UsageMetrics>({ usuariosAtivos: null, clientesAtivos: null });

  useEffect(() => {
    let disposed = false;

    async function fetchData() {
      setLoading(true);
      setError(null);

      const planosUrl = joinUrl(apiBaseUrl, "/api/planos");
      const empresasUrl = joinUrl(apiBaseUrl, "/api/empresas");
      const usuariosUrl = joinUrl(apiBaseUrl, "/api/usuarios");
      const clientesUrl = joinUrl(apiBaseUrl, "/api/clientes/ativos/total");

      try {
        const [planosJson, empresasJson, usuariosJson, clientesJson] = await Promise.all([
          fetch(planosUrl, { headers: { Accept: "application/json" } }).then((res) => {
            if (!res.ok) {
              throw new Error(`Falha ao carregar planos (HTTP ${res.status})`);
            }
            return res.json();
          }),
          fetch(empresasUrl, { headers: { Accept: "application/json" } })
            .then((res) => {
              if (!res.ok) {
                throw new Error(`Falha ao carregar empresas (HTTP ${res.status})`);
              }
              return res.json();
            })
            .catch((err) => {
              console.warn(err);
              return null;
            }),
          fetch(usuariosUrl, { headers: { Accept: "application/json" } })
            .then((res) => {
              if (!res.ok) {
                throw new Error(`Falha ao carregar usuários (HTTP ${res.status})`);
              }
              return res.json();
            })
            .catch((err) => {
              console.warn(err);
              return null;
            }),
          fetch(clientesUrl, { headers: { Accept: "application/json" } })
            .then((res) => {
              if (!res.ok) {
                throw new Error(`Falha ao carregar clientes (HTTP ${res.status})`);
              }
              return res.json();
            })
            .catch((err) => {
              console.warn(err);
              return null;
            }),
        ]);

        const planosRows = normalizeApiRows(planosJson);
        const parsedPlanos = planosRows
          .map((row) => {
            const raw = row as Record<string, unknown>;
            const idNumber = toNumber(raw.id);
            if (idNumber === null) {
              return null;
            }

            const nome = typeof raw.nome === "string" ? raw.nome.trim() : String(raw.nome ?? `Plano ${idNumber}`);
            const ativo = typeof raw.ativo === "boolean" ? raw.ativo : true;
            const descricao =
              typeof raw.descricao === "string" ? raw.descricao.trim() : raw.descricao ? String(raw.descricao) : "";
            const recorrencia = parseRecorrencia(raw.recorrencia);
            const qtdeUsuarios = toNumber(raw.qtde_usuarios);
            const recursos = parseRecursos(raw.recursos);
            const dataCadastro = parseDate(raw.datacadastro);
            const valorNumerico = toNumber(raw.valor);
            const preco = formatCurrencyValue(raw.valor);

            return {
              id: idNumber,
              nome,
              ativo,
              descricao,
              recorrencia,
              qtdeUsuarios: qtdeUsuarios ?? null,
              recursos,
              dataCadastro,
              preco,
              valorNumerico,
            } satisfies PlanoDetalhe;
          })
          .filter((item): item is PlanoDetalhe => item !== null);

        if (parsedPlanos.length === 0) {
          throw new Error("Nenhum plano cadastrado.");
        }

        const empresasRows = empresasJson ? normalizeApiRows(empresasJson) : [];
        const planoSelecionado =
          findPlanFromEmpresa(parsedPlanos, empresasRows) ??
          parsedPlanos.find((item) => item.ativo) ??
          parsedPlanos[0];

        const usuariosCount = usuariosJson ? normalizeApiRows(usuariosJson).length : null;

        let clientesAtivos: number | null = null;
        if (clientesJson && typeof clientesJson === "object" && clientesJson !== null) {
          const maybeDirect = (clientesJson as { total_clientes_ativos?: unknown }).total_clientes_ativos;
          const maybeNested = (clientesJson as { data?: { total_clientes_ativos?: unknown } }).data?.total_clientes_ativos;
          const maybeTotal = (clientesJson as { total?: unknown }).total;
          clientesAtivos = toNumber(maybeDirect) ?? toNumber(maybeNested) ?? toNumber(maybeTotal);
        }

        if (!disposed) {
          setPlano(planoSelecionado);
          setMetrics({ usuariosAtivos: usuariosCount, clientesAtivos });
        }
      } catch (err) {
        console.error(err);
        if (!disposed) {
          setError(err instanceof Error ? err.message : "Não foi possível carregar os dados do plano.");
          setPlano(null);
          setMetrics({ usuariosAtivos: null, clientesAtivos: null });
        }
      } finally {
        if (!disposed) {
          setLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      disposed = true;
    };
  }, [apiBaseUrl]);

  const proximaCobranca = useMemo(() => {
    if (!plano) {
      return null;
    }

    return calculateNextBilling(plano.recorrencia, plano.dataCadastro);
  }, [plano]);

  const usageItems = useMemo<UsageItem[]>(() => {
    if (!plano) {
      return [];
    }

    const items: UsageItem[] = [];
    if (plano.qtdeUsuarios !== null || metrics.usuariosAtivos !== null) {
      items.push({
        label: "Usuários ativos",
        current: metrics.usuariosAtivos,
        limit: plano.qtdeUsuarios,
      });
    }
    if (metrics.clientesAtivos !== null) {
      items.push({
        label: "Clientes ativos",
        current: metrics.clientesAtivos,
      });
    }

    return items;
  }, [metrics.clientesAtivos, metrics.usuariosAtivos, plano]);

  const beneficios = plano?.recursos ?? [];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Meu Plano</h1>
        <p className="text-muted-foreground">
          Acompanhe as informações do plano contratado e o consumo dos principais recursos.
        </p>
      </div>

      {loading ? (
        <Card>
          <CardContent className="flex items-center gap-3 py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Carregando informações do plano…</span>
          </CardContent>
        </Card>
      ) : error ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Não foi possível carregar o plano</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : !plano ? (
        <Alert>
          <AlertTitle>Nenhum plano encontrado</AlertTitle>
          <AlertDescription>
            Cadastre um plano em <strong>Configurações &gt; Planos</strong> para visualizar os detalhes aqui.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <Card>
            <CardHeader className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <CardTitle className="text-2xl">{plano.nome}</CardTitle>
                <p className="text-muted-foreground">
                  {plano.preco}
                  {plano.recorrencia && plano.recorrencia !== "nenhuma"
                    ? ` · Cobrança ${recorrenciaLabels[plano.recorrencia].toLowerCase()}`
                    : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant={plano.ativo ? "secondary" : "outline"}>{plano.ativo ? "Ativo" : "Inativo"}</Badge>
                {plano.recorrencia && <Badge variant="outline">{recorrenciaLabels[plano.recorrencia]}</Badge>}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {plano.descricao && <p className="text-sm text-muted-foreground">{plano.descricao}</p>}
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                {plano.dataCadastro && (
                  <span>
                    Assinado em{" "}
                    <span className="font-medium text-foreground">{formatDate(plano.dataCadastro)}</span>
                  </span>
                )}
                {proximaCobranca ? (
                  <span>
                    Próxima cobrança em{" "}
                    <span className="font-medium text-foreground">{proximaCobranca}</span>
                  </span>
                ) : (
                  <span className="font-medium text-foreground">Cobrança sob demanda</span>
                )}
              </div>
              <Button asChild>
                <Link to="/configuracoes/planos">Alterar plano</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Utilização dos recursos</CardTitle>
              <CardDescription>Acompanhe o consumo dos principais limites do plano</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {usageItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Ainda não há métricas disponíveis para este plano.
                </p>
              ) : (
                usageItems.map((item) => {
                  const limit = item.limit ?? null;
                  const hasLimit = limit !== null && Number.isFinite(limit) && limit > 0;
                  const hasCurrent = typeof item.current === "number" && Number.isFinite(item.current);
                  const progress = hasLimit && hasCurrent ? Math.min(100, Math.round((item.current / limit) * 100)) : 0;
                  return (
                    <div key={item.label} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span>{item.label}</span>
                        <span className="font-medium text-foreground">
                          {hasLimit
                            ? `${hasCurrent ? item.current : "—"}/${limit}`
                            : hasCurrent
                              ? item.current
                              : "—"}
                        </span>
                      </div>
                      {hasLimit ? (
                        hasCurrent ? (
                          <Progress value={progress} aria-label={`Consumo de ${item.label}`} />
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            Dados indisponíveis para este recurso no momento.
                          </p>
                        )
                      ) : (
                        <p className="text-xs text-muted-foreground">Sem limite definido para este recurso.</p>
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Benefícios inclusos</CardTitle>
            </CardHeader>
            <CardContent>
              {beneficios.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Este plano não possui benefícios listados. Atualize os dados do plano para exibir aqui.
                </p>
              ) : (
                <ul className="space-y-2">
                  {beneficios.map((beneficio) => (
                    <li key={beneficio} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      <span>{beneficio}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
