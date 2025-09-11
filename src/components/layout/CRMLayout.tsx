import { ReactNode } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";

interface CRMLayoutProps {
  children: ReactNode;
}

export function CRMLayout({ children }: CRMLayoutProps) {
  return (
    <div className="min-h-screen bg-background flex w-full">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}