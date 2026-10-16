# Decisões técnicas

Registro das decisões citadas no código (`DEC-xx`). Fórmulas e fontes: `docs/METHODS.md`.

## Cálculo

| ID | Decisão |
|---|---|
| DEC-02 | α e β de Décourt pela tabela de Décourt (1996): α pelo solo da ponta, β pelo solo de cada camada; o usuário pode informar valores únicos. |
| DEC-03 | Os três métodos são sempre calculados e exibidos com média e mínimo. Regra padrão do Padm governante: **mínimo**; o usuário pode escolher média ou um método. |
| DEC-04 | Carga de projeto opcional: Padm governante ≥ carga → ATENDE; senão NÃO ATENDE; sem carga → só previsão de capacidade. |
| DEC-06 | Nível d'água é cadastrado e aparece no memorial; não altera o SPT nem a capacidade. |
| DEC-09 | Carga estrutural usual por tipo × diâmetro: aviso quando o Padm a supera; o Padm não muda. |
| DEC-17 | Sem η informada, o Padm do grupo é só indicativo e não dá veredito; com η, a comparação vale como verificação. |
| DEC-19 | Estaca apiloada usa os parâmetros estruturais da escavada sem fluido (NBR 6122 não tem linha própria). |
| DEC-21 | Sugestão de η por Converse-Labarre, aplicada só se o usuário pedir (η continua sendo decisão do engenheiro). |
| DEC-22 | Atrito do tubulão pelo SPT: Aoki-Velloso com analogia à estaca escavada. |
| DEC-25 | Nomes de campos do tubulão: `unitFriction_kPa` e `shaftFS`. |
| DEC-47 | Camadas podem ter o atrito excluído (Rl = 0 nelas); a força de atrito negativo não é calculada. |
| DEC-51 | Armadura da estaca com momento/cortante: flexo-compressão por integração da seção e cortante pelo Modelo I (NBR 6118), sem 2ª ordem. |
| DEC-57 | Referencial: com bloco, o topo da estaca fica a (t − embutimento) abaixo do topo do bloco; o comprimento L é medido do topo da estaca; SPT pode ter profundidades fracionárias. |
| DEC-62 | Um só modo de cálculo, pelas fórmulas publicadas. Projetos salvos com o modo antigo migram para ele; a regra "média" daquele modo vira "mínimo". |

## Produto e interface

| ID | Decisão |
|---|---|
| DEC-08 | Recalque, atrito negativo e esforços em placa ficam fora do escopo; o software declara isso nos resultados. |
| DEC-15 | Sapata isolada: σadm informado ou Vesic (1975). |
| DEC-16 | Tubulão (ponta + fuste) e radier (geotécnico, espessura B/10). |
| DEC-26 | Memorial em PDF gerado no navegador (pdf-lib, fonte embutida). |
| DEC-27 | Assistente interpreta resultados e sugere ajustes; nunca calcula capacidade nem armadura. |
| DEC-28 | Importação de sondagem por JSON/CSV com pré-visualização e confirmação. |
| DEC-29 | Importação/exportação XLSX de sondagem e snapshot só de entradas do projeto. |
| DEC-32 | Teste de ponta a ponta lógico do exemplo (UI plana → capacidade → armadura → memorial). |
| DEC-33 | Recalculo automático com debounce; percentuais de Teixeira editáveis. |
| DEC-35 | Testes E2E com Playwright; XLSX exige confirmação explícita. |
| DEC-37 | Fluxo sequencial do projeto com etapas e bloqueios entre elas. |
| DEC-40 | Sugestão do tipo de solo pela descrição da sondagem, sempre confirmada pelo usuário. |
| DEC-43 | Alertas no formato "o quê / por quê / como corrigir". |
| DEC-44 | Vários pilares, com um ativo por vez; o Padm é compartilhado. |
| DEC-45 | Arranjo e bloco próprios para cada pilar. |
| DEC-46 | Armadura 3D esquemática (só visualização). |
| DEC-48 | Leitura de XLSX com ExcelJS. |
| DEC-50 | Dashboard e biblioteca de projetos salvos no navegador. |
| DEC-54 | Fluxo começa pelas cargas; a análise sugere o tipo de fundação. |
| DEC-55 | Revisão por pilar na análise. |
| DEC-56 | Análise do SPT raso: σadm indicativo ≈ 20·N̄ (kPa), limitado a 50–350 kPa; solo raso fraco desaconselha sapata. |
| DEC-58 | A concepção recomendada já entra aplicada até o usuário confirmar outra escolha. |
| DEC-61 | Carregar o exemplo é escolha explícita: a análise não troca o tipo de fundação. "Estaca isolada" (estudo de capacidade) permanece assim enquanto 1 estaca basta. |
