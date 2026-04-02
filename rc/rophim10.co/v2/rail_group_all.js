// Story 10-13 | RoPhim10 | Rail Group All — v2 (API-based)
// Contract: railGroupAll() -> JSON { rails: [...] }
// Performance: 1 JS call → 9 rails (v5: 9 JS calls)

/**
 * Main rail group resolver
 * Fetches all home screen rails via APIs
 * v6 contract: returns array of rail objects with embedded movies
 */
async function railGroupAll() {
  // ===== CONSTANTS (Must be inside function to avoid WebView scope conflicts) =====
  const SITE_BASE = 'https://rophim10.co';
  const BASE_API = 'https://rophim10.co/baseapi/api/v1';
  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

  console.log('[KENG][RoPhim] railGroupAll() v6 — API-based');

  /**
   * Transform API movie to movie-data-contract format
   * Strict mapping per docs/json-schema-contract/movie-data-contract.md
   * @param {object} apiMovie - API response movie object
   * @returns {object} Contract-compliant movie object
   */
  function transformApiMovie(apiMovie) {
    return {
      rank: 0,  // No rank in grouped view
      title: apiMovie.name || '',
      title_original: apiMovie.origin_name || '',
      poster_url: apiMovie.poster || apiMovie.thumbnail || '',
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
    };
  }

  const rails = [];
  const errors = [];
  
  try {
    // ===== API-Based Rails (Homepage Lists API) =====
    try {
        console.log('[KENG][RoPhim] Fetching rails from Homepage Lists API...');
        const apiUrl = BASE_API + '/lists/homepageLists?page=1&limit=50';
        const apiResponse = await fetch(apiUrl, {
          headers: { 'User-Agent': UA }
        });
        
        if (apiResponse.ok) {
          const apiData = await apiResponse.json();
          
          // API structure: { status, result: { collections: [{ slug, name, movies: [...] }] } }
          if (apiData && apiData.result && apiData.result.collections && Array.isArray(apiData.result.collections)) {
            const apiRails = [];
            const railMap = {
              'phim-sap-toi': { id: 'phim_hot', is_hero_source: true, limit: 20 },
              'phim-dien-anh-moi-coong': { id: 'cinema', limit: 16 },
              'top-10-phim-bo-hom-nay': { id: 'top10_series', show_rank: true, limit: 10 },
              'top-10-movies': { id: 'top10_movies', show_rank: true, limit: 10 },
              'new-series': { id: 'new_series', limit: 12 },
              'new-movies': { id: 'new_movies', limit: 12 },
              'phim-han-quoc-moi': { id: 'korean', limit: 12 },
              'phim-trung-quoc-moi': { id: 'chinese', limit: 12 },
              'au-my': { id: 'usuk', limit: 12 }
            };
            
            for (const apiList of apiData.result.collections) {
              const slug = apiList.slug || '';
              const railConfig = railMap[slug];
              
              if (railConfig && apiList.movies && Array.isArray(apiList.movies)) {
                const movies = apiList.movies.slice(0, railConfig.limit).map(transformApiMovie);
                
                if (movies.length > 0) {
                  apiRails.push({
                    id: railConfig.id,
                    title: apiList.name || railConfig.id,
                    subtitle: null,
                    card_height_percent: 0.18,
                    card_size_ratio: 0.667,
                    is_hero_source: railConfig.is_hero_source || false,
                    show_rank: railConfig.show_rank || false,
                    movies: movies,
                    show_cta: null
                  });
                  
                  console.log('[KENG][RoPhim] API rail: ' + railConfig.id + ' (' + movies.length + ' movies)');
                }
              }
            }
            
            if (apiRails.length > 0) {
              rails.push(...apiRails);
              console.log('[KENG][RoPhim] Loaded ' + apiRails.length + ' rails from Homepage Lists API');
            }
          }
        } else {
          errors.push('Homepage Lists API returned ' + apiResponse.status);
        }
    } catch (e) {
        errors.push('Homepage Lists API error: ' + e.message);
    }
    
    // ===== RESPONSE =====
    if (rails.length === 0) {
      console.warn('[KENG][RoPhim] No rails found');
      errors.forEach(e => console.warn('[KENG][RoPhim] ' + e));
      
      return JSON.stringify({
        rails: [],
        error: 'Could not fetch any rails. Errors: ' + errors.join('; ')
      });
    }
    
    // Validate & return
    const validRails = rails.map(rail => ({
      id: rail.id || 'unknown',
      title: rail.title || 'Untitled Rail',
      subtitle: rail.subtitle || null,
      card_height_percent: rail.card_height_percent || 0.18,
      card_size_ratio: rail.card_size_ratio || 0.667,
      is_hero_source: rail.is_hero_source || false,
      show_rank: rail.show_rank || false,
      movies: Array.isArray(rail.movies) ? rail.movies : [],
      show_cta: rail.show_cta || null
    }));
    
    console.log('[KENG][RoPhim] Returning ' + validRails.length + ' rails');
    return JSON.stringify({ rails: validRails });
    
  } catch (e) {
    console.error('[KENG][RoPhim] railGroupAll() FATAL: ' + e.message);
    return JSON.stringify({
      error: 'Fatal error: ' + e.message
    });
  }
}
