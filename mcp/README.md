# STARKX · servidor MCP

Servidor MCP (stdio) dos motores do STARKX, para ligar o cálculo de fundações ao Claude Code, ao Codex ou a qualquer cliente MCP. Usa os motores deste mesmo repositório (pastas `calculation-engine`, `block-engine` etc.), o SDK oficial `@modelcontextprotocol/sdk` e Zod. Não há login, serviço HTTP nem chave de API.

Licença AGPL-3.0-only, como o resto do repositório (ver [LICENSE](../LICENSE) e [NOTICE](../NOTICE)). As exportações em XLSX e PDF trazem a identidade visual da Mont Cruz Engenharia (`src/assets/`); a marca e o logotipo seguem as restrições do NOTICE. Troque os arquivos de `src/assets/` para usar a sua.

**Estado:** 17 ferramentas (15 de cálculo e exportação + `exportar_ifc` e `importar_sondagem_ifc`). Tipos, build, testes e teste de fumaça passam.

## Construir e testar

Node.js 22 ou superior. A partir da pasta `mcp/` deste repositório:

```bash
npm ci
npm run typecheck
npm run build
npm test
```

O build gera `dist/server.mjs`, `dist/tools.mjs` (usado nos testes), `dist/Roboto-Regular.ttf` e `dist/assets/`. Mantenha fonte e logos junto aos bundles. O servidor é iniciado por `node dist/server.mjs`; stdout é reservado ao protocolo JSON-RPC. Os testes usam `node:test` e o cliente oficial via stdio, e deixam PDFs, XLSX e IFC em `test/saida/` (ignorada pelo git).

## Registro no cliente MCP

```bash
claude mcp add --scope user starkx -- node /caminho/para/starkx/mcp/dist/server.mjs
```

Para o Codex, em `~/.codex/config.toml`:

```toml
[mcp_servers.starkx]
command = "node"
args = ["/caminho/para/starkx/mcp/dist/server.mjs"]
```

## Ferramentas

| Ferramenta | Entrada e saída |
|---|---|
| `validar_sondagem` | `layers: [{depth_m,nspt,soilTypeId}]`, `waterLevel_m` opcional/nulo; erros e avisos do importador SPT |
| `calcular_estaca` | `pileTypeId`, `diametro_cm`, `tipDepth_m`, `layers`; métodos, resistência adotada, fatores e rastreios |
| `calcular_grupo_estacas` | `rows`, `cols`, `spacing_m`, `diameter_m`, `N_kN`, `Mx_kNm`, `My_kNm`, `singlePadm_kN`, `efficiency`; reações/capacidade |
| `calcular_bloco` | Grade, `diameter_m`, `edge_m`, `thickness_m`; carga, momentos e eficiência opcionais; geometria, verificações, armadura e quantitativo |
| `calcular_sapata` | `Nk_kN`, `shape` square/rectangular, `admMode` user/bearing; área, tensões e verificações |
| `calcular_radier` | Contrato de sapata sem `shape`, `aspectRatio` opcional; somente área/tensões e espessura preliminar |
| `calcular_tubulao` | `Nk_kN`, `shaftDiameter_m`, `length_m`, `admMode`; capacidade de ponta/fuste, verificações |
| `sugerir_concepcao` | `N_kN`, `layers`, `preferredPileTypeId`; sugestão heurística entre tipos e alternativas de estacas/grupos |
| `quantitativo_fundacao` | `tipo`: estaca (padrão), sapata ou bloco; geometria e armadura do dimensionamento, retornando quantitativo dos helpers nativos |
| `armadura_estaca` | `pileTypeId`, `diameter_m`, `tipDepth_m`, `Nk_kN`; `Mk_kNm`, `Vk_kN`, `loadIsDesign`, fck/fyk e `cover_mm` opcionais; armadura, verificações e quantitativo nativos |
| `comparar_alternativas` | `N_kN` característico, `layers`, água/momentos opcionais e configurações por alternativa; seis linhas com dimensões, verificação, taxa, quantitativo disponível e motivo |
| `exportar_memorial` | `estaca`, OU `sapata`, OU `estaca`+`bloco` com entradas dos respectivos cálculos; `pasta`, `nome`, `projeto`, `carimbo` e `sobrescrever` |
| `exportar_desenho` | Geometria de estaca como antes, OU `sapata` (com `fck_MPa`), OU `bloco` (com `groupLoad_kN`); construtores nativos, `referencia`, `pasta`, `nome`, `carimbo` e `sobrescrever` |
| `exportar_resumo_xlsx` | `quantitativo` com entrada de quantitativo_fundacao, OU `comparacao` com entrada de comparar_alternativas; `pasta`, `nome`, `projeto`, `sobrescrever`; recalcula e salva resumo Mont Cruz |
| `listar_metodos` | Sem argumentos; métodos/normas por motor, versão/commit e catálogos de solos/estacas |

