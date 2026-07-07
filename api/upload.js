import { request } from './client.js';

export async function upload(path, formData, options = {}) {
  const headers = { ...options.headers };
  // Ensure Content-Type is deleted so browser automatically inserts boundary
  delete headers['Content-Type'];

  return request(path, {
    ...options,
    method: options.method || 'POST',
    body: formData,
    headers
  });
}
