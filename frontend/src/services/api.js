import axios from 'axios';
import { tokenStore } from '../utils/tokenStore.js';

const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

export const api = axios.create({
  baseURL: API_URL,
  timeout: 30_000,
  withCredentials: true, // necesario para que viajen las cookies httpOnly (refresh)
});

// ── Interceptor de request: inyecta Bearer + CSRF
api.interceptors.request.use((config) => {
  const access = tokenStore.getAccess();
  if (access) config.headers.Authorization = `Bearer ${access}`;
  const csrf = tokenStore.getCsrf();
  if (csrf && !['get', 'head', 'options'].includes((config.method || 'get').toLowerCase())) {
    config.headers['X-CSRF-Token'] = csrf;
  }
  return config;
});

// ── Refresh silencioso + exponential backoff para fallos transitorios
let refreshing = null;
async function silentRefresh() {
  if (!refreshing) {
    refreshing = axios.post(`${API_URL}/auth/refresh`, null, { withCredentials: true })
      .then((r) => {
        tokenStore.setAccess(r.data.accessToken);
        if (r.data.csrfToken) tokenStore.setCsrf(r.data.csrfToken);
        return r.data.accessToken;
      })
      .finally(() => { refreshing = null; });
  }
  return refreshing;
}

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const cfg = error.config || {};
    const status = error.response?.status;

    // 401 → intenta refrescar y reintentar UNA vez
    if (status === 401 && !cfg.__retried && !cfg.url?.includes('/auth/')) {
      cfg.__retried = true;
      try {
        await silentRefresh();
        return api(cfg);
      } catch { /* falla → seguir al reject */ }
    }

    // 5xx y errores de red → backoff exponencial hasta 3 reintentos
    cfg.__retryCount = cfg.__retryCount || 0;
    const retriable = !status || status >= 500;
    if (retriable && cfg.__retryCount < 3) {
      cfg.__retryCount += 1;
      const delay = Math.pow(2, cfg.__retryCount) * 250; // 500, 1000, 2000 ms
      await new Promise((res) => setTimeout(res, delay));
      return api(cfg);
    }

    return Promise.reject(error);
  },
);

export { silentRefresh };
