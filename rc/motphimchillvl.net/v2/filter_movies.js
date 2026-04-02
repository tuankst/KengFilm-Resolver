// Story 7-4 | Motchill | Categories — Filter Phim Lẻ
// Contract: filterMovies(sortIdx, sortVal, countryId, countryIdx, countryVal, yearId, yearIdx, yearVal, genreId, genreIdx, genreVal, page)
// URL: https://motphimchillvl.net/?filter[type]=single&filter[sort]=view&filter[region]=ID&filter[year]=YYYY&filter[category]=ID&page=N
//
// Sort values (verified): '' = recently updated (default), 'view' = most viewed
// Region IDs: Trung Quốc=1, Âu Mỹ=2, Hàn Quốc=3, Nhật Bản=7, Thái Lan=20, Việt Nam=31
// Category IDs: Tình Cảm=1, Cổ Trang=2, Tâm Lý=3, Phiêu Lưu=4, Gia Đình=5, Viễn Tưởng=6,
//               Hài Hước=9, Hành Động=10, Chiến Tranh=11, Kinh Dị=12, Hoạt Hình=14, Hình Sự=16, Võ Thuật=19
// Page size: 20 items/page (verified)
// NOTE: MUST use string concat for query — URLSearchParams encodes [] → %5B%5D which site rejects

async function filterMovies(
    sortIdx,   sortVal,
    countryId, countryIdx, countryVal,
    yearId,    yearIdx,    yearVal,
    genreId,   genreIdx,   genreVal,
    page = 1
) {
    const MC_BASE = 'https://motphimchillvl.net';
    const MC_UA   = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

    const REGION_IDS = {
        'Trung Quốc': '1', 'Âu Mỹ': '2', 'Hàn Quốc': '3', 'Nhật Bản': '7',
        'Thái Lan': '20', 'Việt Nam': '31', 'Hồng Kông': '12', 'Đài Loan': '15',
    };
    const GENRE_IDS = {
        'Tình Cảm': '1', 'Cổ Trang': '2', 'Tâm Lý': '3',
        'Phiêu Lưu': '4', 'Gia Đình': '5', 'Viễn Tưởng': '6', 'Khoa Học': '7',
        'Chính kịch': '8', 'Hài Hước': '9', 'Hành Động': '10', 'Chiến Tranh': '11',
        'Kinh Dị': '12', 'Bí ẩn': '13', 'Hoạt Hình': '14', 'Hình Sự': '16',
        'Học Đường': '18', 'Võ Thuật': '19', 'Tội Phạm': '16', 'Lãng Mạn': '27',
    };

    async function fetchHtml(url) {
        const res = await fetch(url, { headers: { 'User-Agent': MC_UA } });
        if (!res.ok) throw new Error('Fetch failed ' + res.status + ': ' + url);
        return res.text();
    }

    function extractOgImage(html) {
        const m = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/);
        return m ? m[1] : '';
    }

    function buildUrl() {
        // MUST use string concat — URLSearchParams encodes [] → %5B%5D which site rejects
        let qs = 'filter[type]=single';
        if (sortIdx !== '-1' && sortVal) {
            qs += '&filter[sort]=' + sortVal;
        }
        if (countryIdx !== '-1' && countryVal) {
            const id = REGION_IDS[countryVal];
            if (id) qs += '&filter[region]=' + id;
        }
        if (yearIdx !== '-1' && yearVal) {
            qs += '&filter[year]=' + yearVal;
        }
        if (genreIdx !== '-1' && genreVal) {
            const id = GENRE_IDS[genreVal];
            if (id) qs += '&filter[category]=' + id;
        }
        qs += '&page=' + page;
        return MC_BASE + '/?' + qs;
    }

    function parsePage(html) {
        const liParts = html.split('<li class="item');
        const movies = [];
        for (let i = 1; i < liParts.length; i++) {
            const block = liParts[i];
            const endIdx = block.indexOf('</li>');
            const liBody = endIdx >= 0 ? block.substring(0, endIdx) : block.substring(0, 2000);

            const hrefM      = liBody.match(/href="(https?:\/\/[^"]+\/phim\/([^"/?]+))"/);
            const imgM       = liBody.match(/data-original="(\/storage\/[^"]+)"/);
            const labelM     = liBody.match(/class="label[^"]*"[^>]*>([^<]+)</);
            const nameTitleM = liBody.match(/class="name"[\s\S]*?title="([^"]+)"/);

            if (!hrefM || !nameTitleM) continue;

            const rawTitle = nameTitleM[1]
                .replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#039;/g, "'");
            if (!rawTitle) continue;

            const label = labelM ? labelM[1].trim() : '';
            if (label.toLowerCase().includes('trailer') || rawTitle.toLowerCase().includes('trailer')) continue;

            const yearM = rawTitle.match(/\b(20\d{2}|19\d{2})\s*$/);
            const year  = yearM ? yearM[1] : '';
            const title = yearM ? rawTitle.slice(0, -year.length).trim() : rawTitle;

            // Badge: "Full Vietsub + Thuyết Minh" → badge_text="Full", badge_sub="Vietsub + Thuyết Minh"
            let badge_text = label;
            let badge_sub  = '';
            const subPatterns = [
                /^(Full|FULL|Hoàn\s*Tất\s*\(\d+\/\d+\))\s+(Vietsub.*|Thuyết\s*Minh.*|Lồng\s*Tiếng.*|TM.*|Raw.*)$/i,
                /^(Full|FULL|Hoàn\s*Tất\s*\(\d+\/\d+\))\s*-\s*(Vietsub.*|Thuyết\s*Minh.*|Lồng\s*Tiếng.*)$/i,
            ];
            for (const pat of subPatterns) {
                const m = label.match(pat);
                if (m) { badge_text = m[1].trim(); badge_sub = m[2].trim(); break; }
            }
            if (badge_sub === '') {
                const plusIdx = label.indexOf(' + ');
                if (plusIdx >= 0) {
                    badge_text = label.slice(0, plusIdx).trim();
                    badge_sub  = label.slice(plusIdx + 3).trim();
                }
            }

            movies.push({
                rank: 0, title, title_original: '',
                poster_url: imgM ? MC_BASE + imgM[1] : '',
                url: hrefM[1], media_type: 'movie',
                badge_text, badge_sub, year,
                rating: '', synopsis: '', age_rating: '',
                episode_current: '', genres: [],
                _slug: hrefM[2],
            });
        }
        return movies;
    }

    try {
        const url = buildUrl();
        console.log('[KENG][7-4][Motchill] filterMovies() url=' + url);

        const html = await fetchHtml(url);
        const movies = parsePage(html);

        if (movies.length === 0) {
            console.log('[KENG][7-4][Motchill] filterMovies() END — no items on page ' + page);
            return JSON.stringify([]);
        }

        const misses = movies.filter(m => !m.poster_url);
        if (misses.length > 0) {
            const results = await Promise.allSettled(misses.map(m => fetchHtml(m.url)));
            results.forEach((r, i) => {
                if (r.status === 'fulfilled') misses[i].poster_url = extractOgImage(r.value);
            });
        }

        const output = movies.map(({ _slug, ...rest }) => rest);
        console.log('[KENG][7-4][Motchill] filterMovies() SUCCESS: ' + output.length + ' items, page=' + page);
        return JSON.stringify(output);

    } catch (e) {
        console.log('[KENG][7-4][Motchill] filterMovies() ERROR: ' + e.message);
        return JSON.stringify({ error: e.message });
    }
}
