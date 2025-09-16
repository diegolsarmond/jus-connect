import React from "react";
import { VariableNode } from "../services/api";

interface InsertMenuProps {
  variables: VariableNode[];
  onSelect: (variable: VariableNode) => void;
  onClose: () => void;
}

const InsertMenu: React.FC<InsertMenuProps> = ({ variables, onSelect, onClose }) => {
  const renderNode = (node: VariableNode) => {
    if (node.children && node.children.length > 0) {
      return (
        <li key={node.value}>
          <details>
            <summary>{node.label}</summary>
            <ul>{node.children.map(renderNode)}</ul>
          </details>
        </li>
      );
    }
    return (
      <li key={node.value}>
        <button type="button" onClick={() => onSelect(node)}>
          {node.label}
        </button>
      </li>
    );
  };

  return (
    <div className="insert-menu" role="menu" aria-label="Inserir variável">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <strong>Variáveis</strong>
        <button type="button" onClick={onClose} className="toolbar-button">
          Fechar
        </button>
      </div>
      <ul>{variables.map(renderNode)}</ul>
    </div>
  );
};

export default InsertMenu;
