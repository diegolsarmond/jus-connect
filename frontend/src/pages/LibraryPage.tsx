import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  TemplateSummary,
  deleteTemplate,
  exportTemplate,
  getTemplates,
  renameTemplate,
} from "../services/api";

const LibraryPage: React.FC = () => {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("todos");

  useEffect(() => {
    const loadTemplates = async () => {
      try {
        setLoading(true);
        const data = await getTemplates();
        setTemplates(data);
      } catch (err) {
        console.error(err);
        setError("Não foi possível carregar os modelos");
      } finally {
        setLoading(false);
      }
    };

    loadTemplates();
  }, []);

  const availableTypes = useMemo(() => {
    const types = new Set<string>();
    templates.forEach((template) => types.add(template.type));
    return Array.from(types);
  }, [templates]);

  const filteredTemplates = useMemo(() => {
    return templates.filter((template) => {
      const matchesSearch = template.name.toLowerCase().includes(search.toLowerCase());
      const matchesType = typeFilter === "todos" || template.type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [templates, search, typeFilter]);

  const handleRename = async (template: TemplateSummary) => {
    const newName = window.prompt("Renomear modelo", template.name);
    if (!newName || newName.trim() === template.name) {
      return;
    }
    try {
      await renameTemplate(template.id, newName.trim());
      setTemplates((prev) =>
        prev.map((item) => (item.id === template.id ? { ...item, name: newName.trim() } : item))
      );
    } catch (err) {
      console.error(err);
      window.alert("Não foi possível renomear o modelo.");
    }
  };

  const handleDelete = async (template: TemplateSummary) => {
    if (!window.confirm(`Excluir definitivamente "${template.name}"?`)) {
      return;
    }
    try {
      await deleteTemplate(template.id);
      setTemplates((prev) => prev.filter((item) => item.id !== template.id));
    } catch (err) {
      console.error(err);
      window.alert("Não foi possível excluir o modelo.");
    }
  };

  const handleExport = async (template: TemplateSummary) => {
    try {
      await exportTemplate(template.id);
    } catch (err) {
      console.error(err);
      window.alert("Falha ao exportar o modelo para PDF.");
    }
  };

  return (
    <section aria-labelledby="library-title">
      <div className="library-header">
        <div>
          <h1 id="library-title">Biblioteca de templates</h1>
          <p style={{ color: "#6b7280", marginTop: 4 }}>
            Organize e gerencie todos os modelos de documentos da equipe.
          </p>
        </div>
        <div className="library-actions">
          <button className="toolbar-button" type="button" onClick={() => navigate("/templates/new", { state: { blank: true } })}>
            Em branco
          </button>
          <button className="toolbar-button" type="button" onClick={() => navigate("/templates/new")}>Criar novo modelo</button>
        </div>
        <div className="library-filters">
          <label htmlFor="search-input" className="sidebar-label" style={{ color: "#4b5563" }}>
            <span className="sr-only">Buscar por nome</span>
          </label>
          <input
            id="search-input"
            type="search"
            placeholder="Buscar por nome"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            style={{
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid #d1d5db",
              minWidth: 220,
            }}
          />
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            className="toolbar-select"
            aria-label="Filtrar por tipo"
          >
            <option value="todos">Todos os tipos</option>
            {availableTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
      </div>
      {loading ? <p>Carregando modelos...</p> : null}
      {error ? <p style={{ color: "#ef4444" }}>{error}</p> : null}
      {!loading && filteredTemplates.length === 0 ? <p>Nenhum modelo encontrado.</p> : null}
      <div className="library-grid">
        {filteredTemplates.map((template) => (
          <article key={template.id} className="template-card">
            <div className="template-preview">
              <h3>{template.name}</h3>
              <p>Tipo: {template.type}</p>
              <p>Atualizado em: {new Date(template.updatedAt).toLocaleDateString()}</p>
              <p style={{ marginTop: 12, fontSize: 12 }}>
                {template.preview || "Pré-visualização não disponível."}
              </p>
            </div>
            <div className="template-meta">
              <button type="button" onClick={() => navigate(`/templates/${template.id}`)}>
                Abrir
              </button>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={() => handleRename(template)}>
                  Renomear
                </button>
                <button type="button" onClick={() => handleExport(template)}>
                  Baixar PDF
                </button>
                <button type="button" onClick={() => handleDelete(template)}>
                  Excluir
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};

export default LibraryPage;
