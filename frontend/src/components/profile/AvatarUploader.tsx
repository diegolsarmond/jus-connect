import { useState, useRef, useEffect } from "react";
import { Upload, X, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface AvatarUploaderProps {
  currentAvatar?: string;
  userName: string;
  onAvatarChange: (file: File | null) => Promise<void> | void;
  size?: "sm" | "md" | "lg";
}

export function AvatarUploader({ currentAvatar, userName, onAvatarChange, size = "md" }: AvatarUploaderProps) {
  const [preview, setPreview] = useState(currentAvatar);
  const [isOpen, setIsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPreview(currentAvatar);
  }, [currentAvatar]);

  const sizeClasses = {
    sm: "h-16 w-16",
    md: "h-24 w-24", 
    lg: "h-32 w-32"
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setError("Arquivo muito grande. O tamanho máximo é 5MB.");
        return;
      }

      if (!file.type.startsWith('image/')) {
        setError("Por favor, selecione apenas arquivos de imagem.");
        return;
      }

      const reader = new FileReader();
      reader.onloadend = async () => {
        const result = reader.result as string;
        const previousPreview = preview;
        setPreview(result);
        setError(null);

        try {
          const response = onAvatarChange(file);
          if (response instanceof Promise) {
            setIsProcessing(true);
            await response;
          }
        } catch (uploadError) {
          setPreview(previousPreview);
          setError(uploadError instanceof Error ? uploadError.message : "Não foi possível atualizar o avatar.");
        } finally {
          setIsProcessing(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemove = () => {
    setPreview(undefined);
    setError(null);
    const response = onAvatarChange(null);
    if (response instanceof Promise) {
      setIsProcessing(true);
      response
        .catch((removeError) => {
          setError(removeError instanceof Error ? removeError.message : "Não foi possível remover o avatar.");
          setPreview(currentAvatar);
        })
        .finally(() => {
          setIsProcessing(false);
        });
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const initials = userName.split(' ').map(n => n[0]).join('').toUpperCase();

  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="relative group">
        <Avatar className={sizeClasses[size]}>
          <AvatarImage src={preview} alt={userName} />
          <AvatarFallback className="text-lg font-semibold bg-primary text-primary-foreground">
            {initials}
          </AvatarFallback>
        </Avatar>
        
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button
              variant="secondary"
              size="sm"
              className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full p-0 shadow-md border-2 border-background group-hover:scale-110 transition-transform"
            >
              <Camera className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Alterar Avatar</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex justify-center">
                <Avatar className="h-32 w-32">
                  <AvatarImage src={preview} alt={userName} />
                  <AvatarFallback className="text-2xl font-semibold bg-primary text-primary-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="avatar-upload">Selecionar nova imagem</Label>
                <Input
                  id="avatar-upload"
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="cursor-pointer file:cursor-pointer"
                  disabled={isProcessing}
                />
                <p className="text-xs text-muted-foreground">
                  Formatos aceitos: PNG, JPG, JPEG. Tamanho máximo: 5MB
                </p>
                {error && <p className="text-xs text-destructive">{error}</p>}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1"
                  disabled={isProcessing}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Enviar Arquivo
                </Button>
                {preview && (
                  <Button
                    variant="destructive"
                    onClick={handleRemove}
                    className="flex-1"
                    disabled={isProcessing}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Remover
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      
      <p className="text-xs text-muted-foreground text-center max-w-[200px]">
        Clique no ícone da câmera para alterar sua foto de perfil
      </p>
    </div>
  );
}