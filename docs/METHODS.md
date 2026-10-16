# Métodos de cálculo

Este documento descreve o que cada motor calcula, com as fórmulas, as tabelas e as fontes. Os
resultados são de **pré-dimensionamento**: a conferência e a responsabilidade técnica são do
engenheiro habilitado.

Unidades internas: m, kN, kPa, MPa. Cargas de **serviço** (características) para a geotecnia; cargas
de **cálculo** (γf = 1,4) para o dimensionamento estrutural. Quando o usuário informa cargas de
cálculo, a geotecnia usa N/1,4.

## 1. Capacidade de carga de estacas (`calculation-engine`)

Os três métodos são calculados a cada SPT do perfil (cada SPT pode ser a cota de ponta, o que
alimenta a varredura de comprimento). O valor governante é, por padrão, o **mínimo** dos três; o
usuário pode escolher a média ou um método.

Fatias: cada SPT representa a camada entre o SPT anterior (ou a superfície) e ele. Só a parte abaixo
do topo da estaca entra no fuste. Camadas marcadas com "excluir atrito" têm atrito nulo.

### 1.1 Aoki & Velloso (1975)

```
Rp = K · N · Ap / F1                 (N do SPT na cota de ponta)
Rl = Σ U · α · K · N · Δz / F2       (N de cada camada do fuste)
Padm = (Rp + Rl) / FS                (FS = 2)
```

K e α: tabela original de Aoki & Velloso (1975), 15 solos.
F1 e F2: Cintra & Aoki (2010) — pré-moldada F1 = 1 + D/0,80 m, F2 = 2·F1; metálica 1,75/3,5;
escavada, Strauss e estacão 3,0/6,0; Franki 2,5/5,0; raiz e hélice contínua 2,0/4,0. A apiloada
usa os valores da Franki (analogia).

### 1.2 Décourt & Quaresma (1978), com α e β de Décourt (1996)

```
Rp = α · C · Np · Ap
Rl = β · 10 · (N̄L/3 + 1) · U · L
Padm = min( Rult/2 ; Rl/1,3 + Rp/4 )
```

- Np: média do N na ponta, no SPT imediatamente acima e no imediatamente abaixo.
- N̄L: média do N ao longo de **todo o fuste**, com 3 ≤ N ≤ 15, sem os SPT usados em Np (o da ponta
  e o de até 1 m acima), ponderada pela espessura das camadas.
- C (kPa): argila 120; silte argiloso 200; silte arenoso 250; areia 400.
- α e β: tabela de Décourt (1996) por grupo de solo (argilas, intermediários, areias) e tipo de
  estaca (escavada em geral, hélice contínua, raiz); pré-moldadas, metálica e Franki usam 100 %.
  α vem do solo da ponta. β, quando não informado, vem do solo **de cada camada**: o atrito é
  somado camada a camada, Σ β·10·(N/3 + 1)·U·Δz, usando N̄L nas camadas da janela de ponta. Com β
  único, a soma é idêntica à fórmula fechada acima.

### 1.3 Teixeira (1996)

```
Rp = α · Np · Ap          Np = média do N entre 4D acima e 1D abaixo da ponta
Rl = β · N̄L · U · L       N̄L = média do N no fuste
Padm = (Rp + Rl) / FS      (FS = 2), com 4 ≤ N ≤ 40
```

α (kPa): tabela de Teixeira (1996) com 8 solos e 4 grupos de estaca (pré-moldada e metálica, Franki,
escavada a céu aberto, raiz). Decisões do produto para o que a tabela não cobre:

- solos intermediários (areia siltoargilosa, silte arenoargiloso, argila arenossiltosa etc.) usam a
  média dos dois solos vizinhos da tabela; silte usa silte argiloso; argila usa argila siltosa;
- Strauss, estacão e hélice contínua usam a coluna "escavada"; apiloada usa a coluna Franki.

β (kPa): pré-moldada/metálica 4; Franki 5; escavada 4; raiz 6.

