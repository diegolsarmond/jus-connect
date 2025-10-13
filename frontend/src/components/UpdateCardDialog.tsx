import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

type UpdateCardDialogProps = {
  subscriptionId: string;
  onUpdate: () => void;
};

const UpdateCardDialog = ({ subscriptionId, onUpdate }: UpdateCardDialogProps) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formState, setFormState] = useState({
    holderName: "",
    number: "",
    expiryMonth: "",
    expiryYear: "",
    ccv: "",
  });

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (loading) {
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.functions.invoke("update-subscription-card", {
        body: {
          subscriptionId,
          creditCard: formState,
        },
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Cartão atualizado",
        description: "As informações de pagamento foram atualizadas com sucesso.",
      });
      setOpen(false);
      onUpdate();
    } catch (err: any) {
      toast({
        title: "Não foi possível atualizar",
        description: err?.message ?? "Tente novamente em instantes.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Atualizar cartão</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Atualizar cartão</DialogTitle>
            <DialogDescription>
              Informe os dados do novo cartão para realizar as próximas cobranças com segurança.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="holderName">Nome no cartão</Label>
              <Input
                id="holderName"
                required
                value={formState.holderName}
                onChange={(event) => setFormState((prev) => ({ ...prev, holderName: event.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="number">Número do cartão</Label>
              <Input
                id="number"
                required
                value={formState.number}
                onChange={(event) => setFormState((prev) => ({ ...prev, number: event.target.value }))}
                placeholder="1234 5678 9012 3456"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="expiryMonth">Mês</Label>
                <Input
                  id="expiryMonth"
                  required
                  maxLength={2}
                  value={formState.expiryMonth}
                  onChange={(event) => setFormState((prev) => ({ ...prev, expiryMonth: event.target.value }))}
                  placeholder="MM"
                />
              </div>
              <div>
                <Label htmlFor="expiryYear">Ano</Label>
                <Input
                  id="expiryYear"
                  required
                  maxLength={4}
                  value={formState.expiryYear}
                  onChange={(event) => setFormState((prev) => ({ ...prev, expiryYear: event.target.value }))}
                  placeholder="AAAA"
                />
              </div>
              <div>
                <Label htmlFor="ccv">CVV</Label>
                <Input
                  id="ccv"
                  required
                  maxLength={4}
                  value={formState.ccv}
                  onChange={(event) => setFormState((prev) => ({ ...prev, ccv: event.target.value }))}
                  placeholder="123"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Atualizando...
                </>
              ) : (
                "Salvar alterações"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default UpdateCardDialog;
