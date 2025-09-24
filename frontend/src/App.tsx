import { Suspense, lazy, type ReactElement } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { adminRelativePath, routes } from "@/config/routes";
import { appConfig } from "@/config/app-config";
import Landing from "./pages/operator/Landing";
import Clientes from "./pages/operator/Clientes";
import NovoCliente from "./pages/operator/NovoCliente";
import EditarCliente from "./pages/operator/EditarCliente";
import VisualizarCliente from "./pages/operator/VisualizarCliente";
import Fornecedores from "./pages/operator/Fornecedores";
import NovoFornecedor from "./pages/operator/NovoFornecedor";
import EditarFornecedor from "./pages/operator/EditarFornecedor";
import VisualizarFornecedor from "./pages/operator/VisualizarFornecedor";
import NovoProcesso from "./pages/operator/NovoProcesso";
import VisualizarProcesso from "./pages/operator/VisualizarProcesso";
import ContratoPreview from "./pages/operator/ContratoPreview";
import Pipeline from "./pages/operator/Pipeline";
import PipelineMenu from "./pages/operator/PipelineMenu";
import NovaOportunidade from "./pages/operator/NovaOportunidade";
import VisualizarOportunidade from "./pages/operator/VisualizarOportunidade";
import EditarOportunidade from "./pages/operator/EditarOportunidade";
import EditarDocumentoOportunidade from "./pages/operator/EditarDocumentoOportunidade";
import Agenda from "./pages/operator/Agenda";
import Tarefas from "./pages/operator/Tarefas";
import Processos from "./pages/operator/Processos";
import Intimacoes from "./pages/operator/Intimacoes";
import LibraryPage from "./pages/operator/LibraryPage";
import EditorPage from "./pages/operator/EditorPage";
import FinancialFlows from "./pages/operator/FinancialFlows";
import Relatorios from "./pages/operator/Relatorios";
import MeuPerfil from "./pages/operator/MeuPerfil";
import MeuPlano from "./pages/operator/MeuPlano";
import Suporte from "./pages/operator/Suporte";
import Conversas from "./pages/operator/Conversas";
import AreaAtuacao from "./pages/operator/configuracoes/parametros/AreaAtuacao";
import SituacaoProcesso from "./pages/operator/configuracoes/parametros/SituacaoProcesso";
import TipoProcesso from "./pages/operator/configuracoes/parametros/TipoProcesso";
import TipoEvento from "./pages/operator/configuracoes/parametros/TipoEvento";
import TipoDocumento from "./pages/operator/configuracoes/parametros/TipoDocumento";
import Perfis from "./pages/operator/configuracoes/parametros/Perfis";
import SituacaoCliente from "./pages/operator/configuracoes/parametros/SituacaoCliente";
import Setores from "./pages/operator/configuracoes/parametros/Setores";
import Etiquetas from "./pages/operator/configuracoes/parametros/Etiquetas";
import FluxoTrabalho from "./pages/operator/configuracoes/parametros/FluxoTrabalho";
import SituacaoProposta from "./pages/operator/configuracoes/parametros/SituacaoProposta";
import Empresas from "./pages/operator/configuracoes/Empresas";
import Integracoes from "./pages/operator/configuracoes/Integracoes";
import Usuarios from "./pages/operator/configuracoes/usuarios/Usuarios";
import NovoUsuario from "./pages/operator/configuracoes/usuarios/NovoUsuario";
import NovaEmpresa from "./pages/operator/configuracoes/NovaEmpresa";
import PerfilUsuario from "./pages/operator/configuracoes/usuarios/PerfilUsuario";
import EditarPerfil from "./pages/operator/configuracoes/usuarios/EditarPerfil";
import AlterarSenha from "./pages/operator/configuracoes/usuarios/AlterarSenha";
import ConfiguracaoSeguranca from "./pages/operator/configuracoes/usuarios/ConfiguracaoSeguranca";
import SessaoDispositivos from "./pages/operator/configuracoes/usuarios/SessaoDispositivos";
import PrivacidadeLGPD from "./pages/operator/configuracoes/usuarios/PrivacidadeLGPD";
import NotificacoesPreferencias from "./pages/operator/configuracoes/usuarios/NotificacoesPreferencias";
import Login from "./pages/operator/Login";
import Register from "./pages/operator/Register";
import RecuperarSenha from "./pages/operator/RecuperarSenha";
import NotFound from "./pages/operator/NotFound";
import SiteIndex from "./pages/site/Index";
import SiteServices from "./pages/site/Services";
import SiteBlog from "./pages/site/Blog";
import SiteBlogArticle from "./pages/site/BlogArticle";
import SiteHistory from "./pages/site/NossaHistoria";
import SiteNotFound from "./pages/site/NotFound";
import SitePrivacyPolicy from "./pages/site/PrivacyPolicy";
import SiteServiceAssistenteIA from "./pages/site/services/AssistenteIA";
import SiteServiceAutomacoes from "./pages/site/services/Automacoes";
import SiteServiceCRM from "./pages/site/services/CRM";
import SiteServiceCRMAdvocacia from "./pages/site/services/CRMAdvocacia";
import SiteServiceDesenvolvimento from "./pages/site/services/Desenvolvimento";
import SiteTermsOfUse from "./pages/site/TermsOfUse";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { ProtectedRoute } from "@/features/auth/ProtectedRoute";
import { RequireModule } from "@/features/auth/RequireModule";
import { RequireAdminUser } from "@/features/auth/RequireAdminUser";
import { PlanProvider } from "@/features/plans/PlanProvider";