### 1.4 Geometria

Seção circular: Ap = π·D²/4, U = π·D. Metálica: área e perímetro informados (catálogo de trilhos).
Franki: Ap da base alargada pela esfera de mesmo volume, r = (3V/4π)^(1/3).

### 1.5 Carga estrutural usual

Tabela de cargas estruturais usuais por tipo e diâmetro (ordem de grandeza de mercado). Se o Padm
governante passa desse valor, há um **aviso**; o Padm não é alterado. Confirmar com o executor.

## 2. Estaca de concreto armado (`structural-engine`)

Parâmetros do concreto por tipo de estaca: NBR 6122:2019, Tabela 4 (fck, γc, ρmín, comprimento
mínimo de armadura, tensão abaixo da qual a estaca pode não ser armada). γs = 1,15; γf = 1,4.
Cobrimento padrão 40 mm (NBR 6118, Tabela 7.2: elemento em contato com o solo, CAA II).

- **Compressão centrada**: Nrd = 0,85·fcd·Ac + As·σs, com σs = min(fyd; Es·2‰) (NBR 6118 17.2.2).
- **Flexo-compressão** (com M ou V informados): Md = max(Msd; M1d,mín), M1d,mín = Nd·(0,015 + 0,03·D)
  (NBR 6118 11.3.3.4.3). MRd(Nd) por integração da seção circular: diagrama parábola-retângulo
  com 0,85·fcd, εc2 = 2‰, εcu = 3,5‰, aço elastoplástico com εsu = 10‰, barras uma a uma, no giro
  mais desfavorável. Escolhe-se a menor armadura n·φ (n ≥ 6) com Md ≤ MRd.
- **Cortante**: Modelo I da NBR 6118 (17.4.2.2) sobre o quadrado de mesma área (b = 0,886·D):
  VRd2 = 0,27·αv2·fcd·bw·d; Vc = 0,6·fctd·bw·d; Asw/s = (Vsd − Vc)/(0,9·d·fywd).
- **Detalhamento** (NBR 6118 18.4): φt ≥ max(5 mm; φℓ/4); s ≤ min(20 cm; D; 12φℓ para CA-50) e
  ≤ espaçamento exigido pelo cortante.
- Pré-moldada: As,mín = max(0,15·Nd/fyd; 0,4 %·Ac). Metálica e madeira: fora do escopo (NBR 8800 e
  NBR 7190).
- **Não cobre**: efeitos de 2ª ordem (flambagem em solo mole), tração e a distribuição de momentos
  ao longo do fuste (o comprimento da gaiola com momento é uma sugestão).

## 3. Grupo de estacas (`pile-group-engine`) e bloco (`block-engine`)

- **Reações** (bloco rígido): Ni = (N + Wbloco)/n ± Mx·yi/Σy² ± My·xi/Σx². Peso do bloco com 25 kN/m³.
  Verifica Nmáx ≤ Padm, ausência de tração e N + W ≤ η·n·Padm.
- **Espaçamento mínimo**: 3D para moldadas in loco e 2,5D para pré-moldadas e metálicas (mínimo
  absoluto 0,80 m).
- **Eficiência de grupo** (sugestão; η é decisão do engenheiro): Converse-Labarre,
  η = 1 − θ·[(n−1)·m + (m−1)·n]/(90·m·n), θ = arctg(D/s) em graus.
- **Bloco rígido** quando h ≥ (a − ap)/3 nas duas direções (NBR 6118 22.7.1). Dimensionado pelo
  método das bielas (Blévot & Frémy, 1967), generalizado para n estacas:
  - tirante: T = Σ Ri·(xi − a/4)/d, por direção (para 2 estacas, T = Nd·(2e − a)/(8d));
  - bielas: tg θ = d/(r − a/4), com 45° ≤ θ ≤ 55°;
  - tensões: σ = R/(A·sen²θ) junto ao pilar e junto à estaca ≤ k·0,85·fcd, com k = 1,4 (2 estacas),
    1,75 (3) e 2,1 (4 ou mais);
  - malha complementar ≥ As,tirante/5 em cada direção.
