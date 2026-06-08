function decodeHtml(text) {
    return String(text || '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&quot;/gi, '"')
        .replace(/&#039;|&apos;/gi, "'")
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>');
}

function cleanCell(value) {
    return decodeHtml(value)
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function extractPhoneTokens(value) {
    const text = cleanCell(value);
    const phones = [];
    const matches = text.match(/\+?\d[\d\s().-]{6,}\d/g) || [];
    for (const match of matches) {
        const digits = match.replace(/\D/g, '');
        if (digits.length >= 8 && digits.length <= 15 && !/^(\d)\1+$/.test(digits)) {
            phones.push(digits);
        }
    }
    return phones;
}

function addPhones(set, value) {
    for (const phone of extractPhoneTokens(value)) set.add(phone);
}

function extractNumbersFromHtml(html) {
    const found = new Set();
    const rows = String(html || '').match(/<tr[\s\S]*?<\/tr>/gi) || [];

    for (const row of rows) {
        const cells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(m => m[1]);
        if (cells.length >= 4) addPhones(found, cells[3]); // MyNumbers table: checkbox, range, prefix, number
        for (const cell of cells) addPhones(found, cell);
    }

    if (found.size === 0) addPhones(found, html);
    return found;
}

function extractNumbersFromJsonPayload(payload) {
    const found = new Set();

    function parseRow(row) {
        if (Array.isArray(row)) {
            if (row.length >= 4) addPhones(found, row[3]);
            return;
        }
        if (!row || typeof row !== 'object') return;
        for (const [key, value] of Object.entries(row)) {
            if (/number|phone|mobile|msisdn|did/i.test(key)) addPhones(found, value);
        }
    }

    function walk(value) {
        if (!value) return;
        if (Array.isArray(value)) {
            value.forEach(parseRow);
            if (found.size === 0) value.forEach(walk);
            return;
        }
        if (typeof value === 'object') {
            for (const [key, child] of Object.entries(value)) {
                if (/^(data|aaData|rows|result|results|list)$/i.test(key) && Array.isArray(child)) {
                    child.forEach(parseRow);
                } else if (/number|phone|mobile|msisdn|did/i.test(key)) {
                    addPhones(found, child);
                } else if (found.size === 0) {
                    walk(child);
                }
            }
        }
    }

    try {
        walk(typeof payload === 'string' ? JSON.parse(payload) : payload);
    } catch (_) {
        return extractNumbersFromHtml(payload);
    }

    return found;
}

function extractAjaxCandidates(html, pageUrl) {
    const candidates = new Set([pageUrl]);
    const patterns = [
        /ajax\s*:\s*["']([^"']+)["']/gi,
        /url\s*:\s*["']([^"']+)["']/gi,
        /["']([^"']*(?:MyNumbers|Number|Numbers|DID|Sim)[^"']*)["']/gi,
    ];

    for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(String(html || ''))) !== null) {
            const raw = decodeHtml(match[1] || '').trim();
            if (!raw || raw.startsWith('#') || /^javascript:/i.test(raw) || /\.(css|js|png|jpg|jpeg|gif|svg)$/i.test(raw)) continue;
            try {
                const resolved = new URL(raw, pageUrl).toString();
                if (/number|did|sim|mynumbers/i.test(resolved) || resolved === pageUrl) candidates.add(resolved);
            } catch (_) { /* ignore malformed script fragments */ }
        }
    }

    return [...candidates].slice(0, 12);
}

function withDataTableParams(candidate) {
    const next = new URL(candidate);
    if (!next.searchParams.has('draw')) next.searchParams.set('draw', '1');
    if (!next.searchParams.has('start')) next.searchParams.set('start', '0');
    if (!next.searchParams.has('length')) next.searchParams.set('length', '500');
    next.searchParams.set('search[value]', '');
    next.searchParams.set('search[regex]', 'false');
    return next.toString();
}

async function scrapePanelNumbers({ client, url, referer }) {
    const page = await client.get(url, {
        validateStatus: () => true,
        headers: { 'Referer': referer, 'X-Requested-With': 'XMLHttpRequest' },
    });
    const body = typeof page.data === 'string' ? page.data : JSON.stringify(page.data || '');
    const direct = extractNumbersFromHtml(body);
    if (page.status !== 200 || direct.size > 0) {
        return { status: page.status, bodyLength: body.length, numbers: direct, sourceUrl: url, attempts: [] };
    }

    const attempts = [];
    const headers = {
        'Referer': url,
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
    };
    const form = new URLSearchParams({ draw: '1', start: '0', length: '500', 'search[value]': '', 'search[regex]': 'false' });

    for (const candidate of extractAjaxCandidates(body, url)) {
        for (const method of ['get', 'post']) {
            const requestUrl = method === 'get' ? withDataTableParams(candidate) : candidate;
            const res = method === 'get'
                ? await client.get(requestUrl, { validateStatus: () => true, headers })
                : await client.post(requestUrl, form, { validateStatus: () => true, headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' } });
            const payload = typeof res.data === 'string' ? res.data : JSON.stringify(res.data || '');
            const numbers = extractNumbersFromJsonPayload(payload);
            attempts.push(`${method.toUpperCase()} ${candidate} -> ${res.status}/${payload.length}/${numbers.size}`);
            if (res.status === 200 && numbers.size > 0) {
                return { status: 200, bodyLength: payload.length, numbers, sourceUrl: candidate, attempts };
            }
        }
    }

    return { status: 200, bodyLength: body.length, numbers: new Set(), sourceUrl: url, attempts };
}

module.exports = { scrapePanelNumbers };