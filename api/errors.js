export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export class NetworkError extends ApiError {
  constructor(message, data) {
    super(message, 0, data);
    this.name = 'NetworkError';
  }
}

export class TimeoutError extends ApiError {
  constructor(message, data) {
    super(message, 408, data);
    this.name = 'TimeoutError';
  }
}

export class AuthenticationError extends ApiError {
  constructor(message, data) {
    super(message, 401, data);
    this.name = 'AuthenticationError';
  }
}
