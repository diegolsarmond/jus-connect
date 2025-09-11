import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export default function Processos() {
  const processos = [
    {
      numero: "5152182-10.2019.8.13.0024",
      dataDistribuicao: "16/10/2019",
      cliente: { nome: "Diego Leonardo da Silva Armond", papel: "Autor" },
      classeJudicial:
        "[CÍVEL] CUMPRIMENTO DE SENTENÇA CONTRA A FAZENDA PÚBLICA (12078)",
      assunto:
        "DIREITO CIVIL (899) - Obrigações (7681) - Inadimplemento (7691) - Perdas e Danos (7698) DIREITO CIVIL (899) - Responsabilidade Civil (10431) - Indenização por Dano Moral (10433) - Direito de Imagem (10437) DIREITO ADMINISTRATIVO E OUTRAS MATÉRIAS DE DIREITO PÚBLICO (9985) - Responsabilidade da Administração (9991) - Indenização por Dano Moral (9992)",
      jurisdicao: "Belo Horizonte - Juizado Especial",
      orgaoJulgador:
        "3ª Unidade Jurisdicional da Fazenda Pública do Juizado Especial 43º JD Belo Horizonte",
      movimentacoes: [
        {
          data: "13/10/2022 17:02:21",
          descricao: "Arquivado Definitivamente",
        },
        {
          data: "13/10/2022 16:58:37",
          descricao: "Juntada de Petição de manifestação",
        },
        {
          data: "06/10/2022 19:09:45",
          descricao:
            "Decorrido prazo de ESTADO DE MINAS GERAIS em 04/10/2022 23:59.",
        },
        {
          data: "06/10/2022 19:09:44",
          descricao:
            "Decorrido prazo de DIEGO LEONARDO DA SILVA ARMOND em 05/10/2022 23:59.",
        },
        {
          data: "06/10/2022 19:09:44",
          descricao:
            "Decorrido prazo de SERGIO AGUILAR SILVA em 05/10/2022 23:59.",
        },
      ],
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Processos</h1>
        <p className="text-muted-foreground">
          Listagem de processos cadastrados
        </p>
      </div>

      <Accordion type="single" collapsible className="w-full">
        {processos.map((processo) => (
          <AccordionItem key={processo.numero} value={processo.numero}>
            <AccordionTrigger>
              <div className="text-left">
                <p className="font-medium">Processo {processo.numero}</p>
                <p className="text-sm text-muted-foreground">
                  Distribuído em {processo.dataDistribuicao}
                </p>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Cliente:</span> {processo.cliente.nome} ({processo.cliente.papel})
                  </div>
                  <div>
                    <span className="font-medium">Classe Judicial:</span> {processo.classeJudicial}
                  </div>
                  <div className="md:col-span-2">
                    <span className="font-medium">Assunto:</span> {processo.assunto}
                  </div>
                  <div>
                    <span className="font-medium">Jurisdição:</span> {processo.jurisdicao}
                  </div>
                  <div>
                    <span className="font-medium">Órgão Julgador:</span> {processo.orgaoJulgador}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Últimas Movimentações</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left">
                          <th className="py-1">Movimento</th>
                          <th className="py-1">Documento</th>
                        </tr>
                      </thead>
                      <tbody className="[&>tr:not(:last-child)]:border-b">
                        {processo.movimentacoes.map((mov, index) => (
                          <tr key={index}>
                            <td className="py-1">
                              {mov.data} - {mov.descricao}
                            </td>
                            <td className="py-1"></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}

