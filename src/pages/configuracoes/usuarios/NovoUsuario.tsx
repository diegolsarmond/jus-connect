import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserFormData } from "@/types/user";

const userSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("Email inválido"),
  phone: z.string().min(10, "Telefone deve ter pelo menos 10 dígitos"),
  role: z.enum(["admin", "advogado", "estagiario", "secretario"]),
  escritorio: z.string().min(1, "Escritório é obrigatório"),
  oabNumero: z.string().optional(),
  oabUf: z.string().optional(),
  especialidades: z.array(z.string()),
  tarifaPorHora: z.number().optional(),
  timezone: z.string().default("America/Sao_Paulo"),
  idioma: z.string().default("pt-BR"),
  avatar: z.string().optional(),
  lgpdConsent: z.boolean().refine(val => val === true, "Consentimento LGPD é obrigatório")
}).refine((data) => {
  if (data.role === "advogado") {
    return data.oabNumero && data.oabUf;
  }
  return true;
}, {
  message: "OAB é obrigatório para advogados",
  path: ["oabNumero"]
});

export default function NovoUsuario() {
  const [avatarPreview, setAvatarPreview] = useState<string>("");
  const [especialidadesInput, setEspecialidadesInput] = useState("");
  const [especialidades, setEspecialidades] = useState<string[]>([]);

  const form = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      role: "secretario",
      escritorio: "",
      oabNumero: "",
      oabUf: "",
      especialidades: [],
      timezone: "America/Sao_Paulo",
      idioma: "pt-BR",
      lgpdConsent: false,
    },
  });

  const watchRole = form.watch("role");
  const isAdvogado = watchRole === "advogado";

  const onSubmit = (data: UserFormData) => {
    console.log({ ...data, especialidades });
    // Aqui seria feita a integração com o backend
  };

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const addEspecialidade = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && especialidadesInput.trim()) {
      e.preventDefault();
      if (!especialidades.includes(especialidadesInput.trim())) {
        setEspecialidades([...especialidades, especialidadesInput.trim()]);
        form.setValue("especialidades", [...especialidades, especialidadesInput.trim()]);
      }
      setEspecialidadesInput("");
    }
  };

  const removeEspecialidade = (especialidade: string) => {
    const newEspecialidades = especialidades.filter(e => e !== especialidade);
    setEspecialidades(newEspecialidades);
    form.setValue("especialidades", newEspecialidades);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Novo Usuário</h1>
          <p className="text-muted-foreground">Cadastre um novo usuário no sistema</p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Coluna Principal */}
            <div className="lg:col-span-2 space-y-6">
              {/* Dados Básicos */}
              <Card>
                <CardHeader>
                  <CardTitle>Dados Básicos</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome Completo</FormLabel>
                          <FormControl>
                            <Input placeholder="João Silva" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input 
                              type="email" 
                              placeholder="joao@escritorio.com.br" 
                              {...field} 
                            />
                          </FormControl>
                          <FormDescription>
                            Email será usado para login no sistema
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Telefone</FormLabel>
                          <FormControl>
                            <Input placeholder="(11) 99999-9999" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="role"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Role</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o role" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="admin">Administrador</SelectItem>
                              <SelectItem value="advogado">Advogado</SelectItem>
                              <SelectItem value="estagiario">Estagiário</SelectItem>
                              <SelectItem value="secretario">Secretário</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="escritorio"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Escritório</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o escritório" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="principal">Escritório Principal</SelectItem>
                            <SelectItem value="filial-sp">Filial São Paulo</SelectItem>
                            <SelectItem value="filial-rj">Filial Rio de Janeiro</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* Dados OAB - Só aparece para advogados */}
              {isAdvogado && (
                <Card>
                  <CardHeader>
                    <CardTitle>Dados OAB</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="oabNumero"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Número OAB</FormLabel>
                            <FormControl>
                              <Input placeholder="123456" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="oabUf"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>UF</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="UF" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="SP">SP</SelectItem>
                                <SelectItem value="RJ">RJ</SelectItem>
                                <SelectItem value="MG">MG</SelectItem>
                                <SelectItem value="RS">RS</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div>
                      <Label>Especialidades</Label>
                      <Input
                        placeholder="Digite e pressione Enter para adicionar"
                        value={especialidadesInput}
                        onChange={(e) => setEspecialidadesInput(e.target.value)}
                        onKeyDown={addEspecialidade}
                      />
                      <div className="flex flex-wrap gap-2 mt-2">
                        {especialidades.map((especialidade) => (
                          <Badge key={especialidade} variant="secondary">
                            {especialidade}
                            <X
                              className="h-3 w-3 ml-1 cursor-pointer"
                              onClick={() => removeEspecialidade(especialidade)}
                            />
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <FormField
                      control={form.control}
                      name="tarifaPorHora"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tarifa por Hora (R$)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              placeholder="350.00" 
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              )}

              {/* LGPD */}
              <Card>
                <CardHeader>
                  <CardTitle>Consentimento LGPD</CardTitle>
                </CardHeader>
                <CardContent>
                  <FormField
                    control={form.control}
                    name="lgpdConsent"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>
                            Concordo com o tratamento dos meus dados pessoais
                          </FormLabel>
                          <FormDescription>
                            O usuário autoriza o tratamento de seus dados pessoais 
                            conforme nossa Política de Privacidade.
                          </FormDescription>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Avatar Upload */}
              <Card>
                <CardHeader>
                  <CardTitle>Avatar</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col items-center space-y-4">
                    <Avatar className="h-24 w-24">
                      <AvatarImage src={avatarPreview} />
                      <AvatarFallback>
                        {form.watch("name")?.split(' ').map(n => n[0]).join('').toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <Label htmlFor="avatar-upload" className="cursor-pointer">
                      <div className="flex items-center gap-2 px-4 py-2 bg-muted rounded-lg hover:bg-muted/80">
                        <Upload className="h-4 w-4" />
                        Upload Imagem
                      </div>
                      <Input
                        id="avatar-upload"
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarChange}
                        className="hidden"
                      />
                    </Label>
                  </div>
                </CardContent>
              </Card>

              {/* Configurações */}
              <Card>
                <CardHeader>
                  <CardTitle>Configurações</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="timezone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Timezone</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="America/Sao_Paulo">Brasília (GMT-3)</SelectItem>
                            <SelectItem value="America/Manaus">Manaus (GMT-4)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="idioma"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Idioma</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="pt-BR">Português (Brasil)</SelectItem>
                            <SelectItem value="en-US">English (US)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4 pt-6 border-t">
            <Button type="submit">Criar Usuário</Button>
            <Button type="button" variant="outline">
              Criar e Convidar
            </Button>
            <Button type="button" variant="ghost">
              Cancelar
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}