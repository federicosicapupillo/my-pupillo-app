import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SLOT_LABELS, type AvailabilityRow, type AvailabilityExceptionRow } from '@/lib/availability';
import { toIso } from '@/lib/availability-calendar';
import { upcomingAvailabilityDates } from '@/lib/worker-calendar-availability';
import { formatWorkerAvailabilityByDay } from '@/lib/worker-availability-summary';
import { formatAvailabilitySlotsForDay } from '@/lib/availability-summary';

export function WorkerAvailabilityList({ rows, exceptions, weekly = null }: {
  rows: AvailabilityRow[]; exceptions: AvailabilityExceptionRow[]; weekly?: string[] | null;
}) {
  const dates = upcomingAvailabilityDates(exceptions);
  const realDays = formatWorkerAvailabilityByDay(rows);
  const days = realDays.length ? realDays : formatAvailabilitySlotsForDay(weekly);
  return <div className="space-y-4 text-sm">
    {dates.length > 0 && <section className="space-y-2">
      <h3 className="font-medium">Disponibilità per data</h3>
      <ul className="space-y-2">
        {dates.map(({ date, available, entries }) => <li key={date} className="border-b py-2 last:border-b-0">
          <p className="font-medium">{new Date(`${date}T00:00:00`).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}</p>
          {!available ? <p className="text-muted-foreground">Non disponibile</p> : entries.map(e => <p key={e.id} className="break-words text-muted-foreground">
            {[e.time_slot ? SLOT_LABELS[e.time_slot] : 'Disponibile', e.start_time && e.end_time ? `${e.start_time.slice(0,5)} – ${e.end_time.slice(0,5)}` : '', e.city, e.district].filter(Boolean).join(' · ')}
          </p>)}
        </li>)}
      </ul>
    </section>}
    {days.length > 0 && <section className="space-y-2">
      <h3 className="font-medium">Disponibilità settimanale di base</h3>
      {days.map(d => <div key={d.day} className="flex flex-wrap gap-x-3 gap-y-1 border-b py-2 last:border-b-0">
        <span className="font-medium">{d.day}</span>
        <span className="text-muted-foreground">{d.slots.map(s => [s.label,s.hours].filter(Boolean).join(' · ')).join(' / ')}</span>
      </div>)}
    </section>}
    {!dates.length && !days.length && <p className="text-muted-foreground">Disponibilità non indicata.</p>}
  </div>;
}

export function PublicWorkerAvailability({ workerId, weekly = null }: { workerId: string; weekly?: string[] | null }) {
  const [data, setData] = useState<{ rows: AvailabilityRow[]; exceptions: AvailabilityExceptionRow[] } | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    setData(null); setError(false);
    void Promise.all([
      supabase.rpc('search_worker_availability_public', { _worker_ids: [workerId] }),
      supabase.rpc('search_worker_availability_exceptions_public', { _worker_ids: [workerId], _from_date: toIso(new Date()) }),
    ]).then(([rows, exceptions]) => {
      if (!active) return;
      if (rows.error || exceptions.error) { setError(true); return; }
      setData({ rows: (rows.data ?? []) as AvailabilityRow[], exceptions: (exceptions.data ?? []) as AvailabilityExceptionRow[] });
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [workerId]);
  if (error) return <p role="alert" className="text-sm text-destructive">Impossibile caricare le disponibilità.</p>;
  if (!data) return <p className="text-sm text-muted-foreground">Caricamento disponibilità…</p>;
  return <WorkerAvailabilityList {...data} weekly={weekly} />;
}