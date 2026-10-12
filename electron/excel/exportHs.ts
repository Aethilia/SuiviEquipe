import { listPrestations } from '../../src/shared/prestations';
import { loadAgents, loadPrestations, loadYear } from '../storage';
import { buildHsWorkbook } from './buildHs';

export async function exportHs(year: number, file: string): Promise<void> {
  const [docs, agents, presta] = await Promise.all([loadYear(year), loadAgents(), loadPrestations()]);
  const wb = buildHsWorkbook(year, docs, Object.values(agents.agents), listPrestations(presta));
  await wb.xlsx.writeFile(file);
}

