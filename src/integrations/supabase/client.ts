import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Detect if we are in self-hosted mode
const IS_SELF_HOSTED = import.meta.env.VITE_SELF_HOSTED === 'true';
const API_URL = import.meta.env.VITE_API_URL || 'https://X.nexus-x.site/api';

function createSupabaseClient() {
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

  if (IS_SELF_HOSTED) {
    console.log('[Nexus] Using Self-Hosted API at:', API_URL);
    // Return a shim that mimics supabase-js for the components
    return {
      auth: {
        getSession: async () => {
          const token = localStorage.getItem('nexus_token');
          const userJson = localStorage.getItem('nexus_user');
          if (!token || !userJson) return { data: { session: null } };
          return { data: { session: { user: JSON.parse(userJson), access_token: token } } };
        },
        signInWithPassword: async ({ email, password }: any) => {
          try {
            const res = await fetch(`${API_URL}/auth/login`, {
              method: 'POST',
              body: JSON.stringify({ username: email, password }),
              headers: { 'Content-Type': 'application/json' }
            });
            const data = await res.json();
            if (!res.ok || data.error) return { error: { message: data.error || 'Login failed' } };
            
            localStorage.setItem('nexus_token', data.token);
            localStorage.setItem('nexus_user', JSON.stringify(data.user));
            return { data: { user: data.user, session: { access_token: data.token } } };
          } catch (e: any) {
            return { error: { message: 'Connection error: ' + e.message } };
          }
        },
        signOut: async () => {
          localStorage.removeItem('nexus_token');
          localStorage.removeItem('nexus_user');
          return { error: null };
        }
      },
      from: (table: string) => ({
        select: (query: string = '*') => ({
          eq: (col: string, val: any) => ({
            single: async () => {
              try {
                const res = await fetch(`${API_URL}/api/data/${table}?${col}=${val}`, {
                  headers: { 'Authorization': `Bearer ${localStorage.getItem('nexus_token')}` }
                });
                const data = await res.json();
                if (!res.ok) return { data: null, error: data.error || 'Fetch error' };
                return { data: Array.isArray(data) ? data[0] : data, error: null };
              } catch (e: any) {
                return { data: null, error: e.message };
              }
            }
          }),
          order: (col: string, opt: any) => ({
            limit: (n: number) => ({
              then: async (cb: any) => {
                try {
                  const res = await fetch(`${API_URL}/api/data/${table}`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('nexus_token')}` }
                  });
                  const data = await res.json();
                  return cb({ data, error: null });
                } catch (e: any) {
                  return cb({ data: null, error: e.message });
                }
              }
            }),
            then: async (cb: any) => {
               try {
                  const res = await fetch(`${API_URL}/api/data/${table}`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('nexus_token')}` }
                  });
                  const data = await res.json();
                  return cb({ data, error: null });
               } catch (e: any) {
                  return cb({ data: null, error: e.message });
               }
            }
          }),
          then: async (cb: any) => {
            try {
              const res = await fetch(`${API_URL}/api/data/${table}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('nexus_token')}` }
              });
              const data = await res.json();
              return cb({ data, error: null });
            } catch (e: any) {
              return cb({ data: null, error: e.message });
            }
          }
        }),
        insert: (rows: any[]) => ({
          then: async (cb: any) => {
            try {
              const res = await fetch(`${API_URL}/api/data/${table}`, {
                method: 'POST',
                body: JSON.stringify(rows[0]),
                headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${localStorage.getItem('nexus_token')}` 
                }
              });
              const data = await res.json();
              return cb({ data, error: null });
            } catch (e: any) {
              return cb({ data: null, error: e.message });
            }
          }
        }),
        update: (body: any) => ({
          eq: (col: string, val: any) => ({
            then: async (cb: any) => {
              try {
                const res = await fetch(`${API_URL}/api/data/${table}?id=${val}`, {
                  method: 'PATCH',
                  body: JSON.stringify(body),
                  headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('nexus_token')}` 
                  }
                });
                const data = await res.json();
                return cb({ data, error: null });
              } catch (e: any) {
                return cb({ data: null, error: e.message });
              }
            }
          })
        })
      })
    } as any;
  }

  // Original Supabase Client
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
     return createClient<Database>('https://placeholder.supabase.co', 'placeholder');
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      storage: typeof window !== 'undefined' ? localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
    }
  });
}

let _supabase: any | undefined;

export const supabase = new Proxy({} as any, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});


