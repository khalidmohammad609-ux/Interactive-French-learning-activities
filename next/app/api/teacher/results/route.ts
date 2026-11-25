import { json } from '@/lib/api';
import { teacherOnly } from '@/lib/auth';
import { teacherResults } from '@/lib/results';

export async function GET() {
  return (await teacherOnly()) || json(teacherResults);
}
