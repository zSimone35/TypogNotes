import { RULE_THICKNESSES } from "../editor/horizontalRule";

export function RuleThicknessMenu({ value, onSelect }: { value: number; onSelect: (thickness: number) => void }) {
  return <>{RULE_THICKNESSES.map(n => <button key={n} type="button" role="menuitemradio" aria-checked={value === n} onClick={() => onSelect(n)}><span style={{ width: 48, height: n, background: "currentColor" }} />{n} px</button>)}</>;
}
