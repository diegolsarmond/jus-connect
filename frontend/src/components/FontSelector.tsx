import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';

interface FontSelectorProps {
  onChange: (font: string) => void;
}

const fonts = [
  'Arial',
  'Times New Roman',
  'Courier New',
  'Georgia',
  'Verdana',
];

export function FontSelector({ onChange }: FontSelectorProps) {
  return (
    <Select onValueChange={onChange}>
      <SelectTrigger className="w-40">
        <SelectValue placeholder="Fonte" />
      </SelectTrigger>
      <SelectContent>
        {fonts.map((font) => (
          <SelectItem key={font} value={font} style={{ fontFamily: font }}>
            {font}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default FontSelector;
