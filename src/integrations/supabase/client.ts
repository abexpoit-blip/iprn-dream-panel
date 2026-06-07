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
      from: (table: string) => {
        const chain: any = {
          _filters: {} as any,
          _limit: 200,
          _order: 'created_at.desc',
          _count: null as string | null,
          
          select: function(query: string = '*', options: any = {}) {
            if (options.count) this._count = options.count;
            return this;
          },
          
          eq: function(col: string, val: any) {
            this._filters[col] = val;
            return this;
          },
          
          ilike: function(col: string, val: any) {
            this._filters[col] = val;
            return this;
          },

          gte: function(col: string, val: any) {
             this._filters[col] = val;
             return this;
          },

          lt: function(col: string, val: any) {
             this._filters[col] = val;
             return this;
          },

          order: function(col: string, options: any = {}) {
            this._order = `${col}.${options.ascending ? 'asc' : 'desc'}`;
            return this;
          },
          
          limit: function(n: number) {
            this._limit = n;
            return this;
          },

          single: async function() {
            const url = new URL(`${API_URL}/api/data/${table}`);
            Object.keys(this._filters).forEach(k => url.searchParams.append(k, this._filters[k]));
            url.searchParams.append('limit', '1');
            
            try {
              const res = await fetch(url.toString(), {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('nexus_token')}` }
              });
              const data = await res.json();
              if (!res.ok) return { data: null, error: data.error || 'Fetch error' };
              return { data: Array.isArray(data) ? data[0] : data, error: null };
            } catch (e: any) {
              return { data: null, error: e.message };
            }
          },

          delete: function() {
             return {
                eq: async (col: string, val: any) => {
                   try {
                     const res = await fetch(`${API_URL}/api/data/${table}?id=${val}`, {
                       method: 'DELETE',
                       headers: { 'Authorization': `Bearer ${localStorage.getItem('nexus_token')}` }
                     });
                     return { error: res.ok ? null : { message: 'Delete failed' } };
                   } catch (e: any) {
                     return { error: { message: e.message } };
                   }
                }
             };
          },

          insert: async function(rows: any[]) {
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
              return { data, error: res.ok ? null : { message: data.error || 'Insert failed' } };
            } catch (e: any) {
              return { data: null, error: { message: e.message } };
            }
          },

          update: function(body: any) {
            return {
              eq: async (col: string, val: any) => {
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
                  return { data, error: res.ok ? null : { message: data.error || 'Update failed' } };
                } catch (e: any) {
                  return { data: null, error: { message: e.message } };
                }
              }
            };
          },

          then: async function(resolve: any) {
            const url = new URL(`${API_URL}/api/data/${table}`);
            Object.keys(this._filters).forEach(k => url.searchParams.append(k, this._filters[k]));
            url.searchParams.append('limit', this._limit.toString());
            url.searchParams.append('order', this._order);
            if (this._count) url.searchParams.append('count', this._count);

            try {
              const res = await fetch(url.toString(), {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('nexus_token')}` }
              });
              const data = await res.json();
              
              let count = null;
              if (this._count) {
                 const range = res.headers.get('Content-Range');
                 if (range) count = parseInt(range.split('/')[1]);
              }

              return resolve({ data, error: res.ok ? null : { message: 'Fetch failed' }, count });
            } catch (e: any) {
              return resolve({ data: null, error: { message: e.message } });
            }
          }
        };
        return chain;
      }
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


