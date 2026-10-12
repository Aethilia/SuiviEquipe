import { app, dialog } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

/** Journal du poste : `%APPDATA%\<application>\suivi-equipe.log` (jamais dans le dossier partagé). */
export const logFile = (): string => path.join(app.getPath('userData'), 'suivi-equipe.log');

export function log(message: string): void {
  try {
    const f = logFile();
    fs.mkdirSync(path.dirname(f), { recursive: true });
    // Journal borné : au-delà de 500 Ko on repart d'un fichier neuf.
    if (fs.existsSync(f) && fs.statSync(f).size > 500_000) fs.renameSync(f, `${f}.old`);
    fs.appendFileSync(f, `${new Date().toISOString()} ${message}\n`);
  } catch {
    /* le journal ne doit jamais faire planter l'application */
  }
}

let shown = false;

/** Affiche une seule boîte d'erreur (les suivantes ne feraient qu'empiler des fenêtres). */
export function fatal(title: string, detail: string): void {
  log(`${title}: ${detail}`);
  if (shown) return;
  shown = true;
  try {
    dialog.showErrorBox('Suivi Équipe – ' + title, `${detail}\n\nJournal : ${logFile()}`);
  } catch {
    /* rien de plus à faire */
  }
}

/** À appeler le plus tôt possible : sans cela, un plantage au démarrage ne laisse ni fenêtre ni trace. */
export function installCrashHandlers(): void {
  log(`démarrage v${app.getVersion()} electron ${process.versions.electron} ${process.platform} ${process.arch}`);
  process.on('uncaughtException', (e) => fatal('Erreur inattendue', e?.stack ?? String(e)));
  process.on('unhandledRejection', (e) => log(`promesse rejetée: ${e instanceof Error ? e.stack : String(e)}`));
  app.on('render-process-gone', (_e, _wc, d) => fatal("L'affichage a planté", `Cause : ${d.reason} (code ${d.exitCode})`));
  app.on('child-process-gone', (_e, d) => log(`processus ${d.type} arrêté: ${d.reason} (${d.exitCode})`));
}
