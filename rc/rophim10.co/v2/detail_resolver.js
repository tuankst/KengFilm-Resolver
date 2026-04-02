// Story 10-13 | RoPhim10 | Detail Movie Resolver — v2 (API-based)
// Contract: getMovieDetail(filmUrl) -> JSON object
// API: https://rophim10.co/baseapi/api/v1/movies/by-slug/{slug}

async function getMovieDetail(filmUrl) {
  const SITE_BASE = 'https://rophim10.co';
  const BASE_API = 'https://rophim10.co/baseapi/api/v1';
  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

  try {
    console.log('[KENG][RoPhim] getMovieDetail: ' + filmUrl);

    // Extract slug from URL (e.g., /phim/avatar-2-dong-chay-cua-nuoc -> avatar-2-dong-chay-cua-nuoc)
    const slugMatch = filmUrl.match(/\/phim\/([^/?]+)/);
    if (!slugMatch) {
      throw new Error('Invalid film URL format: ' + filmUrl);
    }

    const slug = slugMatch[1];
    const url = BASE_API + '/movies/by-slug/' + slug;
    const response = await fetch(url, { headers: { 'User-Agent': UA } });

    if (!response.ok) {
      throw new Error('Detail API returned ' + response.status);
    }

    const data = await response.json();

    if (!data.result) {
      throw new Error('No movie data found');
    }

    const movie = data.result;

    // Transform to detail contract
    const detail = {
      rank: 0,
      title: movie.name || '',
      title_original: movie.origin_name || '',  // Fixed: was original_title
      poster_url: movie.poster || movie.thumbnail || '',
      url: SITE_BASE + '/phim/' + movie.slug,
      media_type: movie.type === 'series' ? 'series' : 'movie',
      badge_text: '',
      badge_sub: '',
      year: String(movie.publish_year || ''),
      rating: String(movie.imdb_rating || ''),
      synopsis: movie.description || movie.content || '',
      age_rating: '',
      episode_current: movie.episode_current || '',
      genres: movie.genres || [],
      // Extended fields (not in base contract but useful for detail page)
      quality: movie.quality || '',
      status: movie.status || '',
      language: movie.language || '',
      countries: movie.countries || [],
      actors: movie.actors || [],
      view_total: movie.view_total || 0,
      trailers: movie.trailers || [],
      total_episodes: parseInt(movie.episode_total || 0)
    };

    console.log('[KENG][RoPhim] Loaded detail: ' + detail.title);
    return JSON.stringify(detail);
  } catch (e) {
    console.error('[KENG][RoPhim] getMovieDetail ERROR: ' + e.message);
    return JSON.stringify({ error: e.message });
  }
}
