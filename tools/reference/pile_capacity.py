"""Implementação de referência, independente do motor, dos métodos semiempíricos de estacas.

Escrita a partir das fórmulas e tabelas publicadas, sem reaproveitar o código TypeScript:

- Aoki & Velloso (1975), com F1/F2 atualizados em Cintra & Aoki (2010);
- Décourt & Quaresma (1978), com α e β de Décourt (1996);
- Teixeira (1996).

Serve de oráculo para os testes (tests/fixtures/reference-cases.json) e para o
check de auditoria (.audit/check.py). Unidades: m, kN, kPa.
"""
from __future__ import annotations

import math

# --- Tabelas -----------------------------------------------------------------

# Aoki & Velloso (1975): solo -> (K em MPa, α em %)
AOKI_K_ALPHA = {
    1: (1.00, 1.4),   # areia
    2: (0.80, 2.0),   # areia siltosa
    3: (0.70, 2.4),   # areia siltoargilosa
    4: (0.60, 3.0),   # areia argilosa
    5: (0.50, 2.8),   # areia argilossiltosa
    6: (0.40, 3.0),   # silte
    7: (0.55, 2.2),   # silte arenoso
    8: (0.45, 2.8),   # silte arenoargiloso
    9: (0.23, 3.4),   # silte argiloso
    10: (0.25, 3.0),  # silte argiloarenoso
    11: (0.20, 6.0),  # argila
    12: (0.35, 2.4),  # argila arenosa
    13: (0.30, 2.8),  # argila arenossiltosa
    14: (0.22, 4.0),  # argila siltosa
    15: (0.33, 3.0),  # argila siltoarenosa
}

# Cintra & Aoki (2010): tipo -> (F1, F2); None = pré-moldada (F1 = 1 + D/0,80 m; F2 = 2·F1)
AOKI_F1F2 = {
    1: None, 2: None, 3: None,       # pré-moldadas de concreto e madeira
    4: (1.75, 3.5),                  # metálica
    5: (3.0, 6.0), 6: (3.0, 6.0), 7: (3.0, 6.0),   # Strauss, escavada, estacão
    8: (2.5, 5.0), 9: (2.5, 5.0),    # apiloada (analogia), Franki
    10: (2.0, 4.0), 11: (2.0, 4.0),  # raiz, hélice contínua
}

# Décourt & Quaresma (1978): C (kPa) por grupo de solo
DECOURT_C = {"argila": 120, "silte_argiloso": 200, "silte_arenoso": 250, "areia": 400}
SOIL_TO_DECOURT_C = {
    1: "areia", 2: "areia", 3: "areia", 4: "areia", 5: "areia",
    6: "silte_arenoso", 7: "silte_arenoso",
    8: "silte_argiloso", 9: "silte_argiloso", 10: "silte_argiloso",
    11: "argila", 12: "argila", 13: "argila", 14: "argila", 15: "argila",
}

# Décourt (1996): α e β por grupo de solo (argilas / intermediários / areias)
DECOURT_ALPHA = {
    "escavada": (0.85, 0.60, 0.50),
    "helice": (0.30, 0.30, 0.30),
    "raiz": (0.85, 0.60, 0.50),
}
DECOURT_BETA = {
    "escavada": (0.80, 0.65, 0.50),
    "helice": (1.00, 1.00, 1.00),
    "raiz": (1.50, 1.50, 1.50),
}
PILE_TO_DECOURT = {5: "escavada", 6: "escavada", 7: "escavada", 8: "escavada", 10: "raiz", 11: "helice"}


def soil_group_index(soil: int) -> int:
    """0 = argilas, 1 = intermediários (siltes), 2 = areias."""
    if soil <= 5:
        return 2
    if soil <= 10:
        return 1
    return 0


