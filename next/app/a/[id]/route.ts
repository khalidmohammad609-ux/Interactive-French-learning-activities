import { htmlResponse, messagePage } from '@/lib/html';
import { activityHtml } from '@/lib/pages';

/** One activity, with web/bridge.js added so each finished level is saved. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const page = await activityHtml(id);
    if (!page) return messagePage('😕 Activity not found', 'There is no activity called "' + id + '". Ask your teacher for the link.', 404);
    return htmlResponse(page.html);
  } catch (e) {
    console.error(e);
    return messagePage('😕 This page could not load', 'Please try again in a minute.', 503);
  }
}
