import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save, User, Mail, Scale, Globe, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProfileCard } from "@/components/profile/ProfileCard";
import { AvatarUploader } from "@/components/profile/AvatarUploader";
import { UserFormData } from "@/types/user";
import { toast } from "@/components/ui/use-toast";
import { getApiBaseUrl, joinUrl } from "@/lib/api";

type UserRole = UserFormData["role"];

type EscritorioOption = string;

interface ApiEscritorio {
  id: number;
  nome: string;
}

interface ApiUsuario {
  id: number;
  nome_completo: string;
  cpf: string | null;
  email: string;
  perfil: number | null;
  empresa: number | null;
  escritorio: number | null;
  oab: string | null;
  oab_number: string | null;
  oab_uf: string | null;
  status: boolean | null;
  senha: string | null;
  telefone: string | null;
  ultimo_login: string | null;
  observacoes: string | null;
}

interface ApiPerfil {
  id: unknown;
}

const roleLabels: Record<UserRole, string> = {
  admin: "Administrador",
  advogado: "Advogado",
  estagiario: "Estagiário",
  secretario: "Secretário",
};

const orderedRoles: readonly UserRole[] = [
  "admin",
  "advogado",
  "estagiario",
  "secretario",
];

const roleBadgeVariants: Record<UserRole, "outline" | "default" | "secondary" | "destructive"> = {
  admin: "destructive",
  advogado: "default",
  estagiario: "secondary",
  secretario: "outline",
};

const perfilToRole = (perfil: number | null): UserRole => {
  switch (perfil) {
    case 1:
      return "admin";
    case 3:
      return "estagiario";
    case 4:
      return "secretario";
    case 2:
    default:
      return "advogado";
  }
};

const roleToPerfil = (role: UserRole): number => {
  switch (role) {
    case "admin":
      return 1;
    case "estagiario":
      return 3;
    case "secretario":
      return 4;
    case "advogado":
    default:
      return 2;
  }
};

const normalizeApiEscritorio = (data: unknown): ApiEscritorio => {
  if (!data || typeof data !== "object") {
    throw new Error("Escritório inválido");
  }

  const item = data as Record<string, unknown>;
  const id = Number(item.id);

  if (!Number.isFinite(id)) {
    throw new Error("Escritório sem ID válido");
  }

  return {
    id,
    nome: String(item.nome ?? ""),
  };
};

const escritorioIdToOption = (id: number | null): EscritorioOption => {
  if (id === null || id === undefined) {
    return "";
  }

  return String(id);
};

const escritorioOptionToId = (option: EscritorioOption): number | null => {
  if (!option) {
    return null;
  }

  const parsed = Number(option);
  return Number.isFinite(parsed) ? parsed : null;
};

const createEmptyFormData = (): UserFormData => ({
  name: "",
  email: "",
  phone: "",
  role: "advogado",
  escritorio: "",
  oabNumero: undefined,
  oabUf: undefined,
  especialidades: [],
  tarifaPorHora: undefined,
  timezone: "America/Sao_Paulo",
  idioma: "pt-BR",
  avatar: undefined,
  lgpdConsent: false,
});

const cloneFormData = (data: UserFormData): UserFormData => ({
  ...data,
  especialidades: [...data.especialidades],
});

const parseOab = (
  oab: string | null,
  oabNumber?: string | null,
  oabUf?: string | null,
): { numero?: string; uf?: string } => {
  const trimmedNumber = typeof oabNumber === "string" ? oabNumber.trim() : "";
  const trimmedUf = typeof oabUf === "string" ? oabUf.trim() : "";

  if (trimmedNumber || trimmedUf) {
    return {
      numero: trimmedNumber || undefined,
      uf: trimmedUf || undefined,
    };
  }

  if (!oab) {
    return {};
  }

  const [numero, uf] = oab.split("/").map((part) => part?.trim());
  return {
    numero: numero || undefined,
    uf: uf || undefined,
  };
};

const formatOab = (numero?: string, uf?: string): string | null => {
  if (!numero) {
    return null;
  }

  return uf ? `${numero}/${uf}` : numero;
};

