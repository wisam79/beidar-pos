import { useAppStore } from '../../store/appStore';

export interface ApiResponse<T = unknown> {
    status: number;
    data?: T;
    error?: string;
    message?: string;
}

/**
 * API Client response handler and unauthorized interceptor.
 * Automatically clears authentication state and redirects to login on 401 Unauthorized.
 */
export const apiClient = {
    handleResponse: <T>(response: ApiResponse<T>): T => {
        if (response.status === 401) {
            useAppStore.getState().clearAuthSession();
            throw new Error('Unauthorized');
        }
        if (response.status >= 400) {
            throw new Error(response.error || response.message || `API Error: ${response.status}`);
        }
        return response.data as T;
    },

    request: async <T>(requestFn: () => Promise<ApiResponse<T>>): Promise<T> => {
        const response = await requestFn();
        return apiClient.handleResponse(response);
    },
};