Os campos seguem os contratos reais dos motores, descritos nos esquemas `src/schemas.ts`. Grandezas trazem a unidade no nome. São exceções adimensionais `nspt`, IDs, flags, contagens, razões e fatores. Na entrada da estaca foram renomeados `diameterCm → diametro_cm`, `areaCm2 → area_cm2`, `perimeterCm → perimetro_cm`, `enlargedBaseVolumeLiters → volume_base_litros`; no quantitativo, `lossPercentage → perdas_pct`. Saídas preservam os nomes dos motores e seus sufixos de unidade.

`tipDepth_m` é o **comprimento a partir do topo**, e `pileTopDepth_m` é a profundidade do topo abaixo da superfície. A ponta no SPT é a soma. Sondagem em m; NSPT e fatores adimensionais; forças kN; momentos kN·m; tensões geotécnicas kPa; resistência dos materiais MPa; aço mm. Use `listar_metodos` para IDs válidos.

Em sapata/radier/tubulão, `admMode: "user"` exige `sigmaAdm_kPa`; `"bearing"` exige `soil`. Sapata/radier usam `{c_kPa,phi_deg,gamma_kN_m3,embedment_m,fsBearing}`; tubulão usa `{c_kPa,phi_deg,gamma_kN_m3,fsTip}`. `loadIsDesign` informa se a carga já é de cálculo; conversões são do motor. Grupo exige `efficiency` explícita ou `null`; sem eficiência, capacidade é indicativa. Os fatores de estaca opcionais `aoki`, `decourt`, `teixeira` e `governingRule` são encaminhados ao motor; `user_selected` exige `selectedMethod` habilitado.

Todas as saídas válidas têm `motor_versao`, `motor_commit`, `motores`, `normas`, `referencias`, `avisos`, `ressalva` e `resultado`. A ressalva é:

> Pré-dimensionamento. Conferir e validar por engenheiro responsável antes de assinar.

Erros de estrutura/entrada usam `isError: true`, com mensagem em português. A sondagem de estrutura válida com erros nas camadas devolve `resultado.ok=false`, `errors`/`erros`, conforme seu propósito de validação. Campos desconhecidos são recusados.

Exemplo de sapata:

```json
{"Nk_kN":1000,"shape":"square","admMode":"user","sigmaAdm_kPa":200,"gammaConcrete_kN_m3":0}
```

Exportações gravam somente na pasta absoluta informada em `pasta`. Arquivos existentes só são substituídos com `sobrescrever: true`; o padrão é recusar. `nome` aceita letras, números, hífen e sublinhado. A camada MCP verifica também links/junções na pasta de destino.

## IFC4X3 (desde 25/10/2026)

`exportar_ifc` grava `<nome>.ifc` (esquema IFC4X3_ADD2) recalculando cada elemento pelos motores. `elementos` aceita `estaca` (IfcPile; `armadura` opcional gera Qto de aço), `bloco` (IfcFooting PILE_CAP agregando as IfcPile do layout do motor; a estaca usa a mesma entrada de `calcular_estaca`), `sapata` (IfcFooting PAD_FOOTING), `radier` (IfcSlab BASESLAB) e `tubulao` (IfcCaissonFoundation; base alargada desenhada a 60° com rodapé de 0,20 m). Cada elemento tem `ref`, `x_m`, `y_m` e profundidades em m abaixo de `cota_terreno_m`. `sondagens` grava IfcBorehole + um IfcGeotechnicalStratum por camada, com NSPT, solo e nível d'água em `Pset_MC_SondagemSPT`. Resultados de cálculo vão em `Pset_MC_STARKX`, classe do concreto em `Pset_ConcreteElementGeneral`, volumes em `Qto_*BaseQuantities` e aço em `Qto_MC_Armadura`. GlobalIds são estáveis por projeto + código + ref: reexportar atualiza o mesmo modelo no Bonsai. O gravador (`src/ifc.ts`) não tem dependências.

`importar_sondagem_ifc` lê IfcBorehole de qualquer IFC4X3 (inclusive gerado pelo IfcBorehole/c-mellueh ou pelo Bonsai) e devolve as camadas no formato STARKX. Usa `scripts/ifc_tools.py` no Python indicado por `STARKX_IFC_PYTHON` (padrão: `python` do PATH, que precisa ter IfcOpenShell). NSPT e solo só entram se estiverem no arquivo; o resto fica marcado como faltando.

Conferido em 25/10/2026: `ifcopenshell.validate` sem erros (incluindo regras EXPRESS), geometria de todos os produtos triangula, Bonsai 0.9 abre os 26 objetos do caso de teste, e a sondagem exportada volta idêntica pela importação (`test/ifc.test.mjs`). 

