import { preflight } from './utils/cors.js';
import { postShare } from './handlers/postShare.js';
import { getMeta, getImage } from './handlers/getShare.js';

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') return preflight();

    // POST /api/share  — 이미지 업로드 & uuid 발급
    if (request.method === 'POST' && pathname === '/api/share') {
      return postShare(request, env);
    }

    if (request.method === 'GET') {
      // GET /api/share/:uuid/img1  |  /api/share/:uuid/img2  — 이미지 프록시
      const imgMatch = pathname.match(/^\/api\/share\/([^/]+)\/(img1|img2)$/);
      if (imgMatch) return getImage(imgMatch[1], imgMatch[2], env);

      // GET /api/share/:uuid  — 메타데이터(img URL, message, isLandscape)
      const metaMatch = pathname.match(/^\/api\/share\/([^/]+)$/);
      if (metaMatch) return getMeta(metaMatch[1], env);
    }

    return new Response('Not found', { status: 404 });
  },
};
