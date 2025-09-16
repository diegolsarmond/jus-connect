import React, { FormEvent, useEffect, useState } from "react";

type VisibilityOption = "PUBLIC" | "PRIVATE";

export interface MetadataFormData {
  name: string;
  type: string;
  area: string;
  complexity: string;
  visibility: VisibilityOption;
  autoCreateClient: boolean;
  autoCreateProcess: boolean;
  description?: string;
}

interface MetadataModalProps {
  open: boolean;
  initialData: MetadataFormData;
  onClose: () => void;
  onSave: (data: MetadataFormData) => void;
}

const MetadataModal: React.FC<MetadataModalProps> = ({ open, initialData, onClose, onSave }) => {
  const [formData, setFormData] = useState<MetadataFormData>(initialData);

  useEffect(() => {
    setFormData(initialData);
  }, [initialData]);

  if (!open) {
    return null;
  }

  const handleChange = (field: keyof MetadataFormData, value: MetadataFormData[keyof MetadataFormData]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSave(formData);
  };

  return (
    <div className="metadata-modal-backdrop" role="dialog" aria-modal="true">
      <div className="metadata-modal">
        <h2>Metadados do modelo</h2>
        <form onSubmit={handleSubmit}>
          <label>
            Título do documento
            <input
              value={formData.name}
              onChange={(event) => handleChange("name", event.target.value)}
              required
            />
          </label>
          <label>
            Tipo de documento
            <input
              value={formData.type}
              onChange={(event) => handleChange("type", event.target.value)}
              placeholder="Ex.: Petição, Contrato"
              required
            />
          </label>
          <label>
            Área de atuação
            <input
              value={formData.area}
              onChange={(event) => handleChange("area", event.target.value)}
              placeholder="Ex.: Trabalhista, Cível"
              required
            />
          </label>
          <label>
            Complexidade
            <select value={formData.complexity} onChange={(event) => handleChange("complexity", event.target.value)}>
              <option value="baixa">Baixa</option>
              <option value="media">Média</option>
              <option value="alta">Alta</option>
            </select>
          </label>
          <label>
            Visibilidade
            <select
              value={formData.visibility}
              onChange={(event) => handleChange("visibility", event.target.value as VisibilityOption)}
            >
              <option value="PUBLIC">Público</option>
              <option value="PRIVATE">Privado</option>
            </select>
          </label>
          <label>
            Descrição (opcional)
            <textarea
              rows={3}
              value={formData.description ?? ""}
              onChange={(event) => handleChange("description", event.target.value)}
            />
          </label>
          <label style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={formData.autoCreateClient}
              onChange={(event) => handleChange("autoCreateClient", event.target.checked)}
            />
            Cadastrar cliente automaticamente
          </label>
          <label style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={formData.autoCreateProcess}
              onChange={(event) => handleChange("autoCreateProcess", event.target.checked)}
            />
            Cadastrar processo automaticamente
          </label>
          <div className="metadata-modal-actions">
            <button type="button" className="toolbar-button" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="toolbar-button" style={{ background: "#4f46e5", color: "white" }}>
              Salvar metadados
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MetadataModal;