## Comparação, quantitativos e identidade

`comparar_alternativas` recebe uma única carga **característica**, os mesmos momentos e a mesma sondagem. Configure os objetos opcionais `estaca`, `bloco`, `sapata`, `radier`, `tubulao` e `concepcao` com os campos das ferramentas correspondentes, omitindo carga/sondagem comuns. Em `concepcao` use `preferredPileTypeId`. A estaca fornece a capacidade individual para o bloco; seu diâmetro/tipo devem coincidir. A eficiência do bloco deve ser explícita para haver veredito de capacidade. Nenhuma tensão admissível de sapata/radier é inferida da sondagem: informe tensão ou parâmetros de solo. Dados ausentes geram `status: "não calculada"` e motivo, preservando as outras linhas. Não há classificação de melhor alternativa ou orçamento.

As taxas são adimensionais, com `criterio_taxa` por linha: N/Padm da estaca, carga nativa com peso próprio/Padm do grupo, sigmaMax/qadm das rasas, Nk/Padm do tubulão ou `utilization` nativa da concepção. Uma taxa geotécnica não substitui verificações estruturais; confira `calculo`, avisos e limites. Sem fck, sapata não tem quantitativo de aço; radier não tem análise da placa. Com momentos, estaca axial isolada e tubulão aparecem como não calculados, pois seus motores não os verificam. A estaca axial continua disponível internamente para obter Padm do bloco, que verifica as reações.

Quantitativos recebem detalhamento informado, sem dimensionar novas barras. Estaca preserva o contrato anterior. Para sapata: `tipo: "sapata"`, `B_m`, `L_m`, `thickness_m`, `bar_mm`, `spacing_cm`. Para bloco: `tipo: "bloco"`, `pileCount`, `width_m`, `length_m`, `thickness_m`; opcionais `pileDiameter_m`, `tieX`/`tieY` (`bar_mm`, `count`), `suggestedBar_mm`, `suggestedSpacing_cm`, `leanConcreteThickness_m`. Ambos aceitam `elementRef`, `cover_m`, `concreteGrade` e `perdas_pct`. Valores não informados seguem os padrões do helper; não equivalem a uma armadura aprovada.

XLSX usa bronze `#7A5820`, grafite `#2F2F30`, creme `#F2EFE8`, Garamond nos títulos e Century Gothic no texto. Inclui logo B horizontal, commit, ressalva, unidades, filtro, cabeçalho fixo e rodapé de impressão. Quantitativos têm abas de resumo e corte de aço; comparação tem tabela e premissas de carga/sondagem. Fontes são declaradas na planilha; sua exibição depende do leitor.

Nos dois PDFs, `carimbo` é opcional e exige `{empresa, responsavel, registro_CREA, obra, codigo}`. O símbolo B oficial é aplicado pela camada MCP em todas as páginas. O conteúdo original é embutido proporcionalmente em uma área acima do carimbo, sem recorte e sem alterar `vendor/`; as escalas físicas do desenho mudam quando o carimbo é aplicado (cotas numéricas permanecem). Não há assinatura digital nem emissão de ART. Assets e procedência: `src/assets/ORIGEM.md`.

Exemplo de exportação de quantitativo:

```json
{"pasta":"/caminho/absoluto/saidas","nome":"bloco","quantitativo":{"tipo":"bloco","pileCount":1,"width_m":1,"length_m":1,"thickness_m":0.6}}
```

## Limites

- Nenhuma fórmula foi reimplementada ou corrigida. A cópia contém os 12 diretórios de motores/domain completos; nem toda função interna é publicada como ferramenta.
- Radier não analisa os esforços/armadura da placa. As sugestões são heurísticas e não aprovam soluções.
- Memorial de bloco usa o construtor conjunto com uma estaca real; não há memorial independente de bloco no motor atual. A capacidade individual é recalculada pela sondagem e prevalece sobre `singlePadm_kN` informado no bloco. O quantitativo desse memorial abrange somente o bloco (sem detalhamento de estacas inventado).
- Desenho de sapata exige fck e usa quantitativo real para evitar barras de exemplo do construtor. Desenho de bloco exige carga e passa `takeoff` nativo. A exportação legada de estaca continua ilustrativa; os padrões de armadura/quantitativo internos desses construtores não são dimensionamento .
- PDF usa os exportadores existentes; XLSX é um resumo produzido na camada MCP com ExcelJS. Não foi encontrado exportador DXF ou DOCX nos motores. Não foi criada estimativa de fôrmas.
- Normas listadas são referências citadas no código, sem presumir edição não informada ou conformidade integral. Catálogo e avisos ajudam a identificar hipóteses.
