# Visualização 3D — STARKX

**Fase 6** (+ P2 DEC-24 · DEC-42 · DEC-46) · Three.js / React Three Fiber. Somente projeção do modelo (store).

## Princípio

- Não calcula capacidade nem armadura.
- Unidades em **metros** (eixo Y para cima; profundidade = −Y).
- Sem Three.js dentro dos engines.

## Componentes

| Arquivo | Papel |
|---------|--------|
| `apps/web/src/viz3d/PileScene3D.tsx` | Estaca(s) + bloco + solo + NA + gaiola |
| `apps/web/src/viz3d/RebarCageMesh.tsx` | Longitudinais + estribos/espirais |
| `apps/web/src/viz3d/rebarGeometry.ts` | Posições/raios (testável, sem Three) |
| `apps/web/src/viz3d/ShallowScene3D.tsx` | Sapata / tubulão / radier + solo |
| `apps/web/src/viz3d/SoilLayersMesh.tsx` | Blocos de solo por camada SPT |
| `apps/web/src/viz3d/PileMesh.tsx` | Cilindro (+ base Franki; translúcido c/ gaiola) |
| `apps/web/src/viz3d/WaterPlane.tsx` | Plano do NA |
| `apps/web/src/components/VizPanel.tsx` | Toggle 2D / 3D |

## Dados (store)

Estaca/bloco: `diameterCm`, `tipDepth_m`, `waterLevel_m`, `layers`, `blockResult`, `theme`, `structural.detail`.

Rasas: `footingResult` / `caissonResult` / `raftResult` + `footingDf_m` / `raftDf_m` + `layers` / `waterLevel_m`.

## Entregue

- Solo + estaca(s) + NA + órbita + cap do bloco
- Sapata (caixa), tubulão (fuste + base), radier (placa)
- Toggle 2D / 3D no painel
- **DEC-42:** solo e bloco translúcidos; anel de saída do fuste no fundo do cap
- **DEC-46:** gaiola 3D esquemática (toggle); fuste translúcido; barras exageradas p/ leitura

## Fora de escopo

- Detalhamento CAD / dobras / emendas, LOD/worker, figura no memorial
