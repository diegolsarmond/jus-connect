import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";

const recoverSchema = z.object({
  cpf: z.string().min(11, "CPF é obrigatório"),
});

type RecoverForm = z.infer<typeof recoverSchema>;

export default function RecuperarSenha() {
  const form = useForm<RecoverForm>({
    resolver: zodResolver(recoverSchema),
    defaultValues: { cpf: "" },
  });

  function onSubmit(values: RecoverForm) {
    console.log(values);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Card className="w-[350px]">
        <CardHeader>
          <CardTitle className="text-center">Recuperar Senha</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="cpf"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CPF</FormLabel>
                    <FormControl>
                      <Input placeholder="000.000.000-00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full">
                Enviar
              </Button>
            </form>
          </Form>
          <div className="mt-4 text-center">
            <Link to="/login" className="text-sm text-primary underline">
              Voltar ao login
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
