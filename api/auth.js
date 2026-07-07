export function injectAuthHeader(headers) {
  const newHeaders = { ...headers };
  const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
  if (token && !newHeaders['Authorization']) {
    newHeaders['Authorization'] = `Bearer ${token}`;
  }
  return newHeaders;
}

export function handleAuthError(err) {
  if (err.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('accessToken');
    if (window.auth) {
      window.auth.currentUser = null;
      window.auth.updateUI();
    }
  }
}
