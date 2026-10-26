/**
 * Gravador IFC4X3_ADD2 mínimo (STEP físico, ISO 10303-21) para fundações e sondagens STARKX.
 * Sem dependências: só gera texto. Pode ser copiado para o app web do STARKX.
 * Unidades do arquivo: m, m², m³, rad, kg, kN, kPa.
 */
import { createHash } from 'node:crypto';

const B64 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$';

/** GlobalId IFC (22 caracteres) determinístico a partir de uma chave: reexportar mantém os mesmos IDs. */
export function ifcGuid(key: string): string {
  const h = createHash('md5').update(key).digest();
  let n = 0n;
  for (const b of h) n = (n << 8n) | BigInt(b);
  let out = '';
  for (let i = 0; i < 22; i++) { out = B64[Number(n & 63n)] + out; n >>= 6n; }
  return out;
}

/** Texto STEP com escape de apóstrofo, barra invertida e caracteres fora do ASCII (\X2\...\X0\). */
export function stepString(s: string): string {
  let out = '';
  let wide = '';
  const flush = () => { if (wide) { out += `\\X2\\${wide}\\X0\\`; wide = ''; } };
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 32 && c <= 126) {
      flush();
      const ch = s[i]!;
      out += ch === "'" ? "''" : ch === '\\' ? '\\\\' : ch;
    } else if (c >= 32) {
      wide += c.toString(16).toUpperCase().padStart(4, '0');
    }
  }
  flush();
  return `'${out}'`;
}

export function stepReal(v: number): string {
  if (!Number.isFinite(v)) throw new Error('Valor numérico não finito no IFC.');
  if (Object.is(v, -0)) v = 0;
  let s = String(v);
  if (/e/i.test(s)) {
    const [m, e] = s.toLowerCase().split('e') as [string, string];
    return `${m.includes('.') ? m : `${m}.`}E${e}`;
  }
  return s.includes('.') ? s : `${s}.`;
}

/** Referência a entidade já escrita. */
export class Ref { constructor(readonly id: number) {} toString() { return `#${this.id}`; } }
/** Enumeração STEP (.VALOR.). */
export class Enum { constructor(readonly v: string) {} toString() { return `.${this.v}.`; } }
/** Valor tipado (IFCLENGTHMEASURE(1.)). */
export class Typed { constructor(readonly type: string, readonly v: Arg) {} toString() { return `${this.type}(${fmt(this.v)})`; } }
/** Atributo derivado (*). */
export const DERIVED = Symbol('derived');
export type Arg = Ref | Enum | Typed | string | number | boolean | null | undefined | typeof DERIVED | Arg[] | { int: number };

function fmt(a: Arg): string {
  if (a === null || a === undefined) return '$';
  if (a === DERIVED) return '*';
  if (a instanceof Ref || a instanceof Enum || a instanceof Typed) return a.toString();
  if (typeof a === 'string') return stepString(a);
  if (typeof a === 'number') return stepReal(a);
  if (typeof a === 'boolean') return a ? '.T.' : '.F.';
  if (Array.isArray(a)) return `(${a.map(fmt).join(',')})`;
  return String(Math.trunc(a.int));
}

export const int = (v: number) => ({ int: v });
export const E = (v: string) => new Enum(v);
export const label = (v: string) => new Typed('IFCLABEL', v);
export const text = (v: string) => new Typed('IFCTEXT', v);
export const length = (v: number) => new Typed('IFCLENGTHMEASURE', v);
export const force = (v: number) => new Typed('IFCFORCEMEASURE', v);
export const pressure = (v: number) => new Typed('IFCPRESSUREMEASURE', v);
export const real = (v: number) => new Typed('IFCREAL', v);
export const integer = (v: number) => new Typed('IFCINTEGER', int(v));
export const bool = (v: boolean) => new Typed('IFCBOOLEAN', v);

export type PropValue = Typed;
export type Props = Record<string, PropValue | null | undefined>;

export interface Rgb { r: number; g: number; b: number; transparency?: number }

/** Escritor de baixo nível + construtores das entidades usadas. */
export class IfcWriter {
  private lines: string[] = [];
  private next = 1;
  readonly origin: Ref; readonly zUp: Ref; readonly zDown: Ref; readonly xDir: Ref;
  readonly placement3d: Ref; readonly origin2d: Ref; readonly placement2d: Ref;
  context!: Ref; body!: Ref; units!: Ref;
  private styles = new Map<string, Ref>();
  private materials = new Map<string, Ref>();

