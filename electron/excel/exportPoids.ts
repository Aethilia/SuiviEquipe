import { loadPoidsYear, loadVehicules } from '../storage';
import { buildPoidsWorkbook } from './buildPoids';

export async function exportPoids(year: number, file: string): Promise<void> {
  const [docs, vehicules] = await Promise.all([loadPoidsYear(year), loadVehicules()]);
  const wb = buildPoidsWorkbook(year, docs, Object.values(vehicules.vehicules));
  await wb.xlsx.writeFile(file);
}