const normalizeApiUser = (data: unknown): ApiUsuario => {
  if (!data || typeof data !== "object") {
    throw new Error("Resposta inválida do usuário");
  }

  const user = data as Record<string, unknown>;

  const toNumberOrNull = (value: unknown): number | null => {
    if (value === null || value === undefined || value === "") {
      return null;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const toBooleanOrNull = (value: unknown): boolean | null => {
    if (value === null || value === undefined || value === "") {
      return null;
    }
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value === "number") {
      return value !== 0;
    }
    if (typeof value === "string") {
      const normalized = value.toLowerCase();
      if (normalized === "true" || normalized === "1") return true;
      if (normalized === "false" || normalized === "0") return false;
    }
    return null;
  };

  const toStringOrNull = (value: unknown): string | null => {
    if (value === null || value === undefined) {
      return null;
    }
    return String(value);
  };

  const id = toNumberOrNull(user.id);
  if (id === null) {
    throw new Error("Usuário sem ID válido");
  }

  return {
    id,
    nome_completo: String(user.nome_completo ?? ""),
    cpf: toStringOrNull(user.cpf),
    email: String(user.email ?? ""),
    perfil: toNumberOrNull(user.perfil),
    empresa: toNumberOrNull(user.empresa),
    escritorio: toNumberOrNull(user.escritorio),
    oab: toStringOrNull(user.oab),
    oab_number: toStringOrNull(user.oab_number),
    oab_uf: toStringOrNull(user.oab_uf),
    status: toBooleanOrNull(user.status),
    senha: toStringOrNull(user.senha),
    telefone: toStringOrNull(user.telefone),
    ultimo_login: toStringOrNull(user.ultimo_login),
    observacoes: toStringOrNull(user.observacoes),
  };
};

const mapApiUserToFormData = (user: ApiUsuario): UserFormData => {
  const { numero, uf } = parseOab(user.oab, user.oab_number, user.oab_uf);

  return {
    name: user.nome_completo,
    email: user.email,
    phone: user.telefone ?? "",
    role: perfilToRole(user.perfil),
    escritorio: escritorioIdToOption(user.escritorio),
    oabNumero: numero,
    oabUf: uf,
    especialidades: [],
    tarifaPorHora: undefined,
    timezone: "America/Sao_Paulo",
    idioma: "pt-BR",
    avatar: undefined,
    lgpdConsent: user.status ?? true,
  };
};

export default function EditarPerfil() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const apiBaseUrl = getApiBaseUrl();

  const [formData, setFormData] = useState<UserFormData>(createEmptyFormData());
  const [initialData, setInitialData] = useState<UserFormData>(createEmptyFormData());
  const [especialidadesInput, setEspecialidadesInput] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [emailVerificationPending, setEmailVerificationPending] = useState(false);
  const [initialEmail, setInitialEmail] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiUser, setApiUser] = useState<ApiUsuario | null>(null);
  const [escritorios, setEscritorios] = useState<ApiEscritorio[]>([]);
  const [availableRoles, setAvailableRoles] = useState<UserRole[]>([]);

  const fetchUser = useCallback(async () => {
    if (!id) {
      setError("ID do usuário inválido.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const url = joinUrl(apiBaseUrl, `/api/usuarios/${id}`);
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      if (!response.ok) {
        throw new Error(`Erro ${response.status}`);
      }

      const json = await response.json();
      const normalizedUser = normalizeApiUser(json);
      const mappedForm = mapApiUserToFormData(normalizedUser);

      setApiUser(normalizedUser);
      setFormData(cloneFormData(mappedForm));
      setInitialData(cloneFormData(mappedForm));
      setInitialEmail(mappedForm.email);
      setEmailVerificationPending(false);
      setIsDirty(false);
    } catch (err) {
      console.error("Erro ao carregar usuário:", err);
      setError("Não foi possível carregar os dados do usuário.");
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl, id]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  useEffect(() => {
    const fetchEscritorios = async () => {
      try {
        const url = joinUrl(apiBaseUrl, "/api/escritorios");
        const response = await fetch(url, { headers: { Accept: "application/json" } });

        if (!response.ok) {
          throw new Error(`Erro ${response.status}`);
        }

        const json = await response.json();
        const normalized = Array.isArray(json)
          ? json
              .map((item) => {
                try {
                  return normalizeApiEscritorio(item);
                } catch (err) {
                  console.error("Escritório ignorado:", err);
                  return null;
                }
              })
              .filter((item): item is ApiEscritorio => item !== null)
          : [];

        setEscritorios(normalized);
      } catch (err) {
        console.error("Erro ao carregar escritórios:", err);
      }
    };

    fetchEscritorios();
  }, [apiBaseUrl]);

  useEffect(() => {
    const fetchPerfis = async () => {
      try {
        const url = joinUrl(apiBaseUrl, "/api/perfis");
        const response = await fetch(url, { headers: { Accept: "application/json" } });

        if (!response.ok) {
          throw new Error(`Erro ${response.status}`);
        }

        const json = await response.json();
        const array = (
          Array.isArray(json)
            ? json
            : Array.isArray((json as { rows?: unknown })?.rows)
              ? ((json as { rows: ApiPerfil[] }).rows)
              : Array.isArray((json as { data?: unknown })?.data)
                ? ((json as { data: ApiPerfil[] }).data)
                : Array.isArray((json as { data?: { rows?: unknown } })?.data?.rows)
                  ? ((json as { data: { rows: ApiPerfil[] } }).data.rows)
                  : []
        ) as ApiPerfil[];

        const roleSet = new Set<UserRole>();

        array.forEach((item) => {
          const id = Number((item as { id?: unknown }).id);
          if (Number.isFinite(id)) {
            roleSet.add(perfilToRole(id));
          }
        });

        setAvailableRoles(orderedRoles.filter((role) => roleSet.has(role)));
      } catch (err) {
        console.error("Erro ao carregar perfis:", err);
      }
    };

    fetchPerfis();
  }, [apiBaseUrl]);

  const handleInputChange = <K extends keyof UserFormData>(field: K, value: UserFormData[K]) => {
    setFormData((prev) => {
      const next = {
        ...prev,
        [field]: field === "especialidades" && Array.isArray(value)
          ? ([...value] as UserFormData[K])
          : value,
      } as UserFormData;
      return next;
    });
    setIsDirty(true);

    if (field === "email" && typeof value === "string") {
      setEmailVerificationPending(value.trim() !== initialEmail.trim());
    }
  };

  const addEspecialidade = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && especialidadesInput.trim()) {
      e.preventDefault();
      const value = especialidadesInput.trim();
      if (!formData.especialidades.includes(value)) {
        handleInputChange("especialidades", [...formData.especialidades, value]);
      }
      setEspecialidadesInput("");
    }
  };

  const removeEspecialidade = (especialidade: string) => {
    handleInputChange(
      "especialidades",
      formData.especialidades.filter((item) => item !== especialidade),
    );
  };

  const handleAvatarChange = (file: File | null) => {
    if (file) {
      console.log("Avatar file:", file);
      setIsDirty(true);
    }
  };

  const handleBack = () => {
    if (id) {
      navigate(`/configuracoes/usuarios/${id}`);
    } else {
      navigate("/configuracoes/usuarios");
    }
  };

  const handleCancel = () => {
    setFormData(cloneFormData(initialData));
    setEspecialidadesInput("");
    setIsDirty(false);
    setEmailVerificationPending(false);
  };

  const handleSave = async () => {
    if (!id || !apiUser) {
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        nome_completo: formData.name.trim(),
        cpf: apiUser.cpf,
        email: formData.email.trim(),
        perfil: roleToPerfil(formData.role),
        empresa: apiUser.empresa,
        escritorio: escritorioOptionToId(formData.escritorio),
        oab: formatOab(formData.oabNumero, formData.oabUf),
        status: apiUser.status ?? true,
        senha: apiUser.senha,
        telefone: formData.phone.trim() || null,
        ultimo_login: apiUser.ultimo_login,
        observacoes: apiUser.observacoes,
      };

      const url = joinUrl(apiBaseUrl, `/api/usuarios/${id}`);
      const response = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Erro ${response.status}`);
      }

      const updated = normalizeApiUser(await response.json());
      const updatedForm = mapApiUserToFormData(updated);

      setApiUser(updated);
      setFormData(cloneFormData(updatedForm));
      setInitialData(cloneFormData(updatedForm));
      setInitialEmail(updatedForm.email);
      setEmailVerificationPending(false);
      setIsDirty(false);

      toast({ title: "Perfil atualizado com sucesso" });
    } catch (err) {
      console.error("Erro ao salvar perfil:", err);
      toast({
        title: "Erro ao salvar alterações",
        description: "Tente novamente em instantes.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const isAdvogado = formData.role === "advogado";

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Editar Perfil</h1>
            <p className="text-muted-foreground">Atualize suas informações pessoais e profissionais</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Carregando dados do usuário...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 sm:p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Editar Perfil</h1>
            <p className="text-muted-foreground">Atualize suas informações pessoais e profissionais</p>
          </div>
        </div>
        <div className="space-y-4">
          <p className="text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={() => void fetchUser()}>
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Editar Perfil</h1>
            <p className="text-muted-foreground">Atualize suas informações pessoais e profissionais</p>
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" disabled={!isDirty || isSaving} onClick={handleCancel}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={!isDirty || isSaving}
            className="bg-primary hover:bg-primary-hover"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salvar Alterações
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Information */}
          <ProfileCard title="Informações Básicas" icon={<User className="h-5 w-5" />}>
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome Completo *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    placeholder="João Silva"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">Função</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value) => handleInputChange("role", value as UserRole)}
                    disabled={availableRoles.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableRoles.map((role) => (
                        <SelectItem key={role} value={role}>
                          {roleLabels[role]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="escritorio">Escritório</Label>
                <Select
                  value={formData.escritorio || undefined}
                  onValueChange={(value) => handleInputChange("escritorio", value as EscritorioOption)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o escritório" />
                  </SelectTrigger>
                  <SelectContent>
                    {escritorios.map((item) => (
                      <SelectItem key={item.id} value={String(item.id)}>
                        {item.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </ProfileCard>

          {/* Contact Information */}
          <ProfileCard title="Contato" icon={<Mail className="h-5 w-5" />}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  placeholder="joao@escritorio.com.br"
                />
                {emailVerificationPending && (
                  <div className="flex items-center gap-2 text-sm text-warning">
                    <Mail className="h-4 w-4" />
                    <span>Alteração pendente de verificação por email</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => handleInputChange("phone", e.target.value)}
                  placeholder="(11) 99999-9999"
                />
              </div>
            </div>
          </ProfileCard>

          {/* OAB Information - Only for lawyers */}
          {isAdvogado && (
            <ProfileCard title="Dados OAB" icon={<Scale className="h-5 w-5" />}>
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="oabNumero">Número OAB *</Label>
                    <Input
                      id="oabNumero"
                      value={formData.oabNumero ?? ""}
                      onChange={(e) => handleInputChange("oabNumero", e.target.value || undefined)}
                      placeholder="123456"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="oabUf">UF *</Label>
                    <Select
                      value={formData.oabUf ?? undefined}
                      onValueChange={(value) => handleInputChange("oabUf", value || undefined)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="UF" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SP">SP</SelectItem>
                        <SelectItem value="RJ">RJ</SelectItem>
                        <SelectItem value="MG">MG</SelectItem>
                        <SelectItem value="RS">RS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Especialidades</Label>
                  <Input
                    placeholder="Digite e pressione Enter para adicionar"
                    value={especialidadesInput}
                    onChange={(e) => setEspecialidadesInput(e.target.value)}
                    onKeyDown={addEspecialidade}
                  />
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.especialidades.map((especialidade) => (
                      <Badge key={especialidade} variant="secondary" className="pr-1">
                        {especialidade}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-4 w-4 p-0 ml-1 hover:bg-destructive hover:text-destructive-foreground"
                          onClick={() => removeEspecialidade(especialidade)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tarifaPorHora">Tarifa por Hora (R$)</Label>
                  <Input
                    id="tarifaPorHora"
                    type="number"
                    value={formData.tarifaPorHora ?? ""}
                    onChange={(e) => {
                      const value = e.target.value;
                      handleInputChange(
                        "tarifaPorHora",
                        value ? Number(value) : undefined,
                      );
                    }}
                    placeholder="350.00"
                  />
                </div>
              </div>
            </ProfileCard>
          )}

          {/* Preferences */}
          <ProfileCard title="Preferências" icon={<Globe className="h-5 w-5" />}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Select
                  value={formData.timezone}
                  onValueChange={(value) => handleInputChange("timezone", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="America/Sao_Paulo">Brasília (GMT-3)</SelectItem>
                    <SelectItem value="America/Manaus">Manaus (GMT-4)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="idioma">Idioma</Label>
                <Select
                  value={formData.idioma}
                  onValueChange={(value) => handleInputChange("idioma", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pt-BR">Português (Brasil)</SelectItem>
                    <SelectItem value="en-US">English (US)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </ProfileCard>

        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Avatar */}
          <ProfileCard title="Avatar">
            <AvatarUploader
              currentAvatar={formData.avatar ?? ""}
              userName={formData.name}
              onAvatarChange={handleAvatarChange}
              size="lg"
            />
          </ProfileCard>

          {/* Preview */}
          <ProfileCard title="Pré-visualização" variant="compact">
            <div className="space-y-3">
              <div className="text-center">
                <h3 className="font-semibold text-foreground">{formData.name}</h3>
                <p className="text-sm text-muted-foreground">{formData.email}</p>
                <div className="flex justify-center mt-2">
                  <Badge variant={roleBadgeVariants[formData.role]}>
                    {roleLabels[formData.role]}
                  </Badge>
                </div>
              </div>

              {isAdvogado && formData.oabNumero && formData.oabUf && (
                <div className="text-center">
                  <Badge variant="secondary">
                    OAB: {formData.oabNumero}/{formData.oabUf}
                  </Badge>
                </div>
              )}
            </div>
          </ProfileCard>
        </div>
      </div>
    </div>
  );
}
