# Visualização 2D — STARKX

**Fase 3** · SVG paramétrico ligado ao modelo (sem fórmulas de capacidade).  
**DEC-42:** bloco no corte, multi-estaca, cotas e legenda de escala do Ø.

## Componentes

| Arquivo | Papel |
|---------|--------|
| `FoundationSection2D.tsx` | Corte: solo, NA, estaca(s), bloco, NSPT |
| `BlockPlan2D.tsx` | Planta do bloco + cotas L×B |

## Props do corte

`diameterCm`, `tipDepth_m`, `waterLevel_m`, `layers[]`, opcional `cap`, `piles[]`.

## Exibido

- Camadas (opacidade reduzida)
- Estaca(s) + ponta + cota L
- Bloco translúcido com penetração das estacas (quando há `cap`)
- NA ou aviso fora do corte
- Escala de profundidade + N-SPT
- Legenda: Ø exagerado p/ leitura · profundidade em escala

## Não faz

- Cálculo geotécnico/estrutural

## 3D

Ver `docs/VIZ_3D.md`.
