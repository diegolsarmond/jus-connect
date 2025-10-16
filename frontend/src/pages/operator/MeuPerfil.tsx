import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Bell,
  Briefcase,
  Building,
  Calendar,
  Check,
  ChevronsUpDown,
  Edit2,
  Clock,
  FileText,
  Link,
  Loader2,
  MapPin,
  Scale,
  Shield,
  User as UserIcon,
} from "lucide-react";
import { AvatarUploader } from "@/components/profile/AvatarUploader";
import { AuditTimeline } from "@/components/profile/AuditTimeline";
import { EditableField } from "@/components/profile/EditableField";
import { ProfileCard } from "@/components/profile/ProfileCard";
import { SessionsList } from "@/components/profile/SessionsList";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { getApiUrl } from "@/lib/api";
import {
  extractCurrencyDigits,
  formatCurrencyInputValue,
  parseCurrencyDigits,
} from "@/pages/administrator/plans-utils";
import {
  fetchMeuPerfil,
  fetchMeuPerfilAuditLogs,
  fetchMeuPerfilSessions,
  revokeMeuPerfilSession,
  revokeTodasMeuPerfilSessions,
  updateMeuPerfil,
  type MeuPerfilProfile,
  type UpdateMeuPerfilPayload,
} from "@/services/meuPerfil";
import type { AuditLog, UserSession } from "@/types/user";

const EMPTY_SELECT_VALUE = "__empty_select__";

const formatCurrency = (value: number | null | undefined) => {
  if (value == null) {
    return "Não informado";
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(value);
};

const formatDate = (date: Date | null | undefined) => {
  if (!date) {
    return "Não informado";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
};

const validateRequired = (value: string) => (value.trim().length === 0 ? "Campo obrigatório" : null);

const validateEmail = (value: string) => {
  if (value.trim().length === 0) return "Campo obrigatório";
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value) ? null : "Informe um e-mail válido";
};

const validatePhone = (value: string) => {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10 ? null : "Informe um telefone válido";
};

const validateCpf = (value: string) => {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 0) {
    return null;
  }
  return digits.length === 11 ? null : "Informe um CPF válido";
};

const validateZip = (value: string) => {
  if (!value) return "Campo obrigatório";
  const zipRegex = /^\d{5}-?\d{3}$/;
  return zipRegex.test(value) ? null : "CEP inválido";
};

const validateUrl = (value: string) => {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!url.protocol.startsWith("http")) {
      return "Use uma URL iniciando com http ou https";
    }
    return null;
  } catch (error) {
    return "URL inválida";
  }
};

const validateHourlyRate = (value: string) => {
  if (!value) return null;
  const digits = extractCurrencyDigits(value);
  if (!digits) {
    return "Informe um valor numérico";
  }
  return parseCurrencyDigits(digits) == null ? "Informe um valor numérico" : null;
};

const specialtiesToString = (specialties: string[]) => specialties.join(", ");

const toNullableString = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
};

const formatCpfValue = (value: string | null | undefined) => {
  if (!value) {
    return "";
  }
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length !== 11) {
    return digits;
  }
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
};

const formatCpfInputValue = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) {
    return digits;
  }
  if (digits.length <= 6) {
    return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  }
  if (digits.length <= 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  }
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
};

const isAbortError = (error: unknown): error is DOMException =>
  error instanceof DOMException && error.name === "AbortError";

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : "Não foi possível completar a ação.");

interface SelectOption {
  value: string;
  label: string;
}

const DEFAULT_TIMEZONE = "America/Sao_Paulo";

const BRAZIL_STATES: SelectOption[] = [
  { value: "AC", label: "Acre" },
  { value: "AL", label: "Alagoas" },
  { value: "AP", label: "Amapá" },
  { value: "AM", label: "Amazonas" },
  { value: "BA", label: "Bahia" },
  { value: "CE", label: "Ceará" },
  { value: "DF", label: "Distrito Federal" },
  { value: "ES", label: "Espírito Santo" },
  { value: "GO", label: "Goiás" },
  { value: "MA", label: "Maranhão" },
  { value: "MT", label: "Mato Grosso" },
  { value: "MS", label: "Mato Grosso do Sul" },
  { value: "MG", label: "Minas Gerais" },
  { value: "PA", label: "Pará" },
  { value: "PB", label: "Paraíba" },
  { value: "PR", label: "Paraná" },
  { value: "PE", label: "Pernambuco" },
  { value: "PI", label: "Piauí" },
  { value: "RJ", label: "Rio de Janeiro" },
  { value: "RN", label: "Rio Grande do Norte" },
  { value: "RS", label: "Rio Grande do Sul" },
  { value: "RO", label: "Rondônia" },
  { value: "RR", label: "Roraima" },
  { value: "SC", label: "Santa Catarina" },
  { value: "SP", label: "São Paulo" },
  { value: "SE", label: "Sergipe" },
  { value: "TO", label: "Tocantins" },
];

const TIMEZONE_OPTIONS: SelectOption[] = [
  { value: "America/Sao_Paulo", label: "America/Sao_Paulo (Brasília)" },
  { value: "America/Bahia", label: "America/Bahia" },
  { value: "America/Belem", label: "America/Belem" },
  { value: "America/Fortaleza", label: "America/Fortaleza" },
  { value: "America/Maceio", label: "America/Maceio" },
  { value: "America/Recife", label: "America/Recife" },
  { value: "America/Manaus", label: "America/Manaus" },
  { value: "America/Porto_Velho", label: "America/Porto_Velho" },
  { value: "America/Rio_Branco", label: "America/Rio_Branco" },
  { value: "America/Boa_Vista", label: "America/Boa_Vista" },
  { value: "America/Cuiaba", label: "America/Cuiaba" },
  { value: "America/Campo_Grande", label: "America/Campo_Grande" },
  { value: "America/Santarem", label: "America/Santarem" },
  { value: "America/Noronha", label: "America/Noronha" },
];

