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

function addStrictPhone(set, value) {
    const digits = String(value || '').replace(/\D/g, '');
    if (digits.length >= 8 && digits.length <= 15 && !/^(\d)\1+$/.test(digits)) set.add(digits);
}

function addPhones(set, value) {
    for (const phone of extractPhoneTokens(value)) set.add(phone);
}

function addPrefixNumber(set, prefixValue, numberValue) {
    const prefix = cleanCell(prefixValue).replace(/\D/g, '');
    const number = cleanCell(numberValue).replace(/\D/g, '');
    if (!prefix || !number) return;
    addStrictPhone(set, number.startsWith(prefix) ? number : `${prefix}${number}`);
}

function addPanelRowPhones(set, row) {
    if (!Array.isArray(row) || row.length < 4) return;
    addPhones(set, row[3]); // MyNumbers table: checkbox, range, prefix, number
    addPrefixNumber(set, row[2], row[3]);
}

function extractNumbersFromHtml(html) {
    const found = new Set();
    const rows = String(html || '').match(/<tr[\s\S]*?<\/tr>/gi) || [];

    for (const row of rows) {
        const cells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(m => m[1]);
        addPanelRowPhones(found, cells);
    }

    return found;
}

function looksLikeHtmlPage(value) {
    return /<!doctype html|<html\b|<head\b|<body\b/i.test(String(value || ''));
}

function looksLikeLoginPage(value) {
    const text = String(value || '');
    if (!looksLikeHtmlPage(text)) return false;
    return /<title[^>]*>[^<]*login|\baccount login\b|\bsign\s*in\b/i.test(text) && !/my numbers|sms dashboard/i.test(text);
}