  constructor(private readonly guidSeed: string) {
    this.origin = this.add('IFCCARTESIANPOINT', [[0, 0, 0]]);
    this.zUp = this.add('IFCDIRECTION', [[0, 0, 1]]);
    this.zDown = this.add('IFCDIRECTION', [[0, 0, -1]]);
    this.xDir = this.add('IFCDIRECTION', [[1, 0, 0]]);
    this.placement3d = this.add('IFCAXIS2PLACEMENT3D', [this.origin, this.zUp, this.xDir]);
    this.origin2d = this.add('IFCCARTESIANPOINT', [[0, 0]]);
    this.placement2d = this.add('IFCAXIS2PLACEMENT2D', [this.origin2d, null]);
  }

  add(type: string, args: Arg[]): Ref {
    const r = new Ref(this.next++);
    this.lines.push(`#${r.id}=${type}(${args.map(fmt).join(',')});`);
    return r;
  }
  guid(key: string) { return ifcGuid(`${this.guidSeed}|${key}`); }
  get count() { return this.next - 1; }

  setupContextAndUnits() {
    this.context = this.add('IFCGEOMETRICREPRESENTATIONCONTEXT', [null, 'Model', int(3), 1e-5, this.placement3d, null]);
    this.body = this.add('IFCGEOMETRICREPRESENTATIONSUBCONTEXT', ['Body', 'Model', DERIVED, DERIVED, DERIVED, DERIVED, this.context, null, E('MODEL_VIEW'), null]);
    const si = (type: string, name: string, prefix: string | null = null) => this.add('IFCSIUNIT', [DERIVED, E(type), prefix ? E(prefix) : null, E(name)]);
    this.units = this.add('IFCUNITASSIGNMENT', [[
      si('LENGTHUNIT', 'METRE'), si('AREAUNIT', 'SQUARE_METRE'), si('VOLUMEUNIT', 'CUBIC_METRE'),
      si('PLANEANGLEUNIT', 'RADIAN'), si('MASSUNIT', 'GRAM', 'KILO'), si('FORCEUNIT', 'NEWTON', 'KILO'),
      si('PRESSUREUNIT', 'PASCAL', 'KILO'),
    ]]);
  }

  point(x: number, y: number, z: number) { return this.add('IFCCARTESIANPOINT', [[x, y, z]]); }
  /** Posicionamento local; rotação em torno de Z (graus). */
  localPlacement(relTo: Ref | null, x = 0, y = 0, z = 0, rotDeg = 0): Ref {
    const p = x === 0 && y === 0 && z === 0 ? this.origin : this.point(x, y, z);
    let ax = this.placement3d;
    if (p !== this.origin || rotDeg !== 0) {
      const xd = rotDeg === 0 ? this.xDir : this.add('IFCDIRECTION', [[Math.cos(rotDeg * Math.PI / 180), Math.sin(rotDeg * Math.PI / 180), 0]]);
      ax = this.add('IFCAXIS2PLACEMENT3D', [p, this.zUp, xd]);
    }
    return this.add('IFCLOCALPLACEMENT', [relTo, ax]);
  }

  /** Cilindro vertical: topo em z0 (local), extrudado para baixo. */
  cylinder(radius: number, depth: number, x = 0, y = 0, z0 = 0): Ref {
    const prof = this.add('IFCCIRCLEPROFILEDEF', [E('AREA'), null, this.placement2d, radius]);
    const pos = this.add('IFCAXIS2PLACEMENT3D', [this.point(x, y, z0), this.zUp, this.xDir]);
    return this.add('IFCEXTRUDEDAREASOLID', [prof, pos, this.zDown, depth]);
  }
  /** Tronco de cone vertical (base alargada de tubulão): raio rTop em z0 até rBottom em z0-depth. */
  cone(rTop: number, rBottom: number, depth: number, z0: number): Ref {
    const a = this.add('IFCCIRCLEPROFILEDEF', [E('AREA'), null, this.placement2d, rTop]);
    const b = this.add('IFCCIRCLEPROFILEDEF', [E('AREA'), null, this.placement2d, rBottom]);
    const pos = this.add('IFCAXIS2PLACEMENT3D', [this.point(0, 0, z0), this.zUp, this.xDir]);
    return this.add('IFCEXTRUDEDAREASOLIDTAPERED', [a, pos, this.zDown, depth, b]);
  }
  /** Prisma retangular centrado em (x,y): topo em z0, extrudado para baixo. */
  box(xDim: number, yDim: number, depth: number, z0 = 0): Ref {
    const prof = this.add('IFCRECTANGLEPROFILEDEF', [E('AREA'), null, this.placement2d, xDim, yDim]);
    const pos = this.add('IFCAXIS2PLACEMENT3D', [this.point(0, 0, z0), this.zUp, this.xDir]);
    return this.add('IFCEXTRUDEDAREASOLID', [prof, pos, this.zDown, depth]);
  }

