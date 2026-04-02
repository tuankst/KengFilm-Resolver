/**
 * Detail Resolver v2 (API-based)
 * Contract: getMovieDetail(filmUrl) → JSON object with full movie details + episodes array
 * Source: GET /baseapi/api/v1/movies/by-slug/{slug} + episodes API
 */
async function getMovieDetail(filmUrl) {
  const BASE_API = 'https://rophim10.com.mx/baseapi/api/v1';
  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
  const SITE_BASE = 'https://rophim10.com.mx';

  try {
    console.log(`[KENG][RoPhim10] getMovieDetail: ${filmUrl}`);

    // Extract slug from URL: /phim/avatar-2-dong-chay-cua-nuoc → avatar-2-dong-chay-cua-nuoc
    const slugMatch = filmUrl.match(/\/phim\/([^/?]+)/);
    if (!slugMatch) {
      return JSON.stringify({ error: 'Invalid film URL format' });
    }

    const slug = slugMatch[1];
    const url = `${BASE_API}/movies/by-slug/${slug}`;

    const response = await fetch(url, {
      headers: { 'User-Agent': UA }
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();

    // API response: { movie: { full movie object } }
    if (!data || !data.movie) {
      return JSON.stringify({ error: 'No movie data in response' });
    }

    const apiMovie = data.movie;
    const movieId = apiMovie.id;

    // Fetch episodes for this movie
    let episodes = [];
    if (movieId) {
      try {
        const episodesUrl = `${BASE_API}/episodes/by-idMovie/${movieId}`;
        const episodesResponse = await fetch(episodesUrl, {
          headers: { 'User-Agent': UA }
        });

        if (episodesResponse.ok) {
          const episodesData = await episodesResponse.json();
          const episodeItems = Array.isArray(episodesData)
            ? episodesData
            : (episodesData.result || episodesData.data || []);

          // Transform to Episode Contract format
          if (Array.isArray(episodeItems) && episodeItems.length > 0) {
            const episodeMap = new Map();

            for (const item of episodeItems) {
              const epNum = parseEpisodeNumber(item.name);
              const epKey = epNum !== null ? epNum : item.name;

              if (!episodeMap.has(epKey)) {
                episodeMap.set(epKey, {
                  episode_index: epNum !== null ? epNum - 1 : 0,
                  name: item.name,
                  servers: []
                });
              }

              const ep = episodeMap.get(epKey);
              if (item.server && item.id) {
                const watchUrl = `${SITE_BASE}/xem-phim/${apiMovie.slug}.${item.id}`;
                ep.servers.push({
                  server: item.server.replace(/:$/, ''),
                  url: watchUrl
                });
              }
            }

            episodes = Array.from(episodeMap.values())
              .sort((a, b) => a.episode_index - b.episode_index);
          }
        }
      } catch (e) {
        console.warn(`[KENG][RoPhim10] Failed to fetch episodes: ${e.message}`);
        // Continue with empty episodes array
      }
    }

    // Return detail object matching Movie Detail Contract
    const detail = {
      id: apiMovie.slug || slug,
      title: apiMovie.name || '',
      title_original: apiMovie.origin_name || '',
      poster_url: apiMovie.poster || apiMovie.thumbnail || '',
      url: apiMovie.slug ? `${SITE_BASE}/phim/${apiMovie.slug}` : filmUrl,
      year: String(apiMovie.publish_year || ''),
      duration: apiMovie.duration || '',
      rating: String(apiMovie.imdb_rating || ''),
      country: Array.isArray(apiMovie.countries) && apiMovie.countries.length > 0
        ? apiMovie.countries[0].name || ''
        : '',
      genres: Array.isArray(apiMovie.categories) ? apiMovie.categories.map(c => c.name || c) : [],
      description: apiMovie.description || '',
      media_type: apiMovie.type === 'series' ? 'series' : 'movie',
      total_episodes: apiMovie.total_episodes || 0,
      badge_text: apiMovie.episode_current || '',
      episodes: episodes
    };

    console.log(`[KENG][RoPhim10] getMovieDetail: ${detail.title} (${detail.media_type}) with ${episodes.length} episodes`);
    return JSON.stringify(detail);

  } catch (e) {
    console.error(`[KENG][RoPhim10] getMovieDetail ERROR: ${e.message}`);
    return JSON.stringify({ error: e.message });
  }
}

/**
 * Helper: Parse episode number from name
 * "Tập 1" → 1, "Tập 12" → 12, "Full" → null
 */
function parseEpisodeNumber(name) {
  if (!name) return null;
  const match = name.match(/\D+(\d+)/);
  return match ? parseInt(match[1]) : null;
}
