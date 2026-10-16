"""Check de domínio do STARKX: motor × cálculo independente.

- Estacas: os 11 casos de tests/fixtures/reference-cases.json recalculados AGORA pelo oráculo
  tools/reference/pile_capacity.py (fórmulas publicadas), não lidos do fixture.
- Sapata: CEB-70 e σmáx com momento conferidos à mão.
- Bloco: Blévot 2 estacas, T = Nd·(2e − a)/(8d).
- Estaca de concreto: Nrd = 0,85·fcd·Ac + As·σs(2‰).
Uso: python .audit/check.py   (sai 1 se algo falhar)
"""
import json
import math
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools" / "reference"))
from pile_capacity import capacity  # noqa: E402

falhas: list[str] = []


def ok(rotulo: str, motor: float, ref: float, tol: float = 1e-6) -> bool:
    bom = motor is not None and math.isfinite(motor) and abs(motor - ref) <= tol * max(1.0, abs(ref))
    if not bom:
        falhas.append(f"{rotulo}: motor={motor} ref={ref:.4f}")
    return bom


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    npx = "npx.cmd" if sys.platform == "win32" else "npx"
    p = subprocess.run([npx, "vite-node", "--config", "vitest.config.ts", ".audit/engine_dump.ts"], cwd=ROOT, capture_output=True,
                       text=True, encoding="utf-8", timeout=180)
    linha = next((l for l in p.stdout.splitlines() if l.startswith("@@JSON@@")), None)
    if not linha:
        print("ERRO motor não rodou:\n" + (p.stderr or p.stdout)[-1500:])
        return 1
    d = json.loads(linha[len("@@JSON@@"):])

    casos = json.loads((ROOT / "tests/fixtures/reference-cases.json").read_text(encoding="utf-8"))["cases"]
    for c in casos:
        ref = capacity(c["input"])
        motor = {m["methodId"]: m for m in d["piles"][c["id"]]["methods"]}
        bom = all(
            ok(f"{c['id']} {mid} {k}", motor[mid][k], ref["methods"][mid][k])
            for mid in ref["methods"]
            for k in ("Rp_kN", "Rl_acum_kN", "Padm_kN")
        )
        pad = " ".join(f"{mid[:2].upper()} {motor[mid]['Padm_kN']:7.1f}" for mid in ref["methods"])
        print(f"{'OK ' if bom else 'ERRO'} estaca {c['id']:<20} {pad} | governante {d['piles'][c['id']]['governing']:.1f} kN")

    # Sapata: B = 2, h = 0,60, CEB-70
    f = d["footing"]
    M = 700 * 2 * 0.895 ** 2 / 2
    As = M / (0.85 * 0.55 * (500 / 1.15) * 1000) * 1e4 / 2
    bom = ok("sapata B", f["B_m"], 2.0) & ok("sapata h", f["thickness_m"], 0.6) & ok("sapata As", f["AsB_cm2_per_m"], As)
    print(f"{'OK ' if bom else 'ERRO'} sapata CEB-70: B={f['B_m']:.3f} h={f['thickness_m']:.2f} As={f['AsB_cm2_per_m']:.2f} cm²/m (ref {As:.2f})")

    fm = d["footingMoment"]
    B_ref = 2.6894  # raiz de B³ − 5B − 6 = 0
    bom = fm["sigmaMax_kPa"] <= fm["qadm_kPa"] + 1e-6 and B_ref <= fm["B_m"] <= B_ref * 1.011
    if not bom:
        falhas.append(f"sapata com momento: B={fm['B_m']:.4f}, σmáx={fm['sigmaMax_kPa']:.1f}")
    print(f"{'OK ' if bom else 'ERRO'} sapata com momento: B={fm['B_m']:.3f} m (ref ≥ {B_ref}) σmáx={fm['sigmaMax_kPa']:.1f} ≤ {fm['qadm_kPa']:.0f} kPa")

    b = d["block"]
    T = 1400 * (2 * 1.2 - 0.3) / (8 * 0.7)
    th = math.degrees(math.atan(0.7 / (0.6 - 0.075)))
    bom = ok("bloco T", b["Tx_kN"], T) & ok("bloco θ", b["thetaMin_deg"], th) & bool(b["ok"])
    print(f"{'OK ' if bom else 'ERRO'} bloco Blévot 2 estacas: T={b['Tx_kN']:.1f} kN (ref {T:.1f}) θ={b['thetaMin_deg']:.2f}° (ref {th:.2f}°)")

    rc = d["pileRc"]
    Nrd = (0.85 * (25 / 3.1) * rc["Ac_m2"] + rc["As_cm2"] * 1e-4 * 420) * 1000
    bom = ok("estaca Nrd", rc["Nrd_kN"], Nrd)
    print(f"{'OK ' if bom else 'ERRO'} estaca Ø40 compressão: Nrd={rc['Nrd_kN']:.1f} kN (ref {Nrd:.1f})")

    for x in falhas:
        print("  FALHA", x)
    print("RESULTADO:", "REPROVADO" if falhas else "APROVADO")
    return 1 if falhas else 0


if __name__ == "__main__":
    sys.exit(main())
