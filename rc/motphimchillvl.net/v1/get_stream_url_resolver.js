/**
 * Motchill Resolver v1.0
 * Architecture: JS-Logic-Shell Standard
 *
 * App gọi:
 *   getEpisodes(filmUrl)   — lấy danh sách tập từ trang phim
 *   getStreamUrl(episodeUrl) — lấy M3U8 / embed link từ trang xem phim
 *
 * Toàn bộ logic fetch + parse nằm trong JS này.
 * Chạy trong WebView context (baseUrl = https://motphimchillvl.net).
 */

async function getStreamUrl(episodeUrl) {
    const MOTCHILL_BASE = 'https://motphimchillvl.net';
    try {
        // Stream links are embedded directly in the episode page (/phim/slug/tap-N-ID)
        // No redirect needed — fetch the URL as-is
        console.log('[JS-MC] Fetching watch page: ' + episodeUrl);
        const res = await fetch(episodeUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        if (!res.ok) throw new Error('Watch page fetch failed: ' + res.status);
        const html = await res.text();
        const re1 = /data-type="([^"]+)"[^>]*data-link="([^"]+)"/gi;
        const re2 = /data-link="([^"]+)"[^>]*data-type="([^"]+)"/gi;
        let m3u8Url = null;
        let embedUrl = null;
        let m;

        while ((m = re1.exec(html)) !== null) {
            const type = m[1].toLowerCase();
            const link = m[2];
            if (type === 'm3u8' && !m3u8Url) m3u8Url = link;
            if (type === 'embed' && !embedUrl) embedUrl = link;
        }
        while ((m = re2.exec(html)) !== null) {
            const link = m[1];
            const type = m[2].toLowerCase();
            if (type === 'm3u8' && !m3u8Url) m3u8Url = link;
            if (type === 'embed' && !embedUrl) embedUrl = link;
        }

        if (m3u8Url) {
            console.log('[JS-MC] STREAM RESOLVED (m3u8): ' + m3u8Url);
            return JSON.stringify({ type: 'm3u8', url: m3u8Url });
        }
        if (embedUrl) {
            console.log('[JS-MC] STREAM RESOLVED (embed): ' + embedUrl);
            return JSON.stringify({ type: 'embed', url: embedUrl });
        }

        throw new Error('No stream link found in episode page');
    } catch (e) {
        console.log('[JS-MC] getStreamUrl error: ' + e.message);
        return JSON.stringify({ error: e.message });
    }
}
