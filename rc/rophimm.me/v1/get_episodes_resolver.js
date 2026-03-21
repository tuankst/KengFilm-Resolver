/**
 * Rophimm Resolver v2.1
 * Architecture: JS-Logic-Shell Standard
 * 
 * App chỉ gọi: getEpisodes(url)
 * Toàn bộ logic fetch + parse nằm trong JS này.
 * Chạy trong WebView context (có fetch, có CORS bypass qua RSC header).
 */

/**
 * Main entry point.
 * @param {string} url - URL trang phim, e.g. "https://rophimm.me/xem-phim/truc-ngoc"
 * @returns {Promise<string>} JSON string: [{id, name, server}] hoặc {error}
 */
async function getEpisodes(url) {
    try {
        // Step 1: Fetch RSC payload to extract movieId and movieSlug
        const rscUrl = url + (url.includes('?') ? '&' : '?') + '_rsc=1';
        console.log('[JS] Fetching RSC: ' + rscUrl);

        const rscRes = await fetch(rscUrl, {
            headers: {
                'RSC': '1',
                'Referer': url,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        if (!rscRes.ok) throw new Error('RSC fetch failed: ' + rscRes.status);
        const payload = await rscRes.text();
        console.log('[JS] RSC payload length: ' + payload.length);

        // Extract movieId: "movieId":11522
        const movieIdMatch = payload.match(/"movieId":(\d+)/);
        if (!movieIdMatch) throw new Error('movieId not found in RSC payload');
        const movieId = movieIdMatch[1];
        console.log('[JS] movieId: ' + movieId);

        // Extract movieSlug: second "slug" occurrence is the movie slug
        const slugMatches = [...payload.matchAll(/"slug":"([^"]+)"/g)];
        let movieSlug = 'phim';
        if (slugMatches.length >= 2) {
            movieSlug = slugMatches[1][1];
        } else if (slugMatches.length === 1) {
            movieSlug = slugMatches[0][1].replace(/-tap-\d+$/, '');
        }
        console.log('[JS] movieSlug: ' + movieSlug);

        // Step 2: Call direct episodes API
        const apiUrl = 'https://rophimm.me/baseapi/api/v1/episodes/by-idMovie/' + movieId;
        console.log('[JS] Fetching episodes API: ' + apiUrl);

        const apiRes = await fetch(apiUrl, {
            headers: {
                'Referer': url,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        if (!apiRes.ok) throw new Error('Episodes API failed: ' + apiRes.status);
        const records = await apiRes.json();
        console.log('[JS] API records: ' + records.length);

        // Step 3: Deduplicate by slug, build episode list
        const seen = new Set();
        const episodes = [];
        for (const r of records) {
            if (!r.slug || seen.has(r.slug)) continue;
            seen.add(r.slug);
            episodes.push({
                id: 'https://rophimm.me/xem-phim/' + movieSlug + '-' + r.slug,
                name: 'Tập ' + r.name,
                server: r.server || 'Rophimm'
            });
        }

        // Sort ascending by episode number
        episodes.sort((a, b) => {
            const na = parseInt((a.id.match(/tap-(\d+)/) || [0, 0])[1]) || 0;
            const nb = parseInt((b.id.match(/tap-(\d+)/) || [0, 0])[1]) || 0;
            return na - nb;
        });

        console.log('[JS] Episodes found: ' + episodes.length);
        return JSON.stringify(episodes);

    } catch (e) {
        console.log('[JS] Error: ' + e.message);
        return JSON.stringify({ error: e.message });
    }
}
