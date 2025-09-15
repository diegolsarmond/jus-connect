import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CRMLayout } from "@/components/layout/CRMLayout";
import Dashboard from "./pages/Dashboard";
import Clientes from "./pages/Clientes";
import NovoCliente from "./pages/NovoCliente";
import EditarCliente from "./pages/EditarCliente";
import VisualizarCliente from "./pages/VisualizarCliente";
import NovoProcesso from "./pages/NovoProcesso";
import VisualizarProcesso from "./pages/VisualizarProcesso";
import ContratoPreview from "./pages/ContratoPreview";
import Pipeline from "./pages/Pipeline";
import PipelineMenu from "./pages/PipelineMenu";
import NovaOportunidade from "./pages/NovaOportunidade";
import VisualizarOportunidade from "./pages/VisualizarOportunidade";
import EditarOportunidade from "./pages/EditarOportunidade";
import Agenda from "./pages/Agenda";
import Tarefas from "./pages/Tarefas";
import Processos from "./pages/Processos";
import DocumentTemplates from "./pages/DocumentTemplates";
import TemplateEditor from "./pages/TemplateEditor";
import FinancialFlows from "./pages/FinancialFlows";
import Relatorios from "./pages/Relatorios";
import MeuPerfil from "./pages/MeuPerfil";
import MeuPlano from "./pages/MeuPlano";
import Suporte from "./pages/Suporte";
import Conversas from "./pages/Conversas";
import AreaAtuacao from "./pages/configuracoes/parametros/AreaAtuacao";
import SituacaoProcesso from "./pages/configuracoes/parametros/SituacaoProcesso";
import TipoProcesso from "./pages/configuracoes/parametros/TipoProcesso";
import TipoEvento from "./pages/configuracoes/parametros/TipoEvento";
import TipoDocumento from "./pages/configuracoes/parametros/TipoDocumento";
import Perfis from "./pages/configuracoes/parametros/Perfis";
import SituacaoCliente from "./pages/configuracoes/parametros/SituacaoCliente";
import Escritorios from "./pages/configuracoes/parametros/Escritorios";
import Etiquetas from "./pages/configuracoes/parametros/Etiquetas";
import FluxoTrabalho from "./pages/configuracoes/parametros/FluxoTrabalho";
import Empresas from "./pages/configuracoes/Empresas";
import Planos from "./pages/configuracoes/Planos";
import Usuarios from "./pages/configuracoes/usuarios/Usuarios";
import NovoUsuario from "./pages/configuracoes/usuarios/NovoUsuario";
import NovaEmpresa from "./pages/configuracoes/NovaEmpresa";
import PerfilUsuario from "./pages/configuracoes/usuarios/PerfilUsuario";
import EditarPerfil from "./pages/configuracoes/usuarios/EditarPerfil";
import AlterarSenha from "./pages/configuracoes/usuarios/AlterarSenha";
import ConfiguracaoSeguranca from "./pages/configuracoes/usuarios/ConfiguracaoSeguranca";
import SessaoDispositivos from "./pages/configuracoes/usuarios/SessaoDispositivos";
import PrivacidadeLGPD from "./pages/configuracoes/usuarios/PrivacidadeLGPD";
import NotificacoesPreferencias from "./pages/configuracoes/usuarios/NotificacoesPreferencias";
import Login from "./pages/Login";
import RecuperarSenha from "./pages/RecuperarSenha";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/recuperar-senha" element={<RecuperarSenha />} />
          <Route element={<CRMLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/conversas" element={<Conversas />} />
            <Route path="/clientes" element={<Clientes />} />
            <Route path="/clientes/novo" element={<NovoCliente />} />
            <Route path="/clientes/:id/editar" element={<EditarCliente />} />
            <Route path="/clientes/:id/novo-processo" element={<NovoProcesso />} />
            <Route
              path="/clientes/:id/processos/:processoId"
              element={<VisualizarProcesso />}
            />
            <Route
              path="/clientes/:id/processos/:processoId/contrato"
              element={<ContratoPreview />}
            />
            <Route path="/clientes/:id" element={<VisualizarCliente />} />
            <Route path="/pipeline" element={<PipelineMenu />} />
            <Route path="/pipeline/:fluxoId" element={<Pipeline />} />
            <Route path="/pipeline/nova-oportunidade" element={<NovaOportunidade />} />
            <Route path="/pipeline/oportunidade/:id" element={<VisualizarOportunidade />} />
            <Route path="/pipeline/editar-oportunidade/:id" element={<EditarOportunidade />} />
            <Route path="/agenda" element={<Agenda />} />
            <Route path="/tarefas" element={<Tarefas />} />
            <Route path="/processos" element={<Processos />} />
            <Route path="/documentos" element={<DocumentTemplates />} />
            <Route path="/documentos/:id" element={<TemplateEditor />} />
            <Route path="/financeiro/lancamentos" element={<FinancialFlows />} />
            <Route path="/relatorios" element={<Relatorios />} />
            <Route path="/meu-perfil" element={<MeuPerfil />} />
            <Route path="/meu-plano" element={<MeuPlano />} />
            <Route path="/suporte" element={<Suporte />} />
            <Route
              path="/configuracoes"
              element={
                <div className="p-6">
                  <h1 className="text-3xl font-bold">Configurações</h1>
                  <p className="text-muted-foreground">Em desenvolvimento</p>
                </div>
              }
            />
            <Route path="/configuracoes/usuarios" element={<Usuarios />} />
            <Route path="/configuracoes/empresas" element={<Empresas />} />
            <Route path="/configuracoes/empresas/nova" element={<NovaEmpresa />} />
            <Route path="/configuracoes/planos" element={<Planos />} />
            <Route path="/configuracoes/usuarios/novo" element={<NovoUsuario />} />
            <Route path="/configuracoes/usuarios/:id" element={<PerfilUsuario />} />
            <Route path="/configuracoes/usuarios/:id/editar" element={<EditarPerfil />} />
            <Route path="/configuracoes/usuarios/:id/senha" element={<AlterarSenha />} />
            <Route
              path="/configuracoes/usuarios/:id/seguranca"
              element={<ConfiguracaoSeguranca />}
            />
            <Route
              path="/configuracoes/usuarios/:id/sessoes"
              element={<SessaoDispositivos />}
            />
            <Route
              path="/configuracoes/usuarios/:id/privacidade"
              element={<PrivacidadeLGPD />}
            />
            <Route
              path="/configuracoes/usuarios/:id/notificacoes"
              element={<NotificacoesPreferencias />}
            />
            <Route
              path="/configuracoes/parametros/area-de-atuacao"
              element={<AreaAtuacao />}
            />
            <Route
              path="/configuracoes/parametros/situacao-processo"
              element={<SituacaoProcesso />}
            />
            <Route
              path="/configuracoes/parametros/tipo-processo"
              element={<TipoProcesso />}
            />
            <Route
              path="/configuracoes/parametros/tipo-evento"
              element={<TipoEvento />}
            />
            <Route
              path="/configuracoes/parametros/tipo-documento"
              element={<TipoDocumento />}
            />
            <Route path="/configuracoes/parametros/perfis" element={<Perfis />} />
            <Route
              path="/configuracoes/parametros/escritorios"
              element={<Escritorios />}
            />
            <Route
              path="/configuracoes/parametros/situacao-cliente"
              element={<SituacaoCliente />}
            />
            <Route path="/configuracoes/parametros/etiquetas" element={<Etiquetas />} />
            <Route
              path="/configuracoes/parametros/fluxo-de-trabalho"
              element={<FluxoTrabalho />}
            />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
