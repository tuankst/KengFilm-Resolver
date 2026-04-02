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