function extractNumbersFromJsonPayload(payload) {
    const found = new Set();

    function parseRow(row) {
        if (Array.isArray(row)) {
            addPanelRowPhones(found, row);
            return;
        }
        if (!row || typeof row !== 'object') return;
        const prefixEntry = Object.entries(row).find(([key]) => /^prefix$/i.test(key));
        for (const [key, value] of Object.entries(row)) {
            if (/number|phone|mobile|msisdn|did/i.test(key)) {
                addPhones(found, value);
                if (prefixEntry) addPrefixNumber(found, prefixEntry[1], value);
            }
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
        return looksLikeHtmlPage(payload) ? new Set() : extractNumbersFromHtml(payload);
    }

    return found;
}

function isValidUrlPath(raw) {
    if (!raw || raw.length > 200) return false;
    if (/[<>\s"'`{}\\]/.test(raw)) return false;
    if (/&[a-z]+;/i.test(raw)) return false;
    if (raw.startsWith('#') || /^javascript:/i.test(raw)) return false;
    if (/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff2?|ttf)(\?|$)/i.test(raw)) return false;
    return /^(https?:\/\/|\/|[a-zA-Z0-9_\-./?=&%]+$)/.test(raw);
}

function extractAjaxCandidates(html, pageUrl) {
    const candidates = [];
    const seen = new Set();
    const source = String(html || '');
    // Only scan <script>...</script> blocks — body HTML produces garbage matches
    const scripts = source.match(/<script\b[^>]*>[\s\S]*?<\/script>/gi) || [];
    const scope = scripts.length > 0 ? scripts.join('\n') : source;

    function addCandidate(raw, kind) {
        if (!isValidUrlPath(raw)) return;
        try {
            const resolved = new URL(raw.trim(), pageUrl).toString();
            if (seen.has(resolved)) return;
            seen.add(resolved);
            candidates.push({ url: resolved, kind });
        } catch (_) {}
    }

    try {
        const u = new URL(pageUrl);
        const directory = u.pathname.endsWith('/') ? u.pathname.slice(0, -1) : u.pathname.replace(/\/[^/]*$/, '');
        const base = u.origin + directory;
        // MyNumbers uses a separate DataTables endpoint; add it even when the page also mentions aj_ranges.php.
        addCandidate(`${base}/res/data_numbers.php?frange=&fclient=`, 'datatable');
        addCandidate(`${base}/res/data_numbers.php`, 'datatable');
        addCandidate(`${base}/res/aj_numbers.php?frange=&fclient=`, 'datatable');
    } catch (_) {}

    const patterns = [
        [/sAjaxSource\s*:\s*["']([^"']+)["']/gi, 'datatable'],
        /["']ajax["']\s*:\s*["']([^"']+)["']/gi,
        [/ajax\s*:\s*\{\s*url\s*:\s*["']([^"']+)["']/gi, 'datatable'],
        [/fetch\(\s*["']([^"']+)["']/gi, 'generic'],
    ];

    for (const entry of patterns) {
        const pattern = Array.isArray(entry) ? entry[0] : entry;
        const kind = Array.isArray(entry) ? entry[1] : 'datatable';
        let match;
        while ((match = pattern.exec(scope)) !== null) {
            addCandidate(match[1], kind);
        }
    }

    if (candidates.length === 0) {
        try {
            const u = new URL(pageUrl);
            const directory = u.pathname.endsWith('/') ? u.pathname.slice(0, -1) : u.pathname.replace(/\/[^/]*$/, '');
            const base = u.origin + directory;
            const guesses = [`${base}/res/data_numbers.php?frange=&fclient=`, `${pageUrl}/data`];
            for (const g of guesses) addCandidate(g, 'guess');
        } catch (_) {}
    }

    return candidates.slice(0, 10);
}

function extractJsonRecordCount(payload) {
    try {
        const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
        const total = parsed?.iTotalDisplayRecords ?? parsed?.iTotalRecords ?? parsed?.recordsFiltered ?? parsed?.recordsTotal;
        if (total === undefined || total === null || total === '') return null;
        const count = Number(total);
        return Number.isFinite(count) ? count : null;
    } catch (_) {
        return null;
    }
}

function withDataTableParams(candidate) {
    const next = new URL(candidate);
    if (!next.searchParams.has('draw')) next.searchParams.set('draw', '1');
    if (!next.searchParams.has('start')) next.searchParams.set('start', '0');
    if (!next.searchParams.has('length')) next.searchParams.set('length', '500');
    next.searchParams.set('search[value]', '');
    next.searchParams.set('search[regex]', 'false');
    if (!next.searchParams.has('sEcho')) next.searchParams.set('sEcho', '1');
    if (!next.searchParams.has('iDisplayStart')) next.searchParams.set('iDisplayStart', '0');
    if (!next.searchParams.has('iDisplayLength')) next.searchParams.set('iDisplayLength', '500');
    if (!next.searchParams.has('sSearch')) next.searchParams.set('sSearch', '');
    return next.toString();
}

function dataTableForm(candidate) {
    const params = new URL(candidate).searchParams;
    const form = new URLSearchParams(params);
    if (!form.has('draw')) form.set('draw', '1');
    if (!form.has('start')) form.set('start', '0');
    if (!form.has('length')) form.set('length', '500');
    form.set('search[value]', '');
    form.set('search[regex]', 'false');
    if (!form.has('sEcho')) form.set('sEcho', '1');
    if (!form.has('iDisplayStart')) form.set('iDisplayStart', '0');
    if (!form.has('iDisplayLength')) form.set('iDisplayLength', '500');
    if (!form.has('sSearch')) form.set('sSearch', '');
    return form;
}

async function scrapePanelNumbers({ client, url, referer }) {
    const page = await client.get(url, {
        validateStatus: () => true,
        headers: { 'Referer': referer, 'X-Requested-With': 'XMLHttpRequest' },
    });
    const body = typeof page.data === 'string' ? page.data : JSON.stringify(page.data || '');
    if (looksLikeLoginPage(body)) {
        return { status: 401, bodyLength: body.length, numbers: new Set(), sourceUrl: url, attempts: ['page returned login screen'] };
    }
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

    for (const candidate of extractAjaxCandidates(body, url)) {
        for (const method of ['get', 'post']) {
            const requestUrl = method === 'get' ? withDataTableParams(candidate.url) : candidate.url;
            const form = dataTableForm(candidate.url);
            const res = method === 'get'
                ? await client.get(requestUrl, { validateStatus: () => true, headers })
                : await client.post(requestUrl, form, { validateStatus: () => true, headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' } });
            const payload = typeof res.data === 'string' ? res.data : JSON.stringify(res.data || '');
            if (looksLikeLoginPage(payload)) {
                attempts.push(`${method.toUpperCase()} ${candidate.url} -> ${res.status}/${payload.length}/login-page`);
                continue;
            }
            const numbers = extractNumbersFromJsonPayload(payload);
            const totalRows = extractJsonRecordCount(res.data);
            attempts.push(`${method.toUpperCase()} ${candidate.url} -> ${res.status}/${payload.length}/${numbers.size}${totalRows !== null ? `/rows=${totalRows}` : ''}`);
            if (res.status === 200 && numbers.size > 0) {
                return { status: 200, bodyLength: payload.length, numbers, sourceUrl: candidate.url, attempts };
            }
            if (res.status === 200 && totalRows === 0 && candidate.kind === 'datatable') {
                return { status: 200, bodyLength: payload.length, numbers: new Set(), sourceUrl: candidate.url, attempts };
            }
        }
    }

    return { status: 200, bodyLength: body.length, numbers: new Set(), sourceUrl: url, attempts };
}

module.exports = { scrapePanelNumbers };