/**
 * Motchill Resolver v1.0
 * Architecture: JS-Logic-Shell Standard
 *
 * App gọi:
 *   getEpisodes(filmUrl)   — lấy danh sách tập từ trang phim
 *   getStreamUrl(episodeUrl) — lấy M3U8 / embed link từ trang xem phim
 *
 * Toàn bộ logic fetch + parse nằm trong JS này.
 * Chạy trong WebView context (baseUrl = https://motphimchillvl.org).
 */

async function getStreamUrl(episodeUrl) {
    const MOTCHILL_BASE = 'https://motphimchillvl.org';
    try {
        // Fast path: if the URL is already a direct m3u8 stream, return immediately
        if (episodeUrl.includes('.m3u8')) {
            console.log('[JS-MC] Direct m3u8 URL detected, skipping fetch: ' + episodeUrl);
            return JSON.stringify({ type: 'm3u8', url: episodeUrl });
        }

        // Stream links are embedded directly in the episode page (/phim/slug/tap-N-ID)
        // No redirect needed — fetch the URL as-is
        console.log('[JS-MC] Fetching watch page: ' + episodeUrl);
        const res = await fetch(episodeUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        if (!res.ok) throw new Error('Watch page fetch failed: ' + res.status);
        const html = await res.text();
        let m3u8Url = null;
        let embedUrl = null;

        // Strategy 1: parse any tag that has BOTH data-link and data-type attributes
        // Use [\s\S]*? to handle multi-line tags and any attribute order.
        // Covers: <li data-link="..." data-type="m3u8" ...> and <div data-type="..." data-link="...">
        const tagRe = /<[a-z][^>]*?data-link="([^"]+)"[\s\S]*?data-type="([^"]+)"[^>]*>/gi;
        const tagRe2 = /<[a-z][^>]*?data-type="([^"]+)"[\s\S]*?data-link="([^"]+)"[^>]*>/gi;
        let m;

        while ((m = tagRe.exec(html)) !== null) {
            const link = m[1];
            const type = m[2].toLowerCase();
            if (type === 'm3u8' && !m3u8Url) m3u8Url = link;
            if (type === 'embed' && !embedUrl) embedUrl = link;
        }
        while ((m = tagRe2.exec(html)) !== null) {
            const type = m[1].toLowerCase();
            const link = m[2];
            if (type === 'm3u8' && !m3u8Url) m3u8Url = link;
            if (type === 'embed' && !embedUrl) embedUrl = link;
        }

        // Strategy 2: fallback — scan for data-link values and infer type from URL pattern
        if (!m3u8Url && !embedUrl) {
            const linkRe = /data-link="([^"]+)"/gi;
            while ((m = linkRe.exec(html)) !== null) {
                const link = m[1];
                if (!m3u8Url && link.includes('.m3u8')) m3u8Url = link;
                else if (!embedUrl && (link.startsWith('http') || link.startsWith('//'))) embedUrl = link;
            }
            if (m3u8Url || embedUrl) {
                console.log('[JS-MC] Strategy 2 fallback used — data-type attr missing');
            }
        }

        if (!m3u8Url && embedUrl) {
            console.log('[JS-MC] m3u8 missing, attempting to follow embed: ' + embedUrl);
            const resolvedM3u8 = await _followEmbed(embedUrl);
            if (resolvedM3u8) m3u8Url = resolvedM3u8;
        }

        const headers = {
            'Referer': MOTCHILL_BASE + '/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        };

        if (m3u8Url) {
            console.log('[JS-MC] STREAM RESOLVED (m3u8): ' + m3u8Url);
            return JSON.stringify({ type: 'm3u8', url: m3u8Url, headers });
        }
        if (embedUrl) {
            console.log('[JS-MC] STREAM RESOLVED (embed): ' + embedUrl);
            return JSON.stringify({ type: 'embed', url: embedUrl, headers });
        }

        throw new Error('No stream link found in episode page');
    } catch (e) {
        console.log('[JS-MC] getStreamUrl error: ' + e.message);
        return JSON.stringify({ error: e.message });
    }
}

/**
 * Deep crawl into popular embed providers to find the direct .m3u8 link
 */
async function _followEmbed(url) {
    try {
        console.log('[JS-MC] Unpacking embed: ' + url);
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36' }
        });
        const html = await res.text();

        // Pattern 1: jwplayer file: "..." or sources: [{file: "..."}]
        // Pattern 2: Typical file: '...' logic in stream providers
        const m3u8Re = /file\s*:\s*["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i;
        const match = html.match(m3u8Re);
        if (match) {
            console.log('[JS-MC] Found m3u8 inside embed');
            return match[1];
        }

        // Pattern 3: some providers use base64 or obfuscation, which we might not hit with simple regex
        // but often they expose a direct link in a <script> or as a 'src'
        return null;
    } catch (e) {
        console.log('[JS-MC] _followEmbed error: ' + e.message);
        return null;
    }
}
