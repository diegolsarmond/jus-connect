import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { SidebarProvider } from "@/components/ui/sidebar";

export function CRMLayout() {
  const location = useLocation();
  const isConversationsRoute = location.pathname.startsWith("/conversas");
  const mainClassName = `flex-1 min-h-0 bg-background ${
    isConversationsRoute ? "overflow-hidden" : "overflow-auto"
  }`;

  return (
    <SidebarProvider>
      <div className="min-h-screen bg-background flex w-full">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <Header />
          <main className={mainClassName}>
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
