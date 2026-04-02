// Story 10.12 — Motchill | Rail Group Homepage v3
// Function: railGroupHomepage()
// Fetches homepage ONCE → parses 6 rails:
//   phim_hot, top10_series, top10_movies, new_series, new_movies, cinema
//
// Selectors (verified via probe 2026-04-01):
//   phim_hot       : div.list-films.film-hot > article.item
//   top10_series   : indexOf('most-view block') → li.item.day  (poster cross-ref from phim_hot)
//   top10_movies   : indexOf('Top phim lẻ') → li.film-item-ver (poster inline)
//   new_series     : div.tab-content1[data-id="1"] → ul.film-moi > li.item
//   new_movies     : div.tab-content1[data-id="2"] → ul.film-moi > li.item
//   cinema         : div.tab-content1[data-id="3"] → ul.film-moi > li.item

async function railGroupHomepage() {
    const BASE = 'https://motphimchillvl.org';
    const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

    // ─── helpers ───────────────────────────────────────────────────────────

    async function fetchHtml(url) {
        const t0 = Date.now();
        console.log('[KENG][Motchill] fetching: ' + url);
        const res = await fetch(url, { headers: { 'User-Agent': UA } });
        if (!res.ok) throw new Error('Fetch failed ' + res.status + ': ' + url);
        const text = await res.text();
        console.log('[KENG][Motchill] fetched: ' + url + ' (' + (Date.now() - t0) + 'ms, ' + text.length + 'B)');
        return text;
    }

    function extractOgImage(html) {
        const m = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/);
        return m ? m[1] : '';
    }

    function cleanTitle(raw) {
        return raw.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#039;/g, "'").trim();
    }

    function splitBadge(label) {
        const plusIdx = label.indexOf(' + ');
        return plusIdx >= 0
            ? { badge_text: label.slice(0, plusIdx).trim(), badge_sub: label.slice(plusIdx + 3).trim() }
            : { badge_text: label, badge_sub: '' };
    }

    function inferMediaType(badgeText) {
        if (/tập\s*\d+/i.test(badgeText) || /^\d+\/\d+$/.test(badgeText) || /\d+\s*tập/i.test(badgeText)) {
            return 'series';
        }
        return 'movie';
    }

    // ─── (1) phim_hot ──────────────────────────────────────────────────────

    function parsePhimHot(html) {
        const startIdx = html.indexOf('class="list-films film-hot"');
        if (startIdx < 0) throw new Error('film-hot section not found');
        const chunk = html.substring(startIdx, startIdx + 20000);

        const artRe = /<article[^>]+class="item"[^>]*title="([^"]*)"[\s\S]*?<\/article>/g;
        const items = [];
        let m;
        while ((m = artRe.exec(chunk)) !== null && items.length < 20) {
            const block = m[0];
            const title = cleanTitle(m[1]);
            if (!title) continue;

            const posterM = block.match(/data-original="([^"]+)"|<img[^>]+src="([^"]+)"/);
            let poster = posterM ? (posterM[1] || posterM[2] || '') : '';
            if (poster && poster.startsWith('/')) poster = BASE + poster;

            const urlM = block.match(/href="(https?:\/\/[^"]+\/phim\/([^"/?]+))"/);
            if (!urlM) continue;

            const badgeM = block.match(/<span[^>]+class="label"[^>]*>([^<]+)<\/span>/);
            const rawBadge = badgeM ? badgeM[1].trim() : '';
            if (/trailer/i.test(rawBadge) || /trailer/i.test(title)) continue;

            const { badge_text, badge_sub } = splitBadge(rawBadge);
            const badgeSubM = block.match(/<span[^>]+class="label-quality"[^>]*>([^<]+)<\/span>/);
            const finalBadgeSub = badge_sub || (badgeSubM ? badgeSubM[1].trim() : '');

            items.push({
                rank: 0, title, title_original: '', poster_url: poster,
                url: urlM[1], media_type: inferMediaType(badge_text),
                badge_text, badge_sub: finalBadgeSub,
                year: '', rating: '', synopsis: '', age_rating: '',
                episode_current: badge_text, genres: [], slug: urlM[2]
            });
        }
        return items;
    }

    // ─── (2) top10_series ──────────────────────────────────────────────────

    function parseTop10Series(html, posterMap) {
        const sectionIdx = html.indexOf('most-view block');
        if (sectionIdx < 0) throw new Error('most-view section not found');
        const section = html.substring(sectionIdx, sectionIdx + 20000);

        const liRe = /<li class="item day"\s*>([\s\S]*?)<\/li>/gi;
        const items = [];
        let lm;
        while ((lm = liRe.exec(section)) !== null && items.length < 10) {
            const block = lm[1];
            const rankM = block.match(/<span[^>]*number-rank[^>]*>(\d+)<\/span>/);
            const hrefM = block.match(/href="(https?:\/\/[^"]+\/phim\/([^"/?]+))"[^>]*title="([^"]+)"/);
            const viewM = block.match(/<div class="count_view">([^<]+)<\/div>/);
            if (!hrefM) continue;

            const slug = hrefM[2];
            items.push({
                rank: rankM ? parseInt(rankM[1]) : items.length + 1,
                title: cleanTitle(hrefM[3]), title_original: '',
                poster_url: posterMap[slug] || '',
                url: hrefM[1], media_type: 'series',
                badge_text: viewM ? viewM[1].trim() : '', badge_sub: '',
                year: '', rating: '', synopsis: '', age_rating: '',
                episode_current: '', genres: [], slug
            });
        }
        return items;
    }

    // ─── (3) top10_movies ─────────────────────────────────────────────────

    function parseTop10Movies(html) {
        const sectionIdx = html.indexOf('Top phim lẻ');
        if (sectionIdx < 0) throw new Error('Top phim lẻ section not found');
        const section = html.substring(sectionIdx, sectionIdx + 10000);

        const liRe = /<li class="film-item-ver">([\s\S]*?)<\/li>/gi;
        const items = [];
        let lm;
        while ((lm = liRe.exec(section)) !== null && items.length < 10) {
            const block = lm[1];
            const hrefM = block.match(/href="(https?:\/\/[^"]+\/phim\/([^"/?]+))"[^>]*title="([^"]+)"/);
            const imgM = block.match(/data-original="(\/storage\/[^"]+)"/);
            const yearM = block.match(/class="real-name"[^>]*>\s*([^<]+)\s*</);
            const ratingM = block.match(/data-rating="([^"]+)"/);
            if (!hrefM) continue;

            const title = cleanTitle(hrefM[3]);
            const rating = ratingM ? (parseFloat(ratingM[1]) / 10).toFixed(1) : '';

            items.push({
                rank: items.length + 1, title, title_original: '',
                poster_url: imgM ? BASE + imgM[1] : '',
                url: hrefM[1], media_type: 'movie',
                badge_text: '', badge_sub: '',
                year: yearM ? yearM[1].trim() : '', rating,
                synopsis: '', age_rating: '', episode_current: '', genres: [], slug: hrefM[2]
            });
        }
        return items;
    }

    // ─── (4) tab sections: new_series, new_movies, cinema ─────────────────

    function parseTabSection(html, dataId, mediaType) {
        // Find <div class="tab-content1" data-id="N">
        const marker = 'class="tab-content1" data-id="' + dataId + '"';
        const markerIdx = html.indexOf(marker);
        if (markerIdx < 0) throw new Error('tab-content1 data-id=' + dataId + ' not found');

        const chunk = html.substring(markerIdx, markerIdx + 12000);
        const items = [];

        // Split on <li class="item
        const parts = chunk.split(/<li class="item/);
        for (let i = 1; i < parts.length && items.length < 16; i++) {
            const block = parts[i];
            const endIdx = block.indexOf('</li>');
            const liBody = endIdx >= 0 ? block.substring(0, endIdx) : block.substring(0, 2000);

            const hrefM = liBody.match(/href="(https?:\/\/[^"]+\/phim\/([^"/?]+))"[^>]*title="([^"]+)"/);
            const imgM = liBody.match(/data-original="(\/storage\/[^"]+)"/);
            const labelM = liBody.match(/class="label[^"]*"[^>]*>([^<]+)</);
            if (!hrefM) continue;

            // Prefer title from .name div (includes year), fallback to href title
            const nameTitleM = liBody.match(/class="name"[\s\S]*?title="([^"]+)"/);
            const rawTitle = nameTitleM ? cleanTitle(nameTitleM[1]) : cleanTitle(hrefM[3]);
            if (!rawTitle) continue;

            const rawLabel = labelM ? labelM[1].trim() : '';
            if (/trailer/i.test(rawLabel) || /trailer/i.test(rawTitle)) continue;

            const { badge_text, badge_sub } = splitBadge(rawLabel);

            // Strip trailing year from title (e.g. "Phim ABC 2026" → "Phim ABC", year "2026")
            const yearM = rawTitle.match(/\b(20\d{2})\s*$/);
            const year = yearM ? yearM[1] : '';
            const title = yearM ? rawTitle.slice(0, -year.length).trim() : rawTitle;

            items.push({
                rank: 0, title, title_original: '',
                poster_url: imgM ? BASE + imgM[1] : '',
                url: hrefM[1], media_type: mediaType,
                badge_text, badge_sub, year, rating: '',
                synopsis: '', age_rating: '', episode_current: badge_text, genres: []
            });
        }
        return items;
    }

    // ─── main ──────────────────────────────────────────────────────────────

    try {
        const tStart = Date.now();
        console.log('[KENG][10-12][Motchill] railGroupHomepage() start');

        const html = await fetchHtml(BASE);
        console.log('[KENG][10-12][Motchill] HTML size: ' + html.length);

        // Parse phim_hot first → build posterMap for top10_series cross-ref
        const phimHotItems = parsePhimHot(html);
        const posterMap = {};
        for (const item of phimHotItems) {
            if (item.slug && item.poster_url) posterMap[item.slug] = item.poster_url;
        }
        // Remove slug from final output
        const phimHot = phimHotItems.map(({ slug, ...rest }) => rest);
        console.log('[KENG][10-12][Motchill] phim_hot: ' + phimHot.length + ' items');

        const top10SeriesRaw = parseTop10Series(html, posterMap);
        // Fetch posters for top10 items not in phim_hot (in parallel)
        const misses = top10SeriesRaw.filter(m => !m.poster_url);
        if (misses.length > 0) {
            console.log('[KENG][10-12][Motchill] top10_series: fetching ' + misses.length + ' missing posters');
            const results = await Promise.allSettled(misses.map(m => fetchHtml(m.url)));
            results.forEach((r, i) => {
                if (r.status === 'fulfilled') misses[i].poster_url = extractOgImage(r.value);
            });
        }
        const top10Series = top10SeriesRaw.map(({ slug, ...rest }) => rest);
        console.log('[KENG][10-12][Motchill] top10_series: ' + top10Series.length + ' items');

        const top10MoviesRaw = parseTop10Movies(html);
        // Fetch posters for top10_movies misses (in parallel)
        const movieMisses = top10MoviesRaw.filter(m => !m.poster_url);
        if (movieMisses.length > 0) {
            console.log('[KENG][10-12][Motchill] top10_movies: fetching ' + movieMisses.length + ' missing posters');
            const results = await Promise.allSettled(movieMisses.map(m => fetchHtml(m.url)));
            results.forEach((r, i) => {
                if (r.status === 'fulfilled') movieMisses[i].poster_url = extractOgImage(r.value);
            });
        }
        const top10Movies = top10MoviesRaw.map(({ slug, ...rest }) => rest);
        console.log('[KENG][10-12][Motchill] top10_movies: ' + top10Movies.length + ' items');

        const newSeries = parseTabSection(html, '1', 'series');
        console.log('[KENG][10-12][Motchill] new_series: ' + newSeries.length + ' items');

        const newMovies = parseTabSection(html, '2', 'movie');
        console.log('[KENG][10-12][Motchill] new_movies: ' + newMovies.length + ' items');

        const cinema = parseTabSection(html, '3', 'movie');
        console.log('[KENG][10-12][Motchill] cinema: ' + cinema.length + ' items');

        const result = [
                {
                    id: 'phim_hot',
                    title: 'Top Phim Hot',
                    subtitle: null,
                    card_height_percent: 0.18,
                    card_size_ratio: 0.667,
                    is_hero_source: true,
                    show_rank: false,
                    movies: phimHot,
                    show_cta: null
                },
                {
                    id: 'top10_series',
                    title: 'Top 10 Phim Bộ',
                    subtitle: null,
                    card_height_percent: 0.18,
                    card_size_ratio: 0.667,
                    is_hero_source: false,
                    show_rank: true,
                    movies: top10Series,
                    show_cta: null
                },
                {
                    id: 'top10_movies',
                    title: 'Top 10 Phim Lẻ',
                    subtitle: null,
                    card_height_percent: 0.18,
                    card_size_ratio: 0.667,
                    is_hero_source: false,
                    show_rank: true,
                    movies: top10Movies,
                    show_cta: null
                },
                {
                    id: 'new_series',
                    title: 'Phim Bộ Mới',
                    subtitle: null,
                    card_height_percent: 0.18,
                    card_size_ratio: 0.667,
                    is_hero_source: false,
                    show_rank: false,
                    movies: newSeries,
                    show_cta: {
                        js_method: 'getAllNewSeries'
                    }
                },
                {
                    id: 'new_movies',
                    title: 'Phim Lẻ Mới',
                    subtitle: null,
                    card_height_percent: 0.18,
                    card_size_ratio: 0.667,
                    is_hero_source: false,
                    show_rank: false,
                    movies: newMovies,
                    show_cta: {
                        js_method: 'getAllNewMovies'
                    }
                },
                {
                    id: 'cinema',
                    title: 'Phim Chiếu Rạp',
                    subtitle: null,
                    card_height_percent: 0.18,
                    card_size_ratio: 0.667,
                    is_hero_source: false,
                    show_rank: false,
                    movies: cinema,
                    show_cta: {
                        js_method: 'getAllCinema'
                    }
                }
        ];

        console.log('[KENG][10-12][Motchill] railGroupHomepage() SUCCESS: 6 rails, total=' + (Date.now() - tStart) + 'ms');
        return JSON.stringify(result);

    } catch (e) {
        console.log('[KENG][10-12][Motchill] ERROR railGroupHomepage: ' + e.message);
        return JSON.stringify({ error: e.message });
    }
}

