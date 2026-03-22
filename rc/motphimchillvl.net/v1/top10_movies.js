// Story 1-11 (updated 5-7a) | Motchill | Top 10 Phim Lẻ Hay
// Target: https://motphimchillvl.net (homepage → Top phim lẻ section)
// If html is provided (homebase HTML sharing), parse from it directly.

async function getTop10Movies(html = null) {
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
        console.log('[KENG][1-11][Motchill] getTop10Movies() html=' + (html ? 'provided(' + html.length + ')' : 'null'));

        if (!html) html = await fetchHtml(MC_BASE);
        console.log('[KENG][1-11][Motchill] HTML length: ' + html.length);

        const sectionIdx = html.indexOf('Top phim lẻ');
        if (sectionIdx < 0) throw new Error('Top phim lẻ section not found');
        const section = html.substring(sectionIdx, sectionIdx + 10000);

        const liRe = /<li class="film-item-ver">([\s\S]*?)<\/li>/gi;
        const movies = [];
        let lm;
        while ((lm = liRe.exec(section)) !== null && movies.length < 10) {
            const block = lm[1];
            const hrefM   = block.match(/href="(https?:\/\/[^"]+\/phim\/([^"/?]+))"[^>]*title="([^"]+)"/);
            const imgM    = block.match(/data-original="(\/storage\/[^"]+)"/);
            const yearM   = block.match(/class="real-name"[^>]*>\s*([^<]+)\s*</);
            const ratingM = block.match(/data-rating="([^"]+)"/);
            if (!hrefM) continue;

            const title  = hrefM[3].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#039;/g, "'");
            const rating = ratingM ? (parseFloat(ratingM[1]) / 10).toFixed(1) : '';

            movies.push({
                rank: movies.length + 1, title, title_original: '',
                poster_url: imgM ? MC_BASE + imgM[1] : '',
                url: hrefM[1], media_type: 'movie', badge_text: '', badge_sub: '',
                year: yearM ? yearM[1].trim() : '', rating,
                synopsis: '', age_rating: '', episode_current: '', genres: [], slug: hrefM[2]
            });
        }

        if (movies.length === 0) throw new Error('No movies parsed from Top phim lẻ section');

        const misses = movies.filter(m => !m.poster_url);
        if (misses.length > 0) {
            const results = await Promise.allSettled(misses.map(m => fetchHtml(m.url)));
            results.forEach((r, i) => {
                if (r.status === 'fulfilled') misses[i].poster_url = extractOgImage(r.value);
            });
        }

        const output = movies.map(({ slug, ...rest }) => rest);
        console.log('[KENG][1-11][Motchill] SUCCESS: ' + output.length + ' items, first: ' + output[0].title);
        return JSON.stringify(output);

    } catch (e) {
        console.log('[KENG][1-11][Motchill] ERROR: ' + e.message);
        return JSON.stringify({ error: e.message });
    }
}
