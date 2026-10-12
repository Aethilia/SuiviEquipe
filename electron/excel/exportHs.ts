import { loadAgents, loadYear } from '../storage';
import { buildHsWorkbook } from './buildHs';

export async function exportHs(year: number, file: string): Promise<void> {
  const [docs, agents] = await Promise.all([loadYear(year), loadAgents()]);
  const wb = buildHsWorkbook(year, docs, Object.values(agents.agents));
  await wb.xlsx.writeFile(file);
}