// Story 5-7a | Motchill | All New Series (CTA — paged)
// Contract: getAllNewSeries(page = 1) → JSON array ([] khi hết trang)
// Target: https://motphimchillvl.org/danh-sach/phim-bo?page=N

async function getAllNewSeries(page = 1) {
    const MC_BASE = 'https://motphimchillvl.org';
    const MC_UA   = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

    async function fetchHtml(url) {
        const res = await fetch(url, { headers: { 'User-Agent': MC_UA } });
        if (!res.ok) throw new Error('Fetch failed ' + res.status + ': ' + url);
        return res.text();
    }

    function extractOgImage(html) {
        const m = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/);
        return m ? m[1] : '';
    }

    function parsePage(html) {
        const liParts = html.split('<li class="item');
        const movies = [];
        for (let i = 1; i < liParts.length; i++) {
            const block = liParts[i];
            const endIdx = block.indexOf('</li>');
            const liBody = endIdx >= 0 ? block.substring(0, endIdx) : block.substring(0, 2000);

            const hrefM  = liBody.match(/href="(https?:\/\/[^"]+\/phim\/([^"/?]+))"/);
            const imgM   = liBody.match(/data-original="(\/storage\/[^"]+)"/);
            const labelM = liBody.match(/class="label[^"]*"[^>]*>([^<]+)</);
            if (!hrefM) continue;

            const nameTitleM = liBody.match(/class="name"[\s\S]*?title="([^"]+)"/);
            const rawTitle = nameTitleM
                ? nameTitleM[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#039;/g, "'")
                : '';
            if (!rawTitle) continue;

            const yearM = rawTitle.match(/\b(20\d{2})\s*$/);
            const year  = yearM ? yearM[1] : '';
            const title = yearM ? rawTitle.slice(0, -year.length).trim() : rawTitle;

            const label      = labelM ? labelM[1].trim() : '';
            if (label.toLowerCase().includes('trailer')) continue;
            const plusIdx    = label.indexOf(' + ');
            const badge_text = plusIdx >= 0 ? label.slice(0, plusIdx).trim() : label;
            const badge_sub  = plusIdx >= 0 ? label.slice(plusIdx + 3).trim() : '';

            movies.push({
                rank: 0, title, title_original: '',
                poster_url: imgM ? MC_BASE + imgM[1] : '',
                url: hrefM[1], media_type: 'series', badge_text, badge_sub,
                year, rating: '', synopsis: '', age_rating: '',
                episode_current: badge_text, genres: [], slug: hrefM[2]
            });
        }
        return movies;
    }

    try {
        console.log('[KENG][5-7a][Motchill] getAllNewSeries(page=' + page + ')');
        const url = MC_BASE + '/danh-sach/phim-bo?page=' + page;
        const html = await fetchHtml(url);
        const movies = parsePage(html);

        // Empty array = no more pages → Flutter stops endless scroll
        if (movies.length === 0) {
            console.log('[KENG][5-7a][Motchill] getAllNewSeries() END — no more items');
            return JSON.stringify([]);
        }

        // Fetch missing posters
        const misses = movies.filter(m => !m.poster_url);
        if (misses.length > 0) {
            const results = await Promise.allSettled(misses.map(m => fetchHtml(m.url)));
            results.forEach((r, i) => {
                if (r.status === 'fulfilled') misses[i].poster_url = extractOgImage(r.value);
            });
        }

        const output = movies.map(({ slug, ...rest }) => rest);
        console.log('[KENG][5-7a][Motchill] getAllNewSeries() SUCCESS: ' + output.length + ' items');
        return JSON.stringify(output);

    } catch (e) {
        console.log('[KENG][5-7a][Motchill] getAllNewSeries() ERROR: ' + e.message);
        return JSON.stringify({ error: e.message });
    }
}

