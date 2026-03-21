/**
 * Get stream URL for a specific episode.
 * Rophimm does NOT expose direct stream files — use embed link instead.
 * 
 * @param {string|number} episodeId - The numeric episode ID from API (e.g. 350458)
 *   OR a full episode URL (e.g. "https://rophimm.me/xem-phim/truc-ngoc-tap-1-...")
 *   In the latter case, we extract the ID from the URL path.
 * @returns {string} JSON: { type: "embed", url: "...", headers: { Referer: "..." } }
 */
function getStreamUrl(episodeId) {
    try {
        // If episodeId is a full URL, extract the numeric ID from the last path segment
        let id = episodeId;
        if (typeof episodeId === 'string' && episodeId.startsWith('http')) {
            // URL format: https://rophimm.me/xem-phim/{slug}-tap-{n}-{id}
            // The numeric ID is the last segment after the final dash
            const parts = episodeId.split('/').pop().split('-');
            const lastPart = parts[parts.length - 1];
            if (/^\d+$/.test(lastPart)) {
                id = lastPart;
            } else {
                // Fallback: use the URL slug as-is for embed
                id = episodeId.split('/').pop();
            }
        }

        const embedUrl = 'https://rophim.chillcdn.top/embed/' + id;
        console.log('[JS] Stream URL (embed): ' + embedUrl);

        return JSON.stringify({
            type: 'embed',
            url: embedUrl,
            headers: { 'Referer': 'https://rophimm.me/' }
        });
    } catch (e) {
        return JSON.stringify({ error: e.message });
    }
}
