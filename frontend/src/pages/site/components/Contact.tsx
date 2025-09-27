import { Mail, MessageCircle, Phone } from "lucide-react";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ContactChannel {
  title: string;
  description: string;
  icon: typeof Mail;
  actionLabel: string;
  href: string;
}

const Contact = () => {
  const channels = useMemo<ContactChannel[]>(
    () => [
      {
        title: "Fale pelo WhatsApp",
        description: "Conecte-se com nosso time para tirar dúvidas ou agendar uma demonstração guiada do Quantum Jud.",
        icon: MessageCircle,
        actionLabel: "Conversar agora",
        href: "https://wa.me/553193054200?text=Ol%C3%A1!%20Quero%20conhecer%20o%20Quantum%20Jud.",
      },
      {
        title: "Envie um e-mail",
        description: "Receba uma proposta personalizada com os módulos e integrações que sua equipe jurídica precisa.",
        icon: Mail,
        actionLabel: "Enviar e-mail",
        href: "mailto:contato@quantumtecnologia.com",
      },
      {
        title: "Converse com especialistas",
        description: "Marque uma reunião para entender como o Quantum Jud pode acelerar seus resultados.",
        icon: Phone,
        actionLabel: "Agendar reunião",
        href: "https://cal.com/quantum/agendamento",
      },
    ],
    [],
  );

  return (
    <section id="contato" className="bg-background">
      <div className="container grid gap-8 px-4 py-20 md:grid-cols-[1.1fr_1fr] md:items-start">
        <div className="space-y-5">
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-primary">
            Vamos conversar
          </span>
          <h2 className="text-3xl font-semibold text-foreground md:text-4xl">
            Pronto para transformar sua gestão jurídica?
          </h2>
          <p className="text-base text-muted-foreground">
            Preencha o formulário ou escolha um canal preferido. Respondemos em até 1 dia útil com um plano aderente à
            maturidade da sua operação.
          </p>
          <div className="space-y-4">
            {channels.map((channel) => (
              <Card key={channel.title} className="border-border/40 bg-background/80">
                <CardHeader className="space-y-2">
                  <div className="flex items-center gap-3">
                    <channel.icon className="h-5 w-5 text-primary" aria-hidden />
                    <CardTitle className="text-lg">{channel.title}</CardTitle>
                  </div>
                  <CardDescription>{channel.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild variant="ghost" className="px-0 text-sm font-semibold text-primary">
                    <a href={channel.href} target={channel.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
                      {channel.actionLabel}
                    </a>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <Card className="border-border/40 bg-background/90 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-xl">Solicite uma apresentação</CardTitle>
            <CardDescription>
              Conte-nos sobre o seu cenário e receberá um diagnóstico gratuito com próximos passos sugeridos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-medium text-foreground" htmlFor="contact-name">
                  Nome completo
                  <input
                    id="contact-name"
                    name="name"
                    type="text"
                    required
                    className="mt-1 w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    placeholder="Como devemos te chamar?"
                  />
                </label>
                <label className="text-sm font-medium text-foreground" htmlFor="contact-email">
                  E-mail corporativo
                  <input
                    id="contact-email"
                    name="email"
                    type="email"
                    required
                    className="mt-1 w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    placeholder="nome@empresa.com"
                  />
                </label>
              </div>
              <label className="text-sm font-medium text-foreground" htmlFor="contact-phone">
                Telefone
                <input
                  id="contact-phone"
                  name="phone"
                  type="tel"
                  required
                  className="mt-1 w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  placeholder="(31) 99305-4200"
                />
              </label>
              <label className="text-sm font-medium text-foreground" htmlFor="contact-company">
                Empresa
                <input
                  id="contact-company"
                  name="company"
                  type="text"
                  required
                  className="mt-1 w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  placeholder="Nome da empresa"
                />
              </label>
              <label className="text-sm font-medium text-foreground" htmlFor="contact-message">
                Como podemos ajudar?
                <textarea
                  id="contact-message"
                  name="message"
                  rows={4}
                  className="mt-1 w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  placeholder="Descreva os desafios, metas e expectativas"
                />
              </label>
              <Button type="submit" className="w-full text-sm font-semibold">
                Enviar mensagem
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};

export default Contact;
