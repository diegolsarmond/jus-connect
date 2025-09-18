import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { SidebarProvider } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

export function CRMLayout() {
  const location = useLocation();
  const isConversationsRoute = location.pathname.startsWith("/conversas");
  const rootClassName = cn(
    "flex w-full",
    isConversationsRoute ? "h-dvh overflow-hidden" : "min-h-screen bg-background",
  );
  const containerClassName = cn(
    "flex-1 flex min-h-0 flex-col",
    isConversationsRoute && "h-full",
  );
  const mainClassName = cn(
    "flex-1 flex flex-col min-h-0",
    isConversationsRoute ? "h-full overflow-hidden" : "overflow-auto",
  );

  return (
    <SidebarProvider>
      <div className={rootClassName}>
        <Sidebar />
        <div className={containerClassName}>
          <Header />
          <main className={mainClassName}>
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
