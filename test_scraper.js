function extractCsrf(html) {
    const m = html.match(/<meta[^>]+name=["']csrf-token["'][^>]+content=["']([^"']+)["']/i) ||
              html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']csrf-token["']/i) ||
              html.match(/["']csrf-token["']\s*:\s*["']([^"']+)["']/i);
    return m ? m[1] : null;
}

const html = '<meta name="csrf-token" content="abcdef123456">';
console.log('CSRF:', extractCsrf(html));

const html2 = '<div data-url="/api/data" data-href="/api/other"></div>';
const matches = html2.matchAll(/data-(url|href|ajax-url)=["']([^"']+)["']/gi);
for (const m of matches) {
    console.log('Found candidate:', m[2]);
}
