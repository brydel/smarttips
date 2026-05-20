import axios, { AxiosError, AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

interface RefreshResponse {
  accessToken: string;
}

interface FailedRequest {
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}

type OnUnauthenticatedCallback = () => void;

let _accessToken: string | null = null;
let _isRefreshing = false;
let _pendingQueue: FailedRequest[] = [];
let _onUnauthenticated: OnUnauthenticatedCallback | null = null;

function _flushQueue(error: unknown, token: string | null): void {
  _pendingQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token as string);
    }
  });
  _pendingQueue = [];
}

function _enqueue(): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    _pendingQueue.push({ resolve, reject });
  });
}

export const apiClient: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
    if (_accessToken && config.headers) {
      config.headers.set('Authorization', `Bearer ${_accessToken}`);
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error),
);

apiClient.interceptors.response.use(
  (response: AxiosResponse): AxiosResponse => response,

  async (error: AxiosError): Promise<AxiosResponse> => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retried?: boolean;
    };

    const isUnauthorized = error.response?.status === 401;
    const isRefreshEndpoint = originalRequest?.url?.includes('/auth/refresh');
    const alreadyRetried = originalRequest?._retried === true;

    if (!isUnauthorized || isRefreshEndpoint || alreadyRetried || !originalRequest) {
      return Promise.reject(error);
    }

    originalRequest._retried = true;

    if (_isRefreshing) {
      try {
        const newToken = await _enqueue();
        originalRequest.headers.set('Authorization', `Bearer ${newToken}`);
        return axios(originalRequest);
      } catch (queueError) {
        return Promise.reject(queueError);
      }
    }

    _isRefreshing = true;

    try {
      const { data } = await apiClient.post<RefreshResponse>('/auth/refresh');
      const newToken = data.accessToken;

      setAccessToken(newToken);
      _flushQueue(null, newToken);

      originalRequest.headers.set('Authorization', `Bearer ${newToken}`);
      return axios(originalRequest);
    } catch (refreshError) {
      setAccessToken(null);
      _flushQueue(refreshError, null);

      if (_onUnauthenticated) {
        _onUnauthenticated();
      } else if (typeof window !== 'undefined') {
        window.location.href = '/login?session=expired';
      }

      return Promise.reject(refreshError);
    } finally {
      _isRefreshing = false;
    }
  },
);

export function setAccessToken(token: string | null): void {
  _accessToken = token;
}

export function getAccessToken(): string | null {
  return _accessToken;
}

export function registerOnUnauthenticated(callback: OnUnauthenticatedCallback): void {
  _onUnauthenticated = callback;
}
