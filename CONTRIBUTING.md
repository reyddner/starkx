# Como contribuir

Obrigado pelo interesse. O STARKX calcula fundações, então a regra principal é: **todo número
precisa de fonte e de teste**.

## Antes de abrir um PR

```sh
npm run ci                 # testes, tipos, build e E2E
python .audit/check.py     # motor × implementação de referência
```

## Mudanças de cálculo

1. Cite a fonte: norma (com item) ou publicação (autor, ano). Coloque-a no comentário da função e
   em `docs/METHODS.md`.
2. Se mudar um método de estaca, atualize também o oráculo independente em
   `tools/reference/pile_capacity.py`, escrito a partir da fonte e não copiado do TypeScript, e
   regenere os casos: `python tools/reference/build_fixtures.py`.
3. Inclua um teste com um valor conferível à mão.
4. Se a mudança for uma decisão do produto (algo que a fonte não define), registre-a em
   `docs/DECISIONS.md`.

## Código

- Os motores (`*-engine/`) não importam nada da interface.
- A interface não calcula: só chama os motores e mostra o resultado.
- Textos da interface e do memorial em português do Brasil.

## Licença das contribuições

Ao contribuir, você concorda que sua contribuição seja distribuída sob a GNU AGPL-3.0.
