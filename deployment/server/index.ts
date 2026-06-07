import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { jwt, sign } from 'hono/jwt';


import postgres from 'postgres';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

const app = new Hono();
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://nexus:nexus123@db:5432/nexus_panel';
console.log(`[Auth] Connecting to database: ${DATABASE_URL.split('@')[1]}`);

const sql = postgres(DATABASE_URL, {
  max: 20,
  idle_timeout: 30,
  connect_timeout: 10
});

// Database Initialization Helper
async function initDb() {
  try {
    console.log('[DB] Checking for profiles table...');
    const [exists] = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'profiles'
      );
    `;
    
    if (!exists.exists) {
      console.log('[DB] Profiles table not found. Running init.sql...');
      const fs = await import('node:fs');
      const path = await import('node:path');
      const initSql = fs.readFileSync(path.join(process.cwd(), 'init.sql'), 'utf8');
      
      // Split by semicolon and filter empty lines to run each statement
      const statements = initSql.split(';').map(s => s.trim()).filter(s => s.length > 0);
      for (const statement of statements) {
        await sql.unsafe(statement);
      }
      console.log('[DB] Initialization complete.');
    } else {
      console.log('[DB] Database already initialized.');
    }
  } catch (err) {
    console.error('[DB] Initialization error:', err);
  }
}

// Run initialization
initDb();

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';

app.use('*', cors());

// Health check for Docker
app.get('/health', (c) => c.json({ status: 'ok' }));

// Auth Routes
app.post('/auth/login', async (c) => {
  try {
    const body = await c.req.json();
    const { username, password } = body;
    
    if (!username || !password) {
      return c.json({ error: 'Username and password required' }, 400);
    }

    const rawUsername = username.trim();
    
    console.log(`[Auth] Attempting login for: ${rawUsername}`);

    // Check multiple username formats to be flexible
    const [user] = await sql`
      SELECT * FROM profiles 
      WHERE username = ${rawUsername} 
      OR username = ${rawUsername.toLowerCase()}
      OR username = ${rawUsername + '@nexus.site'}
    `;
    
    if (!user) {
      console.log(`[Auth] Login failed: User not found (${rawUsername})`);
      return c.json({ error: 'Invalid credentials' }, 401);
    }
    
    if (user.status !== 'approved' && user.status !== 'active') {
      console.log(`[Auth] Login blocked: User status is ${user.status}`);
      return c.json({ error: 'Account pending approval or suspended' }, 403);
    }

    // Try normal bcrypt comparison first
    let isValid = false;
    try {
      isValid = await bcrypt.compare(password, user.password_hash);
    } catch (err) {
      console.error('[Auth] Bcrypt error:', err);
    }
    
    // Hardcoded fallback for admin
    const isSeedAdmin = (user.username === 'admin') && password === 'admin123';
    
    if (!isValid && !isSeedAdmin) {
      console.log(`[Auth] Login failed: Password mismatch for ${rawUsername}`);
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    const token = await sign({ 
      id: user.id, 
      username: user.username, 
      role: user.role || 'agent',
      is_admin: !!user.is_admin,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 // 7 days
    }, JWT_SECRET, 'HS256' as any);

    console.log(`[Auth] User logged in successfully: ${user.username} (${user.role})`);
    return c.json({ 
      user: { 
        id: user.id, 
        username: user.username, 
        role: user.role || 'agent', 
        is_admin: !!user.is_admin,
        status: user.status
      }, 
      token 
    });
  } catch (error) {
    console.error('[Auth] Login exception:', error);
    return c.json({ error: 'Server authentication error' }, 500);
  }
});

// Protected Data Proxy
// @ts-ignore
app.use('/api/*', jwt({ secret: JWT_SECRET, alg: 'HS256' }));

app.get('/api/data/:table', async (c) => {
  const table = c.req.param('table');
  const query = c.req.query();
  
  try {
    let results;
    if (query.id) {
      results = await sql`SELECT * FROM ${sql(table)} WHERE id = ${query.id}`;
    } else {
      // Basic filtering support for better performance
      const keys = Object.keys(query).filter(k => k !== 'id');
      if (keys.length > 0) {
        let baseQuery = sql`SELECT * FROM ${sql(table)} WHERE `;
        keys.forEach((key, index) => {
          baseQuery = sql`${baseQuery} ${sql(key)} = ${query[key]} ${index < keys.length - 1 ? sql`AND` : sql``}`;
        });
        results = await sql`${baseQuery} ORDER BY created_at DESC LIMIT 200`;
      } else {
        results = await sql`SELECT * FROM ${sql(table)} ORDER BY created_at DESC LIMIT 200`;
      }
    }
    return c.json(results);
  } catch (error) {
    console.error(`Error fetching ${table}:`, error);
    return c.json({ error: 'Database error' }, 500);
  }
});

app.post('/api/data/:table', async (c) => {
  const table = c.req.param('table');
  const body = await c.req.json();
  try {
    // Ensure id is generated if missing
    if (!body.id) body.id = crypto.randomUUID();
    const results = await sql`INSERT INTO ${sql(table)} ${sql(body)} RETURNING *`;
    return c.json(results[0]);
  } catch (error) {
    console.error(`Error creating in ${table}:`, error);
    return c.json({ error: 'Database error' }, 500);
  }
});

app.patch('/api/data/:table', async (c) => {
  const table = c.req.param('table');
  const body = await c.req.json();
  const id = c.req.query('id');
  if (!id) return c.json({ error: 'Missing ID' }, 400);
  
  try {
    const results = await sql`UPDATE ${sql(table)} SET ${sql(body)} WHERE id = ${id} RETURNING *`;
    return c.json(results[0]);
  } catch (error) {
    console.error(`Error updating ${table}:`, error);
    return c.json({ error: 'Database error' }, 500);
  }
});

app.get('/api/payouts', async (c) => {
  try {
    const results = await sql`
      SELECT p.*, pr.username 
      FROM payouts p 
      JOIN profiles pr ON p.agent_id = pr.id 
      ORDER BY p.created_at DESC
    `;
    return c.json(results);
  } catch (error) {
    console.error('Error fetching payouts:', error);
    return c.json({ error: 'Database error' }, 500);
  }
});

app.get('/api/bots', async (c) => {
  try {
    const results = await sql`SELECT * FROM bots`;
    return c.json(results);
  } catch (error) {
    console.error('Error fetching bots:', error);
    return c.json({ error: 'Database error' }, 500);
  }
});

const port = 3005;
console.log(`🚀 API Server starting on port ${port}...`);

serve({ fetch: app.fetch, port });
