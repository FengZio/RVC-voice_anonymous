import { API_BASE } from '../constants.js';

export function apiForm(path, formData, options = {}) {
  return fetch(`${API_BASE}${path}`, {
    method: 'POST',
    body: formData,
    ...options,
  }).then(async (response) => {
    let data = {};
    try {
      data = await response.json();
    } catch {
      data = {};
    }
    if (!response.ok) {
      throw new Error(data.detail || '请求失败。');
    }
    return data;
  });
}

export function apiJson(path, options = {}) {
  return fetch(`${API_BASE}${path}`, options).then(async (response) => {
    let data = {};
    try {
      data = await response.json();
    } catch {
      data = {};
    }
    if (!response.ok) {
      throw new Error(data.detail || '请求失败。');
    }
    return data;
  });
}
