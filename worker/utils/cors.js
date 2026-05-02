export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

/** JSON 또는 텍스트 응답에 CORS 헤더를 붙여 반환 */
export function ok(body, extra = {}) {
  return new Response(body, {
    status: 200,
    headers: { ...CORS, ...extra },
  });
}

/** OPTIONS preflight 응답 */
export function preflight() {
  return new Response(null, { status: 204, headers: CORS });
}
