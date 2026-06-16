/**
 * Almacén de access token EN MEMORIA (no localStorage/sessionStorage).
 * Si la página se recarga, hay que hacer /auth/refresh con la cookie httpOnly.
 */
let _accessToken = null;
let _csrfToken = null;

export const tokenStore = {
  setAccess(t)  { _accessToken = t || null; },
  getAccess()   { return _accessToken; },
  clearAccess() { _accessToken = null; },

  setCsrf(t)    { _csrfToken = t || null; },
  getCsrf()     { return _csrfToken; },
  clearCsrf()   { _csrfToken = null; },

  clearAll()    { _accessToken = null; _csrfToken = null; },
};
