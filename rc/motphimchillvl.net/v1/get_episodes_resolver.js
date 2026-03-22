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
 * into nested format per contract: [{ episode_index, name, servers: [{server, id}] }]
 * Rules: sort ascending, deduplicate by episode number, skip non-numbered (Special/OVA).
 */
function groupEpisodes(flatItems) {
    const map = new Map();
    for (const item of flatItems) {
        const num = parseEpisodeNumber(item.name);
        if (num === null) continue; // skip Special/OVA
        if (!map.has(num)) map.set(num, { name: item.name, servers: [] });
        map.get(num).servers.push({ server: item.server, id: item.id });
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
        if (!watchMatch) throw new Error('Watch URL not found (btn-stream-link)');
        const watchPath = watchMatch[1];
        const watchUrl = watchPath.startsWith('http') ? watchPath : MOTCHILL_BASE + watchPath;
        console.log('[JS-MC] Watch URL: ' + watchUrl);

        // Fetch watch page — contains full episode list
        const watchRes = await fetch(watchUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        if (!watchRes.ok) throw new Error('Watch page fetch failed: ' + watchRes.status);
        const watchHtml = await watchRes.text();

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
                episodes.push({ id: fullUrl, name: name, server: serverName });
            }
        }

        if (episodes.length === 0) {
            // Fallback: parse all <a href="/xem-phim/..."> links
            const fallbackRe = /<a[^>]+href="(\/xem-phim\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
            let m;
            while ((m = fallbackRe.exec(watchHtml)) !== null) {
                const name = m[2].replace(/<[^>]+>/g, '').trim();
                if (name) episodes.push({ id: MOTCHILL_BASE + m[1], name: name, server: 'Vietsub' });
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
