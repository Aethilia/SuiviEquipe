/** Nom d'un installateur publié dans le dossier partagé : SuiviEquipe-Setup-1.2.3.exe */
export const INSTALLER_RE = /^SuiviEquipe-Setup-(\d+)\.(\d+)\.(\d+)\.exe$/i;

/** Extrait la version « 1.2.3 » du nom d'un installateur, ou null si le nom ne correspond pas. */
export function parseInstallerName(name: string): string | null {
  const m = INSTALLER_RE.exec(name);
  return m ? `${Number(m[1])}.${Number(m[2])}.${Number(m[3])}` : null;
}

/** Compare deux versions « x.y.z » : négatif si a < b, 0 si égales, positif si a > b. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d;
  }
  return 0;
}