# Teixeira (1996): α (kPa) por solo × grupo de estaca; colunas:
# pré-moldada/metálica, Franki, escavada a céu aberto, raiz
TEIXEIRA_ALPHA_BASE = {
    "argila_siltosa": (110, 100, 100, 100),
    "silte_argiloso": (160, 120, 110, 110),
    "argila_arenosa": (210, 160, 130, 140),
    "silte_arenoso": (260, 210, 160, 160),
    "areia_argilosa": (300, 240, 200, 190),
    "areia_siltosa": (360, 300, 240, 220),
    "areia": (400, 340, 270, 260),
}
# Solos fora da tabela original: média dos dois vizinhos (decisão do produto, documentada).
SOIL_TO_TEIXEIRA = {
    1: ("areia",), 2: ("areia_siltosa",), 3: ("areia_siltosa", "areia_argilosa"),
    4: ("areia_argilosa",), 5: ("areia_siltosa", "areia_argilosa"),
    6: ("silte_argiloso",), 7: ("silte_arenoso",), 8: ("silte_arenoso", "silte_argiloso"),
    9: ("silte_argiloso",), 10: ("silte_arenoso", "silte_argiloso"),
    11: ("argila_siltosa",), 12: ("argila_arenosa",), 13: ("argila_arenosa", "argila_siltosa"),
    14: ("argila_siltosa",), 15: ("argila_arenosa", "argila_siltosa"),
}
PILE_TO_TEIXEIRA_COL = {1: 0, 2: 0, 3: 0, 4: 0, 5: 2, 6: 2, 7: 2, 11: 2, 8: 1, 9: 1, 10: 3}
TEIXEIRA_BETA = {1: 4, 2: 4, 3: 4, 4: 4, 5: 4, 6: 4, 7: 4, 11: 4, 8: 5, 9: 5, 10: 6}


def teixeira_alpha(soil: int, pile: int) -> float:
    col = PILE_TO_TEIXEIRA_COL[pile]
    rows = SOIL_TO_TEIXEIRA[soil]
    return sum(TEIXEIRA_ALPHA_BASE[r][col] for r in rows) / len(rows)


# --- Geometria ---------------------------------------------------------------

def geometry(case: dict) -> tuple[float, float]:
    """(Ap m², U m)."""
    D = case["diameterCm"] / 100
    if case["pileTypeId"] == 4:
        return case["areaCm2"] / 1e4, case["perimeterCm"] / 100
    if case["pileTypeId"] == 9:
        V = case["enlargedBaseVolumeLiters"] / 1000
        r = (3 * V / (4 * math.pi)) ** (1 / 3)
        return math.pi * r * r, math.pi * D
    return math.pi * D * D / 4, math.pi * D


# --- Métodos -----------------------------------------------------------------

def _slices(case: dict):
    """Fatias (z, N, solo, espessura no fuste) até a ponta."""
    top = case.get("pileTopDepth_m", 0.0)
    tip = top + case["tipDepth_m"]
    layers = sorted(case["layers"], key=lambda l: l["depth_m"])
    out, prev = [], 0.0
    for l in layers:
        z = l["depth_m"]
        if z > tip + 1e-6:
            break
        h = max(0.0, z - max(prev, top))
        out.append((z, l["nspt"], l["soilTypeId"], h, l.get("excludeFromShaftFriction", False)))
        prev = z
    return tip, layers, out


def aoki_velloso(case: dict) -> dict:
    Ap, U = geometry(case)
    tip, _, sl = _slices(case)
    f = AOKI_F1F2[case["pileTypeId"]]
    F1, F2 = (1 + case["diameterCm"] / 100 / 0.80, 2 * (1 + case["diameterCm"] / 100 / 0.80)) if f is None else f
    o = case.get("aoki", {})
    pt, ps, fs = o.get("pctTip", 100) / 100, o.get("pctShaft", 100) / 100, o.get("fs", 2)
    z, N, soil, _, _ = sl[-1]
    K = AOKI_K_ALPHA[soil][0] * 1000
    Rp = K * N * Ap / F1 * pt
    Rl = 0.0
    for _, n, s, h, ex in sl:
        if ex:
            continue
        k, a = AOKI_K_ALPHA[s]
        Rl += U * (a / 100) * (k * 1000) * n * h / F2 * ps
    return {"Rp_kN": Rp, "Rl_acum_kN": Rl, "Rult_kN": Rp + Rl, "Padm_kN": (Rp + Rl) / fs}


