// audit counters (env-guarded; browser: no-op)
const env = globalThis.process?.env ?? {};
const ON = !!env.J_COUNTS;
const ABL = new Set((env.J_ABL || '').split(',').filter(Boolean));
export const J = ON ? (k, v = 1) => { const C = (globalThis.__JC ??= {}); C[k] = (C[k] || 0) + v; } : () => {};
export const JA = (k) => ABL.has(k);
globalThis.__JCf = ON ? J : null;
