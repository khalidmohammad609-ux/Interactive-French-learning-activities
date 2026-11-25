import { htmlResponse, messagePage } from '@/lib/html';
import { homeHtml } from '@/lib/pages';

/** Student page. Old-style links (?a=<id>) go to /a/<id>. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const a = url.searchParams.get('a');
  if (a) return Response.redirect(new URL('/a/' + encodeURIComponent(a), url), 307);
  try {
    return htmlResponse(await homeHtml(url.origin));
  } catch (e) {
    console.error(e);
    return messagePage('😕 This page could not load', 'Please try again in a minute.', 503);
  }
}
