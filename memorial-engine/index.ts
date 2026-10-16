export type {
  MemorialInput,
  MemorialDocument,
  MemorialSection,
  MemorialBoreholeLayer,
} from "./types";
export {
  buildMemorialDocument,
  memorialToMarkdown,
  memorialToHtml,
} from "./buildMemorial";

/** PDF: importar de `@memorial/toPdf` (chunk separado na UI). */
export type { MemorialPdfOptions } from "./toPdf";
