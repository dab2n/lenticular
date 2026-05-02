import { ok } from '../utils/cors.js';

/**
 * POST /api/share
 * FormData: img1 (File, 필수), img2 (File, 선택), message (string), isLandscape (string)
 * → R2에 {uuid}/img1, {uuid}/img2?, {uuid}/meta.json 저장
 * → { uuid } 반환
 */
export async function postShare(request, env) {
  let form;
  try {
    form = await request.formData();
  } catch {
    return new Response('Invalid form data', { status: 400 });
  }

  const img1 = form.get('img1');
  const img2 = form.get('img2');
  const message = form.get('message') ?? '';
  const isLandscape = form.get('isLandscape') === 'true';

  if (!img1) return new Response('img1 is required', { status: 400 });

  const uuid = crypto.randomUUID();

  const jobs = [
    env.LENTICULAR_BUCKET.put(`${uuid}/img1`, img1.stream(), {
      httpMetadata: { contentType: img1.type || 'image/png' },
    }),
    env.LENTICULAR_BUCKET.put(
      `${uuid}/meta.json`,
      JSON.stringify({ message, isLandscape, hasImg2: !!img2, createdAt: Date.now() }),
      { httpMetadata: { contentType: 'application/json' } }
    ),
  ];

  if (img2) {
    jobs.push(
      env.LENTICULAR_BUCKET.put(`${uuid}/img2`, img2.stream(), {
        httpMetadata: { contentType: img2.type || 'image/png' },
      })
    );
  }

  await Promise.all(jobs);

  return ok(JSON.stringify({ uuid }), { 'Content-Type': 'application/json' });
}