const CRMLayout = lazy(() =>
  import("@/components/layout/CRMLayout").then((module) => ({ default: module.CRMLayout })),
);
const Dashboard = lazy(() => import("./pages/operator/Dashboard"));
const AdminLayout = lazy(() => import("@/components/layout/DashboardLayout"));
const AdminDashboard = lazy(() => import("./pages/administrator/Dashboard"));
const AdminCompanies = lazy(() => import("./pages/administrator/Companies"));
const AdminCompanyDetails = lazy(() => import("./pages/administrator/CompanyDetails"));
const AdminEditCompany = lazy(() => import("./pages/administrator/EditCompany"));
const AdminNewCompany = lazy(() => import("./pages/administrator/NewCompany"));
const AdminPlans = lazy(() => import("./pages/administrator/Plans"));
const AdminNewPlan = lazy(() => import("./pages/administrator/NewPlan"));
const AdminSubscriptions = lazy(() => import("./pages/administrator/Subscriptions"));
const AdminNewSubscription = lazy(() => import("./pages/administrator/NewSubscription"));
const AdminUsers = lazy(() => import("./pages/administrator/Users"));
const AdminNewUser = lazy(() => import("./pages/administrator/NewUser"));
const AdminBlogPosts = lazy(() => import("./pages/administrator/BlogPosts"));
const AdminAnalytics = lazy(() => import("./pages/administrator/Analytics"));
const AdminSupport = lazy(() => import("./pages/administrator/Support"));
const AdminLogs = lazy(() => import("./pages/administrator/Logs"));
const AdminSettingsLayout = lazy(() => import("./pages/administrator/settings/Layout"));
const AdminSettingsOverview = lazy(() => import("./pages/administrator/settings/Overview"));
const AdminSettingsCategories = lazy(() => import("./pages/administrator/settings/Categories"));
const AdminNotFound = lazy(() => import("./pages/administrator/NotFound"));

const queryClient = new QueryClient();
const routerBasename = appConfig.basePath === "/" ? undefined : appConfig.basePath;

