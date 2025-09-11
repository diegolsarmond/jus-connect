import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CRMLayout } from "@/components/layout/CRMLayout";
import Dashboard from "./pages/Dashboard";
import Clientes from "./pages/Clientes";
import NovoCliente from "./pages/NovoCliente";
import Pipeline from "./pages/Pipeline";
import Agenda from "./pages/Agenda";
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
            <Route path="/pipeline" element={<Pipeline />} />
            <Route path="/agenda" element={<Agenda />} />
            <Route path="/documentos" element={<div className="p-6"><h1 className="text-3xl font-bold">Documentos</h1><p className="text-muted-foreground">Em desenvolvimento</p></div>} />
            <Route path="/relatorios" element={<div className="p-6"><h1 className="text-3xl font-bold">Relatórios</h1><p className="text-muted-foreground">Em desenvolvimento</p></div>} />
            <Route path="/configuracoes" element={<div className="p-6"><h1 className="text-3xl font-bold">Configurações</h1><p className="text-muted-foreground">Em desenvolvimento</p></div>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </CRMLayout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
