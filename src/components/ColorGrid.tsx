import { useEffect, useRef } from "react";
import { PlusCircle, X } from "lucide-react";
import { PALETTE_ROWS, colorName } from "../options";

export function ColorGrid({ label, recent = [], customColors, onSelect, onClear, onAddCustom }: {
  label: string; recent?: string[]; customColors: string[]; onSelect: (hex: string) => void;
  onClear: () => void; onAddCustom: (hex: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const picker = input.current;
    const change = () => { if (picker) { onAddCustom(picker.value); onSelect(picker.value); } };
    picker?.addEventListener("change", change);
    return () => picker?.removeEventListener("change", change);
  }, [onAddCustom, onSelect]);
  const swatch = (hex: string, name: string) => <button type="button" role="menuitem" className="color-swatch" key={hex} aria-label={name} title={`${name} ${hex}`} data-color={hex} style={{ "--menu-color": hex } as React.CSSProperties} onClick={() => onSelect(hex)} />;
  return <div className="color-grid" aria-label={label}>
    {recent.length > 0 && <><h4>RECENTI</h4><div className="color-grid-recent" role="group" aria-label={`${label}: recenti in questa nota`}>{recent.map(hex => swatch(hex, hex))}</div></>}
    <div className="color-grid-swatches">{PALETTE_ROWS.flatMap((row, r) => row.map((hex, c) => swatch(hex, colorName(r, c))))}</div>
    <h4>PERSONALIZZATI</h4>
    <div className="color-grid-custom">{customColors.map(hex => swatch(hex, hex))}
      <button type="button" className="color-grid-action" aria-label="Aggiungi colore personalizzato" title="Aggiungi colore personalizzato" onClick={() => input.current?.showPicker()}><PlusCircle size={20} /></button>
      <button type="button" className="color-grid-action" aria-label={`Ripristina ${label.toLocaleLowerCase("it")}`} onClick={onClear}><X size={16} />Ripristina</button>
    </div><input ref={input} type="color" hidden aria-label="Colore personalizzato" />
  </div>;
}
