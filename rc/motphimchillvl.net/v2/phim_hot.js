/**
 * Story 1-18 (updated 5-7a): Phim Hot — motphimchillvl.net
 * Source: div.list-films.film-hot (homepage)
 * Function: getPhimHot(html = null)
 * If html is provided (homebase HTML sharing), parse from it directly.
 * If html is null, fetch homepage fresh.
 */
async function getPhimHot(html = null) {
  console.log('[KENG][1-18][Motchill] getPhimHot() html=' + (html ? 'provided(' + html.length + ')' : 'null'));
  const BASE = 'https://motphimchillvl.net';
  try {
    if (!html) {
      const res = await fetch(BASE, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      });
      html = await res.text();
    }

    // Extract div.list-films.film-hot section
    const sectionMatch = html.match(/<div[^>]+class="[^"]*list-films[^"]*film-hot[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/);
    if (!sectionMatch) {
      // Fallback: broader match
      const fallback = html.match(/class="[^"]*film-hot[^"]*"[\s\S]{0,50}>([\s\S]{0,8000}?)<\/div>\s*<\/div>/);
      if (!fallback) return JSON.stringify({ error: 'film-hot section not found' });
    }

    // Parse all article.item inside film-hot
    // Find the film-hot div boundaries
    const startIdx = html.indexOf('class="list-films film-hot"');
    if (startIdx === -1) return JSON.stringify({ error: 'film-hot section not found' });

    // Extract a chunk of HTML after the section start
    const chunk = html.substring(startIdx, startIdx + 20000);

    // Match all article.item blocks
    const articleRegex = /<article[^>]+class="item"[^>]*title="([^"]*)"[\s\S]*?<\/article>/g;
    const items = [];
    let match;

    while ((match = articleRegex.exec(chunk)) !== null && items.length < 20) {
      const articleHtml = match[0];
      const title = match[1] || '';

      // poster: data-original or src
      const posterMatch = articleHtml.match(/data-original="([^"]+)"|<img[^>]+src="([^"]+)"/);
      let poster = posterMatch ? (posterMatch[1] || posterMatch[2] || '') : '';
      if (poster && poster.startsWith('/')) poster = BASE + poster;

      // url
      const urlMatch = articleHtml.match(/href="(https?:\/\/[^"]+\/phim\/[^"]+)"/);
      const url = urlMatch ? urlMatch[1] : '';

      // badge_text: span.label (first one)
      const badgeMatch = articleHtml.match(/<span[^>]+class="label"[^>]*>([^<]+)<\/span>/);
      const badge_text = badgeMatch ? badgeMatch[1].trim() : '';

      // badge_sub: span.label-quality ("Thịnh hành")
      const badgeSubMatch = articleHtml.match(/<span[^>]+class="label-quality"[^>]*>([^<]+)<\/span>/);
      const badge_sub = badgeSubMatch ? badgeSubMatch[1].trim() : '';

      // Filter Trailer
      if (/trailer/i.test(badge_text)) continue;
      if (!title || !url) continue;

      // Detect media_type từ badge_text:
      // - Nếu badge có pattern số tập (e.g. "Tập 12", "12/24", "Full") → series
      // - Nếu badge là "Full HD", "CAM", "HD" hoặc không có số tập → movie
      let media_type = 'movie';
      if (/tập\s*\d+/i.test(badge_text) || /^\d+\/\d+$/.test(badge_text) || /\d+\s*tập/i.test(badge_text)) {
        media_type = 'series';
      } else if (/full/i.test(badge_text) && !/full\s*hd/i.test(badge_text)) {
        media_type = 'series'; // "Full" = hoàn thành toàn bộ tập
      }

      items.push({
        rank: 0,
        title,
        title_original: '',
        poster_url: poster,
        url,
        media_type,
        badge_text,
        badge_sub,
        year: '',
        rating: '',
        synopsis: '',
        age_rating: '',
        episode_current: '',
        genres: []
      });
    }

    console.log(`[KENG][1-18][Motchill] getPhimHot() → ${items.length} items`);
    return JSON.stringify(items);
  } catch (e) {
    return JSON.stringify({ error: e.message });
  }
}
