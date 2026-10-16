/**
 * Cenários de projeto (DEC-37 W7 scaffold).
 * Duplicar solução para comparação — sem otimização automática ainda.
 */

export interface DesignScenarioMeta {
  id: string;
  label: string;
  note?: string;
  createdAt: string;
}

export function createScenarioId(): string {
  return `sc-${Date.now().toString(36)}`;
}

export function defaultScenario(): DesignScenarioMeta {
  return {
    id: "default",
    label: "Cenário base",
    createdAt: new Date().toISOString(),
  };
}
