export class InterceptorManager {
  constructor() {
    this.handlers = [];
  }

  use(fulfilled, rejected) {
    this.handlers.push({ fulfilled, rejected });
    return this.handlers.length - 1;
  }

  eject(id) {
    if (this.handlers[id]) {
      this.handlers[id] = null;
    }
  }

  async runRequest(options) {
    let currentOptions = { ...options };
    for (const handler of this.handlers) {
      if (handler && handler.fulfilled) {
        currentOptions = await handler.fulfilled(currentOptions) || currentOptions;
      }
    }
    return currentOptions;
  }

  async runResponse(response) {
    let currentResponse = response;
    for (const handler of this.handlers) {
      if (handler && handler.fulfilled) {
        currentResponse = await handler.fulfilled(currentResponse) || currentResponse;
      }
    }
    return currentResponse;
  }
}

export const requestInterceptors = new InterceptorManager();
export const responseInterceptors = new InterceptorManager();
