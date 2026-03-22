// Story 1-14 | Motchill | Phim Hàn Quốc Mới
// Target: https://motphimchillvl.net/quoc-gia/han-quoc

async function getNewKorean() {
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

    try {
        console.log('[KENG][1-14][Motchill] getNewKorean()');

        const html = await fetchHtml(MC_BASE + '/quoc-gia/han-quoc');
        console.log('[KENG][1-14][Motchill] HTML length: ' + html.length);

        const liParts = html.split('<li class="item');
        const movies = [];
        for (let i = 1; i < liParts.length && movies.length < 20; i++) {
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
                : hrefM[1];

            const yearM = rawTitle.match(/\b(20\d{2})\s*$/);
            const year  = yearM ? yearM[1] : '';
            const title = yearM ? rawTitle.slice(0, -year.length).trim() : rawTitle;

            const label      = labelM ? labelM[1].trim() : '';
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

        if (movies.length === 0) throw new Error('No movies parsed from /quoc-gia/han-quoc');

        const filtered = movies.filter(m => !m.badge_text.toLowerCase().includes('trailer'));
        if (filtered.length === 0) throw new Error('All items filtered as trailers');
        filtered.forEach((m, i) => { movies[i] = m; });
        movies.length = filtered.length;

        const misses = movies.filter(m => !m.poster_url);
        if (misses.length > 0) {
            const results = await Promise.allSettled(misses.map(m => fetchHtml(m.url)));
            results.forEach((r, i) => {
                if (r.status === 'fulfilled') misses[i].poster_url = extractOgImage(r.value);
            });
        }

        const output = movies.map(({ slug, ...rest }) => rest);
        console.log('[KENG][1-14][Motchill] SUCCESS: ' + output.length + ' items, first: ' + output[0].title);
        return JSON.stringify(output);

    } catch (e) {
        console.log('[KENG][1-14][Motchill] ERROR: ' + e.message);
        return JSON.stringify({ error: e.message });
    }
}
