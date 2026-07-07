import { request } from './client.js';

export async function download(path, options = {}) {
  return request(path, {
    ...options,
    _isDownload: true
  });
}
