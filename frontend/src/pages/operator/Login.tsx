import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import quantumLogo from "@/assets/quantum-logo.png";
import { routes } from "@/config/routes";
import { appConfig } from "@/config/app-config";
import { useAuth } from "@/features/auth/AuthProvider";
import { ApiError, resendEmailConfirmationRequest } from "@/features/auth/api";
import { useToast } from "@/components/ui/use-toast";
import { AuthError } from "@supabase/supabase-js";
import type { Session, User as SupabaseUser } from "@supabase/supabase-js";
import type { LoginResponse } from "@/features/auth/types";

const REMEMBER_ME_STORAGE_KEY = "auth.rememberMe";
const DEFAULT_CONFIRMATION_MESSAGE =
  "Confirme seu e-mail antes de acessar. Verifique sua caixa de entrada.";
const DEFAULT_LOGIN_ERROR_MESSAGE = "Não foi possível realizar o login. Tente novamente.";
const SSO_IDENTIFIERS = new Set(["sso", "saml", "oauth", "openid", "oidc"]);

const normalizeMode = (value: string | null | undefined) => value?.trim().toLowerCase() ?? "";

type SupabaseLoginResult = {
  session: Session | null;
  user: SupabaseUser | null;
  error: unknown;
};

const resolveSupabaseLoginResult = (value: unknown): SupabaseLoginResult | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  if ("token" in record) {
    return null;
  }

  if (!("session" in record) && !("error" in record)) {
    return null;
  }

  return {
    session: (record.session as Session | null) ?? null,
    user: (record.user as SupabaseUser | null) ?? null,
    error: record.error ?? null,
  } satisfies SupabaseLoginResult;
};

