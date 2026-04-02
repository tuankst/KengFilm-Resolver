/**
 * Search API Resolver v2 (API-based)
 * Contract: searchMovies(keyword, page) → JSON array of movies
 * Source: POST /baseapi/api/v1/movies/search?keyword={query}&page={page}
 */
async function searchMovies(keyword, page = 1) {
  const BASE_API = 'https://rophim10.com.mx/baseapi/api/v1';
  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
  const SITE_BASE = 'https://rophim10.com.mx';

  try {
    console.log(`[KENG][RoPhim10] searchMovies: "${keyword}" (page ${page})`);

    const url = `${BASE_API}/movies/search?keyword=${encodeURIComponent(keyword)}&page=${page}`;
    const response = await fetch(url, {
      headers: { 'User-Agent': UA }
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();

    // API response: { status, result: [movie objects] }
    if (!data || !data.result || !Array.isArray(data.result)) {
      return JSON.stringify([]);
    }

    const movies = data.result.map(apiMovie => ({
      rank: 0,
      title: apiMovie.name || '',
      title_original: apiMovie.origin_name || '',
      poster_url: apiMovie.thumbnail || apiMovie.poster || '',  // Prefer thumbnail (portrait) for search grid
      url: apiMovie.slug ? `${SITE_BASE}/phim/${apiMovie.slug}` : '',
      media_type: apiMovie.type === 'series' ? 'series' : 'movie',
      badge_text: '',
      badge_sub: '',
      year: String(apiMovie.publish_year || ''),
      rating: String(apiMovie.imdb_rating || ''),
      synopsis: '',
      age_rating: '',
      episode_current: apiMovie.episode_current || '',
      genres: []
    })).filter(m => !m.badge_text.toLowerCase().includes('trailer'));

    console.log(`[KENG][RoPhim10] searchMovies: returned ${movies.length} results`);
    return JSON.stringify(movies);

  } catch (e) {
    console.error(`[KENG][RoPhim10] searchMovies ERROR: ${e.message}`);
    return JSON.stringify({ error: e.message });
  }
}
