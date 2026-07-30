'use client';

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

// Unique channel topic per hook instance so two pages mounting during a
// navigation transition never collide on the same Realtime topic.
let channelSeq = 0;

/**
 * Live updates for request data.
 *
 * Calls `onChange` whenever a row in `requests` or `stage_transitions` changes
 * anywhere — any user, any device. This is what makes assignments and stage
 * moves propagate across open dashboards (member -> lead -> admin) without a
 * manual page refresh.
 *
 * Both tables must be in the `supabase_realtime` publication (they are, as of
 * the enable_realtime_requests_and_transitions migration). A single stage move
 * fires two events (the requests UPDATE + the stage_transitions INSERT), so the
 * callback is debounced to coalesce the burst into one refetch.
 */
export function useRequestsRealtime(onChange: () => void) {
  // Keep the latest callback without re-subscribing on every render.
  const cb = useRef(onChange);
  cb.current = onChange;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const ping = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => cb.current(), 250);
    };

    const channel = supabase
      .channel(`requests-live-${channelSeq++}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, ping)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stage_transitions' }, ping)
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, []);
}
