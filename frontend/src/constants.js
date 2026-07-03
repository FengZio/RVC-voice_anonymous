function backendHost() {
  if (typeof window === 'undefined' || !window.location) {
    return '127.0.0.1:7860';
  }
  if (window.location.port === '5173') {
    return `${window.location.hostname}:7860`;
  }
  return window.location.host;
}

export const API_BASE = typeof window === 'undefined'
  ? 'http://127.0.0.1:7860'
  : `${window.location.protocol}//${backendHost()}`;

export function websocketUrl(path) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${backendHost()}${path}`;
}

export const DEFAULT_CHUNK_MS = 800;
export const DEFAULT_TARGET_BUFFER_MS = 1500;

export const STORAGE_TOKEN_KEY = 'serenepath_token';
export const STORAGE_USER_KEY = 'serenepath_user';
export const STORAGE_ROLE_KEY = 'serenepath_role';
