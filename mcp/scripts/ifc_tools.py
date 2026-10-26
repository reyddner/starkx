"""Ferramentas IFC do servidor MCP do STARKX (rodam em um Python com IfcOpenShell).

Uso:
  python -I ifc_tools.py ler_sondagem <arquivo.ifc>   -> JSON com IfcBorehole e camadas
  python -I ifc_tools.py validar <arquivo.ifc>         -> JSON com erros de esquema e contagens

Lê o arquivo só para consulta; nunca grava.
"""
import json
import sys

import ifcopenshell
import ifcopenshell.util.element as uel
import ifcopenshell.util.placement as upl


def _flat_props(el):
    out = {}
    for pset, props in (uel.get_psets(el) or {}).items():
        for k, v in props.items():
            if k == "id":
                continue
            if isinstance(v, (int, float, str, bool)) or v is None:
                out[f"{pset}.{k}"] = v
    return out


def _z_range(el):
    """Faixa z (mundo) do sólido; usa geometria se possível, senão posicionamento + profundidade da extrusão."""
    try:
        import ifcopenshell.geom as geom
        s = geom.settings()
        s.set("use-world-coords", True)
        sh = geom.create_shape(s, el)
        v = sh.geometry.verts
        zs = v[2::3]
        if zs:
            return min(zs), max(zs)
    except Exception:
        pass
    m = upl.get_local_placement(el.ObjectPlacement) if el.ObjectPlacement else None
    z0 = float(m[2][3]) if m is not None else 0.0
    depth = 0.0
    if el.Representation:
        for rep in el.Representation.Representations:
            for it in rep.Items:
                if it.is_a("IfcExtrudedAreaSolid"):
                    d = it.ExtrudedDirection.DirectionRatios
                    sign = -1.0 if d[2] < 0 else 1.0
                    zl = it.Position.Location.Coordinates[2] if it.Position else 0.0
                    a, b = z0 + zl, z0 + zl + sign * it.Depth
                    return min(a, b), max(a, b)
    return z0 - depth, z0


def _material_name(el):
    try:
        m = uel.get_material(el)
        return getattr(m, "Name", None) if m is not None else None
    except Exception:
        return None


def ler_sondagem(path):
    f = ifcopenshell.open(path)
    furos = []
    for bh in f.by_type("IfcBorehole"):
        parts = [p for p in (uel.get_decomposition(bh) or []) if p.is_a("IfcGeotechnicalStratum")]
        m = upl.get_local_placement(bh.ObjectPlacement) if bh.ObjectPlacement else None
        ranges = [(p, *_z_range(p)) for p in parts]
        collar = float(m[2][3]) if m is not None else (max(r[2] for r in ranges) if ranges else 0.0)
        x = float(m[0][3]) if m is not None else 0.0
        y = float(m[1][3]) if m is not None else 0.0
        camadas = []
        for p, zmin, zmax in sorted(ranges, key=lambda r: -r[2]):
            camadas.append({
                "nome": p.Name, "descricao": p.Description, "tag": p.Tag,
                "topo_m": round(collar - zmax, 4), "base_m": round(collar - zmin, 4),
                "props": _flat_props(p), "material": _material_name(p),
            })
        furos.append({"nome": bh.Name, "guid": bh.GlobalId, "x_m": x, "y_m": y, "cota_boca_m": collar,
                      "props": _flat_props(bh), "camadas": camadas})
    return {"esquema": f.schema_identifier if hasattr(f, "schema_identifier") else f.schema, "furos": furos}


def validar(path):
    import logging
    import ifcopenshell.validate as val
    f = ifcopenshell.open(path)
    logger = val.json_logger()
    val.validate(f, logger, express_rules=True)
    tipos = {}
    for t in ["IfcPile", "IfcFooting", "IfcCaissonFoundation", "IfcSlab", "IfcBorehole", "IfcGeotechnicalStratum",
              "IfcPropertySet", "IfcElementQuantity"]:
        tipos[t] = len(f.by_type(t))
    erros = [str(s.get("message", s))[:300] for s in logger.statements]
    # geometria: tenta triangular cada produto com representação
    import ifcopenshell.geom as geom
    s = geom.settings()
    falhas_geom = []
    for p in f.by_type("IfcProduct"):
        if p.Representation:
            try:
                geom.create_shape(s, p)
            except Exception as e:  # noqa: BLE001
                falhas_geom.append(f"{p.is_a()} {p.Name}: {e}"[:200])
    return {"esquema": f.schema, "erros": erros, "contagem": tipos, "falhas_geometria": falhas_geom}


if __name__ == "__main__":
    if len(sys.argv) != 3 or sys.argv[1] not in ("ler_sondagem", "validar"):
        print(__doc__, file=sys.stderr)
        sys.exit(2)
    fn = ler_sondagem if sys.argv[1] == "ler_sondagem" else validar
    sys.stdout.write(json.dumps(fn(sys.argv[2]), ensure_ascii=False))
