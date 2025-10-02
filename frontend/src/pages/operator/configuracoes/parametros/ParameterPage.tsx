import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getApiBaseUrl } from "@/lib/api";

interface Item { id: number; nome: string; [key: string]: string | number | boolean | null }

interface BooleanField { key: string; label: string; default?: boolean }

interface SelectField { key: string; label: string; optionsEndpoint: string }

interface SelectOption { value: string; label: string }

interface ParameterPageProps {
    title: string;
    description: string;
    placeholder: string;
    emptyMessage: string;
    endpoint?: string; // ex.: "/api/areas"
    booleanFields?: BooleanField[];
    selectField?: SelectField;
}

// junta base + path sem barras duplicadas/faltando
function joinUrl(base: string, path = "") {
    const b = base.replace(/\/+$/, "");
    const p = path ? (path.startsWith("/") ? path : `/${path}`) : "";
    return `${b}${p}`;
}

export default function ParameterPage({
    title, description, placeholder, emptyMessage, endpoint, booleanFields, selectField,
}: ParameterPageProps) {
    const apiUrl = getApiBaseUrl();

    const [items, setItems] = useState<Item[]>([]);
    const [newItem, setNewItem] = useState("");
    const [newBooleans, setNewBooleans] = useState<Record<string, boolean>>({});
    const [newSelectValue, setNewSelectValue] = useState<string | undefined>(undefined);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editingName, setEditingName] = useState("");
    const [editingBooleans, setEditingBooleans] = useState<Record<string, boolean>>({});
    const [editingSelectValue, setEditingSelectValue] = useState<string | undefined>(undefined);
    const [selectOptions, setSelectOptions] = useState<SelectOption[]>([]);
    const [selectLoading, setSelectLoading] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    useEffect(() => {
        if (!selectField) {
            setSelectOptions([]);
            setNewSelectValue(undefined);
            setEditingSelectValue(undefined);
            return;
        }
        const url = joinUrl(apiUrl, selectField.optionsEndpoint);
        let cancelled = false;
        setSelectLoading(true);
        (async () => {
            try {
                const res = await fetch(url, { headers: { Accept: "application/json" } });
                if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
                const data = await res.json();
                const parsed: unknown[] =
                    Array.isArray(data) ? data :
                        Array.isArray(data?.rows) ? data.rows :
                            Array.isArray(data?.data?.rows) ? data.data.rows :
                                Array.isArray(data?.data) ? data.data : [];
                if (!cancelled) {
                    setSelectOptions(parsed.map((r) => {
                        const option = r as { id?: number | string; nome?: string; descricao?: string; label?: string };
                        const value = option?.id != null ? String(option.id) : "";
                        const label = option?.nome ?? option?.descricao ?? option?.label ?? value;
                        return { value, label };
                    }));
                }
            } catch (e) {
                console.error(e);
                if (!cancelled) {
                    setSelectOptions([]);
                }
            } finally {
                if (!cancelled) {
                    setSelectLoading(false);
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [apiUrl, selectField]);

    const resolveSelectLabel = (value: unknown) => {
        if (value == null) return "";
        const strValue = String(value);
        const found = selectOptions.find((option) => option.value === strValue);
        return found?.label ?? strValue;
    };

    useEffect(() => {
        if (!endpoint) return;
        const url = joinUrl(apiUrl, endpoint);
        setLoading(true);
        setErrorMsg(null);
        (async () => {
            try {
                const res = await fetch(url, { headers: { Accept: "application/json" } });
                if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
                const data = await res.json();
                const parsed: unknown[] =
                    Array.isArray(data) ? data :
                        Array.isArray(data?.rows) ? data.rows :
                            Array.isArray(data?.data?.rows) ? data.data.rows :
                                Array.isArray(data?.data) ? data.data : [];
                setItems(parsed.map((r) => {
                    const item = r as { id: number | string; nome?: string; descricao?: string; name?: string; [key: string]: unknown };
                    const extra: Record<string, boolean> = {};
                    booleanFields?.forEach(f => {
                        extra[f.key] = typeof item[f.key] === 'boolean' ? (item[f.key] as boolean) : f.default ?? false;
                    });
                    const selectValue = selectField ? (item[selectField.key] as string | number | null | undefined) : undefined;
                    return {
                        id: Number(item.id),
                        nome: item.nome ?? item.descricao ?? item.name ?? "",
                        ...extra,
                        ...(selectField ? { [selectField.key]: selectValue == null ? null : (typeof selectValue === 'number' ? selectValue : Number(selectValue)) } : {}),
                    };
                }));
            } catch (e: unknown) {
                console.error(e);
                setErrorMsg(e instanceof Error ? e.message : "Erro ao buscar dados");
                setItems([]);
            } finally {
                setLoading(false);
            }
        })();
    }, [apiUrl, endpoint, booleanFields, selectField]);

    const addItem = async () => {
        const nome = newItem.trim();
        if (!nome) return;
        const payload: Record<string, unknown> = { nome, ativo: true };
        booleanFields?.forEach(f => {
            payload[f.key] = newBooleans[f.key] ?? f.default ?? false;
        });
        if (selectField) {
            payload[selectField.key] = newSelectValue ? Number(newSelectValue) : null;
        }
        if (endpoint) {
            try {
                const res = await fetch(joinUrl(apiUrl, endpoint), {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Accept: "application/json" },
                    body: JSON.stringify(payload),
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
                const created = await res.json();
                const currentSelectValue = selectField ? (newSelectValue ? Number(newSelectValue) : null) : undefined;
                const added: Item = {
                    id: Number(created?.id ?? created?.data?.id ?? Date.now()),
                    nome: created?.nome ?? created?.data?.nome ?? nome,
                };
                booleanFields?.forEach(f => {
                    added[f.key] = (created?.[f.key] ?? created?.data?.[f.key] ?? payload[f.key]) as boolean;
                });
                if (selectField) {
                    const responseValue = created?.[selectField.key] ?? created?.data?.[selectField.key] ?? currentSelectValue ?? null;
                    added[selectField.key] = responseValue == null ? null : (typeof responseValue === 'number' ? responseValue : Number(responseValue));
                }
                setItems((prev) => [...prev, added]);
            } catch (e) {
                console.error(e);
                setErrorMsg("Não foi possível criar o item.");
            }
        } else {
            setItems((prev) => [...prev, { id: Date.now(), nome, ...payload }]);
        }
        setNewItem("");
        setNewBooleans({});
        setNewSelectValue(undefined);
    };

    const startEdit = (item: Item) => {
        setEditingId(item.id);
        setEditingName(item.nome);
        const extras: Record<string, boolean> = {};
        booleanFields?.forEach(f => { extras[f.key] = item[f.key]; });
        setEditingBooleans(extras);
        if (selectField) {
            const value = item[selectField.key];
            setEditingSelectValue(value == null ? undefined : String(value));
        }
    };

    const saveEdit = async () => {
        if (editingId == null) return;
        const nome = editingName.trim();
        if (!nome) return;
        const payload: Record<string, unknown> = { nome, ativo: true };
        booleanFields?.forEach(f => {
            payload[f.key] = editingBooleans[f.key];
        });
        if (selectField) {
            payload[selectField.key] = editingSelectValue ? Number(editingSelectValue) : null;
        }
        if (endpoint) {
            try {
                const res = await fetch(joinUrl(apiUrl, `${endpoint}/${editingId}`), {
                    method: "PUT", // ou PATCH no seu backend
                    headers: { "Content-Type": "application/json", Accept: "application/json" },
                    body: JSON.stringify(payload),
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
                const updated = await res.json();
                setItems((prev) =>
                    prev.map((i) => {
                        if (i.id !== editingId) return i;
                        const newItem: Item = {
                            id: Number(updated?.id ?? editingId),
                            nome: updated?.nome ?? updated?.descricao ?? nome,
                        };
                        booleanFields?.forEach(f => {
                            newItem[f.key] = (updated?.[f.key] ?? payload[f.key]) as boolean;
                        });
                        if (selectField) {
                            const responseValue = updated?.[selectField.key] ?? payload[selectField.key] ?? null;
                            newItem[selectField.key] = responseValue == null ? null : (typeof responseValue === 'number' ? responseValue : Number(responseValue));
                        }
                        return newItem;
                    })
                );
            } catch (e) {
                console.error(e);
                setErrorMsg("Não foi possível salvar a edição.");
            }
        } else {
            setItems((prev) => prev.map((i) => (i.id === editingId ? { ...i, nome, ...payload } : i)));
        }
        setEditingId(null);
        setEditingName("");
        setEditingBooleans({});
        setEditingSelectValue(undefined);
    };

    const cancelEdit = () => { setEditingId(null); setEditingName(""); setEditingBooleans({}); setEditingSelectValue(undefined); };

    const deleteItem = async (id: number) => {
        if (endpoint) {
            try {
                const res = await fetch(joinUrl(apiUrl, `${endpoint}/${id}`), { method: "DELETE" });
                if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
            } catch (e) {
                console.error(e);
                setErrorMsg("Não foi possível excluir o item.");
                return;
            }
        }
        setItems((prev) => prev.filter((i) => i.id !== id));
    };

    const columnsCount = 1 + (selectField ? 1 : 0) + (booleanFields?.length ?? 0) + 1;

    return (
        <div className="p-4 sm:p-6 space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-foreground">{title}</h1>
                <p className="text-muted-foreground">{description}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <Input
                    placeholder={placeholder}
                    value={newItem}
                    onChange={(e) => setNewItem(e.target.value)}
                    className="max-w-sm"
                />
                {selectField && (
                    <Select
                        value={newSelectValue}
                        onValueChange={setNewSelectValue}
                        disabled={selectLoading}
                    >
                        <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder={`Selecione ${selectField.label.toLowerCase()}`} />
                        </SelectTrigger>
                        <SelectContent>
                            {selectLoading ? (
                                <SelectItem value="__loading" disabled>
                                    Carregando...
                                </SelectItem>
                            ) : selectOptions.length > 0 ? (
                                selectOptions.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))
                            ) : (
                                <SelectItem value="__empty" disabled>
                                    Nenhuma opção disponível
                                </SelectItem>
                            )}
                        </SelectContent>
                    </Select>
                )}
                {booleanFields?.map(f => (
                    <div key={f.key} className="flex items-center gap-2">
                        <Checkbox
                            id={`new-${f.key}`}
                            checked={newBooleans[f.key] ?? f.default ?? false}
                            onCheckedChange={(v) => setNewBooleans(prev => ({ ...prev, [f.key]: !!v }))}
                        />
                        <label htmlFor={`new-${f.key}`}>{f.label}</label>
                    </div>
                ))}
                <Button onClick={addItem}>
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar
                </Button>
            </div>

            {loading && <p className="text-muted-foreground">Carregando…</p>}
            {errorMsg && <p className="text-red-600">{errorMsg}</p>}

            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Nome</TableHead>
                        {selectField && (
                            <TableHead className="w-48">{selectField.label}</TableHead>
                        )}
                        {booleanFields?.map(f => (
                            <TableHead key={f.key} className="w-32">{f.label}</TableHead>
                        ))}
                        <TableHead className="w-32">Ações</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {items.map((item) => (
                        <TableRow key={item.id}>
                            <TableCell>
                                {editingId === item.id ? (
                                    <Input value={editingName} onChange={(e) => setEditingName(e.target.value)} />
                                ) : (
                                    item.nome
                                )}
                            </TableCell>
                            {selectField && (
                                <TableCell>
                                    {editingId === item.id ? (
                                        <Select
                                            value={editingSelectValue}
                                            onValueChange={setEditingSelectValue}
                                            disabled={selectLoading}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder={`Selecione ${selectField.label.toLowerCase()}`} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {selectLoading ? (
                                                    <SelectItem value="__loading" disabled>
                                                        Carregando...
                                                    </SelectItem>
                                                ) : selectOptions.length > 0 ? (
                                                    selectOptions.map((option) => (
                                                        <SelectItem key={option.value} value={option.value}>
                                                            {option.label}
                                                        </SelectItem>
                                                    ))
                                                ) : (
                                                    <SelectItem value="__empty" disabled>
                                                        Nenhuma opção disponível
                                                    </SelectItem>
                                                )}
                                            </SelectContent>
                                        </Select>
                                    ) : (
                                        resolveSelectLabel(item[selectField.key]) || "—"
                                    )}
                                </TableCell>
                            )}
                            {booleanFields?.map(f => (
                                <TableCell key={f.key}>
                                    {editingId === item.id ? (
                                        <Checkbox
                                            checked={editingBooleans[f.key] ?? false}
                                            onCheckedChange={(v) => setEditingBooleans(prev => ({ ...prev, [f.key]: !!v }))}
                                        />
                                    ) : item[f.key] ? (
                                        "Sim"
                                    ) : (
                                        "Não"
                                    )}
                                </TableCell>
                            ))}
                            <TableCell className="flex gap-2">
                                {editingId === item.id ? (
                                    <>
                                        <Button size="icon" variant="ghost" onClick={saveEdit}><Check className="h-4 w-4" /></Button>
                                        <Button size="icon" variant="ghost" onClick={cancelEdit}><X className="h-4 w-4" /></Button>
                                    </>
                                ) : (
                                    <>
                                        <Button size="icon" variant="ghost" onClick={() => startEdit(item)}>
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button size="icon" variant="ghost" onClick={() => deleteItem(item.id)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </>
                                )}
                            </TableCell>
                        </TableRow>
                    ))}
                    {!loading && items.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={columnsCount} className="text-center text-muted-foreground">
                                {emptyMessage}
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
}
