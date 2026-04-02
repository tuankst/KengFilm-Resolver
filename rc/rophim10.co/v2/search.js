// Story 10-13 | RoPhim10 | Search Movies Resolver — v2 (API-based)
// Contract: searchMovies(query, page = 1) -> JSON array
// API: https://rophim10.co/baseapi/api/v1/movies/search?keyword={query}&page={page}

async function searchMovies(query, page = 1) {
  const SITE_BASE = 'https://rophim10.co';
  const BASE_API = 'https://rophim10.co/baseapi/api/v1';
  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

  try {
    console.log(`[KENG][RoPhim] searchMovies: "${query}" (page ${page})`);

    const url = BASE_API + '/movies/search?keyword=' + encodeURIComponent(query) + '&page=' + page;
    const response = await fetch(url, { headers: { 'User-Agent': UA } });

    if (!response.ok) {
      throw new Error('Search API returned ' + response.status);
    }

    const data = await response.json();

    if (!data.result || !Array.isArray(data.result)) {
      console.log('[KENG][RoPhim] No results found');
      return JSON.stringify([]);
    }

    // Transform API response to movie data contract
    const movies = data.result.map(item => ({
      rank: 0,
      title: item.name || '',
      title_original: item.origin_name || '',
      poster_url: item.poster || item.thumbnail || '',
      url: item.slug ? SITE_BASE + '/phim/' + item.slug : '',
      media_type: item.type === 'series' ? 'series' : 'movie',
      badge_text: '',
      badge_sub: '',
      year: String(item.publish_year || ''),
      rating: String(item.imdb_rating || ''),
      synopsis: '',
      age_rating: '',
      episode_current: item.episode_current || '',
      genres: []
    }));

    console.log('[KENG][RoPhim] Found ' + movies.length + ' results');
    return JSON.stringify(movies);
  } catch (e) {
    console.error('[KENG][RoPhim] searchMovies ERROR: ' + e.message);
    return JSON.stringify({ error: e.message });
  }
}
