import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import quantumLogo from "@/assets/quantum-logo.png";
import { routes } from "@/config/routes";
import { appConfig } from "@/config/app-config";
import { ApiError, confirmEmailRequest } from "@/features/auth/api";

type ConfirmationStatus = "idle" | "loading" | "success" | "error";

const formatDateTime = (value: string | null): string | null => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "long",
      timeStyle: "short",
    }).format(parsed);
  } catch {
    return parsed.toLocaleString();
  }
};

const ConfirmEmail = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<ConfirmationStatus>("idle");
  const [message, setMessage] = useState("Verificando token de confirmação...");
  const [confirmedAt, setConfirmedAt] = useState<string | null>(null);

  const token = useMemo(() => {
    const raw = searchParams.get("token");
    return raw ? raw.trim() : "";
  }, [searchParams]);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Token de confirmação inválido.");
      setConfirmedAt(null);
      return;
    }

    let isActive = true;
    const controller = new AbortController();

    setStatus("loading");
    setMessage("Confirmando seu e-mail...");
    setConfirmedAt(null);

    const confirm = async () => {
      try {
        const result = await confirmEmailRequest(token, controller.signal);
        if (!isActive) {
          return;
        }

        setStatus("success");
        setMessage(result.message);
        setConfirmedAt(result.confirmedAt ?? null);
      } catch (error) {
        if (!isActive) {
          return;
        }

        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        let resolvedMessage = "Não foi possível confirmar o e-mail. Tente novamente.";

        if (error instanceof ApiError) {
          if (error.status === 409) {
            setStatus("success");
            setMessage("Este e-mail já foi confirmado anteriormente.");
            setConfirmedAt(null);
            return;
          }
          resolvedMessage = error.message;
        } else if (error instanceof Error && error.message.trim().length > 0) {
          resolvedMessage = error.message;
        }

        setStatus("error");
        setMessage(resolvedMessage);
        setConfirmedAt(null);
      }
    };

    void confirm();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [token]);

  const confirmedAtLabel = useMemo(() => formatDateTime(confirmedAt), [confirmedAt]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to={routes.home} className="inline-flex items-center gap-3 mb-4 hover:opacity-80 transition-opacity">
            <img src={quantumLogo} alt={appConfig.appName} className="h-12 w-12" />
            <h1 className="text-3xl font-bold text-primary">{appConfig.appName}</h1>
          </Link>
          <p className="text-muted-foreground">Confirme seu e-mail para concluir o cadastro</p>
        </div>

        <Card className="border-0 bg-background/80 backdrop-blur-sm shadow-lg">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">Confirmação de e-mail</CardTitle>
            <CardDescription className="text-center">
              Verificamos o token enviado para o seu e-mail cadastrado
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-4 text-center">
              {status === "loading" && (
                <>
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <p className="text-muted-foreground">{message}</p>
                </>
              )}

              {status === "success" && (
                <>
                  <CheckCircle className="h-12 w-12 text-green-500" />
                  <div className="space-y-1">
                    <p className="text-lg font-semibold">{message}</p>
                    {confirmedAtLabel && (
                      <p className="text-sm text-muted-foreground">
                        Confirmado em {confirmedAtLabel}
                      </p>
                    )}
                  </div>
                </>
              )}

              {status === "error" && (
                <>
                  <XCircle className="h-12 w-12 text-destructive" />
                  <div className="space-y-2">
                    <p className="text-lg font-semibold">{message}</p>
                    <p className="text-sm text-muted-foreground">
                      Caso o problema persista, solicite um novo link através da tela de login.
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="mt-6 space-y-3">
              <Button asChild className="w-full">
                <Link to={routes.login}>Ir para o login</Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link to={routes.register}>Criar uma nova conta</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ConfirmEmail;

