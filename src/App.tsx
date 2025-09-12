import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CRMLayout } from "@/components/layout/CRMLayout";
import Dashboard from "./pages/Dashboard";
import Clientes from "./pages/Clientes";
import NovoCliente from "./pages/NovoCliente";
import VisualizarCliente from "./pages/VisualizarCliente";
import NovoProcesso from "./pages/NovoProcesso";
import VisualizarProcesso from "./pages/VisualizarProcesso";
import ContratoPreview from "./pages/ContratoPreview";
import Pipeline from "./pages/Pipeline";
import Agenda from "./pages/Agenda";
import Processos from "./pages/Processos";
import AreaAtuacao from "./pages/configuracoes/parametros/AreaAtuacao";
import SituacaoProcesso from "./pages/configuracoes/parametros/SituacaoProcesso";
import TipoEvento from "./pages/configuracoes/parametros/TipoEvento";
import Perfis from "./pages/configuracoes/parametros/Perfis";
import SituacaoCliente from "./pages/configuracoes/parametros/SituacaoCliente";
import Escritorios from "./pages/configuracoes/parametros/Escritorios";
import Usuarios from "./pages/configuracoes/usuarios/Usuarios";
import NovoUsuario from "./pages/configuracoes/usuarios/NovoUsuario";
import PerfilUsuario from "./pages/configuracoes/usuarios/PerfilUsuario";
import EditarPerfil from "./pages/configuracoes/usuarios/EditarPerfil";
import AlterarSenha from "./pages/configuracoes/usuarios/AlterarSenha";
import ConfiguracaoSeguranca from "./pages/configuracoes/usuarios/ConfiguracaoSeguranca";
import SessaoDispositivos from "./pages/configuracoes/usuarios/SessaoDispositivos";
import PrivacidadeLGPD from "./pages/configuracoes/usuarios/PrivacidadeLGPD";
import NotificacoesPreferencias from "./pages/configuracoes/usuarios/NotificacoesPreferencias";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <CRMLayout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/clientes" element={<Clientes />} />
            <Route path="/clientes/novo" element={<NovoCliente />} />
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
            <Route path="/pipeline" element={<Pipeline />} />
            <Route path="/agenda" element={<Agenda />} />
            <Route path="/processos" element={<Processos />} />
            <Route path="/documentos" element={<div className="p-6"><h1 className="text-3xl font-bold">Documentos</h1><p className="text-muted-foreground">Em desenvolvimento</p></div>} />
            <Route path="/relatorios" element={<div className="p-6"><h1 className="text-3xl font-bold">Relatórios</h1><p className="text-muted-foreground">Em desenvolvimento</p></div>} />
              <Route path="/configuracoes" element={<div className="p-6"><h1 className="text-3xl font-bold">Configurações</h1><p className="text-muted-foreground">Em desenvolvimento</p></div>} />
              <Route path="/configuracoes/usuarios" element={<Usuarios />} />
              <Route path="/configuracoes/usuarios/novo" element={<NovoUsuario />} />
              <Route path="/configuracoes/usuarios/:id" element={<PerfilUsuario />} />
              <Route path="/configuracoes/usuarios/:id/editar" element={<EditarPerfil />} />
              <Route path="/configuracoes/usuarios/:id/senha" element={<AlterarSenha />} />
              <Route path="/configuracoes/usuarios/:id/seguranca" element={<ConfiguracaoSeguranca />} />
              <Route path="/configuracoes/usuarios/:id/sessoes" element={<SessaoDispositivos />} />
              <Route path="/configuracoes/usuarios/:id/privacidade" element={<PrivacidadeLGPD />} />
              <Route path="/configuracoes/usuarios/:id/notificacoes" element={<NotificacoesPreferencias />} />
              <Route path="/configuracoes/parametros/area-de-atuacao" element={<AreaAtuacao />} />
              <Route path="/configuracoes/parametros/situacao-processo" element={<SituacaoProcesso />} />
              <Route path="/configuracoes/parametros/tipo-evento" element={<TipoEvento />} />
              <Route path="/configuracoes/parametros/perfis" element={<Perfis />} />
              <Route path="/configuracoes/parametros/escritorios" element={<Escritorios />} />
              <Route path="/configuracoes/parametros/situacao-cliente" element={<SituacaoCliente />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </CRMLayout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
