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
    console.log('[DB] Running init.sql (idempotent)...');
    const fs = await import('node:fs');
    const path = await import('node:path');
    const initSql = fs.readFileSync(path.join(process.cwd(), 'init.sql'), 'utf8');
    const statements = initSql.split(';').map(s => s.trim()).filter(s => s.length > 0);
    for (const statement of statements) {
      try {
        await sql.unsafe(statement);
      } catch (e: any) {
        console.warn('[DB] stmt failed (continuing):', e.message);
      }
    }
    console.log('[DB] Initialization complete.');
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
    
    // Status can be active or approved
    const isApproved = user.status === 'approved' || user.status === 'active' || user.is_admin;
    if (!isApproved) {
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
    const isSeedAdmin = (user.username === 'admin' || user.username === 'admin@nexus.site') && password === 'admin123';
    
    console.log(`[Auth] Validation - Bcrypt: ${isValid}, SeedAdmin: ${isSeedAdmin}`);

    
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
        status: user.status,
        balance: user.balance,
        skype_id: user.skype_id,
        full_name: user.full_name
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
      const keys = Object.keys(query).filter(k => !['id', 'limit', 'order', 'head', 'count', 'select'].includes(k));
      const limit = query.limit ? parseInt(query.limit) : 200;
      
      let baseQuery = sql`SELECT * FROM ${sql(table)}`;
      
      if (query.select && query.select !== '*') {
         // Security note: this is a simple proxy, ideally you'd validate select columns
         baseQuery = sql`SELECT ${sql(query.select.split(','))} FROM ${sql(table)}`;
      }

      if (keys.length > 0) {
        baseQuery = sql`${baseQuery} WHERE `;
        keys.forEach((key, index) => {
          // Handle some common relationship patterns or special filters
          if (query[key].startsWith('%') || query[key].endsWith('%')) {
             baseQuery = sql`${baseQuery} ${sql(key)} ILIKE ${query[key]} ${index < keys.length - 1 ? sql`AND` : sql``}`;
          } else {
             baseQuery = sql`${baseQuery} ${sql(key)} = ${query[key]} ${index < keys.length - 1 ? sql`AND` : sql``}`;
          }
        });
      }
      
      if (query.order) {
        const [col, dir] = query.order.split('.');
        baseQuery = sql`${baseQuery} ORDER BY ${sql(col)} ${dir === 'desc' ? sql`DESC` : sql`ASC`}`;
      } else {
        baseQuery = sql`${baseQuery} ORDER BY created_at DESC`;
      }
      
      results = await sql`${baseQuery} LIMIT ${limit}`;
    }

    if (query.count === 'exact') {
       const countRes = await sql`SELECT count(*) FROM ${sql(table)}`;
       c.header('Content-Range', `0-${results.length}/${countRes[0].count}`);
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
    
    // Custom logic for profiles/clients to handle passwords
    if ((table === 'profiles' || table === 'clients') && body.password) {
      const salt = await bcrypt.genSalt(10);
      body.password_hash = await bcrypt.hash(body.password, salt);
      delete body.password;
    }

    const results = await sql`INSERT INTO ${sql(table)} ${sql(body)} RETURNING *`;

    // If we just created a client, also create a profile for them so they can login
    if (table === 'clients') {
      await sql`
        INSERT INTO profiles (id, username, password_hash, role, status)
        VALUES (${body.id}, ${body.username}, ${body.password_hash}, 'client', 'approved')
        ON CONFLICT (username) DO NOTHING
      `;
    }

    return c.json(results[0]);
  } catch (error) {
    console.error(`Error creating in ${table}:`, error);
    return c.json({ error: 'Database error' }, 500);
  }
});