// Story 5-7a | Motchill | All New Movies (CTA — paged)
// Contract: getAllNewMovies(page = 1) → JSON array ([] khi hết trang)
// Target: https://motphimchillvl.org/danh-sach/phim-le?page=N

async function getAllNewMovies(page = 1) {
    const MC_BASE = 'https://motphimchillvl.org';
    const MC_UA   = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

    async function fetchHtml(url) {
        const res = await fetch(url, { headers: { 'User-Agent': MC_UA } });
        if (!res.ok) throw new Error('Fetch failed ' + res.status + ': ' + url);
        return res.text();
    }

    function parsePage(html) {
        const parts = html.split('<li class="item');
        const movies = [];
        for (let i = 1; i < parts.length; i++) {
            const endIdx = parts[i].indexOf('</li>');
            const block = endIdx >= 0 ? parts[i].substring(0, endIdx) : parts[i].substring(0, 2000);

            const hrefM  = block.match(/href="(https?:\/\/[^"]+\/phim\/([^"/?]+))"/);
            const nameM  = block.match(/class="name"[\s\S]{0,300}?title="([^"]+)"/);
            const imgM   = block.match(/data-original="([^"]+)"/);
            const labelM = block.match(/class="label[^"]*">([^<]+)</);
            if (!hrefM) continue;

            const rawTitle = (nameM ? nameM[1] : '')
                .replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#039;/g, "'").trim();
            if (!rawTitle) continue;

            const label = labelM ? labelM[1].trim() : '';
            if (label.toLowerCase().includes('trailer') || rawTitle.toLowerCase().includes('trailer')) continue;

            let title = rawTitle;
            let year  = '';
            const yearMatch = rawTitle.match(/\s+((?:19|20)\d{2})$/);
            if (yearMatch) { year = yearMatch[1]; title = rawTitle.replace(yearMatch[0], '').trim(); }

            const plusIdx    = label.indexOf(' + ');
            const badge_text = plusIdx >= 0 ? label.slice(0, plusIdx).trim() : label;
            const badge_sub  = plusIdx >= 0 ? label.slice(plusIdx + 3).trim() : '';

            let poster = imgM ? imgM[1] : '';
            if (poster && !poster.startsWith('http')) poster = MC_BASE + poster;

            movies.push({
                rank: 0, title, title_original: '', poster_url: poster,
                url: hrefM[1], media_type: 'movie', badge_text, badge_sub,
                year, rating: '', synopsis: '', age_rating: '',
                episode_current: badge_text, genres: [],
            });
        }
        return movies;
    }

    try {
        console.log('[KENG][5-7a][Motchill] getAllNewMovies(page=' + page + ')');
        const url = MC_BASE + '/danh-sach/phim-le?page=' + page;
        const html = await fetchHtml(url);
        const movies = parsePage(html);

        if (movies.length === 0) {
            console.log('[KENG][5-7a][Motchill] getAllNewMovies() END — no more items');
            return JSON.stringify([]);
        }

        console.log('[KENG][5-7a][Motchill] getAllNewMovies() SUCCESS: ' + movies.length + ' items');
        return JSON.stringify(movies);

    } catch (e) {
        console.log('[KENG][5-7a][Motchill] getAllNewMovies() ERROR: ' + e.message);
        return JSON.stringify({ error: e.message });
    }
}

