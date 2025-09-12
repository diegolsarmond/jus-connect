import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Item { id: number; nome: string; }

interface ParameterPageProps {
    title: string;
    description: string;
    placeholder: string;
    emptyMessage: string;
    endpoint?: string; // ex.: "/api/areas"
}

// junta base + path sem barras duplicadas/faltando
function joinUrl(base: string, path = "") {
    const b = base.replace(/\/+$/, "");
    const p = path ? (path.startsWith("/") ? path : `/${path}`) : "";
    return `${b}${p}`;
}

export default function ParameterPage({
    title, description, placeholder, emptyMessage, endpoint,
}: ParameterPageProps) {
    const apiUrl = (import.meta.env.VITE_API_URL as string) || "http://localhost:3000";

    const [items, setItems] = useState<Item[]>([]);
    const [newItem, setNewItem] = useState("");
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editingName, setEditingName] = useState("");
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
                    const item = r as { id: number | string; nome?: string; descricao?: string; name?: string };
                    return {
                        id: Number(item.id),
                        nome: item.nome ?? item.descricao ?? item.name ?? "",
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
    }, [apiUrl, endpoint]);

    const addItem = async () => {
        const nome = newItem.trim();
        if (!nome) return;
        if (endpoint) {
            try {
                const res = await fetch(joinUrl(apiUrl, endpoint), {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Accept: "application/json" },
                    body: JSON.stringify({ nome, ativo: true }),
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
                const created = await res.json();
                setItems((prev) => [
                    ...prev,
                    { id: Number(created?.id ?? created?.data?.id ?? Date.now()), nome: created?.nome ?? created?.data?.nome ?? nome },
                ]);
            } catch (e) {
                console.error(e);
                setErrorMsg("Não foi possível criar o item.");
            }
        } else {
            setItems((prev) => [...prev, { id: Date.now(), nome }]);
        }
        setNewItem("");
    };

    const startEdit = (id: number, nome: string) => { setEditingId(id); setEditingName(nome); };

    const saveEdit = async () => {
        if (editingId == null) return;
        const nome = editingName.trim();
        if (!nome) return;
        if (endpoint) {
            try {
                const res = await fetch(joinUrl(apiUrl, `${endpoint}/${editingId}`), {
                    method: "PUT", // ou PATCH no seu backend
                    headers: { "Content-Type": "application/json", Accept: "application/json" },
                    body: JSON.stringify({ nome, ativo: true }),
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
                const updated = await res.json();
                setItems((prev) =>
                    prev.map((i) =>
                        i.id === editingId
                            ? { id: Number(updated?.id ?? editingId), nome: updated?.nome ?? updated?.descricao ?? nome }
                            : i
                    )
                );
            } catch (e) {
                console.error(e);
                setErrorMsg("Não foi possível salvar a edição.");
            }
        } else {
            setItems((prev) => prev.map((i) => (i.id === editingId ? { ...i, nome } : i)));
        }
        setEditingId(null);
        setEditingName("");
    };

    const cancelEdit = () => { setEditingId(null); setEditingName(""); };

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

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-foreground">{title}</h1>
                <p className="text-muted-foreground">{description}</p>
            </div>

            <div className="flex items-center gap-2">
                <Input
                    placeholder={placeholder}
                    value={newItem}
                    onChange={(e) => setNewItem(e.target.value)}
                    className="max-w-sm"
                />
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
                            <TableCell className="flex gap-2">
                                {editingId === item.id ? (
                                    <>
                                        <Button size="icon" variant="ghost" onClick={saveEdit}><Check className="h-4 w-4" /></Button>
                                        <Button size="icon" variant="ghost" onClick={cancelEdit}><X className="h-4 w-4" /></Button>
                                    </>
                                ) : (
                                    <>
                                        <Button size="icon" variant="ghost" onClick={() => startEdit(item.id, item.nome)}>
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
                            <TableCell colSpan={2} className="text-center text-muted-foreground">
                                {emptyMessage}
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
}
