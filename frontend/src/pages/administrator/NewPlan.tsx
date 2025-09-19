import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { routes } from "@/config/routes";

export default function NewPlan() {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    billingCycle: "monthly",
    features: "",
    maxUsers: "",
    maxCases: "",
    isActive: true,
  });

  const navigate = useNavigate();
  const { toast } = useToast();

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast({
      title: "Plano criado!",
      description: "O novo plano foi cadastrado com sucesso.",
    });
    navigate(routes.admin.plans);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Novo Plano</h1>
        <p className="text-muted-foreground">
          Cadastre um novo plano de assinatura
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informações do Plano</CardTitle>
          <CardDescription>Preencha os dados abaixo</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">Preço</Label>
                <Input
                  id="price"
                  name="price"
                  type="number"
                  value={formData.price}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="billingCycle">Ciclo de Cobrança</Label>
                <Select
                  value={formData.billingCycle}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, billingCycle: value }))
                  }
                >
                  <SelectTrigger id="billingCycle">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Mensal</SelectItem>
                    <SelectItem value="annual">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="maxUsers">Máx. Usuários</Label>
                <Input
                  id="maxUsers"
                  name="maxUsers"
                  type="number"
                  value={formData.maxUsers}
                  onChange={handleChange}
                  placeholder="-1 para ilimitado"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxCases">Máx. Casos</Label>
                <Input
                  id="maxCases"
                  name="maxCases"
                  type="number"
                  value={formData.maxCases}
                  onChange={handleChange}
                  placeholder="-1 para ilimitado"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="features">Recursos (separados por vírgula)</Label>
              <Input
                id="features"
                name="features"
                value={formData.features}
                onChange={handleChange}
              />
            </div>

            <div className="flex items-center space-x-2 pt-4">
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, isActive: checked }))
                }
              />
              <Label htmlFor="isActive">Plano ativo</Label>
            </div>
          </CardContent>
          <CardFooter className="justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => navigate(-1)}>
              Cancelar
            </Button>
            <Button type="submit">Salvar</Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

