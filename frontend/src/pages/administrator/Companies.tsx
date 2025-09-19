import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, Building2, Users, Calendar, Activity, Phone } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { routes } from "@/config/routes";
import { getApiUrl } from "@/lib/api";
import {
  ApiCompany,
  ApiPlan,
  Company,
  CompanyStatusBadge,
  formatCurrency,
  formatDate,
  mapApiCompanyToCompany,
  parseDataArray,
} from "./companies-data";

export default function Companies() {
  const [searchTerm, setSearchTerm] = useState("");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;

    const loadCompanies = async () => {
      setIsLoading(true);
      try {
        const companiesResponse = await fetch(getApiUrl("empresas"), {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });

        if (!companiesResponse.ok) {
          throw new Error(`Falha ao carregar empresas: ${companiesResponse.status}`);
        }

        const companiesPayload = await companiesResponse.json();
        const apiCompanies = parseDataArray<ApiCompany>(companiesPayload);

        const plansIndex = new Map<string, ApiPlan>();
        try {
          const plansResponse = await fetch(getApiUrl("planos"), {
            headers: { Accept: "application/json" },
            signal: controller.signal,
          });

          if (plansResponse.ok) {
            const plansPayload = await plansResponse.json();
            const apiPlans = parseDataArray<ApiPlan>(plansPayload);
            apiPlans.forEach((plan) => {
              if (plan?.id != null) {
                plansIndex.set(String(plan.id), plan);
              }
            });
          } else {
            console.warn("Falha ao carregar planos:", plansResponse.status);
          }
        } catch (planError) {
          if (planError instanceof DOMException && planError.name === "AbortError") {
            return;
          }
          console.warn("Erro ao carregar planos:", planError);
        }

        if (!isMounted) {
          return;
        }

        setCompanies(apiCompanies.map((company) => mapApiCompanyToCompany(company, plansIndex)));
        setError(null);
      } catch (fetchError) {
        if (!isMounted) {
          return;
        }

        if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
          return;
        }

        console.error("Erro ao carregar empresas:", fetchError);
        setCompanies([]);
        setError("Não foi possível carregar as empresas.");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadCompanies();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  const filteredCompanies = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) {
      return companies;
    }

    return companies.filter((company) => {
      const values = [
        company.name,
        company.email,
        company.cnpj,
        company.manager,
        company.phone,
        company.planName,
      ];

      return values.some((value) => value && value.toLowerCase().includes(query));
    });
  }, [companies, searchTerm]);

  const totalCompanies = companies.length;
  const activeCompanies = useMemo(
    () => companies.filter((company) => company.status === "active").length,
    [companies],
  );
  const trialCompanies = useMemo(
    () => companies.filter((company) => company.status === "trial").length,
    [companies],
  );
  const activePercentage = totalCompanies > 0 ? ((activeCompanies / totalCompanies) * 100).toFixed(1) : "0.0";


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Empresas</h1>
          <p className="text-muted-foreground">Gerencie as empresas clientes do seu CRM</p>
        </div>
        <Button asChild>
          <Link to={routes.admin.newCompany}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Empresa
          </Link>
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Empresas</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCompanies}</div>
            <p className="text-xs text-muted-foreground">+2 este mês</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Empresas Ativas</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {activeCompanies}
            </div>
            <p className="text-xs text-muted-foreground">
              {activePercentage}% do total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Trial</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {trialCompanies}
            </div>
            <p className="text-xs text-muted-foreground">Potenciais conversões</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Empresas</CardTitle>
          <CardDescription>Visualize e gerencie todas as empresas cadastradas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar empresas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Cadastro</TableHead>
                  <TableHead>Última Atividade</TableHead>
                  <TableHead>MRR</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-6 text-center text-sm text-muted-foreground">
                      Carregando empresas...
                    </TableCell>
                  </TableRow>
                ) : error ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-6 text-center text-sm text-muted-foreground">
                      {error}
                    </TableCell>
                  </TableRow>
                ) : filteredCompanies.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-6 text-center text-sm text-muted-foreground">
                      Nenhuma empresa encontrada.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCompanies.map((company) => (
                    <TableRow key={company.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{company.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {company.email || "Sem e-mail"}
                          </div>
                          {company.cnpj ? (
                            <div className="text-xs text-muted-foreground">CNPJ: {company.cnpj}</div>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <CompanyStatusBadge status={company.status} />
                      </TableCell>
                      <TableCell>{company.planName}</TableCell>
                      <TableCell>{company.manager || "--"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          {company.phone || "--"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {formatDate(company.createdAt)}
                        </div>
                      </TableCell>
                      <TableCell>{formatDate(company.lastActivity)}</TableCell>
                      <TableCell>
                        <div className="font-medium">R$ {formatCurrency(company.planValue)}</div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={routes.admin.companyDetails(company.id)}>
                            Ver Detalhes
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}