import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { HeaderActions } from "@/components/layout/HeaderActions";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function Header() {
  return (
    <header className="h-16 bg-card border-b border-border px-6 flex items-center justify-between gap-4">
      {/* Search */}
      <div className="flex flex-1 items-center gap-3">
        <SidebarTrigger className="text-muted-foreground" />
        <div className="flex-1 max-w-md">
          <div className="relative">
            {/*<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />*/}
            {/*<Input*/}
            {/*  placeholder="Pesquisar clientes, processos..."*/}
            {/*  className="pl-9 bg-muted/50"*/}
            {/*/>*/}
          </div>
        </div>
      </div>

      {/* Actions */}
      <HeaderActions />
    </header>
  );
}
