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
import Pipeline from "./pages/Pipeline";
import Agenda from "./pages/Agenda";
import Processos from "./pages/Processos";
import AreaAtuacao from "./pages/configuracoes/parametros/AreaAtuacao";
import SituacaoProcesso from "./pages/configuracoes/parametros/SituacaoProcesso";
import TipoEvento from "./pages/configuracoes/parametros/TipoEvento";
import SituacaoCliente from "./pages/configuracoes/parametros/SituacaoCliente";
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
            <Route path="/clientes/:id" element={<VisualizarCliente />} />
            <Route path="/pipeline" element={<Pipeline />} />
            <Route path="/agenda" element={<Agenda />} />
            <Route path="/processos" element={<Processos />} />
            <Route path="/documentos" element={<div className="p-6"><h1 className="text-3xl font-bold">Documentos</h1><p className="text-muted-foreground">Em desenvolvimento</p></div>} />
            <Route path="/relatorios" element={<div className="p-6"><h1 className="text-3xl font-bold">Relatórios</h1><p className="text-muted-foreground">Em desenvolvimento</p></div>} />
              <Route path="/configuracoes" element={<div className="p-6"><h1 className="text-3xl font-bold">Configurações</h1><p className="text-muted-foreground">Em desenvolvimento</p></div>} />
              <Route path="/configuracoes/parametros/area-de-atuacao" element={<AreaAtuacao />} />
              <Route path="/configuracoes/parametros/situacao-processo" element={<SituacaoProcesso />} />
              <Route path="/configuracoes/parametros/tipo-evento" element={<TipoEvento />} />
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
