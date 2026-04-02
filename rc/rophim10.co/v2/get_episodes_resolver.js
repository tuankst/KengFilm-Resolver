// Story 10-13 | RoPhim10 | Episodes Resolver — v2 (Pure API)
// Contract: getEpisodes(filmUrl) -> JSON array of episodes with nested servers
// Option 1: Pure API approach (Detail API → Episodes API)
// API Chain:
//   1. GET /baseapi/api/v1/movies/by-slug/{slug} → get movieId
//   2. GET /baseapi/api/v1/episodes/by-idMovie/{movieId} → get episodes

async function getEpisodes(filmUrl) {
  const SITE_BASE = 'https://rophim10.co';
  const BASE_API = 'https://rophim10.co/baseapi/api/v1';
  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

  async function apiFetch(url) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error('API fetch failed ' + res.status + ': ' + url);
    return res.json();
  }

  try {
    console.log('[KENG][RoPhim] getEpisodes v2 (Pure API): ' + filmUrl);

    // Step 1: Extract slug from filmUrl
    const slugMatch = filmUrl.match(/\/phim\/([^/?#]+)/);
    if (!slugMatch) {
      throw new Error('Invalid film URL format: ' + filmUrl);
    }
    const slug = slugMatch[1];
    console.log('[KENG][RoPhim] Slug: ' + slug);

    // Step 2: Get movie detail to obtain movieId
    const detailUrl = BASE_API + '/movies/by-slug/' + slug;
    console.log('[KENG][RoPhim] Fetching Detail API...');
    const detailData = await apiFetch(detailUrl);

    const movieId = detailData.movie?.id;
    if (!movieId) {
      throw new Error('Movie ID not found in Detail API response');
    }
    console.log('[KENG][RoPhim] Movie ID: ' + movieId);

    // Step 3: Fetch episodes using movieId
    const episodesUrl = BASE_API + '/episodes/by-idMovie/' + movieId;
    console.log('[KENG][RoPhim] Fetching Episodes API...');
    const episodesData = await apiFetch(episodesUrl);

    // Handle both response formats: direct array OR { status, result }
    const rawEpisodes = Array.isArray(episodesData)
      ? episodesData
      : (episodesData.result || []);

    if (rawEpisodes.length === 0) {
      console.log('[KENG][RoPhim] No episodes found');
      return JSON.stringify([]);
    }
    console.log('[KENG][RoPhim] API returned: ' + rawEpisodes.length + ' episode entries');

    // Step 4: Group episodes by name (multiple servers per episode)
    // API returns flat: [{ id, name, server, slug, ... }, ...]
    // Contract needs nested: [{ episode_index, name, servers: [...] }, ...]
    const episodeMap = {};

    for (const item of rawEpisodes) {
      const epName = item.name || item.slug || 'Unknown';

      if (!episodeMap[epName]) {
        episodeMap[epName] = [];
      }

      // Build episode URL: /xem-phim/{slug}.{episodeId}
      const epUrl = SITE_BASE + '/xem-phim/' + slug + '.' + item.id;

      // Clean server name (remove trailing colon)
      const serverName = (item.server || 'Default').replace(/:$/, '');

      episodeMap[epName].push({
        server: serverName,
        url: epUrl
      });
    }

    // Step 5: Convert to sorted array
    const episodeNames = Object.keys(episodeMap);

    // Sort numerically if possible
    episodeNames.sort(function(a, b) {
      const numA = parseInt(a) || 0;
      const numB = parseInt(b) || 0;
      if (numA !== numB) return numA - numB;
      return a.localeCompare(b);
    });

    const formattedEpisodes = episodeNames.map(function(epName, idx) {
      return {
        episode_index: idx,
        name: epName.match(/^Tập/) ? epName : 'Tập ' + epName,
        servers: episodeMap[epName]
      };
    });

    console.log('[KENG][RoPhim] SUCCESS: formatted ' + formattedEpisodes.length + ' episodes');
    return JSON.stringify(formattedEpisodes);

  } catch (e) {
    console.log('[KENG][RoPhim] getEpisodes ERROR: ' + e.message);
    return JSON.stringify([]);
  }
}
