// Remplace le module « electron » dans les tests multi-processus.
export const app = { getPath: () => process.env.USERDATA ?? '' };
