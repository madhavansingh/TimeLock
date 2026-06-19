const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/v1';

export interface ApiResponse<T = any> {
  data: T | null;
  error: {
    code: string;
    message: string;
  } | null;
  requestId: string;
}

class ApiClient {
  private getToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('token');
    }
    return null;
  }

  private getHeaders(isFormData = false): HeadersInit {
    const headers: Record<string, string> = {};
    if (!isFormData) {
      headers['Content-Type'] = 'application/json';
    }
    
    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return headers;
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    const text = await response.text();
    let json: any;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(text || `HTTP Error ${response.status}`);
    }

    if (!response.ok) {
      const errorMsg = json.error?.message || `HTTP error! status: ${response.status}`;
      const err = new Error(errorMsg) as any;
      err.code = json.error?.code || 'HTTP_ERROR';
      err.status = response.status;
      throw err;
    }

    return json as T;
  }

  public async get<T = any>(endpoint: string): Promise<ApiResponse<T>> {
    const url = `${BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    return this.handleResponse<ApiResponse<T>>(response);
  }

  public async post<T = any>(endpoint: string, data: any): Promise<ApiResponse<T>> {
    const url = `${BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse<ApiResponse<T>>(response);
  }

  public async postFormData<T = any>(endpoint: string, formData: FormData): Promise<ApiResponse<T>> {
    const url = `${BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(true),
      body: formData,
    });
    return this.handleResponse<ApiResponse<T>>(response);
  }

  public async put<T = any>(endpoint: string, data: any): Promise<ApiResponse<T>> {
    const url = `${BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const response = await fetch(url, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse<ApiResponse<T>>(response);
  }

  public async delete<T = any>(endpoint: string): Promise<ApiResponse<T>> {
    const url = `${BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const response = await fetch(url, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return this.handleResponse<ApiResponse<T>>(response);
  }
}

export const apiClient = new ApiClient();
