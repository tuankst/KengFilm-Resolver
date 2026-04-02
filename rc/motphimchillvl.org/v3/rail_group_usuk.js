// Story 10.12 — Motchill | Rail Group UsUk v3
// Function: railGroupUsUk()
// Fetches /quoc-gia/au-my → 1 rail: usuk
// App calls this in parallel with other rail groups

async function railGroupUsUk() {
    const BASE = 'https://motphimchillvl.org';
    const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

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

    function parseCountryPage(html, mediaType) {
        const parts = html.split('<li class="item');
        const items = [];
        for (let i = 1; i < parts.length && items.length < 20; i++) {
            const block = parts[i];
            const endIdx = block.indexOf('</li>');
            const liBody = endIdx >= 0 ? block.substring(0, endIdx) : block.substring(0, 2000);

            const hrefM = liBody.match(/href="(https?:\/\/[^"]+\/phim\/([^"/?]+))"/);
            const imgM = liBody.match(/data-original="(\/storage\/[^"]+)"/);
            const labelM = liBody.match(/class="label[^"]*"[^>]*>([^<]+)</);
            if (!hrefM) continue;

            const nameTitleM = liBody.match(/class="name"[\s\S]*?title="([^"]+)"/);
            const rawTitle = nameTitleM ? cleanTitle(nameTitleM[1]) : '';
            if (!rawTitle) continue;

            const rawLabel = labelM ? labelM[1].trim() : '';
            if (/trailer/i.test(rawLabel) || /trailer/i.test(rawTitle)) continue;

            const yearM = rawTitle.match(/\b(20\d{2})\s*$/);
            const year = yearM ? yearM[1] : '';
            const title = yearM ? rawTitle.slice(0, -year.length).trim() : rawTitle;

            const plusIdx = rawLabel.indexOf(' + ');
            const badge_text = plusIdx >= 0 ? rawLabel.slice(0, plusIdx).trim() : rawLabel;
            const badge_sub = plusIdx >= 0 ? rawLabel.slice(plusIdx + 3).trim() : '';

            items.push({
                rank: 0, title, title_original: '',
                poster_url: imgM ? BASE + imgM[1] : '',
                url: hrefM[1], media_type: mediaType,
                badge_text, badge_sub, year, rating: '',
                synopsis: '', age_rating: '', episode_current: badge_text,
                genres: [], slug: hrefM[2]
            });
        }
        return items;
    }

    try {
        const tStart = Date.now();
        console.log('[KENG][10-12][Motchill] railGroupUsUk() start');

        const html = await fetchHtml(BASE + '/quoc-gia/au-my');
        const rawItems = parseCountryPage(html, 'movie');

        // Fetch missing posters in parallel
        const misses = rawItems.filter(m => !m.poster_url);
        if (misses.length > 0) {
            console.log('[KENG][10-12][Motchill] usuk: fetching ' + misses.length + ' missing posters');
            const results = await Promise.allSettled(misses.map(m => fetchHtml(m.url)));
            results.forEach((r, i) => {
                if (r.status === 'fulfilled') misses[i].poster_url = extractOgImage(r.value);
            });
        }

        const movies = rawItems.map(({ slug, ...rest }) => rest);
        if (movies.length === 0) throw new Error('No items parsed from /quoc-gia/au-my');

        console.log('[KENG][10-12][Motchill] railGroupUsUk() SUCCESS: ' + movies.length + ' items, total=' + (Date.now() - tStart) + 'ms');

        return JSON.stringify([
                {
                    id: 'usuk',
                    title: 'Phim Âu Mỹ Mới',
                    subtitle: null,
                    card_height_percent: 0.18,
                    card_size_ratio: 0.667,
                    is_hero_source: false,
                    show_rank: false,
                    movies,
                    show_cta: {
                        js_method: 'getAllUsuk'
                    }
                }
        ]);

    } catch (e) {
        console.log('[KENG][10-12][Motchill] ERROR railGroupUsUk: ' + e.message);
        return JSON.stringify({ error: e.message });
    }
}

async function getAllUsUk(page = 1) {
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
            const rawTitle = nameTitleM ? nameTitleM[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#039;/g, "'") : '';
            if (!rawTitle) continue;
            const yearM = rawTitle.match(/\b(20\d{2})\s*$/);
            const year  = yearM ? yearM[1] : '';
            const title = yearM ? rawTitle.slice(0, -year.length).trim() : rawTitle;
            const label      = labelM ? labelM[1].trim() : '';
            if (label.toLowerCase().includes('trailer')) continue;
            const plusIdx    = label.indexOf(' + ');
            const badge_text = plusIdx >= 0 ? label.slice(0, plusIdx).trim() : label;
            const badge_sub  = plusIdx >= 0 ? label.slice(plusIdx + 3).trim() : '';
            let media_type = 'movie';
            if (/tập\s*\d+/i.test(badge_text) || /^\d+\/\d+$/.test(badge_text) || /\d+\s*tập/i.test(badge_text)) {
                media_type = 'series';
            } else if (/full/i.test(badge_text) && !/full\s*hd/i.test(badge_text)) {
                media_type = 'series';
            }
            movies.push({
                rank: 0, title, title_original: '', poster_url: imgM ? MC_BASE + imgM[1] : '',
                url: hrefM[1], media_type, badge_text, badge_sub,
                year, rating: '', synopsis: '', age_rating: '', episode_current: badge_text, genres: [], slug: hrefM[2]
            });
        }
        return movies;
    }
    try {
        console.log('[KENG][5-7a][Motchill] getAllUsUk(page=' + page + ')');
        const url = MC_BASE + '/quoc-gia/au-my?page=' + page;
        const html = await fetchHtml(url);
        const movies = parsePage(html);
        if (movies.length === 0) {
            console.log('[KENG][5-7a][Motchill] getAllUsUk() END — no more items');
            return JSON.stringify([]);
        }
        const misses = movies.filter(m => !m.poster_url);
        if (misses.length > 0) {
            const results = await Promise.allSettled(misses.map(m => fetchHtml(m.url)));
            results.forEach((r, i) => {
                if (r.status === 'fulfilled') misses[i].poster_url = extractOgImage(r.value);
            });
        }
        const output = movies.map(({ slug, ...rest }) => rest);
        console.log('[KENG][5-7a][Motchill] getAllUsUk() SUCCESS: ' + output.length + ' items');
        return JSON.stringify(output);
    } catch (e) {
        console.log('[KENG][5-7a][Motchill] getAllUsUk() ERROR: ' + e.message);
        return JSON.stringify({ error: e.message });
    }
}
