"""Gera tests/fixtures/reference-cases.json a partir do oráculo (pile_capacity.py).

Uso: python tools/reference/build_fixtures.py
Os perfis de sondagem são sintéticos, criados para estes testes.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pile_capacity import capacity  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]

ARGILA_SOBRE_SILTE = [
    {"depth_m": 1, "nspt": 3, "soilTypeId": 11},
    {"depth_m": 2, "nspt": 4, "soilTypeId": 11},
    {"depth_m": 3, "nspt": 6, "soilTypeId": 12},
    {"depth_m": 4, "nspt": 8, "soilTypeId": 12},
    {"depth_m": 5, "nspt": 10, "soilTypeId": 9},
    {"depth_m": 6, "nspt": 13, "soilTypeId": 9},
    {"depth_m": 7, "nspt": 16, "soilTypeId": 7},
    {"depth_m": 8, "nspt": 20, "soilTypeId": 7},
    {"depth_m": 9, "nspt": 24, "soilTypeId": 7},
    {"depth_m": 10, "nspt": 28, "soilTypeId": 7},
    {"depth_m": 11, "nspt": 33, "soilTypeId": 7},
    {"depth_m": 12, "nspt": 38, "soilTypeId": 7},
]

AREIA = [
    {"depth_m": d, "nspt": n, "soilTypeId": s}
    for d, n, s in [
        (1, 5, 2), (2, 7, 2), (3, 9, 1), (4, 12, 1), (5, 15, 1), (6, 18, 1),
        (7, 22, 1), (8, 26, 1), (9, 30, 1), (10, 35, 1), (11, 42, 1), (12, 48, 1),
    ]
]

# N decrescente com a profundidade: o caso que expunha a soma de médias acumuladas.
DECRESCENTE = [
    {"depth_m": d, "nspt": n, "soilTypeId": 12}
    for d, n in [(1, 25), (2, 22), (3, 18), (4, 15), (5, 12), (6, 10), (7, 8), (8, 6), (9, 5), (10, 5)]
]

# Sondagem a cada 0,5 m, para topo de estaca abaixo do terreno (bloco).
FRACIONADA = [
    {"depth_m": round(0.5 * i, 1), "nspt": 2 + i, "soilTypeId": 12 if i < 10 else 7}
    for i in range(1, 25)
]

CASES = [
    {
        "id": "ref-escavada-30",
        "title": "Exemplo — estaca escavada Ø30 cm × 8 m (o exemplo do app)",
        "input": {"pileTypeId": 6, "diameterCm": 30, "tipDepth_m": 8, "layers": ARGILA_SOBRE_SILTE},
    },
    {
        "id": "helice-40",
        "title": "Hélice contínua Ø40 × 10 m",
        "input": {"pileTypeId": 11, "diameterCm": 40, "tipDepth_m": 10, "layers": ARGILA_SOBRE_SILTE},
    },
    {
        "id": "franki-40",
        "title": "Franki Ø40 × 7 m, base 180 L",
        "input": {"pileTypeId": 9, "diameterCm": 40, "tipDepth_m": 7, "enlargedBaseVolumeLiters": 180, "layers": ARGILA_SOBRE_SILTE},
    },
    {
        "id": "metalica-tr50",
        "title": "Metálica TR 50 × 9 m",
        "input": {"pileTypeId": 4, "diameterCm": 20, "tipDepth_m": 9, "areaCm2": 64.2, "perimeterCm": 52, "layers": ARGILA_SOBRE_SILTE},
    },
    {
        "id": "centrifugada-33",
        "title": "Pré-moldada centrifugada Ø33 × 9 m (F1 = 1 + D/0,8)",
        "input": {"pileTypeId": 2, "diameterCm": 33, "tipDepth_m": 9, "layers": ARGILA_SOBRE_SILTE},
    },
    {
        "id": "raiz-25-areia",
        "title": "Raiz Ø25 × 10 m em areia",
        "input": {"pileTypeId": 10, "diameterCm": 25, "tipDepth_m": 10, "layers": AREIA},
    },
    {
        "id": "escavada-50-areia",
        "title": "Escavada Ø50 × 9 m em areia (janela de ponta de Teixeira com 4D)",
        "input": {"pileTypeId": 6, "diameterCm": 50, "tipDepth_m": 9, "layers": AREIA},
    },
    {
        "id": "decrescente-40",
        "title": "Escavada Ø40 × 8 m, N decrescente",
        "input": {"pileTypeId": 6, "diameterCm": 40, "tipDepth_m": 8, "layers": DECRESCENTE},
    },
    {
        "id": "bloco-topo-0.9",
        "title": "Escavada Ø40, topo a 0,90 m (sob bloco), L = 7,6 m, SPT a cada 0,5 m",
        "input": {"pileTypeId": 6, "diameterCm": 40, "tipDepth_m": 7.6, "pileTopDepth_m": 0.9, "layers": FRACIONADA},
    },
    {
        "id": "parametros-usuario",
        "title": "Parâmetros informados: Aoki ponta 50 %, Décourt α 80 % β 90 %, Teixeira fuste 50 %",
        "input": {
            "pileTypeId": 6, "diameterCm": 30, "tipDepth_m": 8, "layers": ARGILA_SOBRE_SILTE,
            "aoki": {"fs": 2, "pctTip": 50, "pctShaft": 100},
            "decourt": {"alphaPct": 80, "betaPct": 90},
            "teixeira": {"fs": 2, "pctTip": 100, "pctShaft": 50},
        },
    },
    {
        "id": "atrito-excluido",
        "title": "Ref. escavada Ø30 com atrito excluído nos 2 primeiros metros",
        "input": {
            "pileTypeId": 6, "diameterCm": 30, "tipDepth_m": 8,
            "layers": [dict(l, excludeFromShaftFriction=True) if l["depth_m"] <= 2 else l for l in ARGILA_SOBRE_SILTE],
        },
    },
]


def main() -> None:
    out = {
        "description": "Casos de referência calculados pelo oráculo tools/reference/pile_capacity.py "
        "(fórmulas publicadas). Gerado por tools/reference/build_fixtures.py — não editar à mão.",
        "cases": [dict(c, expected=capacity(c["input"])) for c in CASES],
    }
    path = ROOT / "tests" / "fixtures" / "reference-cases.json"
    path.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    for c in out["cases"]:
        m = c["expected"]["methods"]
        print(f"{c['id']:<20} AV {m['aoki_velloso']['Padm_kN']:8.2f}  DQ {m['decourt_quaresma']['Padm_kN']:8.2f}  TX {m['teixeira']['Padm_kN']:8.2f}")


if __name__ == "__main__":
    main()