const withModule = (moduleId: string | string[], element: ReactElement) => (
  <RequireModule module={moduleId}>{element}</RequireModule>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter basename={routerBasename}>

          <Suspense fallback={<LandingFallback />}>
            <Routes>
              <Route path={routes.home} element={<SiteIndex />} />
              <Route path="/blog" element={<SiteBlog />} />
              <Route path="/blog/:slug" element={<SiteBlogArticle />} />
              <Route path="/nossa-historia" element={<SiteHistory />} />
              <Route path="/servicos" element={<SiteServices />} />
              <Route path="/servicos/assistente-ia" element={<SiteServiceAssistenteIA />} />
              <Route path="/servicos/automacoes" element={<SiteServiceAutomacoes />} />
              <Route path="/servicos/crm" element={<SiteServiceCRM />} />
              <Route path="/servicos/crm-advocacia" element={<SiteServiceCRMAdvocacia />} />
              <Route path="/servicos/desenvolvimento" element={<SiteServiceDesenvolvimento />} />
              <Route path="/politica-de-privacidade" element={<SitePrivacyPolicy />} />
              <Route path="/termos-de-uso" element={<SiteTermsOfUse />} />
              <Route path={routes.login} element={<Login />} />
              <Route path={routes.register} element={<Register />} />
              <Route path={routes.forgotPassword} element={<RecuperarSenha />} />
              <Route
                element={(
                  <ProtectedRoute>
                    <PlanProvider>
                      <CRMLayout />
                    </PlanProvider>
                  </ProtectedRoute>
                )}
              >
                <Route path={routes.dashboard} element={withModule("dashboard", <Dashboard />)} />
                <Route path="/conversas" element={withModule("conversas", <Conversas />)} />
                <Route path="/conversas/:conversationId" element={withModule("conversas", <Conversas />)} />
                <Route path="/clientes" element={withModule("clientes", <Clientes />)} />
                <Route path="/clientes/novo" element={withModule("clientes", <NovoCliente />)} />
                <Route path="/clientes/:id/editar" element={withModule("clientes", <EditarCliente />)} />
                <Route path="/clientes/:id/novo-processo" element={withModule("clientes", <NovoProcesso />)} />
                <Route
                  path="/clientes/:id/processos/:processoId"
                  element={withModule("clientes", <VisualizarProcesso />)}
                />
                <Route
                  path="/clientes/:id/processos/:processoId/contrato"
                  element={withModule("clientes", <ContratoPreview />)}
                />
                <Route path="/clientes/:id" element={withModule("clientes", <VisualizarCliente />)} />
                <Route path="/fornecedores" element={withModule("fornecedores", <Fornecedores />)} />
                <Route path="/fornecedores/novo" element={withModule("fornecedores", <NovoFornecedor />)} />
                <Route path="/fornecedores/:id/editar" element={withModule("fornecedores", <EditarFornecedor />)} />
                <Route path="/fornecedores/:id" element={withModule("fornecedores", <VisualizarFornecedor />)} />
                <Route path="/pipeline" element={withModule("pipeline", <PipelineMenu />)} />
                <Route path="/pipeline/:fluxoId" element={withModule("pipeline", <Pipeline />)} />
                <Route path="/pipeline/nova-oportunidade" element={withModule("pipeline", <NovaOportunidade />)} />
                <Route
                  path="/pipeline/oportunidade/:id"
                  element={withModule("pipeline", <VisualizarOportunidade />)}
                />
                <Route
                  path="/pipeline/oportunidade/:id/documentos/:documentId/editar"
                  element={withModule("pipeline", <EditarDocumentoOportunidade />)}
                />
                <Route
                  path="/pipeline/editar-oportunidade/:id"
                  element={withModule("pipeline", <EditarOportunidade />)}
                />
                <Route path="/agenda" element={withModule("agenda", <Agenda />)} />
                <Route path="/tarefas" element={withModule("tarefas", <Tarefas />)} />
                <Route path="/processos" element={withModule("processos", <Processos />)} />
                <Route path="/intimacoes" element={withModule("intimacoes", <Intimacoes />)} />
                <Route path="/documentos">
                  <Route index element={withModule("documentos", <LibraryPage />)} />
                  <Route path="editor/novo" element={withModule("documentos", <EditorPage />)} />
                  <Route path="editor/:id" element={withModule("documentos", <EditorPage />)} />
                </Route>
                <Route path="/financeiro/lancamentos" element={withModule("financeiro", <FinancialFlows />)} />
                <Route path="/relatorios" element={withModule("relatorios", <Relatorios />)} />
                <Route path="/alterar-senha" element={<AlterarSenha />} />
                <Route path="/meu-perfil" element={<MeuPerfil />} />
                <Route path="/meu-plano" element={withModule("meu-plano", <MeuPlano />)} />
                <Route path="/suporte" element={withModule("suporte", <Suporte />)} />
                <Route
                  path="/configuracoes"
                  element={withModule(
                    ["configuracoes", "configuracoes-usuarios", "configuracoes-integracoes", "configuracoes-parametros"],
                    <div className="p-6">
                      <h1 className="text-3xl font-bold">Configurações</h1>
                      <p className="text-muted-foreground">Em desenvolvimento</p>
                    </div>,
                  )}
                />
                <Route path="/configuracoes/usuarios" element={withModule("configuracoes-usuarios", <Usuarios />)} />
                <Route path="/configuracoes/empresas" element={withModule("configuracoes", <Empresas />)} />
                <Route path="/configuracoes/empresas/nova" element={withModule("configuracoes", <NovaEmpresa />)} />
                <Route path="/configuracoes/integracoes" element={withModule("configuracoes-integracoes", <Integracoes />)} />
                <Route path="/configuracoes/usuarios/novo" element={withModule("configuracoes-usuarios", <NovoUsuario />)} />
                <Route path="/configuracoes/usuarios/:id" element={withModule("configuracoes-usuarios", <PerfilUsuario />)} />
                <Route path="/configuracoes/usuarios/:id/editar" element={withModule("configuracoes-usuarios", <EditarPerfil />)} />
                <Route path="/configuracoes/usuarios/:id/senha" element={withModule("configuracoes-usuarios", <AlterarSenha />)} />
                <Route
                  path="/configuracoes/usuarios/:id/seguranca"
                  element={withModule("configuracoes-usuarios", <ConfiguracaoSeguranca />)}
                />
                <Route
                  path="/configuracoes/usuarios/:id/sessoes"
                  element={withModule("configuracoes-usuarios", <SessaoDispositivos />)}
                />
                <Route
                  path="/configuracoes/usuarios/:id/privacidade"
                  element={withModule("configuracoes-usuarios", <PrivacidadeLGPD />)}
                />
                <Route
                  path="/configuracoes/usuarios/:id/notificacoes"
                  element={withModule("configuracoes-usuarios", <NotificacoesPreferencias />)}
                />
                <Route
                  path="/configuracoes/parametros/area-de-atuacao"
                  element={withModule(
                    ["configuracoes-parametros", "configuracoes-parametros-area-atuacao"],
                    <AreaAtuacao />,
                  )}
                />
                <Route
                  path="/configuracoes/parametros/situacao-processo"
                  element={withModule(
                    ["configuracoes-parametros", "configuracoes-parametros-situacao-processo"],
                    <SituacaoProcesso />,
                  )}
                />
                <Route
                  path="/configuracoes/parametros/tipo-processo"
                  element={withModule(
                    ["configuracoes-parametros", "configuracoes-parametros-tipo-processo"],
                    <TipoProcesso />,
                  )}
                />
                <Route
                  path="/configuracoes/parametros/tipo-evento"
                  element={withModule(
                    ["configuracoes-parametros", "configuracoes-parametros-tipo-evento"],
                    <TipoEvento />,
                  )}
                />
                <Route
                  path="/configuracoes/parametros/tipo-documento"
                  element={withModule(
                    ["configuracoes-parametros", "configuracoes-parametros-tipos-documento"],
                    <TipoDocumento />,
                  )}
                />
                <Route
                  path="/configuracoes/parametros/perfis"
                  element={withModule(
                    ["configuracoes-parametros", "configuracoes-parametros-perfis"],
                    <Perfis />,
                  )}
                />
                <Route
                  path="/configuracoes/parametros/setores"
                  element={withModule(
                    ["configuracoes-parametros", "configuracoes-parametros-escritorios"],
                    <Setores />,
                  )}
                />
                <Route
                  path="/configuracoes/parametros/escritorios"
                  element={withModule(
                    ["configuracoes-parametros", "configuracoes-parametros-escritorios"],
                    <Navigate to="/configuracoes/parametros/setores" replace />,
                  )}
                />
                <Route
                  path="/configuracoes/parametros/situacao-proposta"
                  element={withModule(
                    ["configuracoes-parametros", "configuracoes-parametros-situacao-proposta"],
                    <SituacaoProposta />,
                  )}
                />
                <Route
                  path="/configuracoes/parametros/etiquetas"
                  element={withModule(
                    ["configuracoes-parametros", "configuracoes-parametros-etiquetas"],
                    <Etiquetas />,
                  )}
                />
                <Route
                  path="/configuracoes/parametros/fluxo-de-trabalho"
                  element={withModule(
                    ["configuracoes-parametros", "configuracoes-parametros-fluxo-trabalho"],
                    <FluxoTrabalho />,
                  )}
                />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Route>
              <Route
                path={`${routes.admin.root}/*`}
                element={(
                  <ProtectedRoute>
                    <RequireAdminUser>
                      <Suspense fallback={<AdminAreaFallback />}>
                        <AdminLayout />
                      </Suspense>
                    </RequireAdminUser>
                  </ProtectedRoute>

                )}
              >
                <Route index element={<AdminDashboard />} />
                <Route path={adminRelativePath.companies} element={<AdminCompanies />} />
                <Route path={adminRelativePath.companyDetails} element={<AdminCompanyDetails />} />
                <Route path={adminRelativePath.editCompany} element={<AdminEditCompany />} />
                <Route path={adminRelativePath.newCompany} element={<AdminNewCompany />} />
                <Route path={adminRelativePath.plans} element={<AdminPlans />} />
                <Route path={adminRelativePath.newPlan} element={<AdminNewPlan />} />
                <Route path={adminRelativePath.subscriptions} element={<AdminSubscriptions />} />
                <Route path={adminRelativePath.newSubscription} element={<AdminNewSubscription />} />
                <Route path={adminRelativePath.users} element={<AdminUsers />} />
                <Route path={adminRelativePath.newUser} element={<AdminNewUser />} />
                <Route path={adminRelativePath.blog} element={<AdminBlogPosts />} />
                <Route path={adminRelativePath.analytics} element={<AdminAnalytics />} />
                <Route path={adminRelativePath.support} element={<AdminSupport />} />
                <Route path={adminRelativePath.logs} element={<AdminLogs />} />
                <Route path={adminRelativePath.settings} element={<AdminSettingsLayout />}>
                  <Route index element={<AdminSettingsOverview />} />
                  <Route
                    path="parametros/categorias"
                    element={<AdminSettingsCategories />}
                  />
                </Route>
                <Route path="*" element={<AdminNotFound />} />
              </Route>
              <Route path="*" element={<SiteNotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

const AdminAreaFallback = () => (
  <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center" role="status" aria-live="polite">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
    <p className="text-sm font-medium text-muted-foreground">Carregando painel administrativo...</p>
  </div>
);

const LandingFallback = () => (
  <div className="relative min-h-screen">
    <Landing />
    <div
      role="status"
      aria-live="polite"
      className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-background/80 backdrop-blur-md cursor-wait"
    >
      <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
      <p className="text-sm font-medium text-muted-foreground">Preparando sua experiência...</p>
    </div>
  </div>
);

export default App;
