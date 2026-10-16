# Validação

Como o STARKX confere os próprios números.

## Oráculo independente

`tools/reference/pile_capacity.py` implementa Aoki-Velloso, Décourt-Quaresma e Teixeira em Python,
a partir das fórmulas e tabelas publicadas (ver `docs/METHODS.md`), **sem reaproveitar o código
TypeScript do motor**. Por ser independente, ele também acusa um coeficiente digitado errado nas
tabelas do motor.

`tools/reference/build_fixtures.py` gera `tests/fixtures/reference-cases.json` com 11 casos
sintéticos:

| Caso | O que exercita |
|---|---|
| `ref-escavada-30` | o exemplo do app: escavada Ø30 × 8 m, argila mole sobre silte arenoso |
| `helice-40` | hélice contínua: F1/F2 = 2/4, α/β de Décourt próprios |
| `franki-40` | base alargada (área pela esfera equivalente) |
| `metalica-tr50` | área e perímetro informados |
| `centrifugada-33` | pré-moldada: F1 = 1 + D/0,80 |
| `raiz-25-areia` | areia, β de Décourt = 150 % |
| `escavada-50-areia` | janela de ponta de Teixeira de 4D acima a 1D abaixo |
| `decrescente-40` | N decrescente com a profundidade |
| `bloco-topo-0.9` | topo da estaca sob o bloco, SPT a cada 0,5 m |
| `parametros-usuario` | percentuais e α/β informados pelo usuário |
| `atrito-excluido` | camadas com atrito excluído |

Para regerar depois de mudar o oráculo: `python tools/reference/build_fixtures.py`.

## Testes

- `tests/integration/reference-cases.test.ts`: motor × oráculo em Rp, Rl, Rult e Padm de cada
  método (tolerância relativa de 10⁻⁶).
- `tests/integration/calculation-rules.test.ts`: regras dos métodos (α pela tabela, N̄L sem a janela
  de ponta, 4 ≤ N ≤ 40 no Teixeira, atrito desde o primeiro metro).
- Testes unitários com valores conferidos à mão: Vesic (φ = 30°), sapata (CEB-70, σmáx com
  momento), bloco (Blévot com 2 estacas, Converse-Labarre), estaca de concreto (Nrd, M1d,mín, Vc),
  tubulão (serviço × cálculo, fuste, base alargada).
- `e2e/example.spec.ts`: o exemplo carregado na interface mostra os valores do oráculo.

```
npm test            # unitários e integração
npm run typecheck
npm run test:e2e    # navegador (Playwright)
npm run ci          # tudo
python .audit/check.py   # motor × oráculo e contas à mão, em um resumo de uma linha por caso
```

## O que não é validado aqui

- A aderência de cada critério à edição vigente das normas (NBR 6122, NBR 6118) — revisão de
  engenheiro.
- Comparação com provas de carga reais.
- Recalques, efeitos de 2ª ordem, atrito negativo e esforços em placas (fora do escopo).
