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

/**
 * Groups a flat episode array (with duplicate episode numbers across servers)
 * into nested format per contract: [{ episode_index, name, servers: [{server, url}] }]
 * Rules: sort ascending, deduplicate by episode number, skip non-numbered (Special/OVA).
 */
function groupEpisodes(flatItems) {
    const map = new Map();
    for (const item of flatItems) {
        const num = parseEpisodeNumber(item.name);
        // Keep "Tập Full" / non-numbered as key -1 (single film)
        const key = num !== null ? num : -1;
        if (!map.has(key)) map.set(key, { name: item.name, servers: [] });
        map.get(key).servers.push({ server: item.server, url: item.url });
    }
    return Array.from(map.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([, ep], idx) => ({ episode_index: idx, name: ep.name, servers: ep.servers }));
}

function parseEpisodeNumber(name) {
    const m = name.match(/(\d+)/);
    return m ? parseInt(m[1], 10) : null;
}

async function getEpisodes(filmUrl) {
    const MOTCHILL_BASE = 'https://motphimchillvl.net';
    try {
        console.log('[JS-MC] Fetching film page: ' + filmUrl);
        const filmRes = await fetch(filmUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        if (!filmRes.ok) throw new Error('Film page fetch failed: ' + filmRes.status);
        const filmHtml = await filmRes.text();

        // Parse watch URL from <a class="btn-stream-link" href="...">
        const watchMatch = filmHtml.match(/class="[^"]*btn-stream-link[^"]*"\s+href="([^"]+)"/);
        let watchHtml;

        if (watchMatch) {
            const watchPath = watchMatch[1];
            const watchUrl = watchPath.startsWith('http') ? watchPath : MOTCHILL_BASE + watchPath;
            console.log('[JS-MC] Watch URL: ' + watchUrl);

            // Fetch watch page — contains full episode list
            const watchRes = await fetch(watchUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
            });
            if (!watchRes.ok) throw new Error('Watch page fetch failed: ' + watchRes.status);
            watchHtml = await watchRes.text();
        } else {
            // Fallback: film page itself may contain #box-player with data-link (single film / tap-full)
            console.log('[JS-MC] btn-stream-link not found — using film page as watch page');
            watchHtml = filmHtml;
        }

        // Parse episodes from div.episodes > a
        // Each server block: <div class="server-episode-block">ServerName</div><div class="episodes"><a href="...">Tập N</a>...
        const episodes = [];
        const serverBlockRe = /<div[^>]+class="[^"]*server-episode-block[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<div[^>]+class="[^"]*episodes[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
        let serverMatch;
        while ((serverMatch = serverBlockRe.exec(watchHtml)) !== null) {
            const serverName = serverMatch[1].replace(/<[^>]+>/g, '').trim().replace(/:$/, '');
            const episodesBlock = serverMatch[2];
            const epRe = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
            let epMatch;
            while ((epMatch = epRe.exec(episodesBlock)) !== null) {
                const href = epMatch[1];
                const name = epMatch[2].replace(/<[^>]+>/g, '').trim();
                const fullUrl = href.startsWith('http') ? href : MOTCHILL_BASE + href;
                episodes.push({ url: fullUrl, name: name, server: serverName });
            }
        }

        if (episodes.length === 0) {
            // Fallback 1: parse all <a href="/xem-phim/..."> links
            const fallbackRe = /<a[^>]+href="(\/xem-phim\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
            let m;
            while ((m = fallbackRe.exec(watchHtml)) !== null) {
                const name = m[2].replace(/<[^>]+>/g, '').trim();
                if (name) episodes.push({ url: MOTCHILL_BASE + m[1], name: name, server: 'Vietsub' });
            }
        }

        if (episodes.length === 0) {
            // Fallback 2: single film / tap-full — parse data-link from #box-player <li> tags
            // HTML: <li data-link="https://...m3u8" data-type="m3u8" ...>Server Name</li>
            const liRe = /<li[^>]*data-link="([^"]+)"[\s\S]*?data-type="([^"]+)"[^>]*>([\s\S]*?)<\/li>/gi;
            let m;
            while ((m = liRe.exec(watchHtml)) !== null) {
                const link = m[1];
                const type = m[2].toLowerCase();
                const serverName = m[3].replace(/<[^>]+>/g, '').trim() || 'Server';
                if (type === 'm3u8' || type === 'embed') {
                    // Single film: treat as one episode (Tập Full) with multiple servers
                    episodes.push({ url: link, name: 'Tập Full', server: serverName });
                }
            }
            if (episodes.length > 0) {
                console.log('[JS-MC] Fallback 2 (box-player li): ' + episodes.length + ' servers found');
                // Return as single episode with all servers
                const servers = episodes.map(e => ({ server: e.server, url: e.url }));
                return JSON.stringify([{ episode_index: 0, name: 'Tập Full', servers }]);
            }
        }

        console.log('[JS-MC] Episodes found (flat): ' + episodes.length);
        const nested = groupEpisodes(episodes);
        console.log('[JS-MC] Episodes nested: ' + nested.length);
        return JSON.stringify(nested);
    } catch (e) {
        console.log('[JS-MC] getEpisodes error: ' + e.message);
        return JSON.stringify({ error: e.message });
    }
}
