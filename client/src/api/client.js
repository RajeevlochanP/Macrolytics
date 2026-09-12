export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export const API_BASE = '/api';

export const apiClient = async (endpoint, options = {}) => {
  const url = `${API_BASE}${endpoint}`;
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // If we are uploading a file (FormData or Blob), let the browser set the Content-Type
  if (options.body && (options.body instanceof FormData || options.body instanceof Blob)) {
    delete headers['Content-Type'];
  }

  const config = {
    ...options,
    headers,
    credentials: 'include', // Automatically sends HTTP-only auth cookies
  };

  if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData || config.body instanceof Blob)) {
    config.body = JSON.stringify(config.body);
  }

  const response = await fetch(url, config);

  let data;
  try {
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }
  } catch (e) {
    data = null;
  }

  if (!response.ok) {
    throw new ApiError(data?.error || data?.message || response.statusText, response.status);
  }

  return data;
};
