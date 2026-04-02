/**
 * Episodes Resolver v2 (API-based)
 * Contract: getEpisodes(filmUrl) → JSON { episodes: [...] } with nested servers
 * Source: GET /baseapi/api/v1/episodes/by-idMovie/{movieId}
 * 
 * Two-step process:
 * 1. Get movie by slug to extract movieId
 * 2. Fetch episodes for that movieId
 */
async function getEpisodes(filmUrl) {
  const BASE_API = 'https://rophim10.com.mx/baseapi/api/v1';
  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
  const SITE_BASE = 'https://rophim10.com.mx';

  try {
    console.log(`[KENG][RoPhim10] getEpisodes: ${filmUrl}`);

    // Step 1: Extract slug and get movieId
    const slugMatch = filmUrl.match(/\/phim\/([^/?]+)/);
    if (!slugMatch) {
      return JSON.stringify({ error: 'Invalid film URL format' });
    }

    const slug = slugMatch[1];
    const detailUrl = `${BASE_API}/movies/by-slug/${slug}`;
    
    const detailResponse = await fetch(detailUrl, {
      headers: { 'User-Agent': UA }
    });

    if (!detailResponse.ok) {
      throw new Error(`Failed to get movie detail: ${detailResponse.status}`);
    }

    const detailData = await detailResponse.json();
    // API response: { movie: {...}, meta: {...} }
    if (!detailData || !detailData.movie) {
      return JSON.stringify({ error: 'No movie found' });
    }

    const movieId = detailData.movie.id;
    const movieSlug = detailData.movie.slug || slug;
    if (!movieId) {
      return JSON.stringify({ error: 'Cannot extract movieId' });
    }

    // Step 2: Fetch episodes
    const episodesUrl = `${BASE_API}/episodes/by-idMovie/${movieId}`;
    const episodesResponse = await fetch(episodesUrl, {
      headers: { 'User-Agent': UA }
    });

    if (!episodesResponse.ok) {
      throw new Error(`Failed to get episodes: ${episodesResponse.status}`);
    }

    const episodesData = await episodesResponse.json();

    // API response: array of episode objects directly (not wrapped)
    // Each item: { id, name, server, slug, season_number, poster, air_date }
    const episodeItems = Array.isArray(episodesData)
      ? episodesData
      : (episodesData.result || episodesData.data || []);

    if (!Array.isArray(episodeItems) || episodeItems.length === 0) {
      return JSON.stringify([]);
    }

    // Transform to nested format: group servers by episode name/number
    const episodeMap = new Map();

    for (const item of episodeItems) {
      const epNum = parseEpisodeNumber(item.name);
      const epKey = epNum !== null ? epNum : item.name; // fallback to name for 'Full'

      if (!episodeMap.has(epKey)) {
        episodeMap.set(epKey, {
          episode_index: epNum !== null ? epNum - 1 : 0,
          name: item.name,
          servers: []
        });
      }

      const ep = episodeMap.get(epKey);
      if (item.server && item.id) {
        // Watch URL: /xem-phim/{slug}.{episodeId}
        const watchUrl = SITE_BASE + '/xem-phim/' + movieSlug + '.' + item.id;
        ep.servers.push({
          server: item.server.replace(/:$/, ''),  // Remove trailing :
          url: watchUrl
        });
      }
    }

    // Convert to sorted array
    const episodes = Array.from(episodeMap.values())
      .sort((a, b) => a.episode_index - b.episode_index);

    console.log(`[KENG][RoPhim10] getEpisodes: returned ${episodes.length} episodes`);
    return JSON.stringify(episodes);

  } catch (e) {
    console.error(`[KENG][RoPhim10] getEpisodes ERROR: ${e.message}`);
    return JSON.stringify({ error: e.message });
  }
}

/**
 * Helper: Parse episode number from name
 * "Tập 1" → 1, "Tập 12" → 12, "Special" → null
 */
function parseEpisodeNumber(name) {
  if (!name) return null;
  const match = name.match(/\D+(\d+)/);
  return match ? parseInt(match[1]) : null;
}
