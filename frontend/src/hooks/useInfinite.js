import { useCallback, useEffect, useRef, useState } from 'react';
import api from '@/utils/api';

/**
 * Paginated + infinite-scroll data hook.
 * `endpoint` is a path like '/admin/users'; params are merged with skip/limit.
 * Returns { items, loading, done, ref, reload, search, setSearch }.
 */
export default function useInfinite(endpoint, params = {}, pageSize = 20) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const skipRef = useRef(0);
  const paramsKey = JSON.stringify(params);
  const activeRef = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async (reset) => {
    setLoading(true);
    const req = ++activeRef.current;
    if (reset) skipRef.current = 0;
    try {
      const { data } = await api.get(endpoint, {
        params: { ...params, search: debounced || undefined, skip: skipRef.current, limit: pageSize },
      });
      if (req !== activeRef.current) return; // stale
      const list = Array.isArray(data) ? data : data.items || [];
      setItems(prev => (reset ? list : [...prev, ...list]));
      skipRef.current += list.length;
      setDone(list.length < pageSize);
    } catch {
      if (req === activeRef.current) setDone(true);
    }
    if (req === activeRef.current) setLoading(false);
  }, [endpoint, paramsKey, debounced, pageSize]);

  useEffect(() => { load(true); /* eslint-disable-next-line */ }, [paramsKey, debounced]);

  // IntersectionObserver sentinel
  const sentinel = useRef(null);
  useEffect(() => {
    if (done || loading) return;
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) load(false);
    }, { threshold: 0.1 });
    io.observe(el);
    return () => io.disconnect();
  }, [done, loading, load]);

  return { items, loading, done, sentinelRef: sentinel, reload: () => load(true), search, setSearch };
}
