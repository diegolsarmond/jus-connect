import { Link } from "react-router-dom";
import { Github, Linkedin, Mail } from "lucide-react";

import quantumLogo from "@/assets/quantum-logo.png";
import { routes } from "@/config/routes";

const currentYear = new Date().getFullYear();

const Footer = () => {
  return (
    <footer className="border-t border-border/40 bg-background/80">
      <div className="container grid gap-8 px-4 py-12 md:grid-cols-[1.5fr_1fr_1fr]">
        <div className="space-y-4">
          <Link to="/" className="flex items-center gap-3">
            <img src={quantumLogo} alt="Quantum Tecnologia" className="h-10 w-10" />
            <span className="text-lg font-semibold text-foreground">Quantum Tecnologia</span>
          </Link>
          <p className="max-w-sm text-sm text-muted-foreground">
            Soluções digitais completas com foco em resultados para equipes jurídicas, financeiras e operacionais.
          </p>
          <div className="flex items-center gap-3">
            <a
              href="https://www.linkedin.com/company/quantumtecnologia/"
              target="_blank"
              rel="noreferrer"
              className="text-muted-foreground transition hover:text-foreground"
              aria-label="LinkedIn"
            >
              <Linkedin className="h-5 w-5" />
            </a>
            <a
              href="https://github.com/quantumtecnologia"
              target="_blank"
              rel="noreferrer"
              className="text-muted-foreground transition hover:text-foreground"
              aria-label="GitHub"
            >
              <Github className="h-5 w-5" />
            </a>
            <a
              href="mailto:contato@quantumtecnologia.com"
              className="text-muted-foreground transition hover:text-foreground"
              aria-label="Enviar email"
            >
              <Mail className="h-5 w-5" />
            </a>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-foreground">Plataforma</h3>
          <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
            <li>
              <Link to={routes.login} className="transition hover:text-foreground">
                Entrar na plataforma
              </Link>
            </li>
            <li>
              <Link to="/meu-plano" className="transition hover:text-foreground">
                Meu plano
              </Link>
            </li>
            <li>
              <Link to="/suporte" className="transition hover:text-foreground">
                Suporte
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-foreground">Empresa</h3>
          <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
            <li>
              <Link to="/#servicos" className="transition hover:text-foreground">
                Serviços
              </Link>
            </li>
            <li>
              <Link to="/#sobre" className="transition hover:text-foreground">
                Quem somos
              </Link>
            </li>
            <li>
              <Link to="/#contato" className="transition hover:text-foreground">
                Contato
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-border/40 bg-background/60">
        <div className="container flex flex-col items-center justify-between gap-3 px-4 py-4 text-center text-xs text-muted-foreground md:flex-row">
          <span>&copy; {currentYear} Quantum Tecnologia. Todos os direitos reservados.</span>
          <div className="flex gap-4">
            <a href="/politica-de-privacidade" className="transition hover:text-foreground">
              Política de privacidade
            </a>
            <a href="/termos-de-uso" className="transition hover:text-foreground">
              Termos de uso
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
