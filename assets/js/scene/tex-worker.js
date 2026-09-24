/**
 * Worker de génération de textures : calcule une texture en arrière-plan (hors du fil principal)
 * et renvoie ses tableaux de pixels sans copie (transfert de mémoire).
 */
import * as G from './texgen.js';

self.onmessage = ({ data: { id, name, args } }) => {
  try {
    const r = G[name](...args);
    self.postMessage({ id, r }, [r.col.buffer, r.nrm.buffer, r.rough.buffer]);
  } catch (err) {
    self.postMessage({ id, error: String(err) });
  }
};
