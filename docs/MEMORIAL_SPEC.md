# Memorial de cálculo — especificação (Fase 5)

## Princípio

O memorial **não recalcula**. Ele serializa de forma legível:

- dados de entrada do projeto (store / `Project`);
- `CalculationResult` do `calculation-engine`;
- `StructuralDesignResult` do `structural-engine` (se existir).

Toda fórmula citada no texto deve corresponder a traços já emitidos pelos motores.

## Seções (ordem fixa)

1. Identificação do projeto  
2. Dados do local  
3. Dados da estaca  
4. Dados geotécnicos (resumo)  
5. Sondagem (tabela)  
6. Metodologia adotada  
7. Parâmetros adotados  
8. Cálculos (resumo + referência aos traços)  
9. Comparação entre métodos  
10. Verificações (carga de projeto × Padm)  
11. Resultado final  
12. Armadura (se calculada)  
13. Conclusão  
14. Notas e responsabilidade técnica  

## Formatos

| Formato | Uso |
|---------|-----|
| Markdown | arquivo `.md`, versionamento, diff |
| HTML | preview + impressão do navegador |
| PDF nativo | `memorialToPdf` (pdf-lib + Roboto) — DEC-26 |
| Estrutura `MemorialDocument` | API futura DOCX / figuras |

## Fora de escopo (ainda)

- Assinatura digital / ART automática  
- Export DOCX nativo (pode vir depois com a mesma `MemorialDocument`)  
- Inclusão de figuras 2D/3D no PDF  
