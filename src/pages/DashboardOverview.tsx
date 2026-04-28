import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichSchichtplan } from '@/lib/enrich';
import type { EnrichedSchichtplan } from '@/types/enriched';
import type { Schichtplan } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { LivingAppsService, createRecordUrl, extractRecordId } from '@/services/livingAppsService';
import { formatDate } from '@/lib/formatters';
import { useState, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { SchichtplanDialog } from '@/components/dialogs/SchichtplanDialog';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import {
  IconAlertCircle,
  IconTool,
  IconRefresh,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconPlus,
  IconPencil,
  IconTrash,
  IconCalendarWeek,
  IconUsers,
  IconBriefcase,
  IconClipboardList,
  IconCalendarPlus,
} from '@tabler/icons-react';
import { StatCard } from '@/components/StatCard';
import {
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  eachDayOfInterval,
  isSameDay,
  isToday,
  format,
} from 'date-fns';
import { de } from 'date-fns/locale';

const APPGROUP_ID = '69f08cc2357018322f8c56f9';
const REPAIR_ENDPOINT = '/claude/build/repair';

// Color palette for shift types
const SHIFT_COLORS = [
  { bg: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-300' },
  { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-300' },
  { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-300' },
  { bg: 'bg-rose-100', text: 'text-rose-800', border: 'border-rose-300' },
  { bg: 'bg-violet-100', text: 'text-violet-800', border: 'border-violet-300' },
  { bg: 'bg-sky-100', text: 'text-sky-800', border: 'border-sky-300' },
  { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300' },
  { bg: 'bg-teal-100', text: 'text-teal-800', border: 'border-teal-300' },
];

function getShiftColor(schichttypId: string, schichttypenIds: string[]) {
  const idx = schichttypenIds.indexOf(schichttypId);
  return SHIFT_COLORS[idx >= 0 ? idx % SHIFT_COLORS.length : 0];
}

export default function DashboardOverview() {
  const {
    mitarbeiter, schichttypen, schichtplan,
    mitarbeiterMap, schichttypenMap,
    loading, error, fetchAll,
  } = useDashboardData();

  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() =>
    startOfWeek(new Date(), { locale: de, weekStartsOn: 1 })
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<EnrichedSchichtplan | null>(null);
  const [prefillDate, setPrefillDate] = useState<string | null>(null);
  const [prefillMitarbeiterId, setPrefillMitarbeiterId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EnrichedSchichtplan | null>(null);

  const enrichedSchichtplan = enrichSchichtplan(schichtplan, { schichttypenMap, mitarbeiterMap });

  const weekDays = useMemo(() => {
    const end = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: currentWeekStart, end });
  }, [currentWeekStart]);

  const schichttypenIds = useMemo(() => schichttypen.map(s => s.record_id), [schichttypen]);

  // Stats
  const totalMitarbeiter = mitarbeiter.length;
  const totalSchichttypen = schichttypen.length;
  const schichtenDieseWoche = enrichedSchichtplan.filter(s => {
    if (!s.fields.datum) return false;
    const d = new Date(s.fields.datum);
    return d >= currentWeekStart && d <= endOfWeek(currentWeekStart, { weekStartsOn: 1 });
  }).length;
  const schichtenGesamt = enrichedSchichtplan.length;

  function openCreate(date?: string, mitarbeiterId?: string) {
    setEditEntry(null);
    setPrefillDate(date ?? null);
    setPrefillMitarbeiterId(mitarbeiterId ?? null);
    setDialogOpen(true);
  }

  function openEdit(entry: EnrichedSchichtplan) {
    setEditEntry(entry);
    setPrefillDate(null);
    setPrefillMitarbeiterId(null);
    setDialogOpen(true);
  }

  async function handleSubmit(fields: Schichtplan['fields']) {
    if (editEntry) {
      await LivingAppsService.updateSchichtplanEntry(editEntry.record_id, fields);
    } else {
      await LivingAppsService.createSchichtplanEntry(fields);
    }
    fetchAll();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await LivingAppsService.deleteSchichtplanEntry(deleteTarget.record_id);
    setDeleteTarget(null);
    fetchAll();
  }

  // Build defaultValues for dialog
  function buildDefaultValues() {
    if (editEntry) {
      return editEntry.fields;
    }
    const vals: Partial<Schichtplan['fields']> = {};
    if (prefillDate) vals.datum = prefillDate;
    if (prefillMitarbeiterId) vals.mitarbeiter = createRecordUrl(APP_IDS.MITARBEITER, prefillMitarbeiterId);
    return Object.keys(vals).length > 0 ? vals : undefined;
  }

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  return (
    <div className="space-y-6">
      {/* Workflow Navigation */}
      <div className="grid grid-cols-1 gap-3">
        <a
          href="#/intents/schichtplan-erstellen"
          className="flex items-center gap-4 bg-card border border-border border-l-4 border-l-primary rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <IconCalendarPlus size={20} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-foreground text-sm">Schichtplan erstellen</div>
            <div className="text-xs text-muted-foreground mt-0.5">Datum wählen, Mitarbeiter einplanen und Schichten auf einmal anlegen</div>
          </div>
          <IconChevronRight size={18} className="text-muted-foreground shrink-0" />
        </a>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title="Mitarbeiter"
          value={String(totalMitarbeiter)}
          description="Aktiv im System"
          icon={<IconUsers size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Schichttypen"
          value={String(totalSchichttypen)}
          description="Definierte Schichten"
          icon={<IconBriefcase size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Diese Woche"
          value={String(schichtenDieseWoche)}
          description="Geplante Schichten"
          icon={<IconCalendarWeek size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Gesamt"
          value={String(schichtenGesamt)}
          description="Alle Schichteinträge"
          icon={<IconClipboardList size={18} className="text-muted-foreground" />}
        />
      </div>

      {/* Weekly Planner */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentWeekStart(subWeeks(currentWeekStart, 1))}
              className="p-1.5 rounded-lg hover:bg-accent transition-colors"
            >
              <IconChevronLeft size={16} />
            </button>
            <h2 className="font-semibold text-sm text-foreground">
              KW {format(currentWeekStart, 'w', { locale: de })} &mdash;{' '}
              {format(currentWeekStart, 'dd.MM.', { locale: de })} – {format(endOfWeek(currentWeekStart, { weekStartsOn: 1 }), 'dd.MM.yyyy', { locale: de })}
            </h2>
            <button
              onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))}
              className="p-1.5 rounded-lg hover:bg-accent transition-colors"
            >
              <IconChevronRight size={16} />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentWeekStart(startOfWeek(new Date(), { locale: de, weekStartsOn: 1 }))}
              className="text-xs"
            >
              Heute
            </Button>
            <Button size="sm" onClick={() => openCreate()} className="text-xs">
              <IconPlus size={14} className="mr-1 shrink-0" />
              <span className="hidden sm:inline">Schicht</span> hinzufügen
            </Button>
          </div>
        </div>

        {/* Calendar Grid — Employee × Day */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-3 py-2 font-medium text-muted-foreground w-32 bg-muted/20">
                  Mitarbeiter
                </th>
                {weekDays.map(day => (
                  <th
                    key={day.toISOString()}
                    className={`px-2 py-2 text-center font-medium text-xs ${isToday(day) ? 'text-primary' : 'text-muted-foreground'}`}
                  >
                    <div className="font-semibold">
                      {format(day, 'EEE', { locale: de })}
                    </div>
                    <div className={`text-base font-bold mt-0.5 w-7 h-7 flex items-center justify-center mx-auto rounded-full ${isToday(day) ? 'bg-primary text-primary-foreground' : ''}`}>
                      {format(day, 'd')}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mitarbeiter.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-muted-foreground text-sm">
                    <IconUsers size={32} className="mx-auto mb-2 opacity-30" stroke={1.5} />
                    Keine Mitarbeiter vorhanden. Lege zuerst Mitarbeiter an.
                  </td>
                </tr>
              ) : (
                mitarbeiter.map((ma, maIdx) => {
                  const fullName = [ma.fields.vorname, ma.fields.nachname].filter(Boolean).join(' ') || ma.fields.personalnummer || ma.record_id;
                  return (
                    <tr key={ma.record_id} className={`border-b border-border/60 ${maIdx % 2 === 0 ? '' : 'bg-muted/10'}`}>
                      <td className="px-3 py-2 font-medium text-foreground truncate max-w-[128px]" title={fullName}>
                        {fullName}
                      </td>
                      {weekDays.map(day => {
                        const dayStr = format(day, 'yyyy-MM-dd');
                        const shifts = enrichedSchichtplan.filter(s => {
                          if (!s.fields.datum) return false;
                          const sDate = s.fields.datum.slice(0, 10);
                          const sId = extractRecordId(s.fields.mitarbeiter);
                          return sDate === dayStr && sId === ma.record_id;
                        });

                        return (
                          <td
                            key={day.toISOString()}
                            className={`px-1 py-1.5 align-top ${isToday(day) ? 'bg-primary/5' : ''}`}
                            style={{ minWidth: '80px' }}
                          >
                            <div className="flex flex-col gap-1">
                              {shifts.map(shift => {
                                const stId = extractRecordId(shift.fields.schichttyp) ?? '';
                                const color = getShiftColor(stId, schichttypenIds);
                                return (
                                  <div
                                    key={shift.record_id}
                                    className={`group relative px-1.5 py-1 rounded-lg border text-xs leading-tight cursor-pointer ${color.bg} ${color.text} ${color.border}`}
                                    onClick={() => openEdit(shift)}
                                  >
                                    <div className="font-semibold truncate max-w-full">
                                      {shift.schichttypName || 'Schicht'}
                                    </div>
                                    {schichttypenMap.get(extractRecordId(shift.fields.schichttyp) ?? '')?.fields?.startzeit && (
                                      <div className="opacity-70 text-[10px]">
                                        {schichttypenMap.get(extractRecordId(shift.fields.schichttyp) ?? '')?.fields?.startzeit}
                                        {schichttypenMap.get(extractRecordId(shift.fields.schichttyp) ?? '')?.fields?.endzeit
                                          ? `–${schichttypenMap.get(extractRecordId(shift.fields.schichttyp) ?? '')?.fields?.endzeit}`
                                          : ''}
                                      </div>
                                    )}
                                    <button
                                      className={`absolute top-0.5 right-0.5 p-0.5 rounded opacity-60 hover:opacity-100 transition-opacity ${color.text}`}
                                      onClick={e => { e.stopPropagation(); setDeleteTarget(shift); }}
                                      title="Löschen"
                                    >
                                      <IconTrash size={10} />
                                    </button>
                                  </div>
                                );
                              })}
                              {/* Add shift button */}
                              <button
                                className="w-full flex items-center justify-center py-1 rounded-lg border border-dashed border-border/50 text-muted-foreground hover:bg-accent/50 hover:border-border transition-colors"
                                onClick={() => openCreate(dayStr, ma.record_id)}
                                title="Schicht hinzufügen"
                              >
                                <IconPlus size={12} />
                              </button>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Shift Types Legend */}
      {schichttypen.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-4">
          <h3 className="font-semibold text-sm text-foreground mb-3">Schichttypen</h3>
          <div className="flex flex-wrap gap-2">
            {schichttypen.map((st, idx) => {
              const color = SHIFT_COLORS[idx % SHIFT_COLORS.length];
              return (
                <div key={st.record_id} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${color.bg} ${color.text} ${color.border}`}>
                  <span>{st.fields.schichtname || '—'}</span>
                  {(st.fields.startzeit || st.fields.endzeit) && (
                    <span className="opacity-60">
                      {st.fields.startzeit}{st.fields.endzeit ? `–${st.fields.endzeit}` : ''}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Upcoming Shifts (next 7 days) */}
      <UpcomingShifts enrichedSchichtplan={enrichedSchichtplan} onEdit={openEdit} onDelete={setDeleteTarget} />

      {/* Dialogs */}
      <SchichtplanDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleSubmit}
        defaultValues={buildDefaultValues()}
        mitarbeiterList={mitarbeiter}
        schichttypenList={schichttypen}
        enablePhotoScan={AI_PHOTO_SCAN['Schichtplan']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Schichtplan']}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Schicht löschen"
        description={`Schicht von ${deleteTarget?.mitarbeiterName || '—'} am ${deleteTarget?.fields.datum ? formatDate(deleteTarget.fields.datum) : '—'} wirklich löschen?`}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function UpcomingShifts({
  enrichedSchichtplan,
  onEdit,
  onDelete,
}: {
  enrichedSchichtplan: EnrichedSchichtplan[];
  onEdit: (entry: EnrichedSchichtplan) => void;
  onDelete: (entry: EnrichedSchichtplan) => void;
}) {
  const today = new Date();
  const in7Days = new Date(today);
  in7Days.setDate(today.getDate() + 7);

  const upcoming = enrichedSchichtplan
    .filter(s => {
      if (!s.fields.datum) return false;
      const d = new Date(s.fields.datum);
      return d >= today && d <= in7Days;
    })
    .sort((a, b) => (a.fields.datum ?? '').localeCompare(b.fields.datum ?? ''));

  if (upcoming.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <h3 className="font-semibold text-sm text-foreground mb-3">Nächste 7 Tage</h3>
      <div className="space-y-2">
        {upcoming.slice(0, 10).map(s => (
          <div key={s.record_id} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
            <div className="w-16 shrink-0 text-xs font-semibold text-muted-foreground">
              {s.fields.datum ? formatDate(s.fields.datum) : '—'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm text-foreground truncate">{s.mitarbeiterName || '—'}</div>
              <div className="text-xs text-muted-foreground truncate">{s.schichttypName || '—'}</div>
            </div>
            {s.fields.notizen && (
              <div className="hidden sm:block text-xs text-muted-foreground truncate max-w-[160px]">{s.fields.notizen}</div>
            )}
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => onEdit(s)}
                className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground"
                title="Bearbeiten"
              >
                <IconPencil size={14} />
              </button>
              <button
                onClick={() => onDelete(s)}
                className="p-1.5 rounded-lg hover:bg-destructive/10 hover:text-destructive transition-colors text-muted-foreground"
                title="Löschen"
              >
                <IconTrash size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}

function DashboardError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const [repairing, setRepairing] = useState(false);
  const [repairStatus, setRepairStatus] = useState('');
  const [repairDone, setRepairDone] = useState(false);
  const [repairFailed, setRepairFailed] = useState(false);

  const handleRepair = async () => {
    setRepairing(true);
    setRepairStatus('Reparatur wird gestartet...');
    setRepairFailed(false);

    const errorContext = JSON.stringify({
      type: 'data_loading',
      message: error.message,
      stack: (error.stack ?? '').split('\n').slice(0, 10).join('\n'),
      url: window.location.href,
    });

    try {
      const resp = await fetch(REPAIR_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ appgroup_id: APPGROUP_ID, error_context: errorContext }),
      });

      if (!resp.ok || !resp.body) {
        setRepairing(false);
        setRepairFailed(true);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const raw of lines) {
          const line = raw.trim();
          if (!line.startsWith('data: ')) continue;
          const content = line.slice(6);
          if (content.startsWith('[STATUS]')) {
            setRepairStatus(content.replace(/^\[STATUS]\s*/, ''));
          }
          if (content.startsWith('[DONE]')) {
            setRepairDone(true);
            setRepairing(false);
          }
          if (content.startsWith('[ERROR]') && !content.includes('Dashboard-Links')) {
            setRepairFailed(true);
          }
        }
      }
    } catch {
      setRepairing(false);
      setRepairFailed(true);
    }
  };

  if (repairDone) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center">
          <IconCheck size={22} className="text-green-500" />
        </div>
        <div className="text-center">
          <h3 className="font-semibold text-foreground mb-1">Dashboard repariert</h3>
          <p className="text-sm text-muted-foreground max-w-xs">Das Problem wurde behoben. Bitte laden Sie die Seite neu.</p>
        </div>
        <Button size="sm" onClick={() => window.location.reload()}>
          <IconRefresh size={14} className="mr-1" />Neu laden
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
        <IconAlertCircle size={22} className="text-destructive" />
      </div>
      <div className="text-center">
        <h3 className="font-semibold text-foreground mb-1">Fehler beim Laden</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          {repairing ? repairStatus : error.message}
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onRetry} disabled={repairing}>Erneut versuchen</Button>
        <Button size="sm" onClick={handleRepair} disabled={repairing}>
          {repairing
            ? <span className="inline-block w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-1" />
            : <IconTool size={14} className="mr-1" />}
          {repairing ? 'Reparatur läuft...' : 'Dashboard reparieren'}
        </Button>
      </div>
      {repairFailed && <p className="text-sm text-destructive">Automatische Reparatur fehlgeschlagen. Bitte kontaktieren Sie den Support.</p>}
    </div>
  );
}
