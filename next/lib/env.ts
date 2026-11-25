/** Settings, read from Vercel's Environment Variables. Never commit their values (public repo). */
export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  // Supabase calls these "publishable" / "secret" keys now; the older names also work.
  supabasePublicKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  supabaseSecretKey: process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  teacherEmail: (process.env.TEACHER_EMAIL || '').trim().toLowerCase(),
  /** Local testing only: no Supabase, data in memory, teacher pages open. Always refused on Vercel. */
  localMode: process.env.LOCAL_MODE === '1' && !process.env.VERCEL,
};

export function configured(): boolean {
  return !!(env.supabaseUrl && env.supabasePublicKey && env.supabaseSecretKey && env.teacherEmail);
}
