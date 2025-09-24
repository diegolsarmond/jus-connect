import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TypebotBubble from "@/components/site/TypebotBubble";
import SimpleBackground from "@/components/ui/SimpleBackground";

const TermsOfUse = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <TypebotBubble />
      <Header />
      <main>
        <section className="relative overflow-hidden bg-gradient-to-b from-primary/10 via-background to-background pb-20 pt-32">
          <SimpleBackground className="opacity-50" />
          <div className="container relative z-10 space-y-6 px-4 md:space-y-8">
            <div className="max-w-3xl space-y-4">
              <span className="inline-flex items-center rounded-full bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
                Termos de Uso
              </span>
              <h1 className="text-4xl font-semibold md:text-5xl">Condições para utilização das soluções Quantum</h1>
              <p className="text-base text-muted-foreground">
                Ao acessar nossas plataformas e serviços, você concorda com as regras estabelecidas neste documento. Leia com
                atenção para compreender as responsabilidades, limitações e boas práticas que orientam a relação entre a Quantum
                Tecnologia e seus clientes.
              </p>
            </div>
          </div>
        </section>

        <section className="container space-y-12 px-4 py-16 text-sm leading-relaxed text-muted-foreground md:text-base">
          <article className="space-y-6">
            <h2 className="text-2xl font-semibold text-foreground">1. Aceite dos termos</h2>
            <p>
              O uso das soluções QuantumJUD e demais produtos está condicionado à concordância com estes Termos de Uso. Caso não
              concorde com algum ponto, recomendamos interromper imediatamente o acesso e contatar nosso time para eventuais
              esclarecimentos.
            </p>
          </article>

          <article className="space-y-6">
            <h2 className="text-2xl font-semibold text-foreground">2. Cadastro e acesso</h2>
            <p>
              Cada usuário é responsável pela veracidade das informações fornecidas durante o cadastro e pela confidencialidade
              das credenciais de acesso. É proibido compartilhar logins ou permitir que terceiros não autorizados utilizem sua
              conta.
            </p>
          </article>

          <article className="space-y-6">
            <h2 className="text-2xl font-semibold text-foreground">3. Uso adequado da plataforma</h2>
            <p>
              As funcionalidades devem ser utilizadas conforme a finalidade contratada, respeitando a legislação vigente e os
              direitos de terceiros. Qualquer tentativa de engenharia reversa, exploração de vulnerabilidades ou uso indevido da
              infraestrutura resultará em suspensão imediata do acesso.
            </p>
          </article>

          <article className="space-y-6">
            <h2 className="text-2xl font-semibold text-foreground">4. Propriedade intelectual</h2>
            <p>
              Todos os softwares, interfaces, marcas e conteúdos disponibilizados pertencem à Quantum Tecnologia ou a seus
              licenciadores. Não é permitido copiar, reproduzir ou distribuir qualquer parte das soluções sem autorização prévia
              e por escrito.
            </p>
          </article>

          <article className="space-y-6">
            <h2 className="text-2xl font-semibold text-foreground">5. Limitação de responsabilidade</h2>
            <p>
              Empregamos os melhores esforços para manter a plataforma disponível e segura, mas não nos responsabilizamos por
              indisponibilidades ocasionais, perda de dados decorrente de uso inadequado ou danos indiretos resultantes de
              integrações externas.
            </p>
          </article>

          <article className="space-y-6">
            <h2 className="text-2xl font-semibold text-foreground">6. Vigência e alterações</h2>
            <p>
              Estes Termos podem ser atualizados a qualquer momento. As mudanças entram em vigor imediatamente após a publicação
              e recomenda-se revisar periodicamente o documento. O uso contínuo da plataforma após alterações representa a
              concordância com as novas condições.
            </p>
          </article>

          <p className="text-xs text-muted-foreground">
            Última atualização: {new Date().toLocaleDateString("pt-BR")}
          </p>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default TermsOfUse;
