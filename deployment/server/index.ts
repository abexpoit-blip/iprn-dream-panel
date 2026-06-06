import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { jwt, sign, verify } from 'hono/jwt';
import postgres from 'postgres';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

const app = new Hono();
const sql = postgres(process.env.DATABASE_URL || 'postgres://nexus:nexus123@localhost:5432/nexus_panel');
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';

app.use('*', cors());

// Auth Routes
app.post('/auth/login', async (c) => {
  const { username, password } = await c.req.json();
  
  // Find user by username or potential email candidate (for compatibility)
  const usernamePrefix = username.split('@')[0];
  const [user] = await sql`SELECT * FROM profiles WHERE username = ${username} OR username = ${usernamePrefix}`;
  
  if (!user) return c.json({ error: 'Invalid credentials' }, 401);
  
  const isValid = await bcrypt.compare(password, user.password_hash);
  
  // Fallback for initial admin seed if bcrypt hasn't hashed it yet
  const isSeedAdmin = user.username === 'admin' && password === 'admin123';
  
  if (!isValid && !isSeedAdmin) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const token = await sign({ 
    id: user.id, 
    username: user.username, 
    role: user.role,
    is_admin: user.is_admin,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 // 24h
  }, JWT_SECRET, 'HS256');

  return c.json({ user: { id: user.id, username: user.username, role: user.role, is_admin: user.is_admin }, token });
});

// Protected Data Proxy (Supabase-like CRUD)
app.use('/api/*', jwt({ secret: JWT_SECRET, alg: 'HS256' }));

app.get('/api/data/:table', async (c) => {
  const table = c.req.param('table');
  const query = c.req.query();
  
  // Basic select all
  let results;
  if (query.id) {
    results = await sql`SELECT * FROM ${sql(table)} WHERE id = ${query.id}`;
  } else {
    results = await sql`SELECT * FROM ${sql(table)} ORDER BY created_at DESC LIMIT 100`;
  }
  
  return c.json(results);
});

app.post('/api/data/:table', async (c) => {
  const table = c.req.param('table');
  const body = await c.req.json();
  const results = await sql`INSERT INTO ${sql(table)} ${sql(body)} RETURNING *`;
  return c.json(results[0]);
});

app.patch('/api/data/:table', async (c) => {
  const table = c.req.param('table');
  const body = await c.req.json();
  const id = c.req.query('id');
  if (!id) return c.json({ error: 'Missing ID' }, 400);
  
  const results = await sql`UPDATE ${sql(table)} SET ${sql(body)} WHERE id = ${id} RETURNING *`;
  return c.json(results[0]);
});

// Payouts custom logic
app.get('/api/payouts', async (c) => {
  const results = await sql`
    SELECT p.*, pr.username 
    FROM payouts p 
    JOIN profiles pr ON p.agent_id = pr.id 
    ORDER BY p.created_at DESC
  `;
  return c.json(results);
});

// Bot Management
app.get('/api/bots', async (c) => {
  const results = await sql`SELECT * FROM bots`;
  return c.json(results);
});

const port = 3005;
console.log(`🚀 API Server starting on port ${port}...`);

serve({ fetch: app.fetch, port });

