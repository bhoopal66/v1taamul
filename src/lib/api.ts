const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

class ApiClient {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || 'Request failed');
    }

    return response.json();
  }

  get<T>(endpoint: string, params?: Record<string, string>) {
    let url = endpoint;
    if (params && Object.keys(params).length > 0) {
      const searchParams = new URLSearchParams(params);
      url = `${endpoint}?${searchParams.toString()}`;
    }
    return this.request<T>(url, { method: 'GET' });
  }

  post<T>(endpoint: string, data?: any) {
    return this.request<T>(endpoint, { method: 'POST', body: JSON.stringify(data) });
  }

  put<T>(endpoint: string, data?: any) {
    return this.request<T>(endpoint, { method: 'PUT', body: JSON.stringify(data) });
  }

  patch<T>(endpoint: string, data?: any) {
    return this.request<T>(endpoint, { method: 'PATCH', body: JSON.stringify(data) });
  }

  delete<T>(endpoint: string, data?: any) {
    return this.request<T>(endpoint, { method: 'DELETE', body: data ? JSON.stringify(data) : undefined });
  }
}

export const api = new ApiClient();
