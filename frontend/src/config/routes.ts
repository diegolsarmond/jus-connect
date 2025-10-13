import { appConfig, buildAdminPath } from "./app-config";

const route = (path: string) => path;

export const routes = {
  home: route("/"),
  blog: route("/blog"),
  blogPost: (slug: string) => route(`/blog/${slug}`),
  services: route("/servicos"),
  plans: route("/plans"),
  checkout: route("/checkout"),
  subscription: (id: string) => route(`/subscription/${id}`),
  serviceCRM: route("/produtos/crm"),
  serviceCRMAdvocacia: route("/produtos/crm-advocacia"),
  serviceAutomacoes: route("/servicos/automacoes"),
  serviceAssistenteIA: route("/servicos/assistente-ia"),
  serviceDesenvolvimento: route("/servicos/desenvolvimento"),
  history: route("/nossa-historia"),
  privacyPolicy: route("/politica-de-privacidade"),
  termsOfUse: route("/termos-de-uso"),
  dashboard: route("/app"),
  login: route("/login"),
  register: route("/register"),
  confirmEmail: route("/confirmar-email"),
  forgotPassword: route("/recuperar-senha"),
  meuPlano: route("/meu-plano"),
  meuPlanoPlans: route("/meu-plano/planos"),
  meuPlanoPayment: route("/meu-plano/gerenciar-pagamento"),
  admin: {
    root: route(appConfig.adminBasePath),
    dashboard: route(appConfig.adminBasePath),
    companies: route(buildAdminPath("companies")),
    companyDetails: (companyId: string | number) => route(buildAdminPath("companies", String(companyId))),
    editCompany: (companyId: string | number) => route(buildAdminPath("companies", String(companyId), "edit")),
    newCompany: route(buildAdminPath("companies", "new")),
    plans: route(buildAdminPath("plans")),
    newPlan: route(buildAdminPath("plans", "new")),
    subscriptions: route(buildAdminPath("subscriptions")),
    newSubscription: route(buildAdminPath("subscriptions", "new")),
    users: route(buildAdminPath("users")),
    newUser: route(buildAdminPath("users", "new")),
    blog: route(buildAdminPath("blog")),
    analytics: route(buildAdminPath("analytics")),
    support: route(buildAdminPath("support")),
    logs: route(buildAdminPath("logs")),
    settings: route(buildAdminPath("settings")),
  },
  notFound: route("*"),
} as const;

export type AppRoutes = typeof routes;

export const isActiveRoute = (currentPathname: string, targetPath: string) => {
  if (targetPath === "/") {
    return currentPathname === targetPath;
  }

  return currentPathname === targetPath || currentPathname.startsWith(`${targetPath}/`);
};

export const adminRelativePath = {
  companies: "companies",
  companyDetails: "companies/:companyId",
  editCompany: "companies/:companyId/edit",
  newCompany: "companies/new",
  plans: "plans",
  newPlan: "plans/new",
  subscriptions: "subscriptions",
  newSubscription: "subscriptions/new",
  users: "users",
  newUser: "users/new",
  blog: "blog",
  analytics: "analytics",
  support: "support",
  logs: "logs",
  settings: "settings",
} as const;
