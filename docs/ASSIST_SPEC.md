# Assistente STARKX — Fase 10

## Princípio (inviolável)

- **Nunca** calcula Padm, As, σadm, Vesic, etc.
- Só lê resultados dos motores + inputs e emite `AssistFinding[]`.
- Ações sugeridas são **patches** para o usuário confirmar; o recálculo é sempre `calculate` / `design*`.

## MVP (DEC-27)

Heurísticas determinísticas locais (`analyzeAssist`) — sem LLM, sem rede.

Import de sondagem: `parseBoreholeImport` (JSON/CSV) e `parseBoreholeXlsx` (DEC-28/29) com preview obrigatório.

Snapshot de projeto: `exportProjectSnapshot` / `parseProjectSnapshot` — só inputs; apply limpa resultados (DEC-29).

Evolução futura (opcional): LLM só para **redigir** findings já gerados; OCR de PDF de sondagem → mesma fila de confirmação humana.
