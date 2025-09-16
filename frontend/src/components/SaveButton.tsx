import React from "react";

interface SaveButtonProps {
  onClick: () => void;
}

const SaveButton: React.FC<SaveButtonProps> = ({ onClick }) => {
  return (
    <button type="button" className="save-button" onClick={onClick}>
      💾 Salvar novo modelo
    </button>
  );
};

export default SaveButton;
