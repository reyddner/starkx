import { mkdir, readFile, realpath, lstat, writeFile } from 'node:fs/promises';
import { isAbsolute, join, resolve, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import ExcelJS from 'exceljs';
import type { z } from 'zod';
import type { carimbo } from './schemas';

export const fontBytes = () => readFile(new URL('./Roboto-Regular.ttf',import.meta.url));
const asset = (name:string) => readFile(new URL(`./assets/${name}`,import.meta.url));
export async function saveExport(pasta:string,nome:string,ext:'pdf'|'xlsx'|'ifc',bytes:Uint8Array,sobrescrever=false) {
  if (!isAbsolute(pasta)) throw new Error('Informe pasta absoluta de saída.');
  const root=await realpath(fileURLToPath(new URL('../',import.meta.url)));
  const dir=resolve(pasta);
  const contained=(path:string)=>{const rel=relative(root,path);if(rel==='..'||rel.startsWith(`..\\`)||rel.startsWith('../')||isAbsolute(rel)) throw new Error('Pasta de saída deve estar dentro da pasta deste projeto MCP.');};
  contained(dir);
  // Check the nearest existing ancestor before mkdir, including Windows junctions.
  let ancestor=dir;
  for (;;) {
    try { contained(await realpath(ancestor)); break; }
    catch(e) { if (!(e instanceof Error && 'code' in e && e.code==='ENOENT')) throw e; ancestor=dirname(ancestor); }
  }
  await mkdir(dir,{recursive:true});
  contained(await realpath(dir));
  const caminho=join(dir,`${nome}.${ext}`);
  try { if ((await lstat(caminho)).isSymbolicLink()) throw new Error('Destino não pode ser um link simbólico.'); }
  catch(e) { if (!(e instanceof Error && 'code' in e && e.code==='ENOENT')) throw e; }
  await writeFile(caminho,bytes,{flag:sobrescrever?'w':'wx'});
  return {caminho,bytes:bytes.length};
}

/** Original pages remain intact as embedded content; stamp is added in the MCP layer. */
export async function stampPdf(bytes:Uint8Array,stamp?:z.output<typeof carimbo>) {
  if (!stamp) return bytes;
  const original=await PDFDocument.load(bytes);
  const output=await PDFDocument.create();
  output.registerFontkit(fontkit);
  const font=await output.embedFont(await fontBytes(),{subset:true});
  const logo=await output.embedPng(await asset('simbolo_B_transparente.png'));
  const bronze=rgb(0x7a/255,0x58/255,0x20/255), graphite=rgb(0x2f/255,0x2f/255,0x30/255);
  for (const source of await output.embedPages(original.getPages())) {
    const page=output.addPage([source.width,source.height]);
    const lines:string[]=[];
    for (const text of [`Empresa: ${stamp.empresa}`,`Responsável: ${stamp.responsavel}`,`CREA: ${stamp.registro_CREA}`,`Obra: ${stamp.obra}`,`Código: ${stamp.codigo}`]) {
      let line='';
      // Character wrap also handles a long code without spaces.
      for (const ch of text) {
        if (font.widthOfTextAtSize(line+ch,8)>page.getWidth()-108) {lines.push(line);line='';}
        line+=ch;
      }
      lines.push(line);
    }
    const height=Math.max(76,lines.length*11+20);
    const scale=Math.min(1,(page.getHeight()-height-12)/source.height);
    page.drawPage(source,{x:(page.getWidth()-source.width*scale)/2,y:height+6,width:source.width*scale,height:source.height*scale});
    page.drawRectangle({x:8,y:8,width:page.getWidth()-16,height:height-12,color:rgb(0xf2/255,0xef/255,0xe8/255),borderColor:bronze,borderWidth:0.8});
    const logoSize=logo.scaleToFit(56,50);
    page.drawImage(logo,{x:18,y:height-20-logoSize.height,...logoSize});
    lines.forEach((text,i)=>page.drawText(text,{x:88,y:height-23-i*11,size:8,font,color:graphite}));
  }
  return output.save();
}

export interface ExportTable { nome:string; colunas:string[]; linhas:(string|number|null)[][] }
export async function workbookBytes(titulo:string,tables:ExportTable[],commit:string,disclaimer:string) {
  const book=new ExcelJS.Workbook();
  book.creator='Mont Cruz Engenharia — StarkX MCP';
  for (const table of tables) {
    const sheet=book.addWorksheet(table.nome,{views:[{state:'frozen',ySplit:7}],pageSetup:{paperSize:9,orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0}});
    const last=Math.max(2,table.colunas.length);
    sheet.mergeCells(1,1,2,last); sheet.getRow(1).height=28;sheet.getRow(2).height=20;
    sheet.addImage(book.addImage({base64:`data:image/png;base64,${(await asset('logo_B_horizontal_transparente.png')).toString('base64')}`,extension:'png'}),{tl:{col:0,row:0},ext:{width:148,height:40}});
    sheet.mergeCells(3,1,3,last);sheet.getCell(3,1).value=titulo;
    sheet.mergeCells(4,1,4,last);sheet.getCell(4,1).value=`Motor vendorizado: ${commit}`;
    sheet.mergeCells(5,1,5,last);sheet.getCell(5,1).value=disclaimer;
    sheet.getRow(6).height=4;
    for(let col=1;col<=last;col++) sheet.getCell(6,col).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF7A5820'}};
    sheet.getRow(7).values=table.colunas;
    for (const row of table.linhas) sheet.addRow(row.map(v=>v??'Não disponível'));
    sheet.eachRow((row,index)=>{
      row.font={name:index===3?'Garamond':'Century Gothic',size:index===3?17:10,color:{argb:'FF2F2F30'},bold:index===3||index===7};
      row.alignment={vertical:'middle',wrapText:true};
      if(index===3) row.font.color={argb:'FF7A5820'};
      if(index===7) {row.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF7A5820'}};row.font.color={argb:'FFFFFFFF'};row.height=32;}
      else if(index>7) {row.height=58;row.fill={type:'pattern',pattern:'solid',fgColor:{argb:index%2?'FFFFFFFF':'FFF2EFE8'}};}
    });
    sheet.columns.forEach((col,i)=>{col.width=i===0?25:29;});
    sheet.autoFilter={from:{row:7,column:1},to:{row:7,column:table.colunas.length}};
    sheet.headerFooter.oddFooter='Mont Cruz Engenharia — &A — pág. &P/&N';
  }
  return new Uint8Array(await book.xlsx.writeBuffer());
}
