import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { Activity, ArrowLeft, Building2, Calendar, IdCard, Mail, Phone, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/config/routes";
import { getApiUrl } from "@/lib/api";
import {
  ApiCompany,
  ApiPlan,
  ApiUser,
  Company,
  CompanyStatusBadge,
  buildUsersIndex,
  formatCurrency,
  formatDate,
  mapApiCompanyToCompany,
  parseDataArray,
  parseDataItem,
  getPlanIndex,
} from "./companies-data";

interface SummaryCardProps {
  icon: LucideIcon;
  title: string;
  value: string;
  description?: string;
}

const SummaryCard = ({ icon: Icon, title, value, description }: SummaryCardProps) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <Icon className="h-4 w-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
    </CardContent>
  </Card>
);

interface InfoItemProps {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  description?: string;
}

const InfoItem = ({ icon: Icon, label, value, description }: InfoItemProps) => (
  <div className="flex items-start gap-3 rounded-lg border p-3">
    <div className="mt-0.5 text-muted-foreground">
      <Icon className="h-4 w-4" />
    </div>
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="text-sm font-medium leading-tight break-words">{value}</div>
      {description ? <p className="text-xs text-muted-foreground leading-snug">{description}</p> : null}
    </div>
  </div>
);

export default function CompanyDetails() {
  const { companyId } = useParams<{ companyId: string }>();
  const [company, setCompany] = useState<Company | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;

    if (!companyId) {
      setCompany(null);
      setError("Empresa não encontrada.");
      setIsLoading(false);
      return () => {
        isMounted = false;
        controller.abort();
      };
    }

    const loadCompany = async () => {
      setIsLoading(true);
      try {
        const companyResponse = await fetch(getApiUrl(`empresas/${companyId}`), {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });

        if (companyResponse.status === 404) {
          if (isMounted) {
            setCompany(null);
            setError("Empresa não encontrada.");
          }
          return;
        }

        if (!companyResponse.ok) {
          throw new Error(`Falha ao carregar empresa: ${companyResponse.status}`);
        }

        const companyPayload = await companyResponse.json();

        let plansIndex = new Map<string, ApiPlan>();
        try {
          const plansResponse = await fetch(getApiUrl("planos"), {
            headers: { Accept: "application/json" },
            signal: controller.signal,
          });

          if (plansResponse.ok) {
            const plansPayload = await plansResponse.json();
            const apiPlans = parseDataArray<ApiPlan>(plansPayload);
            plansIndex = getPlanIndex(apiPlans);
          } else {
            console.warn("Falha ao carregar planos:", plansResponse.status);
          }
        } catch (plansError) {
          if (plansError instanceof DOMException && plansError.name === "AbortError") {
            return;
          }
          console.warn("Erro ao carregar planos:", plansError);
        }

        let usersIndex: Map<string, ApiUser> | undefined;
        try {
          const usersResponse = await fetch(getApiUrl("usuarios"), {
            headers: { Accept: "application/json" },
            signal: controller.signal,
          });

          if (usersResponse.ok) {
            const usersPayload = await usersResponse.json();
            const usersData = Array.isArray(usersPayload)
              ? (usersPayload as ApiUser[])
              : parseDataArray<ApiUser>(usersPayload);

            if (usersData.length > 0) {
              usersIndex = buildUsersIndex(usersData);
            } else {
              console.warn("Resposta inesperada ao carregar usuários.");
            }
          } else {
            console.warn("Falha ao carregar usuários:", usersResponse.status);
          }
        } catch (usersError) {
          if (usersError instanceof DOMException && usersError.name === "AbortError") {
            return;
          }
          console.warn("Erro ao carregar usuários:", usersError);
        }

        if (!isMounted) {
          return;
        }

        const apiCompany = parseDataItem<ApiCompany>(companyPayload);
        if (!apiCompany) {
          setCompany(null);
          setError("Não foi possível interpretar os dados da empresa.");
          return;
        }

        setCompany(mapApiCompanyToCompany(apiCompany, plansIndex, usersIndex));
        setError(null);
      } catch (fetchError) {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
          return;
        }

        console.error("Erro ao carregar empresa:", fetchError);
        if (isMounted) {
          setCompany(null);
          setError("Não foi possível carregar os detalhes da empresa.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadCompany();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [companyId]);

  const hasValidPlanValue = company?.planValue != null && !Number.isNaN(company.planValue);
  const planValueDisplay = hasValidPlanValue ? `R$ ${formatCurrency(company?.planValue ?? 0)}` : "--";
  const planValueDescription = hasValidPlanValue ? "Com base no plano atual" : "Valor não informado";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to={routes.admin.companies}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para empresas
          </Link>
        </Button>
        {company ? (
          <Button variant="outline" size="sm" asChild>
            <Link to={routes.admin.editCompany(company.id)}>Editar empresa</Link>
          </Button>
        ) : null}
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Carregando detalhes da empresa...
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardHeader>
            <CardTitle>Não foi possível carregar os detalhes</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to={routes.admin.companies}>Voltar para a lista de empresas</Link>
            </Button>
          </CardContent>
        </Card>
      ) : company ? (
        <>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <h1 className="text-3xl font-bold">{company.name}</h1>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>ID #{company.id}</span>
                {company.createdAt ? <span>• Cadastrada em {formatDate(company.createdAt)}</span> : null}
              </div>
            </div>
            <CompanyStatusBadge status={company.status} />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <SummaryCard
              icon={Building2}
              title="Plano atual"
              value={company.planName}
              description={company.planId ? `ID do plano: ${company.planId}` : "Sem plano associado"}
            />
            <SummaryCard
              icon={Activity}
              title="MRR estimado"
              value={planValueDisplay}
              description={planValueDescription}
            />
            <SummaryCard
              icon={Calendar}
              title="Última atividade"
              value={formatDate(company.lastActivity)}
              description="Atualização mais recente"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Informações gerais</CardTitle>
              <CardDescription>Detalhes cadastrais e dados de contato da empresa</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <InfoItem icon={Mail} label="E-mail" value={company.email || "Sem e-mail"} />
                <InfoItem icon={Phone} label="Telefone" value={company.phone || "--"} />
                <InfoItem
                  icon={User}
                  label="Responsável"
                  value={company.managerName || "Não informado"}
                  description="Usuário responsável pelo contrato"
                />
                <InfoItem icon={IdCard} label="CNPJ" value={company.cnpj || "--"} />
                <InfoItem
                  icon={Building2}
                  label="Plano"
                  value={company.planName}
                  description={hasValidPlanValue ? planValueDisplay : "Sem valor definido"}
                />
                <InfoItem icon={Activity} label="Status" value={<CompanyStatusBadge status={company.status} />} />
                <InfoItem icon={Calendar} label="Cadastro" value={formatDate(company.createdAt)} />
                <InfoItem icon={Calendar} label="Última atividade" value={formatDate(company.lastActivity)} />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Empresa não encontrada</CardTitle>
            <CardDescription>A empresa solicitada não está disponível.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to={routes.admin.companies}>Voltar para a lista de empresas</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

