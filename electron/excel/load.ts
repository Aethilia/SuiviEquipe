import fs from 'node:fs';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';

/**
 * Charge un classeur en lecture seule.
 * Les « tableaux Excel » (xl/tables/*) font planter ExcelJS sur les classeurs de l'équipe ;
 * on les retire en mémoire (le fichier d'origine n'est jamais modifié). Les cellules restent intactes.
 */
export async function loadWorkbook(file: string): Promise<ExcelJS.Workbook> {
  const zip = await JSZip.loadAsync(await fs.promises.readFile(file));
  for (const name of Object.keys(zip.files)) {
    if (name.startsWith('xl/tables/')) zip.remove(name);
    else if (/^xl\/worksheets\/(_rels\/)?[^/]+\.(xml|rels)$/.test(name)) {
      let xml = await zip.file(name)!.async('string');
      xml = name.endsWith('.rels')
        ? xml.replace(/<Relationship [^>]*relationships\/table"[^>]*\/>/g, '')
        : xml.replace(/<tableParts[\s\S]*?<\/tableParts>/g, '');
      zip.file(name, xml);
    }
  }
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load((await zip.generateAsync({ type: 'nodebuffer' })) as unknown as ArrayBuffer);
  return wb;
}
