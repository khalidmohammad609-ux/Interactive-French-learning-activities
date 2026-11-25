import { isTeacher } from '@/lib/auth';
import { htmlResponse, messagePage } from '@/lib/html';
import { teacherHtml } from '@/lib/pages';

/** Master page, behind the teacher login. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  if (!(await isTeacher())) return Response.redirect(new URL('/login', url), 303);
  try {
    return htmlResponse(await teacherHtml(url.origin));
  } catch (e) {
    console.error(e);
    return messagePage('😕 The master page could not load', String(e instanceof Error ? e.message : e), 503);
  }
}
