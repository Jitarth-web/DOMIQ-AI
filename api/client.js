import { ApiError, NetworkError, TimeoutError, AuthenticationError } from './errors.js';
import { injectAuthHeader, handleAuthError } from './auth.js';
import { requestInterceptors, responseInterceptors } from './interceptors.js';

export const baseUrl =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const DEFAULT_TIMEOUT = 15000;
const MAX_RETRIES = 5;
const INITIAL_DELAY = 200;

export async function request(path, options = {}) {
  let url = path;
  if (!path.startsWith('http://') && !path.startsWith('https://')) {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    url = `${baseUrl}${cleanPath}`;
  }

  options.method = options.method || 'GET';
  options.credentials = options.credentials || 'include';
  options.headers = options.headers || {};

  // Inject auth header
  options.headers = injectAuthHeader(options.headers);

  // Handle JSON body
  if (options.body && !(options.body instanceof FormData)) {
    if (typeof options.body === 'object') {
      options.body = JSON.stringify(options.body);
    }
    if (!options.headers['Content-Type']) {
      options.headers['Content-Type'] = 'application/json';
    }
  }

  // Run request interceptors
  options = await requestInterceptors.runRequest(options);

  let response;
  let delay = INITIAL_DELAY;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout || DEFAULT_TIMEOUT);

    // Merge AbortSignals
    let userSignalAborted = false;
    if (options.signal) {
      if (options.signal.aborted) {
        clearTimeout(timeoutId);
        throw new DOMException('The user aborted a request.', 'AbortError');
      }
      options.signal.addEventListener('abort', () => {
        userSignalAborted = true;
        controller.abort();
      });
    }

    try {
      response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);
      break;
    } catch (err) {
      clearTimeout(timeoutId);
      
      const isAbort = err.name === 'AbortError';
      
      // If aborted by user, do not retry, throw immediate AbortError/DOMException
      if (isAbort && userSignalAborted) {
        throw err;
      }

      const isNetworkError = err.name === 'TypeError' || err.message.toLowerCase().includes('failed to fetch') || err.message.toLowerCase().includes('networkerror') || err.message.toLowerCase().includes('network error');

      if ((isNetworkError || isAbort) && attempt < MAX_RETRIES) {
        console.warn(`[API] Connection issue to ${url} (attempt ${attempt + 1}/${MAX_RETRIES + 1}). Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
      } else {
        if (isAbort) {
          throw new TimeoutError(`Request to ${url} timed out after ${options.timeout || DEFAULT_TIMEOUT}ms`);
        }
        throw new NetworkError(`Network connection to ${url} failed: ${err.message}`, err);
      }
    }
  }

  // Run response interceptors
  response = await responseInterceptors.runResponse(response);

  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch {
      errorData = { message: `Request failed with status ${response.status}` };
    }

    if (response.status === 401) {
      handleAuthError({ status: 401 });
      throw new AuthenticationError(errorData.message || 'Session expired. Please log in again.', errorData);
    }

    throw new ApiError(errorData.message || 'API Request failed', response.status, errorData);
  }

  if (response.status === 204) {
    return null;
  }

  if (options._isDownload) {
    return await response.blob();
  }

  const contentType = response.headers.get('Content-Type');
  if (contentType && contentType.includes('application/json')) {
    return await response.json();
  }

  return response;
}
