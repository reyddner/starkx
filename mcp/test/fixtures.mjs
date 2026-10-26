import { readFileSync } from 'node:fs';
const reference=JSON.parse(readFileSync(new URL('../../tests/fixtures/reference-cases.json',import.meta.url),'utf8'));
export const example=reference.cases.find(c=>c.id==='ref-escavada-30');
export const pileInput = c => {
  const {diameterCm,areaCm2,perimeterCm,enlargedBaseVolumeLiters,...rest}=c.input;
  return {...rest,diametro_cm:diameterCm,...(areaCm2===undefined?{}:{area_cm2:areaCm2}),...(perimeterCm===undefined?{}:{perimetro_cm:perimeterCm}),...(enlargedBaseVolumeLiters===undefined?{}:{volume_base_litros:enlargedBaseVolumeLiters})};
};
export const cases=reference.cases;
export const toolNames=['validar_sondagem','calcular_estaca','calcular_grupo_estacas','calcular_bloco','calcular_sapata','calcular_radier','calcular_tubulao','sugerir_concepcao','quantitativo_fundacao','exportar_memorial','exportar_desenho','listar_metodos','armadura_estaca','comparar_alternativas','exportar_resumo_xlsx','exportar_ifc','importar_sondagem_ifc'];