def decourt_quaresma(case: dict) -> dict:
    Ap, U = geometry(case)
    tip, layers, sl = _slices(case)
    pile = case["pileTypeId"]
    tip_soil = sl[-1][2]
    kind = PILE_TO_DECOURT.get(pile)
    user = case.get("decourt", {})
    alpha = user.get("alphaPct", 100 * DECOURT_ALPHA[kind][soil_group_index(tip_soil)] if kind else 100) / 100
    user_beta = user.get("betaPct")

    def beta(soil: int) -> float:
        if user_beta is not None:
            return user_beta / 100
        return DECOURT_BETA[kind][soil_group_index(soil)] if kind else 1.0

    # Np: SPT na ponta, imediatamente acima e imediatamente abaixo
    k = next(i for i, l in enumerate(layers) if abs(l["depth_m"] - tip) < 1e-6)
    around = [layers[j]["nspt"] for j in (k - 1, k, k + 1) if 0 <= j < len(layers)]
    Np = sum(around) / len(around)
    # N̄L: média (3 ≤ N ≤ 15) no fuste, sem os SPT da ponta e do metro acima
    shaft = [(min(15, max(3, n)), s, h) for z, n, s, h, ex in sl if h > 1e-9 and not ex]
    window = [z > tip - 1 - 1e-6 for z, n, s, h, ex in sl if h > 1e-9 and not ex]
    outside = [(n, h) for (n, s, h), w in zip(shaft, window) if not w] or [(n, h) for n, s, h in shaft]
    NL = sum(n * h for n, h in outside) / sum(h for _, h in outside)
    Rl = sum(beta(s) * 10 * ((NL if w else n) / 3 + 1) * U * h for (n, s, h), w in zip(shaft, window))
    C = DECOURT_C[SOIL_TO_DECOURT_C[tip_soil]]
    Rp = alpha * C * Np * Ap
    Rult = Rp + Rl
    return {"Rp_kN": Rp, "Rl_acum_kN": Rl, "Rult_kN": Rult, "Padm_kN": min(Rult / 2, Rl / 1.3 + Rp / 4)}


def teixeira(case: dict) -> dict:
    Ap, U = geometry(case)
    tip, layers, sl = _slices(case)
    pile = case["pileTypeId"]
    o = case.get("teixeira", {})
    pt, ps, fs = o.get("pctTip", 100) / 100, o.get("pctShaft", 100) / 100, o.get("fs", 2)
    D = case["diameterCm"] / 100
    clamp = lambda n: min(40, max(4, n))
    win = [clamp(l["nspt"]) for l in layers if tip - 4 * D - 1e-6 <= l["depth_m"] <= tip + D + 1e-6]
    Np = sum(win) / len(win)
    Rp = teixeira_alpha(sl[-1][2], pile) * Np * Ap * pt
    Rl = sum(TEIXEIRA_BETA[pile] * clamp(n) * U * h for z, n, s, h, ex in sl if not ex) * ps
    return {"Rp_kN": Rp, "Rl_acum_kN": Rl, "Rult_kN": Rp + Rl, "Padm_kN": (Rp + Rl) / fs}


def capacity(case: dict) -> dict:
    methods = {
        "aoki_velloso": aoki_velloso(case),
        "decourt_quaresma": decourt_quaresma(case),
        "teixeira": teixeira(case),
    }
    padms = [m["Padm_kN"] for m in methods.values()]
    return {
        "methods": methods,
        "averagePadm_kN": sum(padms) / 3,
        "minimumPadm_kN": min(padms),
    }
