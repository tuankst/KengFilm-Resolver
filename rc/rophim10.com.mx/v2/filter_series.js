// Story 10-13 | RoPhim10 | Filter Phim Bộ — v2
// Contract: filterSeries(sortIdx, sortVal, countryId, countryIdx, countryVal, yearId, yearIdx, yearVal, genreId, genreIdx, genreVal, page = 1) -> JSON array
//
// LIMITATION: RoPhim10 filter API requires auth. Fallback to /movies/by-type/series (no filter support).
// Returns all series sorted by updatedAt. Filter params ignored.
// TODO: Request public filter API from RoPhim10 team.
//
// Filter values (verified 2026-04-02):
// Countries (ID order): Trung Quốc=1, Âu Mỹ=2, Hàn Quốc=3, Indonesia=4, Philippines=5, Nga=6,
//   Singapore=7, Nhật Bản=8, Thái Lan=9, Anh=10, Pháp=11, Bỉ=12, Hồng Kông=13, Canada=14,
//   Úc=15, Ý=16, Tây Ban Nha=17, Ấn Độ=18, Na Uy=19, Đức=20, Việt Nam=21
// Genres (ID order): Chính kịch=1, Hài Hước=2, Bí ẩn=3, Gia Đình=4, Viễn Tưởng=6, Hình Sự=7,
//   Kinh Dị=8, Phiêu Lưu=9, Khoa Học=10, Cổ Trang=11, Võ Thuật=12, Tình Cảm=14, Tâm Lý=16,
//   Âm Nhạc=18, Thể Thao=19, Chiến Tranh=20, Thần Thoại=21, Học Đường=22, Hoạt hình=24, Hành Động=49
// Sort: updatedAt (default), view_total, imdb_rating
// Page size: 32 items/page