const LANGUAGE_OPTIONS: SelectOption[] = [
  { value: "Português (Brasil)", label: "Português (Brasil)" },
  { value: "Inglês", label: "Inglês" },
  { value: "Espanhol", label: "Espanhol" },
  { value: "Francês", label: "Francês" },
  { value: "Alemão", label: "Alemão" },
  { value: "Italiano", label: "Italiano" },
  { value: "Mandarim", label: "Mandarim" },
  { value: "Japonês", label: "Japonês" },
  { value: "Árabe", label: "Árabe" },
  { value: "Russo", label: "Russo" },
  { value: "Hindi", label: "Hindi" },
  { value: "Outro", label: "Outro" },
];

const extractOptionItems = (payload: unknown): Record<string, unknown>[] => {
  if (Array.isArray(payload)) {
    return payload.filter((item): item is Record<string, unknown> => item !== null && typeof item === "object");
  }

  if (payload && typeof payload === "object") {
    const directData = (payload as { data?: unknown }).data;
    if (Array.isArray(directData)) {
      return directData.filter((item): item is Record<string, unknown> => item !== null && typeof item === "object");
    }

    const directRows = (payload as { rows?: unknown }).rows;
    if (Array.isArray(directRows)) {
      return directRows.filter((item): item is Record<string, unknown> => item !== null && typeof item === "object");
    }

    const nestedRows = (payload as { data?: { rows?: unknown } }).data?.rows;
    if (Array.isArray(nestedRows)) {
      return nestedRows.filter((item): item is Record<string, unknown> => item !== null && typeof item === "object");
    }
  }

  return [];
};

const pickStringField = (item: Record<string, unknown>, fields: string[]): string => {
  for (const field of fields) {
    const value = item[field];
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) {
        return trimmed;
      }
    }
  }
  return "";
};

const ensureOptionPresence = (
  options: SelectOption[],
  value: string | null | undefined,
): SelectOption[] => {
  if (!value) {
    return options;
  }
  if (options.some((option) => option.value === value)) {
    return options;
  }
  return [...options, { value, label: value }];
};

const ensureOptionsPresence = (options: SelectOption[], values: string[]): SelectOption[] => {
  if (values.length === 0) {
    return options;
  }
  const existing = new Set(options.map((option) => option.value));
  const additions = values
    .filter((value) => value && !existing.has(value))
    .map((value) => ({ value, label: value }));
  if (additions.length === 0) {
    return options;
  }
  return [...options, ...additions];
};

