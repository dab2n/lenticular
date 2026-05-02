import { ok } from '../utils/cors.js';

/**
 * GET /api/share/:uuid
 * → R2에서 meta.json을 읽어 { img1Url, img2Url, message, isLandscape } 반환
 */
export async function getMeta(uuid, env) {
  const obj = await env.LENTICULAR_BUCKET.get(`${uuid}/meta.json`);
  if (!obj) return new Response('Not found', { status: 404 });

  const meta = await obj.json();

  return ok(
    JSON.stringify({
      img1Url:     `/api/share/${uuid}/img1`,
      img2Url:     meta.hasImg2 ? `/api/share/${uuid}/img2` : null,
      message:     meta.message,
      isLandscape: meta.isLandscape,
    }),
    { 'Content-Type': 'application/json' }
  );
}

/**
 * GET /api/share/:uuid/img1  |  /api/share/:uuid/img2
 * → R2에서 이미지를 읽어 프록시로 응답 (캐시 1년)
 */
export async function getImage(uuid, key, env) {
  const obj = await env.LENTICULAR_BUCKET.get(`${uuid}/${key}`);
  if (!obj) return new Response('Not found', { status: 404 });

  return new Response(obj.body, {
    headers: {
      'Content-Type': obj.httpMetadata?.contentType || 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
