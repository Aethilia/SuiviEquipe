import { describe, expect, it } from 'vitest';
import { compareVersions, parseInstallerName } from '../src/shared/version';

describe('versions', () => {
  it('lit la version dans le nom de l\'installateur', () => {
    expect(parseInstallerName('SuiviEquipe-Setup-1.0.12.exe')).toBe('1.0.12');
    expect(parseInstallerName('SuiviEquipe-Setup-01.002.3.exe')).toBe('1.2.3');
    for (const n of ['SuiviEquipe-Setup-1.0.exe', 'Suivi Équipe Setup 1.0.0.exe', 'SuiviEquipe-Setup-1.0.0.exe.part', 'autre.exe', 'SuiviEquipe-Setup-1.0.0.exe.blockmap']) {
      expect(parseInstallerName(n), n).toBeNull();
    }
  });
  it('compare numériquement (1.0.10 > 1.0.9)', () => {
    expect(compareVersions('1.0.10', '1.0.9')).toBeGreaterThan(0);
    expect(compareVersions('1.0.5', '1.0.5')).toBe(0);
    expect(compareVersions('0.1.0', '1.0.5')).toBeLessThan(0);
    expect(compareVersions('2.0.0', '1.99.99')).toBeGreaterThan(0);
  });
});