  style(name: string, c: Rgb): Ref {
    const k = `${name}|${c.r}|${c.g}|${c.b}|${c.transparency ?? 0}`;
    const hit = this.styles.get(k); if (hit) return hit;
    const colour = this.add('IFCCOLOURRGB', [name, c.r, c.g, c.b]);
    const shading = this.add('IFCSURFACESTYLESHADING', [colour, c.transparency ?? 0]);
    const st = this.add('IFCSURFACESTYLE', [name, E('BOTH'), [shading]]);
    this.styles.set(k, st); return st;
  }
  shape(items: Ref[], type: 'SweptSolid' | 'AdvancedSweptSolid', style?: Ref): Ref {
    if (style) for (const it of items) this.add('IFCSTYLEDITEM', [it, [style], null]);
    const rep = this.add('IFCSHAPEREPRESENTATION', [this.body, 'Body', type, items]);
    return this.add('IFCPRODUCTDEFINITIONSHAPE', [null, null, [rep]]);
  }

  material(name: string, category: string): Ref {
    const hit = this.materials.get(name); if (hit) return hit;
    const m = this.add('IFCMATERIAL', [name, null, category]);
    this.materials.set(name, m); return m;
  }
  private matUse = new Map<Ref, Ref[]>();
  assignMaterial(m: Ref, obj: Ref) { const l = this.matUse.get(m) ?? []; l.push(obj); this.matUse.set(m, l); }

  pset(name: string, objects: Ref[], props: Props, key: string) {
    const ps = Object.entries(props).filter(([, v]) => v != null)
      .map(([k, v]) => this.add('IFCPROPERTYSINGLEVALUE', [k, null, v as Typed, null]));
    if (!ps.length) return;
    const set = this.add('IFCPROPERTYSET', [this.guid(`pset|${key}|${name}`), null, name, null, ps]);
    this.add('IFCRELDEFINESBYPROPERTIES', [this.guid(`rdp|${key}|${name}`), null, null, null, objects, set]);
  }
  qto(name: string, obj: Ref, q: { volume?: Record<string, number>; length?: Record<string, number>; area?: Record<string, number>; weight?: Record<string, number> }, key: string, method = 'STARKX') {
    const items: Ref[] = [];
    for (const [k, v] of Object.entries(q.length ?? {})) items.push(this.add('IFCQUANTITYLENGTH', [k, null, null, v, null]));
    for (const [k, v] of Object.entries(q.area ?? {})) items.push(this.add('IFCQUANTITYAREA', [k, null, null, v, null]));
    for (const [k, v] of Object.entries(q.volume ?? {})) items.push(this.add('IFCQUANTITYVOLUME', [k, null, null, v, null]));
    for (const [k, v] of Object.entries(q.weight ?? {})) items.push(this.add('IFCQUANTITYWEIGHT', [k, null, null, v, null]));
    if (!items.length) return;
    const eq = this.add('IFCELEMENTQUANTITY', [this.guid(`qto|${key}|${name}`), null, name, null, method, items]);
    this.add('IFCRELDEFINESBYPROPERTIES', [this.guid(`rdq|${key}|${name}`), null, null, null, [obj], eq]);
  }

  /** Fecha as associações de material pendentes (uma relação por material). */
  flushMaterials() {
    for (const [m, objs] of this.matUse) this.add('IFCRELASSOCIATESMATERIAL', [this.guid(`ram|${m.id}`), null, null, null, objs, m]);
    this.matUse.clear();
  }

  toString(fileName: string, timestamp: string, system: string) {
    return [
      'ISO-10303-21;', 'HEADER;',
      `FILE_DESCRIPTION(('ViewDefinition [ReferenceView]'),'2;1');`,
      `FILE_NAME(${stepString(fileName)},${stepString(timestamp)},(${stepString('Mont Cruz Engenharia')}),(${stepString('Mont Cruz Engenharia')}),${stepString(system)},${stepString(system)},'');`,
      `FILE_SCHEMA(('IFC4X3_ADD2'));`, 'ENDSEC;', 'DATA;', ...this.lines, 'ENDSEC;', 'END-ISO-10303-21;', '',
    ].join('\n');
  }
}

/** Cores por família de solo do catálogo STARKX (1–5 areias, 6–10 siltes, 11–15 argilas). */
export function soilColour(soilTypeId: number): Rgb {
  if (soilTypeId <= 5) return { r: 0.93, g: 0.80, b: 0.45, transparency: 0.2 };
  if (soilTypeId <= 10) return { r: 0.72, g: 0.62, b: 0.48, transparency: 0.2 };
  return { r: 0.66, g: 0.36, b: 0.24, transparency: 0.2 };
}
export const CONCRETE: Rgb = { r: 0.72, g: 0.72, b: 0.70 };