const splitCommaSeparatedValues = (value: string | null | undefined): string[] => {
  if (!value) {
    return [];
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

const hourlyRateToInputValue = (value: number | null | undefined): string => {
  if (value == null) {
    return "";
  }
  const cents = Math.round(value * 100);
  if (!Number.isFinite(cents)) {
    return "";
  }
  return formatCurrencyInputValue(String(Math.max(cents, 0)));
};

interface EditableSelectFieldProps {
  label: string;
  value: string | null;
  options: SelectOption[];
  onSave: (value: string | null) => Promise<void> | void;
  placeholder?: string;
  disabled?: boolean;
  isLoading?: boolean;
  emptyMessage?: string;
  emptyMessageTone?: "muted" | "error";
  allowEmpty?: boolean;
  defaultValue?: string | null;
}

const EditableSelectField = ({
  label,
  value,
  options,
  onSave,
  placeholder,
  disabled,
  isLoading,
  emptyMessage,
  emptyMessageTone = "muted",
  allowEmpty = true,
  defaultValue = null,
}: EditableSelectFieldProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState<string>(value ?? defaultValue ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isEditing) {
      setEditValue(value ?? defaultValue ?? "");
    }
  }, [value, defaultValue, isEditing]);

  const selectedLabel = value
    ? options.find((option) => option.value === value)?.label ?? value
    : "";

  const resolvedPlaceholder = placeholder ?? "Selecione uma opção";
  const resolvedEmptyMessage = emptyMessage ?? "Nenhuma opção disponível.";
  const messageClass = emptyMessageTone === "error" ? "text-destructive" : "text-muted-foreground";

  const startEditing = () => {
    setEditValue(value ?? defaultValue ?? "");
    setError(null);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setEditValue(value ?? defaultValue ?? "");
    setError(null);
    setIsEditing(false);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const resolvedValue = editValue || (allowEmpty ? "" : defaultValue ?? "");
      await onSave(resolvedValue === "" ? null : resolvedValue);
      setIsEditing(false);
      setError(null);
    } catch (saveError) {
      const message =
        saveError instanceof Error ? saveError.message : "Não foi possível salvar as alterações.";
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-muted-foreground">{label}</label>
        {!isEditing && !disabled && (
          <Button
            variant="ghost"
            size="sm"
            onClick={startEditing}
            className="h-6 w-6 p-0 hover:bg-accent"
          >
            <Edit2 className="h-3 w-3" />
          </Button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando opções...</p>
          ) : options.length > 0 || allowEmpty ? (
            <>
              <Select
                value={
                  editValue === "" && allowEmpty ? EMPTY_SELECT_VALUE : editValue
                }
                onValueChange={(newValue) =>
                  setEditValue(newValue === EMPTY_SELECT_VALUE ? "" : newValue)
                }
                disabled={isSaving || disabled || (options.length === 0 && !allowEmpty)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={resolvedPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  {allowEmpty && (
                    <SelectItem value={EMPTY_SELECT_VALUE}>Nenhum</SelectItem>
                  )}
                  {options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {options.length === 0 && emptyMessage && (
                <p className={cn("text-xs", messageClass)}>{emptyMessage}</p>
              )}
            </>
          ) : (
            <p className={cn("text-sm", messageClass)}>{resolvedEmptyMessage}</p>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleSave}
              className="h-7"
              disabled={isSaving || (options.length === 0 && !allowEmpty)}
            >
              {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3 mr-1" />}
              {isSaving ? "Salvando" : "Salvar"}
            </Button>
            <Button variant="outline" size="sm" onClick={handleCancel} className="h-7" disabled={isSaving}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm bg-muted/50 p-3 rounded-md min-h-[2.5rem] flex items-center">
          {selectedLabel || <span className="text-muted-foreground italic">Não informado</span>}
        </p>
      )}
    </div>
  );
};

interface EditableMultiSelectFieldProps {
  label: string;
  values: string[];
  options: SelectOption[];
  onSave: (values: string[]) => Promise<void> | void;
  placeholder?: string;
  disabled?: boolean;
  isLoading?: boolean;
  emptyMessage?: string;
  emptyMessageTone?: "muted" | "error";
}

const EditableMultiSelectField = ({
  label,
  values,
  options,
  onSave,
  placeholder,
  disabled,
  isLoading,
  emptyMessage,
  emptyMessageTone = "muted",
}: EditableMultiSelectFieldProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(values);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isEditing) {
      setSelected(values);
    }
  }, [values, isEditing]);

  const optionMap = useMemo(() => {
    const map = new Map<string, string>();
    options.forEach((option) => {
      map.set(option.value, option.label);
    });
    return map;
  }, [options]);

  const selectedLabels = values.map((item) => optionMap.get(item) ?? item);
  const displayValue = selectedLabels.join(", ");
  const resolvedPlaceholder = placeholder ?? "Selecione uma ou mais opções";
  const resolvedEmptyMessage = emptyMessage ?? "Nenhuma opção disponível.";
  const messageClass = emptyMessageTone === "error" ? "text-destructive" : "text-muted-foreground";

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const triggerLabel = selected.length
    ? `${selected.length} opção${selected.length > 1 ? "s" : ""} selecionada${
        selected.length > 1 ? "s" : ""
      }`
    : resolvedPlaceholder;

  const startEditing = () => {
    setSelected(values);
    setError(null);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setSelected(values);
    setError(null);
    setOpen(false);
    setIsEditing(false);
  };

  const toggleSelection = (optionValue: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(optionValue)) {
        next.delete(optionValue);
      } else {
        next.add(optionValue);
      }
      return Array.from(next);
    });
  };

  const clearSelection = () => {
    setSelected([]);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await onSave(selected);
      setIsEditing(false);
      setOpen(false);
      setError(null);
    } catch (saveError) {
      const message =
        saveError instanceof Error ? saveError.message : "Não foi possível salvar as alterações.";
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-muted-foreground">{label}</label>
        {!isEditing && !disabled && (
          <Button
            variant="ghost"
            size="sm"
            onClick={startEditing}
            className="h-6 w-6 p-0 hover:bg-accent"
          >
            <Edit2 className="h-3 w-3" />
          </Button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando opções...</p>
          ) : options.length > 0 ? (
            <>
              <Popover open={open} onOpenChange={(next) => !isSaving && setOpen(next)}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between"
                    disabled={disabled || isSaving}
                  >
                    <span className="truncate text-left">{triggerLabel}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[min(420px,90vw)] p-0">
                  <Command>
                    <CommandInput placeholder="Buscar..." />
                    <CommandList>
                      <CommandEmpty>Nenhuma opção encontrada.</CommandEmpty>
                      <CommandGroup>
                        {options.map((option) => {
                          const isSelected = selectedSet.has(option.value);
                          return (
                            <CommandItem
                              key={option.value}
                              value={option.label}
                              onSelect={() => toggleSelection(option.value)}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  isSelected ? "opacity-100" : "opacity-0",
                                )}
                              />
                              <span className="flex-1 truncate">{option.label}</span>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {selected.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {selected.map((item) => (
                    <Badge key={item} variant="secondary">
                      {optionMap.get(item) ?? item}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Nenhuma opção selecionada.</p>
              )}
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={clearSelection} disabled={isSaving}>
                  Limpar seleção
                </Button>
              </div>
            </>
          ) : (
            <p className={cn("text-sm", messageClass)}>{resolvedEmptyMessage}</p>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} className="h-7" disabled={isSaving}>
              {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3 mr-1" />}
              {isSaving ? "Salvando" : "Salvar"}
            </Button>
            <Button variant="outline" size="sm" onClick={handleCancel} className="h-7" disabled={isSaving}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm bg-muted/50 p-3 rounded-md min-h-[2.5rem] flex items-center">
          {displayValue ? (
            <span className="truncate">{displayValue}</span>
          ) : (
            <span className="text-muted-foreground italic">Não informado</span>
          )}
        </p>
      )}
    </div>
  );
};

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        resolve(result);
      } else {
        reject(new Error("Formato de arquivo inválido."));
      }
    };
    reader.onerror = () => reject(new Error("Não foi possível processar o arquivo selecionado."));
    reader.readAsDataURL(file);
  });

