// Story 5-9 | Motchill | Movie Detail
// Contract: getMovieDetail(url) → JSON object (or { error: "..." })
// Target: https://motphimchillvl.net/phim/{slug}
// Strategy:
//   1. Fetch detail page → metadata (title, poster, dinfo)
//   2. Extract tap-1 (or tap-full) URL from btn-stream-link
//   3. Fetch watch page → full episode list
// Log prefix: [KENG][5-9][Motchill]

async function getMovieDetail(url) {
    const MC_BASE = 'https://motphimchillvl.net';
    const MC_UA   = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

    async function fetchHtml(targetUrl) {
        const res = await fetch(targetUrl, {
            headers: {
                'User-Agent': MC_UA,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'vi-VN,vi;q=0.9',
            }
        });
        if (!res.ok) throw new Error('HTTP ' + res.status + ': ' + targetUrl);
        return res.text();
    }

    function stripTags(html) {
        return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }

    function extractDinfo(html) {
        // Extract all dt/dd pairs from first <dl> block (no class needed)
        const blockM = html.match(/<dl[^>]*>([\s\S]*?)<\/dl>/);
        if (!blockM) return {};
        const block = blockM[1];
        const pairs = [...block.matchAll(/<dt>([^<]+)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/g)];
        const result = {};
        for (const [, dt, dd] of pairs) {
            const key = dt.trim().replace(/:$/, '');
            result[key] = stripTags(dd);
        }
        return result;
    }

    function extractEpisodesFromWatchPage(html) {
        // Watch page has full episode list as anchor tags
        const episodes = [];
        const re = /href="(https?:\/\/motphimchillvl\.net\/phim\/[^/]+\/tap-([^"]+))"[^>]*>\s*([^<]+)\s*<\/a>/g;
        let m;
        while ((m = re.exec(html)) !== null) {
            const epUrl  = m[1];
            const tapSlug = m[2]; // e.g. "1-2882668" or "full-193"
            const name   = m[3].trim();
            if (!name || name.length > 30) continue; // skip nav/breadcrumb links
            // Extract episode id from tap slug: tap-{N}-{id} or tap-full-{id}
            const idM = tapSlug.match(/^(?:full-)?(\d+)(?:-(\d+))?$/);
            const epId = idM ? (idM[2] || idM[1]) : tapSlug;
            episodes.push({ id: epId, name, url: epUrl });
        }
        return episodes;
    }

    function normalizeUrl(src) {
        if (!src) return '';
        if (src.startsWith('http')) return src;
        return MC_BASE + src;
    }

    try {
        console.log('[KENG][5-9][Motchill] getMovieDetail(' + url + ')');

        // Step 1: Fetch detail page
        const detailHtml = await fetchHtml(url);
        console.log('[KENG][5-9][Motchill] detail page: ' + detailHtml.length + ' chars');

        // Extract slug from URL for id
        const slugM = url.match(/\/phim\/([^/?#]+)/);
        const slug  = slugM ? slugM[1] : '';

        // Title
        const titleM = detailHtml.match(/<span class="title"[^>]*>([^<]+)<\/span>/);
        const title  = titleM ? titleM[1].trim() : '';

        // Original title — strip year in parens and extra whitespace
        const realNameM = detailHtml.match(/<span class="real-name">\s*([\s\S]*?)\s*<\/span>/);
        let titleOriginal = '';
        if (realNameM) {
            titleOriginal = realNameM[1]
                .replace(/\(\d{4}\)/g, '')
                .replace(/<[^>]+>/g, '')
                .replace(/\s+/g, ' ')
                .trim();
        }

        // Poster — prefer absolute URL, fallback to og:image
        const posterInlineM = detailHtml.match(/<img itemprop="image" src="([^"]+)"/);
        const posterOgM     = detailHtml.match(/<meta property="og:image" content="([^"]+)"/);
        const posterRaw     = posterInlineM ? posterInlineM[1] : (posterOgM ? posterOgM[1] : '');
        const posterUrl     = normalizeUrl(posterRaw);

        // Description from og:description
        const descM    = detailHtml.match(/<meta property="og:description" content="([^"]+)"/);
        const description = descM ? descM[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').substring(0, 500) : '';

        // dinfo fields
        const dinfo = extractDinfo(detailHtml);
        const year          = dinfo['Năm sản xuất'] || '';
        const duration      = dinfo['Thời lượng']   || '';
        const country       = dinfo['Quốc gia']     || '';
        const genresRaw     = dinfo['Thể loại']     || '';
        const statusText    = dinfo['Trạng thái']   || '';
        const totalEpsStr   = dinfo['Số tập']       || '0';
        const totalEpisodes = parseInt(totalEpsStr, 10) || 0;

        // Genres: split by comma or space
        const genres = genresRaw
            ? genresRaw.split(/[,،]/).map(g => g.trim()).filter(Boolean)
            : [];

        // media_type: movie if Số tập == 1 or status contains FULL
        const isMovie = totalEpisodes === 1 || /full/i.test(statusText);
        const mediaType = isMovie ? 'movie' : 'series';

        // badge_text from status (e.g. "Tập 571 Vietsub" → "Tập 571", "FULL Vietsub" → "Full")
        const badgeM    = statusText.match(/^(Tập\s*\d+|FULL|Full)/i);
        const badgeText = badgeM ? badgeM[1].trim() : statusText.split(' ')[0] || '';

        // Step 2: Get tap-1 (or tap-full) URL from btn-stream-link
        const streamLinkM = detailHtml.match(/class="btn-see btn btn-danger btn-stream-link"\s+href="([^"]+)"/);
        const firstEpUrl  = streamLinkM ? streamLinkM[1] : '';

        // Step 3: Fetch watch page for full episode list
        let episodes = [];
        if (firstEpUrl) {
            console.log('[KENG][5-9][Motchill] fetching watch page: ' + firstEpUrl);
            const watchHtml = await fetchHtml(firstEpUrl);
            console.log('[KENG][5-9][Motchill] watch page: ' + watchHtml.length + ' chars');
            episodes = extractEpisodesFromWatchPage(watchHtml);
            console.log('[KENG][5-9][Motchill] episodes found: ' + episodes.length);
        } else {
            console.log('[KENG][5-9][Motchill] WARN: no stream link found on detail page');
        }

        // Rating (not available on detail page — leave empty)
        const rating = '';

        const result = {
            id:             slug,
            title,
            title_original: titleOriginal,
            poster_url:     posterUrl,
            url,
            year,
            duration,
            rating,
            country,
            genres,
            description,
            media_type:     mediaType,
            total_episodes: episodes.length || totalEpisodes,
            badge_text:     badgeText,
            episodes,
        };

        console.log('[KENG][5-9][Motchill] getMovieDetail() SUCCESS: ' + title + ' | ' + mediaType + ' | ' + episodes.length + ' eps');
        return JSON.stringify(result);

    } catch (e) {
        console.log('[KENG][5-9][Motchill] getMovieDetail() ERROR: ' + e.message);
        return JSON.stringify({ error: e.message });
    }
}
