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
      const keys = Object.keys(query).filter(k => !['id', 'limit', 'order', 'head', 'count', 'select', 'or'].includes(k));
      const limit = Math.min(query.limit ? parseInt(query.limit) : 5000, 10000);
      
      let baseQuery = sql`SELECT * FROM ${sql(table)}`;
      
      if (query.select && query.select !== '*') {
         // Security note: this is a simple proxy, ideally you'd validate select columns
         baseQuery = sql`SELECT ${sql(query.select.split(','))} FROM ${sql(table)}`;
      }

      let hasWhere = false;
      const addWhere = () => {
        baseQuery = hasWhere ? sql`${baseQuery} AND ` : sql`${baseQuery} WHERE `;
        hasWhere = true;
      };

      keys.forEach((key) => {
        addWhere();
        if (String(query[key]).startsWith('%') || String(query[key]).endsWith('%')) {
           baseQuery = sql`${baseQuery} ${sql(key)} ILIKE ${query[key]}`;
        } else {
           baseQuery = sql`${baseQuery} ${sql(key)} = ${query[key]}`;
        }
      });

      if (query.or) {
        const parts = String(query.or).split(',').map(p => p.trim()).filter(Boolean);
        const clauses = parts.map((p) => {
          const [col, op, ...rest] = p.split('.');
          return { col, op, val: rest.join('.') };
        }).filter((p) => p.col && p.op === 'eq' && p.val);
        if (clauses.length > 0) {
          addWhere();
          baseQuery = sql`${baseQuery} (`;
          clauses.forEach((p, index) => {
            baseQuery = sql`${baseQuery} ${sql(p.col)} = ${p.val} ${index < clauses.length - 1 ? sql`OR` : sql``}`;
          });
          baseQuery = sql`${baseQuery})`;
        }
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
// Fast report endpoints: server-side pagination + aggregation for heavy pages
// =========================================================================

function pageParams(c: any) {
  const limit = Math.min(Math.max(parseInt(c.req.query('limit') || '25', 10) || 25, 1), 500);
  const offset = Math.max(parseInt(c.req.query('offset') || '0', 10) || 0, 0);
  return { limit, offset };
}

app.get('/api/reports/cdr', async (c) => {
  const { limit, offset } = pageParams(c);
  const q = c.req.query();
  const dateOnly = (value: string | undefined) => String(value || '').match(/^\d{4}-\d{2}-\d{2}/)?.[0] || null;
  const today = new Date().toISOString().slice(0, 10);
  const start = `${dateOnly(q.start) || today} 00:00:00`;
  const end = `${dateOnly(q.end) || today} 23:59:59`;

  try {
    const rows = await sql`
      SELECT c.id, c.received_at, c.number, c.prefix, c.message, c.payout, c.status,
             c.client_id, c.agent_id, cl.name AS client_name
      FROM sms_cdr c
      LEFT JOIN clients cl ON cl.id = c.client_id
      WHERE c.received_at >= ${start}
        AND c.received_at <= ${end}
        AND (${q.prefix || ''} = '' OR c.prefix ILIKE ${'%' + (q.prefix || '') + '%'})
        AND (${q.number || ''} = '' OR c.number ILIKE ${'%' + (q.number || '') + '%'})
        AND (${q.client_id || ''} = '' OR c.client_id::text = ${q.client_id || ''})
        AND (${q.agent_id || ''} = '' OR c.agent_id::text = ${q.agent_id || ''})
      ORDER BY c.received_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    const [summary] = await sql`
      SELECT COUNT(*)::int AS total, COALESCE(SUM(payout), 0)::float AS payout_total
      FROM sms_cdr c
      WHERE c.received_at >= ${start}
        AND c.received_at <= ${end}
        AND (${q.prefix || ''} = '' OR c.prefix ILIKE ${'%' + (q.prefix || '') + '%'})
        AND (${q.number || ''} = '' OR c.number ILIKE ${'%' + (q.number || '') + '%'})
        AND (${q.client_id || ''} = '' OR c.client_id::text = ${q.client_id || ''})
        AND (${q.agent_id || ''} = '' OR c.agent_id::text = ${q.agent_id || ''})
    `;
    return c.json({ rows, total: summary?.total || 0, payout_total: summary?.payout_total || 0 });
  } catch (err: any) {
    console.error('[reports/cdr]', err);
    return c.json({ error: err.message || 'CDR report failed' }, 500);
  }
});

app.get('/api/reports/sms-summary', async (c) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const since = `${today} 00:00:00`;
    const [summary] = await sql`
      SELECT COUNT(*)::int AS rows,
             COUNT(*) FILTER (WHERE outcome = 'billed')::int AS billed,
             COUNT(*) FILTER (WHERE outcome IN ('duplicate','dup'))::int AS duplicates,
             MAX(created_at) AS last_scrape
      FROM otp_audit_log
      WHERE created_at >= ${since}
    `;
    const latest = await sql`
      SELECT o.created_at AS received_at,
             COALESCE(np.prefix, substring(regexp_replace(COALESCE(o.phone_number, ''), '[^0-9]', '', 'g') from 1 for 3)) AS prefix,
             o.phone_number AS number,
             o.sms_text AS message,
             COALESCE(NULLIF(o.amount_earned, 0), np.client_rate, np.agent_rate, np.panel_payout, 0) AS payout,
             cl.name AS client_name
      FROM otp_audit_log o
      LEFT JOIN LATERAL (
        SELECT prefix, assigned_client, client_rate, agent_rate, panel_payout
        FROM number_pool
        WHERE regexp_replace(COALESCE(number, ''), '[^0-9]', '', 'g') LIKE '%' || right(regexp_replace(COALESCE(o.phone_number, ''), '[^0-9]', '', 'g'), 9)
        ORDER BY updated_at DESC NULLS LAST, created_at DESC
        LIMIT 1
      ) np ON true
      LEFT JOIN clients cl ON cl.id = np.assigned_client
      WHERE o.created_at >= ${since}
      ORDER BY o.created_at DESC
      LIMIT 200
    `;
    return c.json({ summary: summary || { rows: 0, billed: 0, duplicates: 0, last_scrape: null }, latest });
  } catch (err: any) {
    console.error('[reports/sms-summary]', err);
    return c.json({ error: err.message || 'SMS summary failed' }, 500);
  }
});

app.get('/api/reports/otps', async (c) => {
  const me = caller(c);
  const { limit, offset } = pageParams(c);
  const search = String(c.req.query('search') || '').trim();
  const like = `%${search}%`;
  const isClient = me.role === 'client';
  const isAgent = !me.is_admin && (me.role === 'agent' || me.role === 'admin');

  try {
    const rows = await sql`
      SELECT id,
             COALESCE(phone_number, number) AS phone_number,
             cli,
             otp_code,
             message AS sms_text,
             CASE WHEN status = 'delivered' THEN 'billed' ELSE COALESCE(status, 'unknown') END AS outcome,
             source,
             COALESCE(received_at, created_at) AS created_at
      FROM sms_cdr
      WHERE (${isClient} = false OR client_id::text = ${me.id || ''})
        AND (${isAgent} = false OR agent_id::text = ${me.id || ''})
        AND (${search} = '' OR COALESCE(phone_number, number, '') ILIKE ${like}
          OR COALESCE(cli, '') ILIKE ${like}
          OR COALESCE(otp_code, '') ILIKE ${like}
          OR COALESCE(message, '') ILIKE ${like})
      ORDER BY COALESCE(received_at, created_at) DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    const [summary] = await sql`
      SELECT COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE status IN ('delivered','billed'))::int AS billed,
             COUNT(*) FILTER (WHERE status IN ('duplicate','dup'))::int AS duplicates,
             MAX(COALESCE(received_at, created_at)) AS last
      FROM sms_cdr
      WHERE (${isClient} = false OR client_id::text = ${me.id || ''})
        AND (${isAgent} = false OR agent_id::text = ${me.id || ''})
        AND (${search} = '' OR COALESCE(phone_number, number, '') ILIKE ${like}
          OR COALESCE(cli, '') ILIKE ${like}
          OR COALESCE(otp_code, '') ILIKE ${like}
          OR COALESCE(message, '') ILIKE ${like})
    `;
    return c.json({ rows, total: summary?.total || 0, summary: summary || { total: 0, billed: 0, duplicates: 0, last: null } });
  } catch (err: any) {
    console.error('[reports/otps]', err);
    return c.json({ error: err.message || 'OTP report failed' }, 500);
  }
});

app.get('/api/reports/stats/:group', async (c) => {
  const group = c.req.param('group');
  const limit = Math.min(parseInt(c.req.query('limit') || '200', 10) || 200, 500);
  try {
    if (group === 'client') {
      const rows = await sql`
        SELECT COALESCE(cl.name, cl.username, 'Unassigned') AS label, COUNT(*)::int AS sms,
               COALESCE(SUM(c.payout), 0)::float AS payout
        FROM sms_cdr c LEFT JOIN clients cl ON cl.id = c.client_id
        GROUP BY label ORDER BY sms DESC LIMIT ${limit}
      `;
      return c.json(rows);
    }
    if (group === 'range') {
      const rows = await sql`
        SELECT COALESCE(prefix, 'Unknown') AS label, COUNT(*)::int AS sms,
               COALESCE(SUM(payout), 0)::float AS payout
        FROM sms_cdr GROUP BY label ORDER BY sms DESC LIMIT ${limit}
      `;
      return c.json(rows);
    }
    if (group === 'number') {
      const rows = await sql`
        SELECT COALESCE(number, 'Unknown') AS label, COUNT(*)::int AS sms,
               COALESCE(SUM(payout), 0)::float AS payout
        FROM sms_cdr GROUP BY label ORDER BY sms DESC LIMIT ${limit}
      `;
      return c.json(rows);
    }
    return c.json({ error: 'Invalid stats group' }, 400);
  } catch (err: any) {
    console.error('[reports/stats]', err);
    return c.json({ error: err.message || 'Stats report failed' }, 500);
  }
});

app.get('/api/reports/number-ranges', async (c) => {
  try {
    const rows = await sql`
      SELECT DISTINCT COALESCE(NULLIF(range_name, ''), NULLIF(country, ''), NULLIF(prefix, '')) AS name
      FROM number_pool
      WHERE COALESCE(range_name, country, prefix) IS NOT NULL
      ORDER BY name
      LIMIT 5000
    `;
    return c.json({ ranges: rows.map((r: any) => r.name).filter(Boolean) });
  } catch (err: any) {
    return c.json({ error: err.message || 'Ranges failed' }, 500);
  }
});

app.get('/api/reports/numbers', async (c) => {
  const { limit, offset } = pageParams(c);
  const rangeName = c.req.query('range_name') || '';
  const search = String(c.req.query('search') || '').trim();
  const like = `%${search}%`;
  try {
    const rows = await sql`
      SELECT np.*,
             COALESCE(NULLIF(np.range_name, ''), NULLIF(np.country, ''), NULLIF(np.prefix, ''), 'Unknown') AS range_name
      FROM number_pool np
      WHERE (${rangeName} = '' OR COALESCE(np.range_name, np.country, np.prefix, '') = ${rangeName})
        AND (${search} = '' OR COALESCE(np.number, '') ILIKE ${like}
          OR COALESCE(np.country, '') ILIKE ${like}
          OR COALESCE(np.range_name, '') ILIKE ${like}
          OR COALESCE(np.prefix, '') ILIKE ${like})
      ORDER BY np.updated_at DESC NULLS LAST, np.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    const [summary] = await sql`
      SELECT COUNT(*)::int AS total FROM number_pool np
      WHERE (${rangeName} = '' OR COALESCE(np.range_name, np.country, np.prefix, '') = ${rangeName})
        AND (${search} = '' OR COALESCE(np.number, '') ILIKE ${like}
          OR COALESCE(np.country, '') ILIKE ${like}
          OR COALESCE(np.range_name, '') ILIKE ${like}
          OR COALESCE(np.prefix, '') ILIKE ${like})
    `;
    return c.json({ rows, total: summary?.total || 0 });
  } catch (err: any) {
    console.error('[reports/numbers]', err);
    return c.json({ error: err.message || 'Numbers report failed' }, 500);
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
