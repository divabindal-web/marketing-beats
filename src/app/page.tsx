import { redirect } from 'next/navigation';

export default function Home() {
  // Overview adapts to the signed-in role; the design-ops dashboard is only
  // right for people whose job is the request queue.
  redirect('/overview');
}
