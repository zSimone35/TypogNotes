import { useState } from "react";
import { SHAPES } from "../options";
import type { ShapeId } from "../ui/materialShapes";

export function ShapePicker({ value, globalOnly = false, onSelect, onReset }: { value: ShapeId; globalOnly?: boolean; onSelect: (id: ShapeId, global: boolean) => void; onReset?: () => void }) {
  const [global, setGlobal] = useState(globalOnly);
  return <div className="shape-picker">
    {!globalOnly && <div className="shape-scope"><button type="button" aria-pressed={!global} onClick={() => setGlobal(false)}>Solo questa nota</button><button type="button" aria-pressed={global} onClick={() => setGlobal(true)}>Tutte le note</button></div>}
    <div className="shape-picker-grid">{SHAPES.map(shape => <button type="button" role="menuitemradio" key={shape.id} aria-label={shape.label} title={shape.label} aria-checked={value === shape.id} onClick={() => onSelect(shape.id, global)}><span data-shape={shape.id} /></button>)}</div>
    {!globalOnly && <button type="button" onClick={onReset}>Usa impostazione globale</button>}
  </div>;
}
