import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const PendingSubscriptions = () => {
  const navigate = useNavigate();
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storedId = localStorage.getItem("subscriptionId");
    if (storedId) {
      setSubscriptionId(storedId);
    }
  }, []);

  if (!subscriptionId) {
    return null;
  }

  return (
    <Alert className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-accent/30 bg-accent/10">
      <div>
        <AlertTitle className="flex items-center gap-2">
          <Badge variant="secondary" className="bg-accent text-accent-foreground">
            Assinatura pendente
          </Badge>
          Retome seu pagamento
        </AlertTitle>
        <AlertDescription>
          Identificamos uma assinatura ainda não finalizada. Você pode continuar o processo de pagamento agora mesmo.
        </AlertDescription>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => navigate(`/subscription/${subscriptionId}`)}>
          Ver detalhes
        </Button>
        <Button
          onClick={() => {
            if (typeof window !== "undefined") {
              localStorage.removeItem("subscriptionId");
              localStorage.removeItem("customerId");
              setSubscriptionId(null);
            }
          }}
        >
          Limpar alerta
        </Button>
      </div>
    </Alert>
  );
};

export default PendingSubscriptions;
