import { API_CONFIG } from "@/config/constants";

/**
 * API service for making authenticated requests
 */
export class ApiService {
  private baseUrl: string;
  private getAccessToken: () => string | undefined;

  constructor(getAccessToken: () => string | undefined) {
    this.baseUrl = API_CONFIG.BASE_URL;
    this.getAccessToken = getAccessToken;
  }

  /**
   * Get access token - public method
   */
  public getToken(): string | undefined {
    return this.getAccessToken();
  }

  /**
   * Get headers with authentication token
   */
  private getHeaders(): HeadersInit {
    const token = this.getAccessToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  /**
   * Generic fetch wrapper with authentication
   */
  async _fetch(url: string, options: RequestInit = {}): Promise<Response> {
    const response = await fetch(`${this.baseUrl}${url}`, {
      ...options,
      mode: 'cors',
      credentials: 'include',
      headers: {
        ...this.getHeaders(),
        ...options.headers,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Token might be expired, let the auth provider handle it
        throw new Error('Authentication required');
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    console.log(response.headers);

    return response;
  }

  /**
   * GET request
   */
  async get(url: string): Promise<any> {
    const response = await this._fetch(url);
    return response.json();
  }

  /**
   * POST request
   */
  async post(url: string, data: any): Promise<any> {
    const response = await this._fetch(url, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.json();
  }

  /**
   * PUT request
   */
  async put(url: string, data: any): Promise<any> {
    const response = await this._fetch(url, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return response.json();
  }

  /**
   * DELETE request
   */
  async delete(url: string): Promise<void> {
    await this._fetch(url, {
      method: 'DELETE',
    });
  }
}

/**
 * Create an API service instance
 */
export const createApiService = (getAccessToken: () => string | undefined) => {
  return new ApiService(getAccessToken);
};
