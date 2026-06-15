import axios from 'axios';

const BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:4000';

export const apiClient = axios.create({ baseURL: BASE, timeout: 30_000 });

apiClient.interceptors.request.use(cfg => {
  const token = localStorage.getItem('gateway_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// apiClient.interceptors.response.use(
//   res => res,
//   err => {
//     if (err.response?.status === 401) {
//       localStorage.removeItem('gateway_token');
//       localStorage.removeItem('gateway_user');
//       window.location.href = '/login';
//     }
//     return Promise.reject(err);
//   }
// );
apiClient.interceptors.response.use(res => res, err => {
  if (err.response?.status === 401) {
    const hadToken = !!localStorage.getItem('gateway_token');
    localStorage.removeItem('gateway_token');
    localStorage.removeItem('gateway_user');
    if (hadToken) {
      window.location.href = '/'; // session genuinely expired — reload app
    }
    // if hadToken was false, do nothing — just let the request fail quietly
  }
  return Promise.reject(err);
}
);