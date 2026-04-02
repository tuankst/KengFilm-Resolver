// Story 10-13 | RoPhim10 | Get Stream URL Resolver — v2
// Contract: getStreamUrl(episodeUrl) → JSON { type, url, headers } | { error }
//
// Research findings (2026-04-02):
// - No stream API available — all episode stream endpoints require auth
// - Watch page URL: https://rophim10.com.mx/xem-phim/{slug}.{episodeId}
// - m3u8 is embedded in HTML of watch page (via opstream90 CDN)
// - Fallback: https://api.rophim10.com.mx/embed/{episodeId}
//
// Input: episodeUrl is the `url` field from episodes resolver server entry
// e.g. "https://rophim10.com.mx/xem-phim/dap-tan-toi-ac.347776"

async function getStreamUrl(episodeUrl) {
    const SITE_BASE = 'https://rophim10.com.mx';
    const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

    async function fetchHtml(url) {
        const res = await fetch(url, {
            headers: {
                'User-Agent': UA,
                'Referer': SITE_BASE + '/'
            }
        });
        if (!res.ok) throw new Error('Fetch failed ' + res.status + ': ' + url);
        return res.text();
    }

    try {
        console.log('[KENG][RoPhim10] getStreamUrl: ' + episodeUrl);

        // If input is already a direct m3u8 URL, return immediately
        if (episodeUrl.includes('.m3u8')) {
            return JSON.stringify({ type: 'm3u8', url: episodeUrl, headers: {} });
        }

        // Strategy 1: Fetch watch page HTML — m3u8 is embedded directly
        const html = await fetchHtml(episodeUrl);

        const m3u8Re = /https?:\/\/[^\s"'><\\]+\.m3u8[^\s"'><\\]*/gi;
        const m3u8Matches = html.match(m3u8Re);

        if (m3u8Matches && m3u8Matches.length > 0) {
            const streamUrl = m3u8Matches[0].replace(/\\/g, '');
            console.log('[KENG][RoPhim10] Found m3u8 in watch page: ' + streamUrl);
            return JSON.stringify({
                type: 'm3u8',
                url: streamUrl,
                headers: {
                    'Referer': SITE_BASE + '/',
                    'User-Agent': UA
                }
            });
        }

        // Strategy 2: Look for embed iframe (api.rophim10.com.mx/embed/{id})
        const iframeM = html.match(/<iframe[^>]+src="(https?:\/\/api\.rophim10[^"]+)"/i)
                     || html.match(/src="(https?:\/\/api\.rophim10[^"]+embed[^"]+)"/i);
        if (iframeM) {
            const embedUrl = iframeM[1];
            console.log('[KENG][RoPhim10] Following embed: ' + embedUrl);
            const embedHtml = await fetchHtml(embedUrl);
            const embedMatches = embedHtml.match(m3u8Re);
            if (embedMatches && embedMatches.length > 0) {
                const streamUrl = embedMatches[0].replace(/\\/g, '');
                console.log('[KENG][RoPhim10] Found m3u8 in embed: ' + streamUrl);
                return JSON.stringify({
                    type: 'm3u8',
                    url: streamUrl,
                    headers: {
                        'Referer': embedUrl,
                        'User-Agent': UA
                    }
                });
            }
        }

        // Strategy 3: Extract episode ID from URL, fetch embed directly
        // URL format: .../xem-phim/{slug}.{episodeId}
        const epIdM = episodeUrl.match(/\.(\d+)$/);
        if (epIdM) {
            const episodeId = epIdM[1];
            const directEmbedUrl = 'https://api.rophim10.com.mx/embed/' + episodeId;
            console.log('[KENG][RoPhim10] Trying direct embed: ' + directEmbedUrl);
            const embedHtml = await fetchHtml(directEmbedUrl);
            const embedMatches = embedHtml.match(m3u8Re);
            if (embedMatches && embedMatches.length > 0) {
                const streamUrl = embedMatches[0].replace(/\\/g, '');
                console.log('[KENG][RoPhim10] Found m3u8 via direct embed: ' + streamUrl);
                return JSON.stringify({
                    type: 'm3u8',
                    url: streamUrl,
                    headers: {
                        'Referer': directEmbedUrl,
                        'User-Agent': UA
                    }
                });
            }
        }

        throw new Error('No stream URL found in watch page or embed');

    } catch (e) {
        console.log('[KENG][RoPhim10] getStreamUrl error: ' + e.message);
        return JSON.stringify({ error: e.message });
    }
}
