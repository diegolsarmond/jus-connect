import React from "react";

interface VariableTagProps {
  label: string;
  selected?: boolean;
}

const VariableTag: React.FC<VariableTagProps> = ({ label, selected }) => {
  return (
    <span className="variable-tag" data-selected={selected ? "true" : "false"}>
      {label}
    </span>
  );
};

export default VariableTag;
