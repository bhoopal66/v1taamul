import React from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Check, Palette } from 'lucide-react';

export interface ColorOption {
  name: string;
  bg: string;
  text: string;
  border: string;
  dot: string;
}

export const AVAILABLE_COLORS: ColorOption[] = [
  { name: 'Rose', bg: 'bg-rose-500/20', text: 'text-rose-600', border: 'border-rose-500/30', dot: 'bg-rose-500' },
  { name: 'Cyan', bg: 'bg-cyan-500/20', text: 'text-cyan-600', border: 'border-cyan-500/30', dot: 'bg-cyan-500' },
  { name: 'Orange', bg: 'bg-orange-500/20', text: 'text-orange-600', border: 'border-orange-500/30', dot: 'bg-orange-500' },
  { name: 'Indigo', bg: 'bg-indigo-500/20', text: 'text-indigo-600', border: 'border-indigo-500/30', dot: 'bg-indigo-500' },
  { name: 'Teal', bg: 'bg-teal-500/20', text: 'text-teal-600', border: 'border-teal-500/30', dot: 'bg-teal-500' },
  { name: 'Pink', bg: 'bg-pink-500/20', text: 'text-pink-600', border: 'border-pink-500/30', dot: 'bg-pink-500' },
  { name: 'Lime', bg: 'bg-lime-500/20', text: 'text-lime-600', border: 'border-lime-500/30', dot: 'bg-lime-500' },
  { name: 'Fuchsia', bg: 'bg-fuchsia-500/20', text: 'text-fuchsia-600', border: 'border-fuchsia-500/30', dot: 'bg-fuchsia-500' },
  { name: 'Red', bg: 'bg-red-500/20', text: 'text-red-600', border: 'border-red-500/30', dot: 'bg-red-500' },
  { name: 'Emerald', bg: 'bg-emerald-500/20', text: 'text-emerald-600', border: 'border-emerald-500/30', dot: 'bg-emerald-500' },
  { name: 'Violet', bg: 'bg-violet-500/20', text: 'text-violet-600', border: 'border-violet-500/30', dot: 'bg-violet-500' },
  { name: 'Sky', bg: 'bg-sky-500/20', text: 'text-sky-600', border: 'border-sky-500/30', dot: 'bg-sky-500' },
];

interface CategoryColorPickerProps {
  selectedColor?: string;
  onColorSelect: (colorName: string) => void;
  triggerClassName?: string;
}

export const CategoryColorPicker: React.FC<CategoryColorPickerProps> = ({
  selectedColor,
  onColorSelect,
  triggerClassName,
}) => {
  const [open, setOpen] = React.useState(false);
  const selected = AVAILABLE_COLORS.find(c => c.name === selectedColor);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("gap-2 h-9", triggerClassName)}
        >
          {selected ? (
            <>
              <span className={cn("w-4 h-4 rounded-full", selected.dot)} />
              <span className={cn("text-sm", selected.text)}>{selected.name}</span>
            </>
          ) : (
            <>
              <Palette className="w-4 h-4" />
              <span className="text-sm">Pick color</span>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Select a color</p>
          <div className="grid grid-cols-4 gap-2">
            {AVAILABLE_COLORS.map((color) => (
              <button
                key={color.name}
                onClick={() => {
                  onColorSelect(color.name);
                  setOpen(false);
                }}
                className={cn(
                  "relative w-full aspect-square rounded-lg transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                  color.dot,
                  selectedColor === color.name && "ring-2 ring-ring ring-offset-2"
                )}
                title={color.name}
              >
                {selectedColor === color.name && (
                  <Check className="absolute inset-0 m-auto w-4 h-4 text-white drop-shadow-md" />
                )}
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export const getColorByName = (colorName: string): ColorOption | undefined => {
  return AVAILABLE_COLORS.find(c => c.name === colorName);
};
