import { useState } from "react";
import { Edit2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface EditableFieldProps {
  label: string;
  value: string;
  onSave: (value: string) => void;
  type?: "text" | "email" | "tel" | "textarea";
  placeholder?: string;
  validation?: (value: string) => string | null;
  className?: string;
}

export function EditableField({ 
  label, 
  value, 
  onSave, 
  type = "text", 
  placeholder,
  validation,
  className 
}: EditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [error, setError] = useState<string | null>(null);

  const handleSave = () => {
    if (validation) {
      const validationError = validation(editValue);
      if (validationError) {
        setError(validationError);
        return;
      }
    }
    
    onSave(editValue);
    setIsEditing(false);
    setError(null);
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
    setError(null);
  };

  const InputComponent = type === "textarea" ? Textarea : Input;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-muted-foreground">{label}</label>
        {!isEditing && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setIsEditing(true)}
            className="h-6 w-6 p-0 hover:bg-accent"
          >
            <Edit2 className="h-3 w-3" />
          </Button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-2">
          <InputComponent
            type={type === "textarea" ? undefined : type}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            placeholder={placeholder}
            className={cn("text-sm", error && "border-destructive")}
          />
          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} className="h-7">
              <Check className="h-3 w-3 mr-1" />
              Salvar
            </Button>
            <Button variant="outline" size="sm" onClick={handleCancel} className="h-7">
              <X className="h-3 w-3 mr-1" />
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm bg-muted/50 p-3 rounded-md min-h-[2.5rem] flex items-center">
          {value || <span className="text-muted-foreground italic">Não informado</span>}
        </p>
      )}
    </div>
  );
}