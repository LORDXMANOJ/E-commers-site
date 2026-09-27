import axios, { AxiosError } from "axios";
import { storage } from "./storage";

export const TOKEN_KEY = "aurelle.token";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  timeout: 20_000,
});

api.interceptors.request.use((config) => {
  const token = storage.get(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export type FieldError = { path: string; message: string };

/** Normalised API failure: always has a human-readable message. */
export class ApiError extends Error {
  status: number;
  errors: FieldError[];
  constructor(message: string, status: number, errors: FieldError[] = []) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

let onUnauthorized: (() => void) | null = null;
/** Registered by the auth provider: a 401 on an authenticated request signs the user out locally. */
export const setUnauthorizedHandler = (fn: () => void) => {
  onUnauthorized = fn;
};

api.interceptors.response.use(
  (res) => res,
  (err: AxiosError<{ message?: string; errors?: FieldError[] }>) => {
    if (!err.response) {
      return Promise.reject(new ApiError("Can't reach the server. Check your connection and try again.", 0));
    }
    const { status, data } = err.response;
    if (status === 401 && err.config?.headers?.Authorization) onUnauthorized?.();
    return Promise.reject(new ApiError(data?.message ?? "Something went wrong. Please try again.", status, data?.errors ?? []));
  },
);

/** Unwraps the `{ success, data }` envelope. */
export async function get<T>(url: string, params?: object): Promise<T> {
  return (await api.get(url, { params })).data.data as T;
}
export async function post<T>(url: string, body?: unknown): Promise<T> {
  return (await api.post(url, body)).data.data as T;
}
export async function patch<T>(url: string, body?: unknown): Promise<T> {
  return (await api.patch(url, body)).data.data as T;
}
export async function put<T>(url: string, body?: unknown): Promise<T> {
  return (await api.put(url, body)).data.data as T;
}
export async function del<T>(url: string): Promise<T> {
  return (await api.delete(url)).data.data as T;
}

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");