// Story 5-7a | Motchill | All Cinema (CTA — paged)
// Contract: getAllCinema(page = 1) → JSON array ([] khi hết trang)
// Target: https://motphimchillvl.org/danh-sach/phim-chieu-rap?page=N

async function getAllCinema(page = 1) {
    const MC_BASE = 'https://motphimchillvl.org';
    const MC_UA   = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

    async function fetchHtml(url) {
        const res = await fetch(url, { headers: { 'User-Agent': MC_UA } });
        if (!res.ok) throw new Error('Fetch failed ' + res.status + ': ' + url);
        return res.text();
    }

    function parsePage(html) {
        const parts = html.split('<li class="item');
        const movies = [];
        for (let i = 1; i < parts.length; i++) {
            const endIdx = parts[i].indexOf('</li>');
            const block = endIdx >= 0 ? parts[i].substring(0, endIdx) : parts[i].substring(0, 2000);

            const hrefM  = block.match(/href="(https?:\/\/[^"]+\/phim\/([^"/?]+))"/);
            const nameM  = block.match(/class="name"[\s\S]{0,300}?title="([^"]+)"/);
            const imgM   = block.match(/data-original="([^"]+)"/);
            const labelM = block.match(/class="label[^"]*">([^<]+)</);
            if (!hrefM) continue;

            const rawTitle = (nameM ? nameM[1] : '')
                .replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#039;/g, "'").trim();
            if (!rawTitle) continue;

            const label = labelM ? labelM[1].trim() : '';
            if (label.toLowerCase().includes('trailer') || rawTitle.toLowerCase().includes('trailer')) continue;

            let title = rawTitle;
            let year  = '';
            const yearMatch = rawTitle.match(/\s+((?:19|20)\d{2})$/);
            if (yearMatch) { year = yearMatch[1]; title = rawTitle.replace(yearMatch[0], '').trim(); }

            const plusIdx    = label.indexOf(' + ');
            const badge_text = plusIdx >= 0 ? label.slice(0, plusIdx).trim() : label;
            const badge_sub  = plusIdx >= 0 ? label.slice(plusIdx + 3).trim() : '';

            let poster = imgM ? imgM[1] : '';
            if (poster && !poster.startsWith('http')) poster = MC_BASE + poster;

            movies.push({
                rank: 0, title, title_original: '', poster_url: poster,
                url: hrefM[1], media_type: 'movie', badge_text, badge_sub,
                year, rating: '', synopsis: '', age_rating: '',
                episode_current: badge_text, genres: [],
            });
        }
        return movies;
    }

    try {
        console.log('[KENG][5-7a][Motchill] getAllCinema(page=' + page + ')');
        const url = MC_BASE + '/danh-sach/phim-chieu-rap?page=' + page;
        const html = await fetchHtml(url);
        const movies = parsePage(html);

        if (movies.length === 0) {
            console.log('[KENG][5-7a][Motchill] getAllCinema() END — no more items');
            return JSON.stringify([]);
        }

        console.log('[KENG][5-7a][Motchill] getAllCinema() SUCCESS: ' + movies.length + ' items');
        return JSON.stringify(movies);

    } catch (e) {
        console.log('[KENG][5-7a][Motchill] getAllCinema() ERROR: ' + e.message);
        return JSON.stringify({ error: e.message });
    }
}