async function filterSeries(
    sortIdx,   sortVal,
    countryId, countryIdx, countryVal,
    yearId,    yearIdx,    yearVal,
    genreId,   genreIdx,   genreVal,
    page
) {
    page = page || 1;
    const SITE_BASE = 'https://rophim10.com.mx';
    const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

    // Sort: index → API param
    const SORT_VALUES = ['updatedAt', 'view_total', 'imdb_rating'];  // 0=Mới Cập Nhật, 1=Xem Nhiều, 2=Đánh Giá Cao

    // Countries: index → API ID (matches provider-config.json order)
    const COUNTRY_IDS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21'];
    // Order: Trung Quốc, Âu Mỹ, Hàn Quốc, Indonesia, Philippines, Nga, Singapore, Nhật Bản, Thái Lan,
    //        Anh, Pháp, Bỉ, Hồng Kông, Canada, Úc, Ý, Tây Ban Nha, Ấn Độ, Na Uy, Đức, Việt Nam

    // Genres: index → API ID
    const GENRE_IDS = ['1', '2', '3', '4', '6', '7', '8', '9', '10', '11', '12', '14', '16', '18', '19', '20', '21', '22', '24', '49'];
    // Order: Chính kịch, Hài Hước, Bí ẩn, Gia Đình, Viễn Tưởng, Hình Sự, Kinh Dị, Phiêu Lưu,
    //        Khoa Học, Cổ Trang, Võ Thuật, Tình Cảm, Tâm Lý, Âm Nhạc, Thể Thao, Chiến Tranh,
    //        Thần Thoại, Học Đường, Hoạt hình, Hành Động

    async function fetchHtml(url) {
        const res = await fetch(url, { headers: { 'User-Agent': UA } });
        if (!res.ok) throw new Error('Fetch failed ' + res.status + ': ' + url);
        return res.text();
    }

    function buildUrl() {
        const params = [];

        if (countryIdx !== '-1') {
            const idx = parseInt(countryIdx);
            const id = (idx >= 0 && idx < COUNTRY_IDS.length) ? COUNTRY_IDS[idx] : '';
            params.push('countries=' + id);
        } else {
            params.push('countries=');
        }

        if (genreIdx !== '-1') {
            const idx = parseInt(genreIdx);
            const id = (idx >= 0 && idx < GENRE_IDS.length) ? GENRE_IDS[idx] : '';
            params.push('genres=' + id);
        } else {
            params.push('genres=');
        }

        if (yearIdx !== '-1' && yearVal) {
            params.push('years=' + yearVal);
        } else {
            params.push('years=');
        }

        params.push('type=series');
        params.push('rating=');

        let sortValue = 'updatedAt';
        if (sortIdx !== '-1') {
            const idx = parseInt(sortIdx);
            sortValue = (idx >= 0 && idx < SORT_VALUES.length) ? SORT_VALUES[idx] : 'updatedAt';
        }
        params.push('sort=' + sortValue);
        params.push('page=' + page);

        return SITE_BASE + '/tim-kiem?' + params.join('&');
    }

    try {
        console.log('[KENG][RoPhim10] filterSeries: page ' + page);
        const url = buildUrl();
        const html = await fetchHtml(url);

        // Collect data from multiple <a> tags with same href
        const movieData = {};  // href -> {poster, title, badge, slug}
        const itemRe = /<a[^>]+href="([^"]*\/phim\/([^"/?]+))"[^>]*>([\s\S]*?)<\/a>/gi;
        let m;

        while ((m = itemRe.exec(html)) !== null) {
            const link = m[1].startsWith('http') ? m[1] : SITE_BASE + m[1];
            if (link.includes('.trailer')) continue;

            const fullMatch = m[0];  // Full <a>...</a> including opening tag
            const content = m[3];    // Content inside <a>
            const slug = m[2];

            if (!movieData[link]) {
                movieData[link] = { slug: slug, poster: '', title: '', badge: '' };
            }

            // Try extract image (from thumbnail <a>)
            const imgM = content.match(/src="([^"]+)"/) || content.match(/data-src="([^"]+)"/) || content.match(/data-original="([^"]+)"/);
            if (imgM) {
                let poster = imgM[1].startsWith('//') ? 'https:' + imgM[1] : imgM[1];
                if (poster.includes('loading') || poster.includes('base64') || poster.includes('.gif')) {
                    const fallbackImg = content.match(/data-src="([^"]+)"/) || content.match(/data-original="([^"]+)"/);
                    if (fallbackImg) poster = fallbackImg[1].startsWith('//') ? 'https:' + fallbackImg[1] : fallbackImg[1];
                }
                movieData[link].poster = poster;
            }

            // Try extract title with Vietnamese accents (from title <a>)
            // Use first title found (Vietnamese comes before English in HTML)
            const titleM = fullMatch.match(/<a[^>]+title="([^"]+)"/i);
            if (titleM && !movieData[link].title) {
                movieData[link].title = titleM[1].trim();
            }

            // Extract badge (from thumbnail <a>)
            const badgeM = content.match(/class="[^"]*(?:tag-classic|pin-new|badge|label|status|quality)[^"]*">([\s\S]*?)</i);
            if (badgeM && !movieData[link].badge) {
                movieData[link].badge = badgeM[1].replace(/<[^>]+>/g, '').trim();
            }
        }

        // Build final array from collected data
        const series = [];
        for (const [link, data] of Object.entries(movieData)) {
            if (data.poster) {  // Only include items with poster
                const title = data.title || data.slug.replace(/-/g, ' ');  // Fallback to slug if no title
                series.push({
                    rank:            0,
                    title:           title,
                    title_original:  '',
                    poster_url:      data.poster,
                    url:             link,
                    media_type:      'series',
                    badge_text:      data.badge,
                    badge_sub:       '',
                    year:            '',
                    rating:          '',
                    synopsis:        '',
                    age_rating:      '',
                    episode_current: data.badge,
                    genres:          []
                });

                if (series.length >= 60) break;  // Limit to 60 items
            }
        }

        const finalResults = series.map((i, idx) => ({
            rank:            (page - 1) * 60 + idx + 1,
            title:           i.title || 'No Title',
            title_original:  i.title_original || '',
            poster_url:      i.poster_url || '',
            url:             i.url || '',
            media_type:      'series',
            badge_text:      i.badge_text || '',
            badge_sub:       i.badge_sub || '',
            year:            i.year || '',
            rating:          i.rating || '',
            synopsis:        i.synopsis || '',
            age_rating:      i.age_rating || '',
            episode_current: i.episode_current || '',
            genres:          i.genres || []
        }));

        console.log('[KENG][RoPhim10] filterSeries SUCCESS: ' + finalResults.length + ' items (page ' + page + ')');
        return JSON.stringify(finalResults);

    } catch (e) {
        console.log('[KENG][RoPhim10] filterSeries error: ' + e.message);
        return JSON.stringify([]);
    }
}
