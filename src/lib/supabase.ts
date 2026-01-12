// Legacy compatibility layer - redirects to new API-based auth
// This file exists for backwards compatibility with components still importing from here

import { api } from '@/lib/api';

export const signUp = async (email: string, password: string, fullName: string) => {
  try {
    const data = await api.post<{ user: any }>('/auth/signup', { email, password, fullName });
    return { data, error: null };
  } catch (error: any) {
    return { data: null, error: { message: error.message || 'Signup failed' } };
  }
};

export const signIn = async (email: string, password: string) => {
  try {
    const data = await api.post<{ user: any }>('/auth/login', { email, password });
    return { data, error: null };
  } catch (error: any) {
    return { data: null, error: { message: error.message || 'Login failed' } };
  }
};

export const signOut = async () => {
  try {
    await api.post('/auth/logout', {});
    return { error: null };
  } catch (error: any) {
    return { error: { message: error.message || 'Logout failed' } };
  }
};

export const getCurrentUser = async () => {
  try {
    const data = await api.get<{ user: any }>('/auth/me');
    return { user: data.user, error: null };
  } catch (error: any) {
    return { user: null, error: { message: error.message || 'Failed to get user' } };
  }
};

export const getSession = async () => {
  try {
    const data = await api.get<{ user: any }>('/auth/me');
    return { session: data.user ? { user: data.user } : null, error: null };
  } catch (error: any) {
    return { session: null, error: { message: error.message || 'Failed to get session' } };
  }
};
