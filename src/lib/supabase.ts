import { supabase } from "@/integrations/supabase/client";

export { supabase };

const withTimeout = async <T,>(
  promise: Promise<T>,
  ms: number,
  timeoutMessage: string
): Promise<T> => {
  let timeoutId: number | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(timeoutMessage)), ms);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId);
  }
};

// Auth helpers
export const signUp = async (email: string, password: string, fullName: string) => {
  try {
    const { data, error } = await withTimeout(
      supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            full_name: fullName,
            username: email.split('@')[0],
          },
        },
      }),
      12_000,
      'Signup timed out. Please try again.'
    );

    return { data, error };
  } catch (e: any) {
    const status = e?.status;
    const message =
      status === 504
        ? 'Backend timed out. Please try again in a moment.'
        : e?.message || 'Signup failed. Please try again.';

    return { data: null as any, error: { message } as any };
  }
};

export const signIn = async (email: string, password: string) => {
  try {
    const { data, error } = await withTimeout(
      supabase.auth.signInWithPassword({
        email,
        password,
      }),
      12_000,
      'Sign-in timed out. Please try again.'
    );

    return { data, error };
  } catch (e: any) {
    const status = e?.status;
    const message =
      status === 504
        ? 'Backend timed out. Please try again in a moment.'
        : e?.message || 'Sign-in failed. Please try again.';

    return {
      data: { user: null, session: null } as any,
      error: { message } as any,
    };
  }
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  return { error };
};

export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  return { user, error };
};

export const getSession = async () => {
  const { data: { session }, error } = await supabase.auth.getSession();
  return { session, error };
};
