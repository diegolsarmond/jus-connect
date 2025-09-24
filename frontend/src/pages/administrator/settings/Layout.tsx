import { NavLink, Outlet } from "react-router-dom";
import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

type NavSection = {
  title: string;
  items: Array<{
    label: string;
    to: string;
    description?: ReactNode;
    end?: boolean;
  }>;
};

const sections: NavSection[] = [
  {
    title: "Geral",
    items: [
      {
        label: "Visão Geral",
        to: ".",
        description: "Configurações principais do painel",
        end: true,
      },
    ],
  },
  {
    title: "Parâmetros",
    items: [
      {
        label: "Categorias",
        to: "parametros/categorias",
        description: "Gerencie as categorias utilizadas no sistema",
      },
    ],
  },
];

export default function AdminSettingsLayout() {
  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <aside className="w-full max-w-xs shrink-0 space-y-6 lg:sticky lg:top-24">
        {sections.map((section) => (
          <nav key={section.title} aria-label={section.title} className="space-y-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {section.title}
              </p>
            </div>
            <ul className="space-y-1">
              {section.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      cn(
                        "block rounded-md border border-transparent px-3 py-2 text-sm transition-colors",
                        "hover:border-border hover:bg-muted",
                        isActive
                          ? "border-primary/60 bg-primary/5 text-primary"
                          : "text-muted-foreground",
                      )
                    }
                  >
                    <div className="space-y-0.5">
                      <span className="font-medium text-foreground">{item.label}</span>
                      {item.description ? (
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                      ) : null}
                    </div>
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </aside>

      <div className="flex-1">
        <Outlet />
      </div>
    </div>
  );
}