- **Bloco flexível**: verificação à punção da estaca mais carregada (NBR 6118 19.5): contorno C na
  face da estaca (τRd2) e contorno C' a 2d (τRd1). O cálculo como placa fica com o projetista.
- Bloco de 1 estaca: a carga passa direto; armadura construtiva.

## 4. Sapata isolada (`footing-engine`) e radier (`raft-engine`)

- **Geotecnia (serviço)**: área por (Nk + W)/σadm, com σadm informado ou qadm = qult/FS por Vesic
  (1975): qult = c·Nc·sc + γ·Df·Nq·sq + 0,5·γ·B·Nγ·sγ, fatores de forma de De Beer/Vesic. Com
  momentos, a sapata é ampliada até σmáx = N/A·(1 + 6ex/B + 6ey/L) ≤ σadm e com a base toda
  comprimida (6ex/B + 6ey/L ≤ 1).
- **Estrutural (cálculo)**: sapata rígida com h ≥ (B − bp)/3 (NBR 6118 22.6.1); flexão pelo método
  CEB-70 na seção S1 a 0,15·bp da face do pilar, As = M1d/(0,85·d·fyd), As ≥ 0,15 %·h; biela no
  contorno do pilar (τRd2, NBR 6118 19.5.3.1); punção no contorno C' quando a sapata é flexível.
- **Radier**: área e tensões como a sapata; espessura sugerida max(0,40 m; B/10). Os esforços na
  placa exigem modelo de placa sobre base elástica e ficam fora do escopo.
- **Não cobre**: recalques, nível d'água na capacidade, profundidade e inclinação nos fatores de
  Vesic (omitidos, a favor da segurança).

## 5. Tubulão (`caisson-engine`)

- Ponta: σadm informado ou Vesic com a base circular; Rp,adm = qadm·Ab.
- Fuste: atrito informado ou Aoki-Velloso (analogia com estaca escavada), com FS do fuste. Sem
  atrito no trecho da base alargada.
- Capacidade admissível comparada com a carga de **serviço**.
- Fuste de concreto simples: σd = Nd/As ≤ 0,85·fcd, com fcd = min(fck; 25)/3,1 (analogia com a
  escavada sem fluido da NBR 6122, Tabela 4).
- Base alargada: tronco de cone a 60°, H = (Db − Ds)/2·tg 60°, recomendado H ≤ 1,80 m.

## 6. Referências

- Aoki, N.; Velloso, D. A. (1975). An approximate method to estimate the bearing capacity of piles.
  V Congresso Panamericano de Mecânica dos Solos, Buenos Aires.
- Décourt, L.; Quaresma, A. R. (1978). Capacidade de carga de estacas a partir de valores de SPT.
  VI COBRAMSEF, Rio de Janeiro.
- Décourt, L. (1996). Análise e projeto de fundações profundas: estacas. In: Hachich et al.,
  Fundações: teoria e prática. Pini.
- Teixeira, A. H. (1996). Projeto e execução de fundações. III SEFE, São Paulo.
- Cintra, J. C. A.; Aoki, N. (2010). Fundações por estacas: projeto geotécnico. Oficina de Textos.
- Vesic, A. S. (1975). Bearing capacity of shallow foundations. In: Foundation Engineering Handbook.
- Blévot, J.; Frémy, R. (1967). Semelles sur pieux. Annales de l'ITBTP.
- Velloso, D. A.; Lopes, F. R. Fundações, vol. 1 e 2. Oficina de Textos.
- ABNT NBR 6122:2019 — Projeto e execução de fundações.
- ABNT NBR 6118:2014 — Projeto de estruturas de concreto.

Os pontos marcados como "decisão do produto" ou "analogia" não estão nas fontes originais e estão
documentados para revisão.
