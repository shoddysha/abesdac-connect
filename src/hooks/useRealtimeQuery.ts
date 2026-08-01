import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

/**
 * Subscribes to Postgres changes on `table` and invalidates the given
 * query key whenever a row is inserted, updated, or deleted — so every
 * open tab / user re-fetches and re-renders automatically.
 */
export function useRealtimeQuery(table: string, queryKey: readonly unknown[]) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel(`realtime:${table}:${queryKey.join(':')}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        () => {
          queryClient.invalidateQueries({ queryKey });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, JSON.stringify(queryKey)]);
}
