// Story 1-17 | Motchill | Search
// Target: https://motphimchillvl.org/?search={keyword}
// Structure: identical to listing pages (list-films film-new section)

const MC_BASE = 'https://motphimchillvl.org';
const MC_UA   = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

async function fetchHtml(url) {
    const res = await fetch(url, { headers: { 'User-Agent': MC_UA } });
    if (!res.ok) throw new Error('Fetch failed ' + res.status + ': ' + url);
    return res.text();
}

async function searchMovies(keyword, page = 1) {
    try {
        if (!keyword || !keyword.trim()) throw new Error('keyword is required');
        console.log('[KENG][1-17][Motchill] searchMovies(' + keyword + ', page=' + page + ')');

        const encoded = encodeURIComponent(keyword.trim());
        const target  = MC_BASE + '/?search=' + encoded + '&page=' + page;
        const html    = await fetchHtml(target);

        // Isolate search results section (list-films film-new)
        const secStart = html.indexOf('list-films film-new');
        if (secStart < 0) throw new Error('Search results section not found');
        const section = html.substring(secStart, secStart + 20000);

        const parts   = section.split('<li class="item');
        const results = [];

        for (let i = 1; i < parts.length && results.length < 20; i++) {
            const endIdx = parts[i].indexOf('</li>');
            const block  = endIdx >= 0 ? parts[i].substring(0, endIdx) : parts[i].substring(0, 2000);

            const hrefM  = block.match(/href="(https?:\/\/[^"]+\/phim\/([^"/?]+))"/);
            const nameM  = block.match(/class="name"[\s\S]{0,300}?title="([^"]+)"/);
            const imgM   = block.match(/data-original="([^"]+)"/);
            const labelM = block.match(/class="label[^"]*">([^<]+)</);

            if (!hrefM) continue;

            const rawTitle = (nameM ? nameM[1] : '')
                .replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#039;/g, "'").trim();

            if (!rawTitle) continue;

            const label = labelM ? labelM[1].trim() : '';

            // Filter out Trailer
            if (label.toLowerCase().includes('trailer') || rawTitle.toLowerCase().includes('trailer')) {
                continue;
            }

            // Split title and year: "Title 2024" -> "Title", "2024"
            let title = rawTitle;
            let year  = '';
            const yearMatch = rawTitle.match(/\s+((?:19|20)\d{2})$/);
            if (yearMatch) {
                year  = yearMatch[1];
                title = rawTitle.replace(yearMatch[0], '').trim();
            }

            const plusIdx    = label.indexOf(' + ');
            const badge_text = plusIdx >= 0 ? label.slice(0, plusIdx).trim() : label;
            const badge_sub  = plusIdx >= 0 ? label.slice(plusIdx + 3).trim() : '';

            // Detect media_type từ badge_text:
            // - Số tập (e.g. "Tập 12", "12/24") hoặc "Full" (không phải "Full HD") → series
            // - "Full HD", "CAM", "HD", v.v. → movie
            let media_type = 'movie';
            if (/tập\s*\d+/i.test(badge_text) || /^\d+\/\d+$/.test(badge_text) || /\d+\s*tập/i.test(badge_text)) {
                media_type = 'series';
            } else if (/full/i.test(badge_text) && !/full\s*hd/i.test(badge_text)) {
                media_type = 'series';
            }

            let poster = imgM ? imgM[1] : '';
            if (poster && !poster.startsWith('http')) {
                poster = MC_BASE + poster;
            }

            results.push({
                rank:            0,
                title:           title,
                title_original:  '',
                poster_url:      poster,
                url:             hrefM[1],
                media_type:      media_type,
                badge_text:      badge_text,
                badge_sub:       badge_sub,
                year:            year,
                rating:          '',
                synopsis:        '',
                age_rating:      '',
                episode_current: badge_text,
                genres:          [],
            });
        }

        if (results.length === 0) {
            // Empty array signals no more pages — consistent with CTA paging contract
            console.log('[KENG][1-17][Motchill] page ' + page + ': no results');
            return JSON.stringify([]);
        }

        console.log('[KENG][1-17][Motchill] SUCCESS: page=' + page + ', ' + results.length + ' items, first: ' + results[0].title);
        return JSON.stringify(results);

    } catch (e) {
        console.log('[KENG][1-17][Motchill] ERROR: ' + e.message);
        return JSON.stringify({ error: e.message });
    }
}
