import { MATERIAL_SHAPES } from "../ui/materialShapes";
import { SHAPES } from "../options";

export function ShapeDefs() {
  return <>
    <svg width="0" height="0" aria-hidden="true" style={{ position: "absolute" }}><defs>{Object.entries(MATERIAL_SHAPES).map(([id, d]) => <clipPath key={id} id={`m3-${id}`} clipPathUnits="objectBoundingBox"><path d={d} /></clipPath>)}</defs></svg>
    <style>{Object.keys(MATERIAL_SHAPES).map(id => `[data-shape="${id}"]{clip-path:url(#m3-${id})}`).join("")}</style>
    {import.meta.env.DEV && new URLSearchParams(location.search).has("shapes") && <div className="shape-gallery">{SHAPES.map(shape => <div key={shape.id}><span data-shape={shape.id} /><small>{shape.label}</small></div>)}</div>}
  </>;
}