export default function MeuPerfil() {
  const [profile, setProfile] = useState<MeuPerfilProfile | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isAuditLoading, setIsAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);

  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [isSessionsLoading, setIsSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState<string | null>(null);

  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const [officeOptions, setOfficeOptions] = useState<SelectOption[]>([]);
  const [isOfficeLoading, setIsOfficeLoading] = useState(false);
  const [officeError, setOfficeError] = useState<string | null>(null);

  const [specialtyOptions, setSpecialtyOptions] = useState<SelectOption[]>([]);
  const [isSpecialtyLoading, setIsSpecialtyLoading] = useState(false);
  const [specialtyError, setSpecialtyError] = useState<string | null>(null);

  const latestZipLookupIdRef = useRef(0);
  const zipLookupAbortRef = useRef<AbortController | null>(null);

  const loadProfile = useCallback(async (signal?: AbortSignal) => {
    setIsProfileLoading(true);
    setProfileError(null);
    try {
      const data = await fetchMeuPerfil({ signal });
      setProfile(data);
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }
      setProfileError(errorMessage(error));
    } finally {
      setIsProfileLoading(false);
    }
  }, []);

  const loadAuditLogs = useCallback(async (signal?: AbortSignal) => {
    setIsAuditLoading(true);
    setAuditError(null);
    try {
      const data = await fetchMeuPerfilAuditLogs({ signal, limit: 20 });
      setAuditLogs(data);
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }
      setAuditError(errorMessage(error));
    } finally {
      setIsAuditLoading(false);
    }
  }, []);

  const loadSessions = useCallback(async (signal?: AbortSignal) => {
    setIsSessionsLoading(true);
    setSessionsError(null);
    try {
      const data = await fetchMeuPerfilSessions({ signal });
      setSessions(data);
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }
      setSessionsError(errorMessage(error));
    } finally {
      setIsSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    const profileController = new AbortController();
    const logsController = new AbortController();
    const sessionsController = new AbortController();

    void loadProfile(profileController.signal);
    void loadAuditLogs(logsController.signal);
    void loadSessions(sessionsController.signal);

    return () => {
      profileController.abort();
      logsController.abort();
      sessionsController.abort();
    };
  }, [loadProfile, loadAuditLogs, loadSessions]);

  const officeOptionsWithCurrent = useMemo(
    () => ensureOptionPresence(officeOptions, profile?.office ?? null),
    [officeOptions, profile?.office],
  );

  const specialtyOptionsWithCurrent = useMemo(
    () => ensureOptionsPresence(specialtyOptions, profile?.specialties ?? []),
    [specialtyOptions, profile?.specialties],
  );

  const languageValues = useMemo(
    () => splitCommaSeparatedValues(profile?.language ?? null),
    [profile?.language],
  );

  const languageOptionsWithCurrent = useMemo(
    () => ensureOptionsPresence(LANGUAGE_OPTIONS, languageValues),
    [languageValues],
  );

  const timezoneOptionsWithCurrent = useMemo(
    () => ensureOptionPresence(TIMEZONE_OPTIONS, profile?.timezone ?? null),
    [profile?.timezone],
  );

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const loadOffices = async () => {
      setIsOfficeLoading(true);
      setOfficeError(null);
      try {
        const response = await fetch(getApiUrl("escritorios"), {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });

        let json: unknown = null;
        try {
          json = await response.json();
        } catch (parseError) {
          console.error("Não foi possível interpretar a resposta de escritórios", parseError);
        }

        if (!response.ok) {
          throw new Error(
            json && typeof json === "object" && "error" in json && typeof (json as { error?: unknown }).error === "string"
              ? String((json as { error: string }).error)
              : `Não foi possível carregar os escritórios (HTTP ${response.status})`,
          );
        }

        const items = extractOptionItems(json);
        const options = items
          .map((item) => {
            const name = pickStringField(item, ["nome", "nome_fantasia", "razao_social", "descricao"]);
            return name ? ({ value: name, label: name } as SelectOption) : null;
          })
          .filter((option): option is SelectOption => option !== null)
          .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));

        if (!cancelled) {
          setOfficeOptions(options);
        }
      } catch (error) {
        if (isAbortError(error)) {
          return;
        }
        console.error(error);
        if (!cancelled) {
          setOfficeOptions([]);
          setOfficeError(error instanceof Error ? error.message : "Erro ao carregar escritórios.");
        }
      } finally {
        if (!cancelled) {
          setIsOfficeLoading(false);
        }
      }
    };

    void loadOffices();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const loadSpecialties = async () => {
      setIsSpecialtyLoading(true);
      setSpecialtyError(null);
      try {
        const response = await fetch(getApiUrl("areas"), {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });

        let json: unknown = null;
        try {
          json = await response.json();
        } catch (parseError) {
          console.error("Não foi possível interpretar a resposta de áreas", parseError);
        }

        if (!response.ok) {
          throw new Error(
            json && typeof json === "object" && "error" in json && typeof (json as { error?: unknown }).error === "string"
              ? String((json as { error: string }).error)
              : `Não foi possível carregar as áreas de atuação (HTTP ${response.status})`,
          );
        }

        const items = extractOptionItems(json);
        const options = items
          .map((item) => {
            const name = pickStringField(item, ["nome", "descricao", "label", "name"]);
            return name ? ({ value: name, label: name } as SelectOption) : null;
          })
          .filter((option): option is SelectOption => option !== null)
          .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));

        if (!cancelled) {
          setSpecialtyOptions(options);
        }
      } catch (error) {
        if (isAbortError(error)) {
          return;
        }
        console.error(error);
        if (!cancelled) {
          setSpecialtyOptions([]);
          setSpecialtyError(error instanceof Error ? error.message : "Erro ao carregar especialidades.");
        }
      } finally {
        if (!cancelled) {
          setIsSpecialtyLoading(false);
        }
      }
    };

    void loadSpecialties();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  const mutateProfile = useCallback(
    async (payload: UpdateMeuPerfilPayload) => {
      setMutationError(null);
      setIsUpdatingProfile(true);
      try {
        const updated = await updateMeuPerfil(payload);
        setProfile(updated);
        await loadAuditLogs();
        return updated;
      } catch (error) {
        if (isAbortError(error)) {
          return null;
        }
        const message = errorMessage(error);
        setMutationError(message);
        throw error instanceof Error ? error : new Error(message);
      } finally {
        setIsUpdatingProfile(false);
      }
    },
    [loadAuditLogs],
  );

  const buildFieldSaveHandler = useCallback(
    (field: "name" | "title" | "email" | "phone" | "bio" | "oabNumber" | "linkedin" | "website") =>
      async (rawValue: string) => {
        await mutateProfile({ [field]: toNullableString(rawValue) } as UpdateMeuPerfilPayload);
      },
    [mutateProfile],
  );

  const handleCpfSave = useCallback(
    async (rawValue: string) => {
      const digits = rawValue.replace(/\D/g, "");
      await mutateProfile({ cpf: digits.length === 0 ? null : digits });
    },
    [mutateProfile],
  );

  const handleAddressSave = useCallback(
    (field: "street" | "number" | "complement" | "neighborhood" | "city" | "state" | "zip") =>
      async (rawValue: string) => {
        await mutateProfile({ address: { [field]: toNullableString(rawValue) } });
      },
    [mutateProfile],
  );

  const handleZipSave = useCallback(
    async (rawValue: string) => {
      const zipValue = toNullableString(rawValue);
      const address: NonNullable<UpdateMeuPerfilPayload["address"]> = { zip: zipValue };
      const digits = zipValue?.replace(/\D/g, "") ?? "";
      const requestId = latestZipLookupIdRef.current + 1;
      latestZipLookupIdRef.current = requestId;

      if (digits.length === 8) {
        const controller = new AbortController();
        zipLookupAbortRef.current?.abort();
        zipLookupAbortRef.current = controller;
        try {
          const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
            signal: controller.signal,
          });
          if (response.ok) {
            const data = (await response.json()) as {
              logradouro?: string;
              bairro?: string;
              localidade?: string;
              uf?: string;
              erro?: boolean;
            };

            if (requestId !== latestZipLookupIdRef.current) {
              return;
            }

            if (!data?.erro) {
              if (typeof data.logradouro === "string") {
                const street = toNullableString(data.logradouro);
                if (street !== null) {
                  address.street = street;
                }
              }

              if (typeof data.bairro === "string") {
                const neighborhood = toNullableString(data.bairro);
                if (neighborhood !== null) {
                  address.neighborhood = neighborhood;
                }
              }

              if (typeof data.localidade === "string") {
                const city = toNullableString(data.localidade);
                if (city !== null) {
                  address.city = city;
                }
              }

              if (typeof data.uf === "string") {
                const state = toNullableString(data.uf);
                if (state !== null) {
                  address.state = state;
                }
              }
            }
          }
        } catch (error) {
          if (isAbortError(error)) {
            return;
          }
          console.error("Erro ao buscar CEP:", error);
        } finally {
          if (zipLookupAbortRef.current === controller) {
            zipLookupAbortRef.current = null;
          }
        }
      }

      await mutateProfile({ address });
    },
    [mutateProfile],
  );

  const handleSpecialtiesSave = useCallback(
    async (values: string[]) => {
      const normalized = values
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
      await mutateProfile({ specialties: normalized });
    },
    [mutateProfile],
  );

  const handleOfficeSave = useCallback(
    async (selected: string | null) => {
      const normalized = selected == null ? null : toNullableString(selected);
      await mutateProfile({ office: normalized });
    },
    [mutateProfile],
  );

  const handleOabUfSave = useCallback(
    async (selected: string | null) => {
      const normalized = selected == null ? null : toNullableString(selected);
      await mutateProfile({ oabUf: normalized });
    },
    [mutateProfile],
  );

  const handleTimezoneSave = useCallback(
    async (selected: string | null) => {
      const value = selected ?? DEFAULT_TIMEZONE;
      await mutateProfile({ timezone: value });
    },
    [mutateProfile],
  );

  const handleLanguageSave = useCallback(
    async (values: string[]) => {
      const normalized = values
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
      await mutateProfile({ language: normalized.length ? normalized.join(", ") : null });
    },
    [mutateProfile],
  );

  const handleHourlyRateSave = useCallback(
    async (value: string) => {
      const digits = extractCurrencyDigits(value);
      if (!digits) {
        await mutateProfile({ hourlyRate: null });
        return;
      }

      const parsed = parseCurrencyDigits(digits);
      if (parsed == null) {
        throw new Error("Informe um valor numérico");
      }
      await mutateProfile({ hourlyRate: parsed });
    },
    [mutateProfile],
  );

  const handleNotificationToggle = useCallback(
    async (field: keyof MeuPerfilProfile["notifications"], checked: boolean) => {
      let previousValue: boolean | undefined;
      setProfile((prev) => {
        if (!prev) {
          previousValue = undefined;
          return prev;
        }

        previousValue = prev.notifications[field];
        return {
          ...prev,
          notifications: {
            ...prev.notifications,
            [field]: checked,
          },
        } satisfies MeuPerfilProfile;
      });

      try {
        await mutateProfile({ notifications: { [field]: checked } });
      } catch (error) {
        setProfile((prev) => {
          if (!prev) {
            return prev;
          }
          return {
            ...prev,
            notifications: {
              ...prev.notifications,
              [field]: previousValue ?? false,
            },
          } satisfies MeuPerfilProfile;
        });
        throw error;
      }
    },
    [mutateProfile],
  );

  const handleSecurityToggle = useCallback(
    async (field: keyof MeuPerfilProfile["security"], checked: boolean) => {
      let previousValue: boolean | undefined;
      setProfile((prev) => {
        if (!prev) {
          previousValue = undefined;
          return prev;
        }

        previousValue = prev.security[field];
        return {
          ...prev,
          security: {
            ...prev.security,
            [field]: checked,
          },
        } satisfies MeuPerfilProfile;
      });

      try {
        await mutateProfile({ security: { [field]: checked } });
      } catch (error) {
        setProfile((prev) => {
          if (!prev) {
            return prev;
          }
          return {
            ...prev,
            security: {
              ...prev.security,
              [field]: previousValue ?? false,
            },
          } satisfies MeuPerfilProfile;
        });
        throw error;
      }
    },
    [mutateProfile],
  );

  const handleAvatarChange = useCallback(
    async (file: File | null) => {
      if (file) {
        const dataUrl = await readFileAsDataUrl(file);
        await mutateProfile({ avatarUrl: dataUrl });
        return;
      }
      await mutateProfile({ avatarUrl: null });
    },
    [mutateProfile],
  );

  const handleRevokeSession = useCallback(
    async (sessionId: string) => {
      setSessionsError(null);
      try {
        const session = await revokeMeuPerfilSession(sessionId);
        setSessions((prev) =>
          prev.map((item) => (item.id === session.id ? session : item)),
        );
        await loadAuditLogs();
      } catch (error) {
        const message = errorMessage(error);
        setSessionsError(message);
        throw error instanceof Error ? error : new Error(message);
      }
    },
    [loadAuditLogs],
  );

  const handleRevokeAllSessions = useCallback(async () => {
    setSessionsError(null);
    try {
      await revokeTodasMeuPerfilSessions();
      await loadSessions();
      await loadAuditLogs();
    } catch (error) {
      const message = errorMessage(error);
      setSessionsError(message);
      throw error instanceof Error ? error : new Error(message);
    }
  }, [loadAuditLogs, loadSessions]);

  const handleExportData = useCallback(async () => {
    setExportError(null);
    setIsExporting(true);
    try {
      const [profileData, auditData, sessionsData] = await Promise.all([
        fetchMeuPerfil(),
        fetchMeuPerfilAuditLogs({ limit: 100 }),
        fetchMeuPerfilSessions(),
      ]);

      const payload = {
        generatedAt: new Date().toISOString(),
        profile: profileData,
        auditLogs: auditData,
        sessions: sessionsData,
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `jusconnect-perfil-${new Date().toISOString()}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setExportError(errorMessage(error));
    } finally {
      setIsExporting(false);
    }
  }, []);

  const initials = useMemo(() => {
    if (!profile?.name) {
      return "JP";
    }

    return profile.name
      .split(" ")
      .filter(Boolean)
      .map((word) => word[0])
      .join("")
      .toUpperCase();
  }, [profile?.name]);

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold text-foreground">Meu Perfil</h1>
        <p className="text-muted-foreground">
          Personalize suas informações profissionais, controle seus acessos e mantenha seus dados sempre atualizados.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <ProfileCard
            title="Identidade Profissional"
            icon={<UserIcon className="h-5 w-5" />}
            isLoading={isProfileLoading}
            error={profileError}
            onRetry={() => void loadProfile()}
            emptyState={<p className="text-sm text-muted-foreground">Nenhuma informação disponível.</p>}
          >
            {profile && (
              <div className="flex flex-col gap-6 md:flex-row">
                <div className="flex flex-col items-center gap-4">
                  <AvatarUploader currentAvatar={profile.avatarUrl ?? undefined} userName={profile.name} onAvatarChange={handleAvatarChange} />
                </div>

                <div className="flex-1 space-y-4">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16">
                      <AvatarImage src={profile.avatarUrl ?? undefined} alt={profile.name} />
                      <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>

                    <div className="space-y-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h2 className="text-2xl font-semibold text-foreground">{profile.name}</h2>
                        {profile.office && <Badge variant="outline">{profile.office}</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">Membro desde {formatDate(profile.memberSince)}</p>
                    </div>
                  </div>

                  {mutationError && <p className="text-sm text-destructive">{mutationError}</p>}

                  <div className="grid gap-4 md:grid-cols-2">
                    <EditableField
                      label="Nome completo"
                      value={profile.name}
                      onSave={buildFieldSaveHandler("name")}
                      validation={validateRequired}
                      disabled={isUpdatingProfile}
                    />
                    <EditableField
                      label="Título profissional"
                      value={profile.title ?? ""}
                      onSave={buildFieldSaveHandler("title")}
                      placeholder="Ex: Advogado Sênior"
                      disabled={isUpdatingProfile}
                    />
                    <EditableField
                      label="E-mail"
                      value={profile.email}
                      onSave={buildFieldSaveHandler("email")}
                      type="email"
                      validation={validateEmail}
                      disabled={isUpdatingProfile}
                    />
                    <EditableField
                      label="CPF"
                      value={formatCpfValue(profile.cpf)}
                      onSave={handleCpfSave}
                      validation={validateCpf}
                      disabled={isUpdatingProfile}
                      onEditChange={formatCpfInputValue}
                    />
                    <EditableField
                      label="Telefone"
                      value={profile.phone ?? ""}
                      onSave={buildFieldSaveHandler("phone")}
                      type="tel"
                      validation={validatePhone}
                      disabled={isUpdatingProfile}
                    />
                  </div>

                  <EditableField
                    label="Biografia"
                    value={profile.bio ?? ""}
                    onSave={buildFieldSaveHandler("bio")}
                    type="textarea"
                    placeholder="Compartilhe sua experiência profissional"
                    disabled={isUpdatingProfile}
                  />

                  <div className="grid gap-4 md:grid-cols-2">
                    <EditableSelectField
                      label="Escritório"
                      value={profile.office ?? null}
                      options={officeOptionsWithCurrent}
                      onSave={handleOfficeSave}
                      placeholder="Selecione o escritório"
                      disabled={isUpdatingProfile}
                      isLoading={isOfficeLoading}
                      emptyMessage={officeError ?? "Nenhum escritório disponível."}
                      emptyMessageTone={officeError ? "error" : "muted"}
                    />
                    <EditableMultiSelectField
                      label="Especialidades"
                      values={profile.specialties}
                      options={specialtyOptionsWithCurrent}
                      onSave={handleSpecialtiesSave}
                      placeholder="Selecione as especialidades"
                      disabled={isUpdatingProfile}
                      isLoading={isSpecialtyLoading}
                      emptyMessage={specialtyError ?? "Nenhuma especialidade disponível."}
                      emptyMessageTone={specialtyError ? "error" : "muted"}
                    />
                    <EditableField
                      label="OAB"
                      value={profile.oabNumber ?? ""}
                      onSave={buildFieldSaveHandler("oabNumber")}
                      placeholder="Número da OAB"
                      disabled={isUpdatingProfile}
                    />
                    <EditableSelectField
                      label="UF"
                      value={profile.oabUf ?? null}
                      options={ensureOptionPresence(BRAZIL_STATES, profile.oabUf ?? null)}
                      onSave={handleOabUfSave}
                      placeholder="Selecione a UF"
                      disabled={isUpdatingProfile}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <EditableField
                      label="Tarifa por hora"
                      value={hourlyRateToInputValue(profile.hourlyRate)}
                      onSave={handleHourlyRateSave}
                      validation={validateHourlyRate}
                      placeholder="Ex: R$ 450,00"
                      disabled={isUpdatingProfile}
                      onEditChange={(input) => formatCurrencyInputValue(extractCurrencyDigits(input))}
                    />
                    <EditableSelectField
                      label="Fuso horário"
                      value={profile.timezone ?? null}
                      options={timezoneOptionsWithCurrent}
                      onSave={handleTimezoneSave}
                      placeholder="Selecione o fuso horário"
                      disabled={isUpdatingProfile}
                      allowEmpty={false}
                      defaultValue={DEFAULT_TIMEZONE}
                    />
                    <EditableMultiSelectField
                      label="Idioma"
                      values={languageValues}
                      options={languageOptionsWithCurrent}
                      onSave={handleLanguageSave}
                      placeholder="Selecione os idiomas"
                      disabled={isUpdatingProfile}
                    />
                    <EditableField
                      label="LinkedIn"
                      value={profile.linkedin ?? ""}
                      onSave={buildFieldSaveHandler("linkedin")}
                      placeholder="URL do LinkedIn"
                      validation={validateUrl}
                      disabled={isUpdatingProfile}
                    />
                    <EditableField
                      label="Website"
                      value={profile.website ?? ""}
                      onSave={buildFieldSaveHandler("website")}
                      placeholder="URL do seu site"
                      validation={validateUrl}
                      disabled={isUpdatingProfile}
                    />
                  </div>
                </div>
              </div>
            )}
          </ProfileCard>

          <ProfileCard
            title="Endereço"
            icon={<MapPin className="h-5 w-5" />}
            isLoading={isProfileLoading}
            error={profileError}
            onRetry={() => void loadProfile()}
            emptyState={<p className="text-sm text-muted-foreground">Nenhum endereço cadastrado.</p>}
          >
            {profile && (
              <div className="grid gap-4 md:grid-cols-2">
                <EditableField
                  label="CEP"
                  value={profile.address.zip ?? ""}
                  onSave={handleZipSave}
                  validation={validateZip}
                  disabled={isUpdatingProfile}
                />
                <EditableField
                  label="Rua"
                  value={profile.address.street ?? ""}
                  onSave={handleAddressSave("street")}
                  disabled={isUpdatingProfile}
                />
                <EditableField
                  label="Cidade"
                  value={profile.address.city ?? ""}
                  onSave={handleAddressSave("city")}
                  disabled={isUpdatingProfile}
                />
                <EditableField
                  label="Estado"
                  value={profile.address.state ?? ""}
                  onSave={handleAddressSave("state")}
                  disabled={isUpdatingProfile}
                />
              </div>
            )}
          </ProfileCard>

          <ProfileCard
            title="Preferências"
            icon={<Bell className="h-5 w-5" />}
            isLoading={isProfileLoading}
            error={profileError}
            onRetry={() => void loadProfile()}
          >
            {profile && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-primary" />
                      <span>Alertas de segurança</span>
                    </div>
                    <Switch
                      checked={profile.notifications.securityAlerts}
                      onCheckedChange={(checked) => handleNotificationToggle("securityAlerts", checked).catch(() => {})}
                      disabled={isUpdatingProfile}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Receba notificações sobre atividades suspeitas e novos dispositivos.
                  </p>
                </div>

                <div className="space-y-2 border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-primary" />
                      <span>Lembretes da agenda</span>
                    </div>
                    <Switch
                      checked={profile.notifications.agendaReminders}
                      onCheckedChange={(checked) => handleNotificationToggle("agendaReminders", checked).catch(() => {})}
                      disabled={isUpdatingProfile}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Seja avisado sobre compromissos e prazos importantes.</p>
                </div>

                <div className="space-y-2 border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      <span>Newsletter</span>
                    </div>
                    <Switch
                      checked={profile.notifications.newsletter}
                      onCheckedChange={(checked) => handleNotificationToggle("newsletter", checked).catch(() => {})}
                      disabled={isUpdatingProfile}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Receba novidades e materiais exclusivos da JusConnect.</p>
                </div>

                <div className="space-y-2 border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Scale className="h-4 w-4 text-primary" />
                      <span>Políticas e compliance</span>
                    </div>
                    <Switch checked readOnly disabled />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Notificações críticas relacionadas às políticas do escritório são sempre enviadas.
                  </p>
                </div>
              </div>
            )}
          </ProfileCard>

          <ProfileCard
            title="Segurança"
            icon={<Shield className="h-5 w-5" />}
            isLoading={isProfileLoading}
            error={profileError}
            onRetry={() => void loadProfile()}
          >
            {profile && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-primary" />
                      <span>Autenticação em duas etapas</span>
                    </div>
                    <Switch
                      checked={profile.security.twoFactor}
                      onCheckedChange={(checked) => handleSecurityToggle("twoFactor", checked).catch(() => {})}
                      disabled={isUpdatingProfile}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Exige um segundo fator de autenticação para novos acessos.
                  </p>
                </div>

                <div className="space-y-2 border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-primary" />
                      <span>Alertas de login</span>
                    </div>
                    <Switch
                      checked={profile.security.loginAlerts}
                      onCheckedChange={(checked) => handleSecurityToggle("loginAlerts", checked).catch(() => {})}
                      disabled={isUpdatingProfile}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Seja avisado sempre que uma nova sessão for iniciada.
                  </p>
                </div>

                <div className="space-y-2 border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4 text-primary" />
                      <span>Aprovação de dispositivos</span>
                    </div>
                    <Switch
                      checked={profile.security.deviceApproval}
                      onCheckedChange={(checked) => handleSecurityToggle("deviceApproval", checked).catch(() => {})}
                      disabled={isUpdatingProfile}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Novos dispositivos precisam ser autorizados antes de acessar o sistema.
                  </p>
                </div>

                <div className="space-y-2 border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-primary" />
                      <span>Último acesso</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{formatDate(profile.lastLogin)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Manter a autenticação atualizada aumenta a proteção dos seus dados.
                  </p>
                </div>
              </div>
            )}
          </ProfileCard>
        </div>

        <div className="space-y-6">
          <ProfileCard
            title="Resumo Profissional"
            icon={<Briefcase className="h-5 w-5" />}
            isLoading={isProfileLoading}
            error={profileError}
            onRetry={() => void loadProfile()}
          >
            {profile && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Tarifa por hora</span>
                  <span className="font-medium text-foreground">{formatCurrency(profile.hourlyRate)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Especialidades</span>
                  <span className="font-medium text-foreground text-right">
                    {profile.specialties.length > 0 ? specialtiesToString(profile.specialties) : "Não informado"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Website</span>
                  <span className="font-medium text-foreground break-all">
                    {profile.website ? (
                      <a href={profile.website} target="_blank" rel="noreferrer" className="text-primary underline">
                        {profile.website}
                      </a>
                    ) : (
                      "Não informado"
                    )}
                  </span>
                </div>
              </div>
            )}
          </ProfileCard>

          <ProfileCard title="Exportar dados" icon={<FileText className="h-5 w-5" /> }>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Baixe uma cópia de todas as suas informações de perfil, histórico de auditoria e sessões ativas.
              </p>
              {exportError && <p className="text-sm text-destructive">{exportError}</p>}
              <Button onClick={() => void handleExportData()} disabled={isExporting} className="w-full">
                {isExporting ? "Preparando..." : "Exportar dados"}
              </Button>
            </div>
          </ProfileCard>

          <ProfileCard
            title="Histórico recente"
            icon={<Activity className="h-5 w-5" />}
            isLoading={isAuditLoading}
            error={auditError}
            onRetry={() => void loadAuditLogs()}
          >
            <AuditTimeline logs={auditLogs} maxItems={5} />
          </ProfileCard>

          <ProfileCard
            title="Sessões ativas"
            icon={<Shield className="h-5 w-5" />}
            isLoading={isSessionsLoading}
            error={sessionsError}
            onRetry={() => void loadSessions()}
          >
            <SessionsList
              sessions={sessions}
              onRevokeSession={handleRevokeSession}
              onRevokeAllSessions={handleRevokeAllSessions}
              onReload={() => loadSessions()}
            />
          </ProfileCard>

          <ProfileCard
            title="Acesso rápido"
            icon={<Link className="h-5 w-5" />}
            isLoading={isProfileLoading}
            error={profileError}
            onRetry={() => void loadProfile()}
            emptyState={<p className="text-sm text-muted-foreground">Sem links disponíveis.</p>}
          >
            {profile && (
              <div className="space-y-2">
                <Button variant="outline" className="w-full" asChild>
                  <a href="/configuracoes/usuarios/sessoes" className="flex items-center justify-center gap-2">
                    <Shield className="h-4 w-4" /> Gerenciar sessões
                  </a>
                </Button>
                {profile.linkedin && (
                  <Button variant="outline" className="w-full" asChild>
                    <a href={profile.linkedin} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2">
                      <Link className="h-4 w-4" /> Perfil no LinkedIn
                    </a>
                  </Button>
                )}
              </div>
            )}
          </ProfileCard>
        </div>
      </div>
    </div>
  );
}
