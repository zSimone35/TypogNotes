// Copyright 2024 The Android Open Source Project. Licensed under Apache-2.0.
// JS port of RoundedPolygon/RoundedCorner and Cubic.circularArc from androidx/graphics/shapes.
// Shape vertices are read from the vendored MaterialShapes.kt (androidx-main, 2026-09-26).
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const add = (a,b) => [a[0]+b[0], a[1]+b[1]];
const sub = (a,b) => [a[0]-b[0], a[1]-b[1]];
const mul = (a,k) => [a[0]*k, a[1]*k];
const dot = (a,b) => a[0]*b[0]+a[1]*b[1];
const norm = a => Math.hypot(...a);
const unit = a => norm(a) ? mul(a,1/norm(a)) : [0,0];
const rot90 = a => [-a[1],a[0]];
const lerp = (a,b,t) => add(mul(a,1-t),mul(b,t));
const line = (a,b) => [a,lerp(a,b,1/3),lerp(a,b,2/3),b];
const rotate = (p,a) => [p[0]*Math.cos(a)-p[1]*Math.sin(a),p[0]*Math.sin(a)+p[1]*Math.cos(a)];
const eps = 1e-4;
function arc(center,a,b) {
  const u=unit(sub(a,center)), v=unit(sub(b,center)), c=Math.max(-1,Math.min(1,dot(u,v)));
  if(c>.999) return line(a,b);
  const k=norm(sub(a,center))*4/3*(Math.sqrt(2*(1-c))-Math.sqrt(1-c*c))/(1-c)*(dot(rot90(u),sub(b,center))>=0?1:-1);
  return [a,add(a,mul(rot90(u),k)),sub(b,mul(rot90(v),k)),b];
}
function rounded(points) {
  const n=points.length;
  const corners=points.map(([x,y,r=0,s=0],i)=>{
    const p=[x,y], prev=points[(i+n-1)%n].slice(0,2), next=points[(i+1)%n].slice(0,2);
    const d1=unit(sub(prev,p)), d2=unit(sub(next,p));
    const cos=Math.max(-1,Math.min(1,dot(d1,d2))), sin=Math.sqrt(1-cos*cos);
    const cut=sin>1e-3?r*(cos+1)/sin:0;
    return {p,prev,next,r,s,d1,d2,cut,total:cut*(1+s)};
  });
  const adjusts=corners.map((c,i)=>{
    const next=corners[(i+1)%n], size=norm(sub(c.p,next.p)), cut=c.cut+next.cut, total=c.total+next.total;
    return cut>size?[size/cut,0]:total>size?[1,(size-cut)/(total-cut)]:[1,1];
  });
  const curves=corners.map((c,i)=>{
    const allowed=[adjusts[(i+n-1)%n],adjusts[i]].map(([r,s])=>c.cut*r+(c.total-c.cut)*s);
    const cut=Math.min(...allowed,c.cut);
    if(cut<eps||c.r<eps) return [line(c.p,c.p)];
    const r=c.r*cut/c.cut, center=add(c.p,mul(unit(add(c.d1,c.d2)),Math.hypot(r,cut)));
    const a=add(c.p,mul(c.d1,cut)), b=add(c.p,mul(c.d2,cut));
    const flank=(side,intersection,other,allow)=>{
      const smooth=allow>c.total?c.s:allow>c.cut?c.s*(allow-c.cut)/(c.total-c.cut):0;
      const dir=unit(sub(side,c.p)), start=add(c.p,mul(dir,cut*(1+smooth)));
      const end=add(center,mul(unit(sub(lerp(intersection,lerp(intersection,other,.5),smooth),center)),r));
      const tangent=rot90(sub(end,center)), den=dot(dir,rot90(tangent)), num=dot(sub(end,side),rot90(tangent));
      const control=Math.abs(den)<eps||Math.abs(den)<eps*Math.abs(num)?intersection:add(side,mul(dir,num/den));
      return [start,mul(add(start,mul(control,2)),1/3),control,end];
    };
    const f0=flank(c.prev,a,b,allowed[0]), f1=flank(c.next,b,a,allowed[1]).reverse();
    return [f0,arc(center,f0[3],f1[0]),f1];
  });
  return curves.flatMap((cs,i)=>[...cs,line(cs.at(-1)[3],curves[(i+1)%n][0][0])]);
}
function repeat(points,reps,mirror) {
  const result=[], count=mirror?reps*2:reps, section=2*Math.PI/count;
  for(let k=0;k<count;k++) for(let j=0;j<points.length;j++) {
    const i=mirror&&k%2?points.length-1-j:j;
    if(mirror&&k%2&&i===0) continue;
    const [x,y,r,s]=points[i], p=[x-.5,y-.5];
    const a=Math.atan2(p[1],p[0]), a0=Math.atan2(points[0][1]-.5,points[0][0]-.5);
    const angle=section*k+(mirror&&k%2?section-a+2*a0:a);
    result.push([.5+norm(p)*Math.cos(angle),.5+norm(p)*Math.sin(angle),r,s]);
  }
  return result;
}
const regular=(n,r=.2)=>Array.from({length:n},(_,i)=>[Math.cos(i*2*Math.PI/n),Math.sin(i*2*Math.PI/n),r,0]);
const star=(n,inner,r)=>regular(n*2,r).map((p,i)=>[p[0]*(i%2?inner:1),p[1]*(i%2?inner:1),r,0]);
const rectangle=(w,h,rs)=>[[w/2,h/2],[-w/2,h/2],[-w/2,-h/2],[w/2,-h/2]].map((p,i)=>[...p,rs[i],0]);
const source=readFileSync(new URL('./vendor/MaterialShapes.kt',import.meta.url),'utf8');
const names='circle square slanted arch fan arrow semiCircle oval pill triangle diamond clamShell pentagon gem verySunny sunny cookie4Sided cookie6Sided cookie7Sided cookie9Sided cookie12Sided ghostish clover4Leaf clover8Leaf burst softBurst boom softBoom flower puffy puffyDiamond pixelCircle pixelTriangle bun heart'.split(' ');
const shapes={};
for(const name of names) {
  const fn=name.replace(/cookie(\d+)Sided/,'cookie$1').replace(/clover(\d+)Leaf/,'clover$1');
  const body=source.split(`internal fun ${fn}(`)[1]?.split('\n        internal fun ')[0];
  assert(body, name);
  let cubics;
  if(name==='circle'||name==='oval') {
    cubics=Array.from({length:10},(_,i)=>arc([0,0],[Math.cos(i*Math.PI/5),Math.sin(i*Math.PI/5)],[Math.cos((i+1)*Math.PI/5),Math.sin((i+1)*Math.PI/5)]));
  } else {
    let points;
    if(body.includes('customPolygon(')) {
      points=[...body.matchAll(/PointNRound\(Offset\(([-.\d]+)f,\s*([-.\d]+)f\)(?:,\s*CornerRounding\(([-.\d]+)f(?:,\s*([-.\d]+)f)?\))?\)/g)].map(m=>[+m[1],+m[2],+(m[3]??0),+(m[4]??0)]);
      const reps=+(body.match(/reps = (\d+)/)?.[1]??body.match(/\n\s*\),\s*\n\s*(\d+),/)?.[1]??1);
      points=repeat(points,reps,body.includes('mirroring = true'));
    } else if(name==='square') points=rectangle(1,1,[.3,.3,.3,.3]);
    else if(name==='arch') points=regular(4).map((p,i)=>[p[0],p[1],[1,1,.2,.2][i],0]);
    else if(name==='semiCircle') points=rectangle(1.6,1,[.2,.2,1,1]);
    else if(name==='triangle') points=regular(3);
    else points=star(+(body.match(/numVerticesPerRadius = (\d+)/)[1]),+(body.match(/innerRadius = ([.\d]+)f/)[1]),name==='sunny'?.15:.5);
    assert(points.length>=3,name);
    cubics=rounded(points);
  }
  const angle=name==='arch'?-135:name==='triangle'||name.startsWith('cookie')&&['cookie7Sided','cookie9Sided','cookie12Sided'].includes(name)?-90:name==='oval'?-45:0;
  cubics=cubics.map(c=>c.map(p=>rotate([p[0],p[1]*(name==='oval'?.64:name==='puffy'?.742:1)],angle*Math.PI/180)));
  // Conservative control-point bounds keep every path inside the objectBoundingBox.
  const all=cubics.flat(), min=[Math.min(...all.map(p=>p[0])),Math.min(...all.map(p=>p[1]))], max=[Math.max(...all.map(p=>p[0])),Math.max(...all.map(p=>p[1]))];
  const size=Math.max(max[0]-min[0],max[1]-min[1]);
  const fmt=p=>p.map((v,i)=>((v-min[i]+(size-max[i]+min[i])/2)/size).toFixed(4)).join(' ');
  assert(all.flat().every(Number.isFinite),name);
  shapes[name]='M'+fmt(cubics[0][0])+cubics.map(c=>'C'+c.slice(1).map(fmt).join(' ')).join('')+'Z';
}
assert.equal(Object.keys(shapes).length,35);
writeFileSync(new URL('../src/ui/materialShapes.ts',import.meta.url),'// Generated by scripts/generate-material-shapes.mjs. AndroidX, Apache-2.0; see scripts/vendor.\nexport const MATERIAL_SHAPES = '+JSON.stringify(shapes,null,2)+' as const;\nexport type ShapeId = keyof typeof MATERIAL_SHAPES;\n');
