// Story 10-13 | RoPhim10 | Rail Group All — v2 (API-based)
// Contract: railGroupAll() -> JSON { rails: [...] }
// Performance: 1 JS call → 9 rails (v5: 9 JS calls)

/**
 * Main rail group resolver
 * Fetches all home screen rails via APIs
 * v6 contract: returns array of rail objects with embedded movies
 * 
 * Fallback strategy:
 * - Try API endpoints first
 * - Fall back to HTML parsing if APIs unavailable  
 * - Skip unavailable rails gracefully
 */
async function railGroupAll() {
  // ===== CONSTANTS (Must be inside function to avoid WebView scope conflicts) =====
  const SITE_BASE = 'https://rophim10.com.mx';
  const BASE_API = 'https://rophim10.com.mx/baseapi/api/v1';
  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

  console.log('[KENG][RoPhim10] railGroupAll() v6 — API-based');

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
      title_original: apiMovie.origin_name || '',  // Fixed: was original_title
      poster_url: apiMovie.poster || apiMovie.thumbnail || '',  // Prefer poster (landscape) for home rails
      url: apiMovie.slug ? `${SITE_BASE}/phim/${apiMovie.slug}` : '',
      media_type: apiMovie.type === 'series' ? 'series' : 'movie',  // Fixed: was movie_type
      badge_text: '',  // Added: required field
      badge_sub: '',   // Added: required field
      year: String(apiMovie.publish_year || ''),  // Fixed: convert to string
      rating: String(apiMovie.imdb_rating || ''),  // Fixed: was imdb_rating, convert to string
      synopsis: '',  // Added: required field
      age_rating: '',  // Added: required field
      episode_current: apiMovie.episode_current || '',
      genres: []  // Added: required field
    };
  }

  const rails = [];
  const errors = [];
  
  try {
    // ===== OPTION: API-Based Rails (Homepage Lists API) =====
    // Fetch structured rail data directly from API
    // No longer relying on HTML parsing as app doesn't pass HTML
    try {
        console.log('[KENG][RoPhim10] Fetching rails from Homepage Lists API...');
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
            
            // CTA config: rails that have show_cta enabled
            const ctaConfig = {
              'korean':  { js_method: 'getAllKorean' },
              'chinese': { js_method: 'getAllChinese' },
              'usuk':    { js_method: 'getAllUsuk' },
              'cinema':  { js_method: 'getAllCinema' },
            };

            for (const apiList of apiData.result.collections) {
              const slug = apiList.slug || '';
              const railConfig = railMap[slug];
              
              if (railConfig && apiList.movies && Array.isArray(apiList.movies)) {
                const movies = apiList.movies.slice(0, railConfig.limit).map(transformApiMovie);
                
                if (movies.length > 0) {
                  const railId = railConfig.id;
                  const showCta = ctaConfig[railId] ? { js_method: ctaConfig[railId].js_method } : null;
                  apiRails.push({
                    id: railId,
                    title: apiList.name || railId,
                    subtitle: null,
                    card_height_percent: 0.18,
                    card_size_ratio: 1.5,
                    is_hero_source: railConfig.is_hero_source || false,
                    show_rank: railConfig.show_rank || false,
                    movies: movies,
                    show_cta: showCta
                  });
                  
                  console.log('[KENG][RoPhim10] API rail: ' + railId + ' (' + movies.length + ' movies) cta=' + (showCta ? showCta.js_method : 'null'));
                }
              }
            }
            
            if (apiRails.length > 0) {
              rails.push(...apiRails);
              console.log('[KENG][RoPhim10] Loaded ' + apiRails.length + ' rails from Homepage Lists API');
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
      console.warn('[KENG][RoPhim10] No rails found');
      errors.forEach(e => console.warn('[KENG][RoPhim10] ' + e));

      // Error format per contract: { error: '...' } — NOT { rails: [], error: '...' }
      return JSON.stringify({
        error: 'Could not fetch any rails. Errors: ' + errors.join('; ')
      });
    }

    // Validate & return plain array per v6 Rail Group Contract
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

    console.log('[KENG][RoPhim10] Returning ' + validRails.length + ' rails');
    return JSON.stringify(validRails);  // Plain array, NOT { rails: [...] }
    
  } catch (e) {
    console.error('[KENG][RoPhim10] railGroupAll() FATAL: ' + e.message);
    return JSON.stringify({
      error: 'Fatal error: ' + e.message
    });
  }
}

// =============================================================================
// CTA Functions — "Xem tất cả" handlers
// API: GET /movies/by-region/{slug}?page={n}  (public, no auth)
// API: GET /movies/by-category/{slug}?page={n} (public, no auth)
// Contract: (page: number) → JSON.stringify(movies[]) | '[]' when exhausted
// =============================================================================

/**
 * Shared CTA helper — fetches a paginated movie list from a public API endpoint
 * @param {string} url - Full API URL with page param
 * @param {string} label - Log label
 */
async function _fetchCtaMovies(url, label) {
  const SITE_BASE = 'https://rophim10.com.mx';
  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

  function transformCtaMovie(apiMovie) {
    return {
      rank: 0,
      title: apiMovie.name || '',
      title_original: apiMovie.origin_name || '',
      poster_url: apiMovie.thumbnail || apiMovie.poster || '',  // Prefer thumbnail (portrait) for CTA
      url: apiMovie.slug ? SITE_BASE + '/phim/' + apiMovie.slug : '',
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

  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!r.ok) {
      console.warn('[KENG][RoPhim10] ' + label + ' HTTP ' + r.status);
      return JSON.stringify([]);
    }
    const data = await r.json();
    const items = data.result || [];
    if (!Array.isArray(items) || items.length === 0) {
      return JSON.stringify([]);
    }
    const movies = items.map(transformCtaMovie).filter(m => m.title && m.url);
    console.log('[KENG][RoPhim10] ' + label + ' page movies: ' + movies.length);
    return JSON.stringify(movies);
  } catch (e) {
    console.error('[KENG][RoPhim10] ' + label + ' error: ' + e.message);
    return JSON.stringify([]);
  }
}

async function getAllKorean(page) {
  const p = page || 1;
  return _fetchCtaMovies(
    'https://rophim10.com.mx/baseapi/api/v1/movies/by-region/han-quoc?page=' + p,
    'getAllKorean p=' + p
  );
}

async function getAllChinese(page) {
  const p = page || 1;
  return _fetchCtaMovies(
    'https://rophim10.com.mx/baseapi/api/v1/movies/by-region/trung-quoc?page=' + p,
    'getAllChinese p=' + p
  );
}

async function getAllUsuk(page) {
  const p = page || 1;
  return _fetchCtaMovies(
    'https://rophim10.com.mx/baseapi/api/v1/movies/by-region/au-my?page=' + p,
    'getAllUsuk p=' + p
  );
}

async function getAllCinema(page) {
  const p = page || 1;
  return _fetchCtaMovies(
    'https://rophim10.com.mx/baseapi/api/v1/movies/by-category/chieu-rap?page=' + p,
    'getAllCinema p=' + p
  );
}
