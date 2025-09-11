import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { clients } from "@/lib/clients";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { toast } from "@/components/ui/use-toast";

const formSchema = z.object({
  number: z.string().optional(),
  tipo: z.enum(["Cível", "Criminal"]),
  participacao: z.enum(["Requerente", "Requerido", "Réu", "Autor"]),
  areaAtuacao: z.enum([
    "Trabalhista",
    "Previdencia",
    "Criminal",
    "Familia",
  ]),
  nomeReu: z.string().min(1, "Nome é obrigatório"),
  documentoReu: z.string().optional(),
  enderecoReu: z.string().min(1, "Endereço é obrigatório"),
  numeroReu: z.string().optional(),
  bairro: z.string().min(1, "Bairro é obrigatório"),
  cidade: z.string().min(1, "Cidade é obrigatória"),
  cep: z.string().optional(),
  valorCausa: z.string().optional(),
  descricaoFatos: z.string().min(1, "Descrição é obrigatória"),
  pedidos: z.string().min(1, "Pedidos são obrigatórios"),
  status: z.enum(["Em andamento", "Encerrado"]),
});

export default function NovoProcesso() {
  const { id } = useParams();
  const navigate = useNavigate();
  const client = clients.find((c) => c.id === Number(id));

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      number: "",
      tipo: "Cível",
      participacao: "Requerente",
      areaAtuacao: "Trabalhista",
      nomeReu: "",
      documentoReu: "",
      enderecoReu: "",
      numeroReu: "",
      bairro: "",
      cidade: "",
      cep: "",
      valorCausa: "",
      descricaoFatos: "",
      pedidos: "",
      status: "Em andamento",
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    if (!client) return;
    const newProcess = {
      id:
        (client.processes.length > 0
          ? Math.max(...client.processes.map((p) => p.id))
          : 0) + 1,
      number: values.number,
      tipo: values.tipo,
      participacao: values.participacao,
      areaAtuacao: values.areaAtuacao,
      nomeReu: values.nomeReu,
      documentoReu: values.documentoReu,
      enderecoReu: values.enderecoReu,
      numeroReu: values.numeroReu,
      bairro: values.bairro,
      cidade: values.cidade,
      cep: values.cep,
      valorCausa: values.valorCausa,
      descricaoFatos: values.descricaoFatos,
      pedidos: values.pedidos,
      status: values.status,
    };
    client.processes.push(newProcess);
    toast({ title: "Processo criado com sucesso" });
    navigate(`/clientes/${id}`);
  };

  if (!client) {
    return (
      <div className="p-6">
        <p>Cliente não encontrado</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Novo Processo</h1>
        <p className="text-muted-foreground">Cliente: {client.name}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informações</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="tipo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Processo</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Cível">Cível</SelectItem>
                        <SelectItem value="Criminal">Criminal</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="participacao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Participação</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Requerente">Requerente</SelectItem>
                        <SelectItem value="Requerido">Requerido</SelectItem>
                        <SelectItem value="Réu">Réu</SelectItem>
                        <SelectItem value="Autor">Autor</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="areaAtuacao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Área de Atuação</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a área" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Trabalhista">Trabalhista</SelectItem>
                        <SelectItem value="Previdencia">Previdencia</SelectItem>
                        <SelectItem value="Criminal">Criminal</SelectItem>
                        <SelectItem value="Familia">Familia</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número</FormLabel>
                    <FormControl>
                      <Input placeholder="0000-00.0000.0.00.0000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="nomeReu"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome Completo do Réu / Promovido</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome completo" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="documentoReu"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CPF/CNPJ do Réu / Promovido</FormLabel>
                    <FormControl>
                      <Input placeholder="Documento" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="enderecoReu"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Endereço Completo do Réu</FormLabel>
                    <FormControl>
                      <Input placeholder="Endereço" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="numeroReu"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nº / Apto do Réu</FormLabel>
                    <FormControl>
                      <Input placeholder="Número" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bairro"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bairro</FormLabel>
                    <FormControl>
                      <Input placeholder="Bairro" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cidade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cidade</FormLabel>
                    <FormControl>
                      <Input placeholder="Cidade" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cep"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CEP</FormLabel>
                    <FormControl>
                      <Input placeholder="CEP" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="valorCausa"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor da Causa / Pedido</FormLabel>
                    <FormControl>
                      <Input placeholder="Valor" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="descricaoFatos"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição dos fatos</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Descreva os fatos" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="pedidos"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quais são os seus pedidos na presente ação?</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Seus pedidos" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Situação do Processo</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Em andamento">Em andamento</SelectItem>
                        <SelectItem value="Encerrado">Encerrado</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => navigate(-1)}>
                  Cancelar
                </Button>
                <Button type="submit" className="bg-primary hover:bg-primary-hover">
                  Salvar
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
