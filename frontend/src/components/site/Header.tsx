import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";

import quantumLogo from "@/assets/quantum-logo.png";
import { routes } from "@/config/routes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type HeaderNavItem = {
  label: string;
  href?: string;
  children?: HeaderNavItem[];
};

const NAV_ITEMS: HeaderNavItem[] = [
  { label: "Início", href: "#hero" },
  { label: "Serviços", href: "#servicos" },
  {
    label: "Nossos Produtos",
    children: [
      { label: "CRMs", href: "#crm" },
      { label: "Assistentes Virtuais", href: "/servicos/assistente-ia" },
    ],
  },
  { label: "Sobre", href: "#sobre" },
  { label: "Blog", href: "#blog" },
  { label: "Contato", href: "#contato" },
];

const Header = () => {
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => setIsMenuOpen((previous) => !previous);
  const closeMenu = () => setIsMenuOpen(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/50">
      <div className="container flex h-16 items-center justify-between gap-6 px-4">
        <Link to="/" className="flex items-center gap-3" onClick={closeMenu}>
          <img src={quantumLogo} alt="Quantum Tecnologia" className="h-8 w-8" />
          <span className="font-semibold tracking-tight text-lg text-foreground">Quantum Tecnologia</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Navegação principal">
          {NAV_ITEMS.map((item) =>
            item.children && item.children.length > 0 ? (
              <div key={item.label} className="group relative">
                <button
                  type="button"
                  className="flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                  aria-haspopup="menu"
                  aria-expanded="false"
                >
                  {item.label}
                </button>
                <div className="invisible absolute left-0 top-full z-50 mt-2 min-w-[12rem] rounded-md border border-border/40 bg-background/95 p-1 text-sm opacity-0 shadow-lg transition duration-150 ease-in-out group-hover:visible group-hover:opacity-100">
                  {item.children.map((child) => (
                    <a
                      key={child.label}
                      href={child.href}
                      className="block rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      {child.label}
                    </a>
                  ))}
                </div>
              </div>
            ) : item.href ? (
              <a
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
                  location.pathname === "/" && location.hash === item.href && "text-foreground",
                )}
              >
                {item.label}
              </a>
            ) : null,
          )}
        </nav>

        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" className="hidden text-sm font-medium text-muted-foreground hover:text-foreground md:inline-flex">
            <Link to="#contato">Falar com especialista</Link>
          </Button>
          <Button asChild className="text-sm font-semibold">
            <Link to={routes.login}>Entrar</Link>
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="inline-flex items-center justify-center md:hidden"
            onClick={toggleMenu}
            aria-expanded={isMenuOpen}
            aria-controls="mobile-menu"
            aria-label="Alternar menu"
          >
            {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {isMenuOpen ? (
        <div id="mobile-menu" className="border-t border-border/40 bg-background/95 backdrop-blur md:hidden">
          <div className="container flex flex-col gap-2 px-4 py-3">
            {NAV_ITEMS.map((item) =>
              item.children && item.children.length > 0 ? (
                <div key={item.label} className="flex flex-col gap-1">
                  <span className="px-3 py-2 text-sm font-semibold text-foreground">{item.label}</span>
                  {item.children.map((child) => (
                    <a
                      key={child.label}
                      href={child.href}
                      className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted"
                      onClick={closeMenu}
                    >
                      {child.label}
                    </a>
                  ))}
                </div>
              ) : item.href ? (
                <a
                  key={item.href}
                  href={item.href}
                  className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted"
                  onClick={closeMenu}
                >
                  {item.label}
                </a>
              ) : null,
            )}
            <Button asChild className="mt-2" onClick={closeMenu}>
              <Link to={routes.login}>Entrar</Link>
            </Button>
          </div>
        </div>
      ) : null}
    </header>
  );
};

export default Header;
