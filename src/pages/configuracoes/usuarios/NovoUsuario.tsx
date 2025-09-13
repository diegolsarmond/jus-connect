import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Upload } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

const apiUrl = (import.meta.env.VITE_API_URL as string) || "http://localhost:3000";

function joinUrl(base: string, path = "") {
  const b = base.replace(/\/+$/, "");
  const p = path ? (path.startsWith("/") ? path : `/${path}`) : "";
  return `${b}${p}`;
}

const roleToPerfil = (role: string): number => {
  switch (role) {
    case "administrador":
      return 1;
    case "advogado":
      return 2;
    case "secretario":
      return 4;
    default:
      return 2;
  }
};

const officeToEscritorio = (office: string): number => {
  switch (office) {
    case "principal":
      return 1;
    case "filial":
      return 2;
    default:
      return 1;
  }
};

const existingEmails = [
  "joao.silva@escritorio.com.br",
  "maria.santos@escritorio.com.br",
];

const formSchema = z.object({
  name: z.string().min(1, "Nome completo é obrigatório"),
  email: z
    .string()
    .email("Email inválido")
    .refine((email) => !existingEmails.includes(email), "Email já cadastrado"),
  role: z.enum(["advogado", "secretario", "administrador"], {
    required_error: "Papel é obrigatório",
  }),
  office: z.string().min(1, "Escritório é obrigatório"),
  oab: z
    .string()
    .optional()
    .refine(
      (value) => !value || /^\d+\/[A-Za-z]{2}$/.test(value),
      {
        message: "Formato válido: 123456/SP",
      }
    ),
  status: z.enum(["ativo", "inativo"]),
  password: z.string().min(6, "Mínimo de 6 caracteres").optional(),
  phone: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function NovoUsuario() {
  const navigate = useNavigate();
  const [avatarPreview, setAvatarPreview] = useState<string>("");

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      role: "secretario",
      office: "",
      oab: "",
      status: "ativo",
      password: "",
      phone: "",
      notes: "",
    },
  });

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const onSubmit = async (data: FormValues) => {
    let password = data.password;
    if (!password) {
      password = Math.random().toString(36).slice(-8);
    }

    const payload = {
      nome_completo: data.name,
      cpf: "",
      email: data.email,
      perfil: roleToPerfil(data.role),
      empresa: 1,
      escritorio: officeToEscritorio(data.office),
      oab: data.oab || null,
      status: data.status === "ativo",
      senha: password,
      telefone: data.phone || null,
      ultimo_login: null,
      observacoes: data.notes || null,
    };

    try {
      const url = joinUrl(apiUrl, "/api/usuarios");
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error("Erro ao criar usuário");
      }
      if (!data.password) {
        toast({
          title: "Usuário criado",
          description: `Senha temporária enviada para ${data.email}`,
        });
      } else {
        toast({ title: "Usuário criado" });
      }
      navigate("/configuracoes/usuarios");
    } catch (error) {
      console.error("Erro ao criar usuário:", error);
      toast({ title: "Erro ao criar usuário", variant: "destructive" });
    }
  };

  const initials = form
    .watch("name")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Novo Usuário</h1>
          <p className="text-muted-foreground">Cadastre um novo usuário</p>
        </div>
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
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome completo</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome completo" {...field} />
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
                      <Input type="email" placeholder="email@exemplo.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Avatar */}
              <div className="flex flex-col items-center gap-4 py-4">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={avatarPreview} />
                  <AvatarFallback>{initials || "U"}</AvatarFallback>
                </Avatar>
                <Label
                  htmlFor="avatar-upload"
                  className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-muted rounded-md hover:bg-muted/80"
                >
                  <Upload className="h-4 w-4" />
                  Upload
                </Label>
                <Input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
              </div>

              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Papel</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o papel" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="advogado">Advogado</SelectItem>
                        <SelectItem value="secretario">Secretário</SelectItem>
                        <SelectItem value="administrador">Administrador</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="office"
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
                        <SelectItem value="filial">Filial X</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="oab"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>OAB</FormLabel>
                    <FormControl>
                      <Input placeholder="123456/SP" {...field} />
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
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="ativo">Ativo</SelectItem>
                        <SelectItem value="inativo">Inativo</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Senha inicial</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Opcional" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone</FormLabel>
                    <FormControl>
                      <Input type="tel" placeholder="(11) 99999-9999" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div>
                <Label>Último login</Label>
                <Input value="-" readOnly />
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Observações" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(-1)}
                >
                  Cancelar
                </Button>
                <Button type="submit">Salvar</Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