const resolveFriendlyErrorMessage = (error: unknown): string => {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return "Credenciais inválidas. Verifique seu e-mail e senha.";
    }

    if (error.status === 403) {
      return error.message || DEFAULT_LOGIN_ERROR_MESSAGE;
    }

    if (error.status >= 500) {
      return "Serviço temporariamente indisponível. Tente novamente em instantes.";
    }

    return error.message || DEFAULT_LOGIN_ERROR_MESSAGE;
  }

  if (error instanceof AuthError) {
    const normalizedMessage = error.message.trim().toLowerCase();
    if (error.status === 400 || normalizedMessage.includes("invalid login credentials")) {
      return "Credenciais inválidas. Verifique seu e-mail e senha.";
    }

    if (error.status === 403) {
      return "Acesso negado. Entre em contato com o suporte.";
    }

    if (error.status >= 500) {
      return "Serviço temporariamente indisponível. Tente novamente em instantes.";
    }

    return error.message || DEFAULT_LOGIN_ERROR_MESSAGE;
  }

  if (error instanceof Error) {
    return error.message || DEFAULT_LOGIN_ERROR_MESSAGE;
  }

  return DEFAULT_LOGIN_ERROR_MESSAGE;
};

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [emailConfirmationMessage, setEmailConfirmationMessage] = useState<string | null>(null);
  const [isResendingEmailConfirmation, setIsResendingEmailConfirmation] = useState(false);
  const [authSession, setAuthSession] = useState<Session | null>(null);
  const [authUser, setAuthUser] = useState<SupabaseUser | null>(null);
  const [pendingEmailVerification, setPendingEmailVerification] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, isLoading, user } = useAuth();
  const { toast } = useToast();
  const resolveRedirectPath = useCallback(
    () =>
      ((location.state as { from?: { pathname?: string } } | undefined)?.from?.pathname) ?? routes.dashboard,
    [location],
  );

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(REMEMBER_ME_STORAGE_KEY);
        if (raw) {
          const stored = JSON.parse(raw) as { email?: string; password?: string };
          if (stored?.email && stored?.password) {
            setEmail(stored.email);
            setPassword(stored.password);
            setRememberMe(true);
          }
        }
      } catch (error) {
        console.warn("Failed to read remember me data", error);
      }
    }
  }, []);

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const normalizedEnvMode = useMemo(
    () =>
      normalizeMode(
        ((import.meta.env as Record<string, unknown>).VITE_AUTH_LOGIN_MODE as string | undefined) ??
          ((import.meta.env as Record<string, unknown>).VITE_AUTH_MODE as string | undefined) ??
          ((import.meta.env as Record<string, unknown>).VITE_AUTH_PROVIDER as string | undefined) ??
          ((import.meta.env as Record<string, unknown>).VITE_AUTH_DEFAULT_MODE as string | undefined) ??
          ((import.meta.env as Record<string, unknown>).VITE_AUTH_DEFAULT_PROVIDER as string | undefined),
      ),
    [],
  );

  const queryMode = normalizeMode(searchParams.get("mode") ?? searchParams.get("loginMode"));
  const queryProvider = normalizeMode(searchParams.get("provider"));
  const querySsoFlag = normalizeMode(searchParams.get("sso"));
  const isSsoConfigured = normalizedEnvMode !== "" && SSO_IDENTIFIERS.has(normalizedEnvMode);
  const isSsoQuerySelected =
    SSO_IDENTIFIERS.has(queryMode) || SSO_IDENTIFIERS.has(queryProvider) || querySsoFlag === "true";
  const sessionProvider = normalizeMode(
    (authSession?.user?.app_metadata as { provider?: string } | undefined)?.provider ??
      (authUser?.app_metadata as { provider?: string } | undefined)?.provider,
  );
  const isSsoProvider = sessionProvider !== "" && sessionProvider !== "email";
  const shouldUseSsoMode = isSsoConfigured || isSsoQuerySelected || isSsoProvider;

  useEffect(() => {
    if (!isLoading && isAuthenticated && !pendingEmailVerification) {
      if (user?.mustChangePassword) {
        navigate("/alterar-senha", { replace: true, state: { from: resolveRedirectPath() } });
        return;
      }

      navigate(resolveRedirectPath(), { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate, pendingEmailVerification, resolveRedirectPath, user]);

  useEffect(() => {
    if (shouldUseSsoMode) {
      setRememberMe(false);
    }
  }, [shouldUseSsoMode]);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setEmailConfirmationMessage(null);
    setIsSubmitting(true);
    setAuthSession(null);
    setAuthUser(null);
    setPendingEmailVerification(false);

    try {
      if (typeof window !== "undefined") {
        if (rememberMe && !shouldUseSsoMode) {
          window.localStorage.setItem(
            REMEMBER_ME_STORAGE_KEY,
            JSON.stringify({ email, password }),
          );
        } else {
          window.localStorage.removeItem(REMEMBER_ME_STORAGE_KEY);
        }
      }

      const result = await login({ email, senha: password });
      const supabaseResult = resolveSupabaseLoginResult(result);

      if (!supabaseResult) {
        const response = result as LoginResponse;
        if (response.user.mustChangePassword) {
          navigate("/alterar-senha", { replace: true, state: { from: resolveRedirectPath() } });
          return;
        }

        navigate(resolveRedirectPath(), { replace: true });
        return;
      }

      setAuthSession(supabaseResult.session);
      const candidateUser = supabaseResult.session?.user ?? supabaseResult.user ?? null;
      setAuthUser(candidateUser);

      if (candidateUser && candidateUser.email_confirmed_at === null) {
        setEmailConfirmationMessage(DEFAULT_CONFIRMATION_MESSAGE);
        setPendingEmailVerification(true);
        return;
      }

      if (supabaseResult.error) {
        setErrorMessage(resolveFriendlyErrorMessage(supabaseResult.error));
        return;
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        const normalizedMessage = error.message.trim().toLowerCase();
        if (normalizedMessage.includes("confirme seu e-mail")) {
          setEmailConfirmationMessage(error.message || DEFAULT_CONFIRMATION_MESSAGE);
          setPendingEmailVerification(true);
          return;
        }
      }

      setErrorMessage(resolveFriendlyErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendEmailConfirmation = useCallback(async () => {
    if (!email) {
      toast({
        variant: "destructive",
        title: "Não foi possível reenviar o e-mail de confirmação",
        description: "Informe um e-mail válido e tente novamente.",
      });
      return;
    }

    setIsResendingEmailConfirmation(true);

    try {
      const message = await resendEmailConfirmationRequest(email);
      toast({
        title: "E-mail reenviado",
        description: message,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Não foi possível reenviar o e-mail de confirmação",
        description: "Entre em contato com o suporte.",
      });
    } finally {
      setIsResendingEmailConfirmation(false);
    }
  }, [email, toast]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <span className="text-sm">Carregando acesso...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <Link to={routes.home} className="inline-flex items-center gap-3 mb-4 hover:opacity-80 transition-opacity">
            <img src={quantumLogo} alt={appConfig.appName} className="h-12 w-12" />
            <h1 className="text-3xl font-bold text-primary">{appConfig.appName}</h1>
          </Link>
          <p className="text-muted-foreground">Entre na sua conta</p>
        </div>

        <Card className="border-0 bg-background/80 backdrop-blur-sm shadow-lg">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">Login</CardTitle>
            <CardDescription className="text-center">
              Digite suas credenciais para acessar o sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                />
              </div>

              {shouldUseSsoMode ? null : (
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Sua senha"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      autoComplete="current-password"
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              )}

              {emailConfirmationMessage ? (
                <div className="space-y-3 rounded-md border border-primary/40 bg-primary/10 px-3 py-3 text-sm text-primary">
                  <p>{emailConfirmationMessage}</p>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={handleResendEmailConfirmation}
                    disabled={isResendingEmailConfirmation}
                  >
                    {isResendingEmailConfirmation ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Reenviando...
                      </span>
                    ) : (
                      "Reenviar e-mail de confirmação"
                    )}
                  </Button>
                </div>
              ) : null}

              {errorMessage ? (
                <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {errorMessage}
                </div>
              ) : null}

              {shouldUseSsoMode ? null : (
                <div className="flex items-center justify-between">
                  <label className="flex items-center space-x-2 text-sm">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300"
                      checked={rememberMe}
                      onChange={(event) => {
                        const { checked } = event.target;
                        setRememberMe(checked);
                        if (!checked && typeof window !== "undefined") {
                          window.localStorage.removeItem(REMEMBER_ME_STORAGE_KEY);
                        }
                      }}
                    />
                    <span>Lembrar de mim</span>
                  </label>
                  <Link to={routes.forgotPassword} className="text-sm text-primary hover:underline">
                    Esqueceu a senha?
                  </Link>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Entrando...
                  </span>
                ) : (
                  "Entrar"
                )}
              </Button>
            </form>

            <Separator className="my-6" />

            <div className="text-center text-sm text-muted-foreground">
              Não tem uma conta?{" "}
              <Link to={routes.register} className="text-primary hover:underline">
                Cadastre-se
              </Link>
            </div>

            <div className="text-center mt-4">
              <Link to={routes.home} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                ← Voltar para o site
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Demo credentials */}
        {/*<Card className="mt-4 border-primary/20 bg-primary/5">*/}
        {/*  <CardContent className="pt-4">*/}
        {/*    <p className="text-sm text-center text-muted-foreground mb-2">*/}
        {/*      <strong>Credenciais de demonstração:</strong>*/}
        {/*    </p>*/}
        {/*    <p className="text-xs text-center text-muted-foreground">*/}
        {/*      Email: admin@com<br />*/}
        {/*      Senha: demo123*/}
        {/*    </p>*/}
        {/*  </CardContent>*/}
        {/*</Card>*/}
      </div>
    </div>
  );
};

export default Login;