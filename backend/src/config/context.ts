import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContext {
  requestId: string;
  nvidiaApiKey?: string;
}

export const requestContextStorage = new AsyncLocalStorage<RequestContext>();

/**
 * Returns the current request's correlation ID, or 'system' if called outside a request context.
 */
export function getRequestId(): string {
  const store = requestContextStorage.getStore();
  return store?.requestId || 'system';
}

/**
 * Returns the custom NVIDIA API key if provided in request headers.
 */
export function getNvidiaApiKey(): string | undefined {
  const store = requestContextStorage.getStore();
  return store?.nvidiaApiKey;
}
