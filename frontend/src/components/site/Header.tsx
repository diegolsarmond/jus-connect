import { useEffect, useRef, useState } from "react";
import { Link, type To, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";

import quantumLogo from "@/assets/quantum-logo.png";
import { routes } from "@/config/routes";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";

type HeaderNavItem = {
  label: string;
  href?: string;
  children?: HeaderNavItem[];
};

const NAV_ITEMS: HeaderNavItem[] = [
  { label: "Início", href: routes.home },
  { label: "Serviços", href: routes.services },
  {
    label: "Nossos Produtos",
    children: [
      { label: "Suíte de CRM", href: routes.serviceCRM },
      { label: "CRM para Advocacia", href: routes.serviceCRMAdvocacia },
      { label: "Assistentes Virtuais com IA", href: routes.serviceAssistenteIA },
      { label: "Automações Inteligentes", href: routes.serviceAutomacoes },
      { label: "Desenvolvimento Sob Medida", href: routes.serviceDesenvolvimento },
    ],
  },
  { label: "Sobre", href: routes.history },
  { label: "Blog", href: routes.blog },
  { label: "Contato", href: "#contato" },
];

const resolveNavLink = (href: string): To =>
  href.startsWith("#") ? { pathname: routes.home, hash: href } : href;

const isNavItemActive = (href: string | undefined, currentPath: string, currentHash: string) => {
  if (!href) {
    return false;
  }

  if (href.startsWith("http")) {
    return false;
  }

  if (href.startsWith("#")) {
    return currentPath === routes.home && currentHash === href;
  }

  if (href === routes.home) {
    return currentPath === routes.home && currentHash === "";
  }

  if (href.startsWith("/")) {
    return currentPath === href || currentPath.startsWith(`${href}/`);
  }

  return currentPath === href;
};

const formatHref = (to: To): string | undefined => {
  if (typeof to === "string") {
    return to;
  }

  if (typeof to === "object" && to !== null) {
    const { pathname = "", search = "", hash = "" } = to as {
      pathname?: string;
      search?: string;
      hash?: string;
    };

    const combined = `${pathname}${search}${hash}`;
    return combined || undefined;
  }

  return undefined;
};

const trackNavigation = (label: string, href: string | undefined, context: string) => {
  trackEvent("nav_link_click", {
    label,
    href,
    context,
  });
};

const Header = () => {
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toggleMenu = () => setIsMenuOpen((previous) => !previous);
  const closeMenu = () => setIsMenuOpen(false);

  const clearCloseTimeout = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  };

  const openDropdown = (label: string) => {
    clearCloseTimeout();
    setActiveDropdown(label);
  };

  const scheduleCloseDropdown = () => {
    clearCloseTimeout();
    closeTimeoutRef.current = setTimeout(() => {
      setActiveDropdown(null);
      closeTimeoutRef.current = null;
    }, 200);
  };

  useEffect(() => {
    return () => {
      clearCloseTimeout();
    };
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/50">
      <div className="container flex h-16 items-center justify-between gap-6 px-4">
        <Link
          to={routes.home}
          className="flex items-center gap-3"
          onClick={() => {
            trackNavigation("Logo", routes.home, "desktop");
            closeMenu();
          }}
        >
          <img src={quantumLogo} alt="Quantum Tecnologia" className="h-8 w-8" />
          <span className="font-semibold tracking-tight text-lg text-foreground">Quantum Tecnologia</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Navegação principal">
          {NAV_ITEMS.map((item) => {
            if (item.children && item.children.length > 0) {
              const isDropdownActive = item.children.some((child) =>
                isNavItemActive(child.href, location.pathname, location.hash),
              );

              return (
                <div
                  key={item.label}
                  className="relative"
                  onMouseEnter={() => openDropdown(item.label)}
                  onMouseLeave={scheduleCloseDropdown}
                  onFocus={() => openDropdown(item.label)}
                  onBlur={(event) => {
                    const nextTarget = event.relatedTarget as Node | null;
                    if (!nextTarget || !event.currentTarget.contains(nextTarget)) {
                      scheduleCloseDropdown();
                    }
                  }}
                >
                  <button
                    type="button"
                    className={cn(
                      "flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
                      isDropdownActive && "text-foreground",
                    )}
                    aria-haspopup="menu"
                    aria-expanded={activeDropdown === item.label}
                  >
                    {item.label}
                  </button>
                  <div
                    className={cn(
                      "pointer-events-auto absolute left-0 top-full z-50 mt-2 min-w-[12rem] rounded-md border border-border/40 bg-background/95 p-1 text-sm shadow-lg transition duration-150 ease-in-out",
                      activeDropdown === item.label
                        ? "visible translate-y-0 opacity-100"
                        : "invisible translate-y-1 opacity-0",
                    )}
                    role="menu"
                    aria-hidden={activeDropdown !== item.label}
                  >
                    {item.children.map((child) =>
                      child.href ? (
                        <Link
                          key={child.href ?? child.label}
                          to={resolveNavLink(child.href)}
                          className="block rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          onFocus={() => openDropdown(item.label)}
                          onClick={() =>
                            trackNavigation(
                              child.label,
                              child.href,
                              "desktop-dropdown",
                            )
                          }
                        >
                          {child.label}
                        </Link>
                      ) : null,
                    )}
                  </div>
                </div>
              );
            }

            if (item.href) {
              const resolvedHref = resolveNavLink(item.href);

              return (
                <Link
                  key={item.href ?? item.label}
                  to={resolvedHref}
                  className={cn(
                    "rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
                    isNavItemActive(item.href, location.pathname, location.hash) && "text-foreground",
                  )}
                  onClick={() =>
                    trackNavigation(
                      item.label,
                      formatHref(resolvedHref),
                      "desktop",
                    )
                  }
                >
                  {item.label}
                </Link>
              );
            }

            return null;
          })}
        </nav>

        <div className="flex items-center gap-3">
          <ModeToggle />
          <Button
            asChild
            variant="ghost"
            className="hidden text-sm font-medium text-muted-foreground hover:text-foreground md:inline-flex"
          >
            <Link
              to={{ pathname: routes.home, hash: "#contato" }}
              onClick={() =>
                trackNavigation(
                  "Falar com especialista",
                  `${routes.home}#contato`,
                  "desktop-cta",
                )
              }
            >
              Falar com especialista
            </Link>
          </Button>
          <Button asChild className="text-sm font-semibold">
            <Link
              to={routes.login}
              onClick={() => trackNavigation("Entrar", routes.login, "desktop-cta")}
            >
              Entrar
            </Link>
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
          <div className="container flex flex-col gap-3 px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Tema</span>
              <ModeToggle />
            </div>
            {NAV_ITEMS.map((item) =>
              item.children && item.children.length > 0 ? (
                <div key={item.label} className="flex flex-col gap-1">
                  <span className="px-3 py-2 text-sm font-semibold text-foreground">{item.label}</span>
                  {item.children.map((child) =>
                    child.href ? (
                      <Link
                        key={child.label}
                        to={resolveNavLink(child.href)}
                        className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted"
                        onClick={() => {
                          trackNavigation(child.label, child.href, "mobile-dropdown");
                          closeMenu();
                        }}
                      >
                        {child.label}
                      </Link>
                    ) : null,
                  )}
                </div>
              ) : item.href ? (
                <Link
                  key={item.href}
                  to={resolveNavLink(item.href)}
                  className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted"
                  onClick={() => {
                    trackNavigation(
                      item.label,
                      item.href,
                      "mobile",
                    );
                    closeMenu();
                  }}
                >
                  {item.label}
                </Link>
              ) : null,
            )}
            <Button asChild className="mt-2" onClick={closeMenu}>
              <Link
                to={routes.login}
                onClick={() => trackNavigation("Entrar", routes.login, "mobile-cta")}
              >
                Entrar
              </Link>
            </Button>
          </div>
        </div>
      ) : null}
    </header>
  );
};

export default Header;
