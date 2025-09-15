import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  BadgeCheck,
  Bell,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Gavel,
  Mail,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const intimacoes = [
  {
    id: "1",
    titulo: "Audiência de conciliação designada",
    tipo: "Audiência",
    cliente: "Maria Ferreira",
    processo: "1002345-67.2023.8.26.0100",
    orgao: "TJSP · 12ª Vara Cível Central",
    prazo: "Hoje às 16:00",
    recebidaHa: "há 2 horas",
    status: "urgente",
    descricao: "Confirmar presença da cliente e preparar a defesa prévia.",
  },
  {
    id: "2",
    titulo: "Despacho solicitando manifestação",
    tipo: "Despacho",
    cliente: "João Pedro",
    processo: "0809987-45.2022.8.19.0001",
    orgao: "TJRJ · 3ª Vara de Família",
    prazo: "Em 2 dias",
    recebidaHa: "há 5 horas",
    status: "prazo",
    descricao: "Manifestar sobre proposta de acordo apresentada pela parte contrária.",
  },
  {
    id: "3",
    titulo: "Publicação de sentença",
    tipo: "Publicação",
    cliente: "Construtora Delta",
    processo: "0004456-12.2021.5.02.0040",
    orgao: "TRT 2ª Região · 8ª Vara do Trabalho",
    prazo: "Em 10 dias",
    recebidaHa: "ontem",
    status: "pendente",
    descricao: "Avaliar possibilidade de recurso e comunicar cliente.",
  },
  {
    id: "4",
    titulo: "Prazo para apresentação de documentos",
    tipo: "Prazo processual",
    cliente: "Ana Souza",
    processo: "5003344-21.2020.4.03.6100",
    orgao: "TRF3 · 2ª Turma",
    prazo: "Em 5 dias",
    recebidaHa: "há 3 dias",
    status: "respondida",
    descricao: "Documentação enviada via PJe e protocolo confirmado.",
  },
] as const;

type Intimacao = (typeof intimacoes)[number];
type IntimacaoStatus = Intimacao["status"];
type IntimacaoTipo = Intimacao["tipo"];

const statusConfig: Record<
  IntimacaoStatus,
  { label: string; icon: LucideIcon; className: string }
> = {
  urgente: {
    label: "Urgente",
    icon: AlertTriangle,
    className:
      "bg-destructive/10 text-destructive border-destructive/20 dark:bg-destructive/20 dark:text-destructive",
  },
  prazo: {
    label: "Prazo próximo",
    icon: Clock,
    className: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/20 dark:text-amber-200",
  },
  pendente: {
    label: "Pendente",
    icon: Clock,
    className: "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-500/20 dark:text-sky-200",
  },
  respondida: {
    label: "Respondida",
    icon: CheckCircle2,
    className:
      "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-200",
  },
};

const tipoConfig: Record<IntimacaoTipo, { icon: LucideIcon; className: string }> = {
  Audiência: {
    icon: Gavel,
    className:
      "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200",
  },
  Despacho: {
    icon: FileText,
    className:
      "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200",
  },
  Publicação: {
    icon: Mail,
    className:
      "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-200",
  },
  "Prazo processual": {
    icon: BadgeCheck,
    className:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
  },
};

export function IntimacaoMenu() {
  const pendentes = intimacoes.filter((item) => item.status !== "respondida").length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {pendentes > 0 ? (
            <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground shadow-sm">
              {pendentes}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] p-0" align="end">
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Intimações</p>
              <p className="text-xs text-muted-foreground">
                Acompanhe publicações e prazos mais recentes.
              </p>
            </div>
            <Badge variant="outline" className="rounded-full px-2 text-xs font-medium">
              {pendentes} pendente{pendentes === 1 ? "" : "s"}
            </Badge>
          </div>
        </div>
        <ScrollArea className="max-h-80">
          <ul className="divide-y divide-border">
            {intimacoes.map((intimacao) => {
              const status = statusConfig[intimacao.status];
              const tipo = tipoConfig[intimacao.tipo];
              const TipoIcon = tipo.icon;
              const StatusIcon = status.icon;

              return (
                <li key={intimacao.id}>
                  <button
                    type="button"
                    className="flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 focus:bg-muted/60 focus:outline-none"
                  >
                    <span
                      className={cn(
                        "mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm",
                        tipo.className
                      )}
                    >
                      <TipoIcon className="h-5 w-5" />
                    </span>
                    <span className="flex-1 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold leading-tight">
                          {intimacao.titulo}
                        </p>
                        <Badge
                          variant="outline"
                          className={cn(
                            "flex items-center gap-1 rounded-full px-2 text-[11px] font-medium",
                            status.className
                          )}
                        >
                          <StatusIcon className="h-3.5 w-3.5" />
                          {status.label}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <p className="leading-snug">
                          Processo {intimacao.processo} · {intimacao.orgao}
                        </p>
                        <p className="leading-snug">Cliente: {intimacao.cliente}</p>
                        <p className="mt-1 leading-relaxed text-foreground">
                          {intimacao.descricao}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          Prazo {intimacao.prazo}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          Recebida {intimacao.recebidaHa}
                        </span>
                      </div>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </ScrollArea>
        <div className="border-t border-border bg-muted/40 px-3 py-2">
          <Button variant="ghost" className="w-full justify-between text-sm font-medium">
            Ver todas as intimações
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
