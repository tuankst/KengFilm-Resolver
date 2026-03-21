// Story 5-7a | Motchill | All US-UK (CTA — paged)
// Contract: getAllUsUk(page = 1) → JSON array ([] khi hết trang)
// Target: https://motphimchillvl.net/quoc-gia/au-my?page=N
// Note: US-UK mix movie + series — media_type detected từ badge_text

async function getAllUsUk(page = 1) {
    const MC_BASE = 'https://motphimchillvl.net';
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

            // Detect media_type: series nếu badge có "Tập N", "N/M", "N tập", hoặc "Full" (không phải "Full HD")
            let media_type = 'movie';
            if (/tập\s*\d+/i.test(badge_text) || /^\d+\/\d+$/.test(badge_text) || /\d+\s*tập/i.test(badge_text)) {
                media_type = 'series';
            } else if (/full/i.test(badge_text) && !/full\s*hd/i.test(badge_text)) {
                media_type = 'series';
            }

            movies.push({
                rank: 0, title, title_original: '',
                poster_url: imgM ? MC_BASE + imgM[1] : '',
                url: hrefM[1], media_type, badge_text, badge_sub,
                year, rating: '', synopsis: '', age_rating: '',
                episode_current: badge_text, genres: [], slug: hrefM[2]
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

        // Fetch missing posters
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
