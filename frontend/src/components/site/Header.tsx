import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";

import quantumLogo from "@/assets/quantum-logo.png";
import { routes } from "@/config/routes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type HeaderNavItem = {
  label: string;
  href: string;
};

const NAV_ITEMS: HeaderNavItem[] = [
  { label: "Início", href: "#hero" },
  { label: "Serviços", href: "#servicos" },
  { label: "CRM", href: "#crm" },
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
          {NAV_ITEMS.map((item) => (
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
          ))}
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
            {NAV_ITEMS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted"
                onClick={closeMenu}
              >
                {item.label}
              </a>
            ))}
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
