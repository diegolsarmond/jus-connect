import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TypebotBubble from "@/components/site/TypebotBubble";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Scale, Shield, Users, Zap } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
      <TypebotBubble />
      <Header />
      <main>
        <div className="container mx-auto px-4 py-16">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 mb-6">
              <Scale className="w-12 h-12 text-accent" />
              <h1 className="text-5xl font-bold bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent">
                LexCRM
              </h1>
            </div>
            <p className="text-2xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Sistema de Gestão Jurídica completo para advogados e escritórios de advocacia
            </p>
            <div className="flex gap-4 justify-center">
              <Button
                size="lg"
                onClick={() => navigate("/plans")}
                className="bg-gradient-to-r from-accent to-accent/80 hover:from-accent/90 hover:to-accent/70 text-lg px-8"
              >
                Ver Planos
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => {
                  const subscriptionId = typeof window !== "undefined" ? localStorage.getItem("subscriptionId") : null;
                  if (subscriptionId) {
                    navigate(`/subscription/${subscriptionId}`);
                  } else {
                    navigate("/plans");
                  }
                }}
                className="text-lg px-8"
              >
                Minha Assinatura
              </Button>
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto mb-16">
            {[
              {
                icon: Scale,
                title: "Gestão de Processos",
                description: "Controle completo de todos os seus processos jurídicos",
              },
              {
                icon: Users,
                title: "Gestão de Clientes",
                description: "Mantenha todos os dados dos seus clientes organizados",
              },
              {
                icon: Zap,
                title: "Controle de Prazos",
                description: "Nunca perca um prazo importante novamente",
              },
              {
                icon: Shield,
                title: "Segurança Total",
                description: "Seus dados protegidos com máxima segurança",
              },
            ].map((feature, index) => (
              <Card
                key={index}
                className="p-6 text-center hover:shadow-lg transition-all hover:-translate-y-1"
              >
                <feature.icon className="w-12 h-12 text-accent mx-auto mb-4" />
                <h3 className="font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </Card>
            ))}
          </div>

          <Card className="p-12 bg-gradient-to-r from-primary to-primary/90 text-primary-foreground max-w-4xl mx-auto">
            <div className="text-center">
              <h2 className="text-3xl font-bold mb-4">Pronto para começar?</h2>
              <p className="text-lg mb-8 opacity-90">
                Escolha o plano ideal para o seu escritório e comece a gerenciar seus processos com mais eficiência
              </p>
              <Button
                size="lg"
                variant="secondary"
                onClick={() => navigate("/plans")}
                className="text-lg px-8"
              >
                Escolher Plano
              </Button>
            </div>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Index;
