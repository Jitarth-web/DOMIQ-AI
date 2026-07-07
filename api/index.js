import { request, baseUrl } from './client.js';
import { upload } from './upload.js';
import { download } from './download.js';
import { requestInterceptors, responseInterceptors } from './interceptors.js';
import { ApiError, NetworkError, TimeoutError, AuthenticationError } from './errors.js';

const apiClient = {
  baseUrl,
  interceptors: {
    request: requestInterceptors,
    response: responseInterceptors
  },
  request,
  get: (path, options = {}) => request(path, { ...options, method: 'GET' }),
  post: (path, body, options = {}) => request(path, { ...options, method: 'POST', body }),
  put: (path, body, options = {}) => request(path, { ...options, method: 'PUT', body }),
  patch: (path, body, options = {}) => request(path, { ...options, method: 'PATCH', body }),
  delete: (path, options = {}) => request(path, { ...options, method: 'DELETE' }),
  upload,
  download
};

// Inject into global window for backwards compatibility
window.apiClient = apiClient;
window.ApiError = ApiError;
window.NetworkError = NetworkError;
window.TimeoutError = TimeoutError;
window.AuthenticationError = AuthenticationError;

export { apiClient, ApiError, NetworkError, TimeoutError, AuthenticationError };
export default apiClient;