// Upsert endpoint — handles ON CONFLICT for bot_settings etc.
app.post('/api/upsert/:table', async (c) => {
  const table = c.req.param('table');
  const onConflict = c.req.query('on_conflict') || '';
  const rows = await c.req.json();
  const list = Array.isArray(rows) ? rows : [rows];
  if (list.length === 0) return c.json([]);

  try {
    const conflictParts = onConflict.split(',').map(s => s.trim()).filter(Boolean);
    const results: any[] = [];
    for (const row of list) {
      const cols = Object.keys(row);
      const vals = Object.values(row);

      let query = `INSERT INTO "${table}" (${cols.map(c => `"${c}"`).join(',')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(',')})`;
      if (conflictParts.length > 0) {
        const conflictCols = conflictParts.map(s => `"${s}"`).join(',');
        const updateCols = cols.filter(c => !conflictParts.includes(c));
        if (updateCols.length > 0) {
          query += ` ON CONFLICT (${conflictCols}) DO UPDATE SET ${updateCols.map(c => `"${c}" = EXCLUDED."${c}"`).join(',')}`;
        } else {
          query += ` ON CONFLICT (${conflictCols}) DO NOTHING`;
        }
      }
      query += ` RETURNING *`;
      const r = await sql.unsafe(query, vals as any[]);
      if (r[0]) results.push(r[0]);
    }
    return c.json(results);
  } catch (error: any) {
    console.error(`Upsert error on ${c.req.param('table')}:`, error.message);
    return c.json({ error: error.message }, 500);
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

app.delete('/api/data/:table', async (c) => {
  const table = c.req.param('table');
  const id = c.req.query('id');
  if (!id) return c.json({ error: 'Missing ID' }, 400);
  
  try {
    await sql`DELETE FROM ${sql(table)} WHERE id = ${id}`;
    return c.json({ success: true });
  } catch (error) {
    console.error(`Error deleting from ${table}:`, error);
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

// Auto Pool trigger — notifies all bots to immediately scrape their number panels
app.post('/api/numbers/auto-pool', async (c) => {
  try {
    const beforeRow = await sql`SELECT COUNT(*)::int AS n FROM number_pool`;
    const before = beforeRow[0]?.n ?? 0;
    await sql`NOTIFY scrape_now`;
    return c.json({
      success: true,
      message: 'Auto Pool triggered. Bots are scraping number panels now.',
      pool_count_before: before,
    });
  } catch (error: any) {
    console.error('Auto Pool error:', error);
    return c.json({ error: error.message || 'Failed to trigger auto pool' }, 500);
  }
});

// =========================================================================
// Allocation chain: Admin → Agent → Client
// =========================================================================

// Helper — read JWT payload (Hono jwt middleware stores it under c.get('jwtPayload'))
function caller(c: any) {
  return c.get('jwtPayload') || {};
}

// POST /api/allocations/assign-agent  (admin only)
// body: { number_ids: string[], agent_id: string, markup: number }
app.post('/api/allocations/assign-agent', async (c) => {
  const me = caller(c);
  if (!me.is_admin && me.role !== 'admin') return c.json({ error: 'Admin only' }, 403);

  const body = await c.req.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body.number_ids) ? body.number_ids : [];
  const agentId: string = body.agent_id;
  const markup = Number(body.markup) || 0;
  if (!ids.length || !agentId) return c.json({ error: 'number_ids and agent_id required' }, 400);

  try {
    // Confirm the agent exists & is a real agent profile
    const agent = await sql`SELECT id FROM profiles WHERE id = ${agentId} LIMIT 1`;
    if (!agent.length) return c.json({ error: 'Agent not found' }, 404);

    let assigned = 0;
    for (const nid of ids) {
      const rows = await sql`
        SELECT id, panel_payout FROM number_pool WHERE id = ${nid} LIMIT 1
      `;
      if (!rows.length) continue;
      const base = Number(rows[0].panel_payout) || 0;
      const finalRate = base + markup;

      // Release any prior active agent allocation for this number
      await sql`
        UPDATE number_allocations
        SET status = 'released', released_at = now()
        WHERE number_pool_id = ${nid} AND tier = 'agent' AND status = 'active'
      `;
      // Also release any active client allocation since ownership chain restarts
      await sql`
        UPDATE number_allocations
        SET status = 'released', released_at = now()
        WHERE number_pool_id = ${nid} AND tier = 'client' AND status = 'active'
      `;

      await sql`
        INSERT INTO number_allocations
          (number_pool_id, tier, from_user_id, to_user_id, base_rate, markup, final_rate)
        VALUES
          (${nid}, 'agent', ${me.id}, ${agentId}, ${base}, ${markup}, ${finalRate})
      `;

      await sql`
        UPDATE number_pool
        SET assigned_agent = ${agentId},
            assigned_client = NULL,
            agent_rate = ${finalRate},
            client_rate = NULL,
            updated_at = now()
        WHERE id = ${nid}
      `;
      assigned++;
    }
    return c.json({ success: true, assigned, agent_id: agentId, markup });
  } catch (err: any) {
    console.error('[assign-agent]', err);
    return c.json({ error: err.message || 'assign-agent failed' }, 500);
  }
});

// POST /api/allocations/assign-client  (agent only)
// body: { number_ids: string[], client_id: string, markup: number }
app.post('/api/allocations/assign-client', async (c) => {
  const me = caller(c);
  if (!me.id) return c.json({ error: 'Auth required' }, 401);

  const body = await c.req.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body.number_ids) ? body.number_ids : [];
  const clientId: string = body.client_id;
  const markup = Number(body.markup) || 0;
  if (!ids.length || !clientId) return c.json({ error: 'number_ids and client_id required' }, 400);

  try {
    // Confirm the client belongs to this agent (or caller is admin)
    const cli = await sql`SELECT id, agent_id FROM clients WHERE id = ${clientId} LIMIT 1`;
    if (!cli.length) return c.json({ error: 'Client not found' }, 404);
    if (!me.is_admin && cli[0].agent_id !== me.id) {
      return c.json({ error: 'This client is not under your account' }, 403);
    }

    let assigned = 0;
    for (const nid of ids) {
      const rows = await sql`
        SELECT id, assigned_agent, agent_rate, panel_payout
        FROM number_pool WHERE id = ${nid} LIMIT 1
      `;
      if (!rows.length) continue;
      const n = rows[0];
      // Caller must own the number at agent tier (admin override OK)
      if (!me.is_admin && n.assigned_agent !== me.id) continue;

      const base = Number(n.agent_rate ?? n.panel_payout) || 0;
      const finalRate = base + markup;

      // Release prior client allocation if any
      await sql`
        UPDATE number_allocations
        SET status = 'released', released_at = now()
        WHERE number_pool_id = ${nid} AND tier = 'client' AND status = 'active'
      `;

      await sql`
        INSERT INTO number_allocations
          (number_pool_id, tier, from_user_id, to_client_id, base_rate, markup, final_rate)
        VALUES
          (${nid}, 'client', ${me.id}, ${clientId}, ${base}, ${markup}, ${finalRate})
      `;

      await sql`
        UPDATE number_pool
        SET assigned_client = ${clientId},
            client_rate = ${finalRate},
            updated_at = now()
        WHERE id = ${nid}
      `;
      assigned++;
    }
    return c.json({ success: true, assigned, client_id: clientId, markup });
  } catch (err: any) {
    console.error('[assign-client]', err);
    return c.json({ error: err.message || 'assign-client failed' }, 500);
  }
});

// POST /api/allocations/release   body: { number_ids: string[], tier: 'agent'|'client' }
app.post('/api/allocations/release', async (c) => {
  const me = caller(c);
  const body = await c.req.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body.number_ids) ? body.number_ids : [];
  const tier: string = body.tier;
  if (!ids.length || !['agent', 'client'].includes(tier)) {
    return c.json({ error: 'number_ids[] and tier required' }, 400);
  }
  if (tier === 'agent' && !me.is_admin) return c.json({ error: 'Admin only' }, 403);

  try {
    for (const nid of ids) {
      await sql`
        UPDATE number_allocations
        SET status = 'released', released_at = now()
        WHERE number_pool_id = ${nid} AND tier = ${tier} AND status = 'active'
      `;
      if (tier === 'agent') {
        await sql`UPDATE number_pool SET assigned_agent = NULL, assigned_client = NULL, agent_rate = NULL, client_rate = NULL, updated_at = now() WHERE id = ${nid}`;
        await sql`UPDATE number_allocations SET status='released', released_at=now() WHERE number_pool_id=${nid} AND tier='client' AND status='active'`;
      } else {
        await sql`UPDATE number_pool SET assigned_client = NULL, client_rate = NULL, updated_at = now() WHERE id = ${nid}`;
      }
    }
    return c.json({ success: true, released: ids.length, tier });
  } catch (err: any) {
    console.error('[release]', err);
    return c.json({ error: err.message || 'release failed' }, 500);
  }
});

// GET /api/allocations/agents  → list of agent profiles for admin assign dialog
app.get('/api/allocations/agents', async (c) => {
  try {
    const rows = await sql`
      SELECT id, username, full_name, balance
      FROM profiles
      WHERE COALESCE(is_admin,false)=false AND COALESCE(role,'agent') IN ('agent','user')
      ORDER BY username
    `;
    return c.json(rows);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// GET /api/allocations/my-clients  → clients owned by current agent
app.get('/api/allocations/my-clients', async (c) => {
  const me = caller(c);
  try {
    const rows = me.is_admin
      ? await sql`SELECT id, username, email, agent_id FROM clients ORDER BY username`
      : await sql`SELECT id, username, email, agent_id FROM clients WHERE agent_id = ${me.id} ORDER BY username`;
    return c.json(rows);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

const port = 3005;
console.log(`🚀 API Server starting on port ${port}...`);

serve({ fetch: app.fetch, port });
