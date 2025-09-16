import { appConfig, buildAdminPath } from "./app-config";

const route = (path: string) => path;

export const routes = {
  home: route("/"),
  login: route("/login"),
  register: route("/register"),
  forgotPassword: route("/forgot-password"),
  admin: {
    root: route(appConfig.adminBasePath),
    dashboard: route(appConfig.adminBasePath),
    companies: route(buildAdminPath("companies")),
    newCompany: route(buildAdminPath("companies", "new")),
    plans: route(buildAdminPath("plans")),
    newPlan: route(buildAdminPath("plans", "new")),
    subscriptions: route(buildAdminPath("subscriptions")),
    newSubscription: route(buildAdminPath("subscriptions", "new")),
    users: route(buildAdminPath("users")),
    newUser: route(buildAdminPath("users", "new")),
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
  newCompany: "companies/new",
  plans: "plans",
  newPlan: "plans/new",
  subscriptions: "subscriptions",
  newSubscription: "subscriptions/new",
  users: "users",
  newUser: "users/new",
  analytics: "analytics",
  support: "support",
  logs: "logs",
  settings: "settings",
} as const;
