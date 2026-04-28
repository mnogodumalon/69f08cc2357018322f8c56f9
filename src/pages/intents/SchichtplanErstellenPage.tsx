import { useState, useCallback, useMemo } from 'react';
import { IntentWizardShell } from '@/components/IntentWizardShell';
import { MitarbeiterDialog } from '@/components/dialogs/MitarbeiterDialog';
import { SchichttypenDialog } from '@/components/dialogs/SchichttypenDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useDashboardData } from '@/hooks/useDashboardData';
import { LivingAppsService, createRecordUrl, extractRecordId } from '@/services/livingAppsService';
import { APP_IDS } from '@/types/app';
import type { Mitarbeiter, Schichttypen } from '@/types/app';
import {
  IconCalendar,
  IconUsers,
  IconCheck,
  IconPlus,
  IconChevronRight,
  IconChevronLeft,
  IconAlertCircle,
  IconLoader2,
  IconCalendarEvent,
} from '@tabler/icons-react';

const WIZARD_STEPS = [
  { label: 'Datum wählen' },
  { label: 'Schichten zuweisen' },
  { label: 'Zusammenfassung' },
];

interface RowAssignment {
  mitarbeiterId: string;
  included: boolean;
  schichttypId: string;
  existingRecordId: string | null;
}

interface SavedAssignment {
  mitarbeiterName: string;
  schichttypName: string;
  date: string;
}

export default function SchichtplanErstellenPage() {
  const { mitarbeiter, schichttypen, schichtplan, loading, error, fetchAll } = useDashboardData();

  const [currentStep, setCurrentStep] = useState(1);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [assignments, setAssignments] = useState<RowAssignment[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAssignments, setSavedAssignments] = useState<SavedAssignment[]>([]);
  const [createdCount, setCreatedCount] = useState(0);
  const [updatedCount, setUpdatedCount] = useState(0);

  const [mitarbeiterDialogOpen, setMitarbeiterDialogOpen] = useState(false);
  const [schichttypenDialogOpen, setSchichttypenDialogOpen] = useState(false);

  // Existing schichtplan entries for the selected date
  const existingForDate = useMemo(() => {
    if (!selectedDate) return [];
    return schichtplan.filter(sp => {
      const d = sp.fields.datum;
      if (!d) return false;
      return d.slice(0, 10) === selectedDate;
    });
  }, [schichtplan, selectedDate]);

  // Build a map: mitarbeiterId -> existingSchichtplan record for the selected date
  const existingByMitarbeiter = useMemo(() => {
    const map = new Map<string, { recordId: string; schichttypId: string | null }>();
    for (const sp of existingForDate) {
      const mid = extractRecordId(sp.fields.mitarbeiter ?? '');
      const sid = extractRecordId(sp.fields.schichttyp ?? '');
      if (mid) {
        map.set(mid, { recordId: sp.record_id, schichttypId: sid });
      }
    }
    return map;
  }, [existingForDate]);

  const handleGoToStep2 = useCallback(() => {
    if (!selectedDate) return;
    // Build assignment rows from mitarbeiter list
    const rows: RowAssignment[] = mitarbeiter.map(m => {
      const existing = existingByMitarbeiter.get(m.record_id);
      return {
        mitarbeiterId: m.record_id,
        included: !!existing,
        schichttypId: existing?.schichttypId ?? (schichttypen[0]?.record_id ?? ''),
        existingRecordId: existing?.recordId ?? null,
      };
    });
    setAssignments(rows);
    setCurrentStep(2);
  }, [selectedDate, mitarbeiter, existingByMitarbeiter, schichttypen]);

  const includedCount = useMemo(
    () => assignments.filter(a => a.included).length,
    [assignments]
  );

  const handleToggleIncluded = useCallback((mitarbeiterId: string) => {
    setAssignments(prev =>
      prev.map(a =>
        a.mitarbeiterId === mitarbeiterId ? { ...a, included: !a.included } : a
      )
    );
  }, []);

  const handleChangeSchichttyp = useCallback((mitarbeiterId: string, schichttypId: string) => {
    setAssignments(prev =>
      prev.map(a =>
        a.mitarbeiterId === mitarbeiterId ? { ...a, schichttypId } : a
      )
    );
  }, []);

  const mitarbeiterMap = useMemo(() => {
    const m = new Map<string, Mitarbeiter>();
    mitarbeiter.forEach(r => m.set(r.record_id, r));
    return m;
  }, [mitarbeiter]);

  const schichttypenMap = useMemo(() => {
    const m = new Map<string, Schichttypen>();
    schichttypen.forEach(r => m.set(r.record_id, r));
    return m;
  }, [schichttypen]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveError(null);
    let created = 0;
    let updated = 0;
    const saved: SavedAssignment[] = [];

    try {
      const included = assignments.filter(a => a.included && a.schichttypId);
      for (const row of included) {
        const mitarbeiterRecord = mitarbeiterMap.get(row.mitarbeiterId);
        const schichttypRecord = schichttypenMap.get(row.schichttypId);
        const mitarbeiterName = mitarbeiterRecord
          ? `${mitarbeiterRecord.fields.nachname ?? ''} ${mitarbeiterRecord.fields.vorname ?? ''}`.trim()
          : row.mitarbeiterId;
        const schichttypName = schichttypRecord?.fields.schichtname ?? row.schichttypId;

        const fields = {
          datum: selectedDate,
          mitarbeiter: createRecordUrl(APP_IDS.MITARBEITER, row.mitarbeiterId),
          schichttyp: createRecordUrl(APP_IDS.SCHICHTTYPEN, row.schichttypId),
        };

        if (row.existingRecordId) {
          await LivingAppsService.updateSchichtplanEntry(row.existingRecordId, fields);
          updated++;
        } else {
          await LivingAppsService.createSchichtplanEntry(fields);
          created++;
        }

        saved.push({ mitarbeiterName, schichttypName, date: selectedDate });
      }

      setCreatedCount(created);
      setUpdatedCount(updated);
      setSavedAssignments(saved);
      await fetchAll();
      setCurrentStep(3);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  }, [assignments, selectedDate, mitarbeiterMap, schichttypenMap, fetchAll]);

  const handleReset = useCallback(() => {
    setSelectedDate('');
    setAssignments([]);
    setSavedAssignments([]);
    setCreatedCount(0);
    setUpdatedCount(0);
    setSaveError(null);
    setCurrentStep(1);
  }, []);

  const handleMitarbeiterCreated = useCallback(async (fields: Mitarbeiter['fields']) => {
    await LivingAppsService.createMitarbeiterEntry(fields);
    await fetchAll();
  }, [fetchAll]);

  const handleSchichttypenCreated = useCallback(async (fields: Schichttypen['fields']) => {
    await LivingAppsService.createSchichttypenEntry(fields);
    await fetchAll();
  }, [fetchAll]);

  // Format date for display
  const formattedDate = useMemo(() => {
    if (!selectedDate) return '';
    try {
      const [year, month, day] = selectedDate.split('-');
      return `${day}.${month}.${year}`;
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  return (
    <IntentWizardShell
      title="Schichtplan erstellen"
      subtitle="Plane die Schichten fuer einen Tag und weise Mitarbeiter zu"
      steps={WIZARD_STEPS}
      currentStep={currentStep}
      onStepChange={setCurrentStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* Step 1: Datum wählen */}
      {currentStep === 1 && (
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <IconCalendar size={18} className="text-primary" />
                </div>
                <div>
                  <h2 className="font-semibold text-base">Datum auswählen</h2>
                  <p className="text-sm text-muted-foreground">Für welchen Tag möchtest du den Schichtplan erstellen?</p>
                </div>
              </div>
              <div className="space-y-2">
                <label htmlFor="datum" className="text-sm font-medium">
                  Datum
                </label>
                <input
                  id="datum"
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="w-full min-w-0 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
            </CardContent>
          </Card>

          {/* Existing shifts for this date */}
          {selectedDate && existingForDate.length > 0 && (
            <Card className="overflow-hidden">
              <CardContent className="p-6 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <IconCalendarEvent size={16} className="text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium">
                    Bereits geplante Schichten am {formattedDate}
                  </span>
                </div>
                <div className="space-y-2">
                  {existingForDate.map(sp => {
                    const mid = extractRecordId(sp.fields.mitarbeiter ?? '');
                    const sid = extractRecordId(sp.fields.schichttyp ?? '');
                    const mRecord = mid ? mitarbeiterMap.get(mid) : undefined;
                    const sRecord = sid ? schichttypenMap.get(sid) : undefined;
                    const name = mRecord
                      ? `${mRecord.fields.nachname ?? ''} ${mRecord.fields.vorname ?? ''}`.trim()
                      : mid ?? '–';
                    const schicht = sRecord?.fields.schichtname ?? sid ?? '–';
                    return (
                      <div
                        key={sp.record_id}
                        className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2"
                      >
                        <span className="text-sm font-medium min-w-0 truncate">{name}</span>
                        <span className="text-xs text-muted-foreground shrink-0 bg-background rounded px-2 py-0.5 border">
                          {schicht}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {selectedDate && existingForDate.length === 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground px-1">
              <IconAlertCircle size={15} className="shrink-0" />
              Keine bestehenden Schichten für diesen Tag
            </div>
          )}

          <div className="flex justify-end">
            <Button
              disabled={!selectedDate}
              onClick={handleGoToStep2}
              className="gap-2"
            >
              Weiter
              <IconChevronRight size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Mitarbeiter & Schichten zuweisen */}
      {currentStep === 2 && (
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <IconUsers size={18} className="text-primary" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-base">Mitarbeiter einplanen</h2>
                    <p className="text-sm text-muted-foreground">
                      Datum: <span className="font-medium text-foreground">{formattedDate}</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5">
                  <IconUsers size={14} className="text-primary shrink-0" />
                  <span className="text-sm font-semibold text-primary">
                    {includedCount} Mitarbeiter eingeplant
                  </span>
                </div>
              </div>

              {/* Add new buttons */}
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setMitarbeiterDialogOpen(true)}
                  className="gap-1.5"
                >
                  <IconPlus size={14} />
                  Neuen Mitarbeiter anlegen
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSchichttypenDialogOpen(true)}
                  className="gap-1.5"
                >
                  <IconPlus size={14} />
                  Neuen Schichttyp anlegen
                </Button>
              </div>

              {/* Assignment table */}
              {assignments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
                  <IconUsers size={32} className="text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">Keine Mitarbeiter vorhanden</p>
                  <p className="text-xs text-muted-foreground">Lege zuerst einen Mitarbeiter an</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 pr-3 font-medium text-muted-foreground w-10">
                          <span className="sr-only">Einplanen</span>
                        </th>
                        <th className="text-left py-2 pr-3 font-medium text-muted-foreground">Mitarbeiter</th>
                        <th className="text-left py-2 font-medium text-muted-foreground">Schichttyp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {assignments.map(row => {
                        const mRecord = mitarbeiterMap.get(row.mitarbeiterId);
                        const name = mRecord
                          ? `${mRecord.fields.nachname ?? ''} ${mRecord.fields.vorname ?? ''}`.trim()
                          : row.mitarbeiterId;
                        return (
                          <tr key={row.mitarbeiterId} className={row.included ? 'bg-primary/3' : ''}>
                            <td className="py-3 pr-3">
                              <button
                                type="button"
                                onClick={() => handleToggleIncluded(row.mitarbeiterId)}
                                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors shrink-0 ${
                                  row.included
                                    ? 'bg-primary border-primary text-primary-foreground'
                                    : 'border-input bg-background hover:border-primary/50'
                                }`}
                                aria-label={row.included ? 'Abwählen' : 'Auswählen'}
                              >
                                {row.included && <IconCheck size={12} stroke={3} />}
                              </button>
                            </td>
                            <td className="py-3 pr-3">
                              <span className={`font-medium min-w-0 ${row.included ? 'text-foreground' : 'text-muted-foreground'}`}>
                                {name || '–'}
                              </span>
                              {row.existingRecordId && (
                                <span className="ml-2 text-xs text-primary bg-primary/10 rounded px-1.5 py-0.5">
                                  bereits geplant
                                </span>
                              )}
                            </td>
                            <td className="py-3">
                              <select
                                value={row.schichttypId}
                                onChange={e => handleChangeSchichttyp(row.mitarbeiterId, e.target.value)}
                                disabled={!row.included}
                                className="w-full min-w-0 max-w-[200px] h-8 rounded-md border border-input bg-background px-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <option value="">Schichttyp wählen...</option>
                                {schichttypen.map(st => (
                                  <option key={st.record_id} value={st.record_id}>
                                    {st.fields.schichtname ?? st.record_id}
                                    {st.fields.startzeit && st.fields.endzeit
                                      ? ` (${st.fields.startzeit}–${st.fields.endzeit})`
                                      : ''}
                                  </option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {saveError && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <IconAlertCircle size={16} className="shrink-0" />
              {saveError}
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <Button
              variant="outline"
              onClick={() => setCurrentStep(1)}
              className="gap-2"
            >
              <IconChevronLeft size={16} />
              Zurück
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || includedCount === 0}
              className="gap-2"
            >
              {saving ? (
                <>
                  <IconLoader2 size={16} className="animate-spin" />
                  Wird gespeichert...
                </>
              ) : (
                <>
                  <IconCheck size={16} />
                  Schichten speichern ({includedCount})
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Zusammenfassung */}
      {currentStep === 3 && (
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                  <IconCheck size={18} className="text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h2 className="font-semibold text-base">Schichtplan gespeichert</h2>
                  <p className="text-sm text-muted-foreground">
                    {createdCount > 0 && `${createdCount} Schicht${createdCount !== 1 ? 'en' : ''} erstellt`}
                    {createdCount > 0 && updatedCount > 0 && ', '}
                    {updatedCount > 0 && `${updatedCount} Schicht${updatedCount !== 1 ? 'en' : ''} aktualisiert`}
                    {createdCount === 0 && updatedCount === 0 && 'Keine Änderungen vorgenommen'}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm font-medium flex items-center gap-2">
                <IconCalendar size={14} className="text-muted-foreground shrink-0" />
                Datum: {formattedDate}
              </div>

              {savedAssignments.length > 0 && (
                <div className="space-y-2">
                  {savedAssignments.map((a, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-2 rounded-lg bg-background border px-3 py-2"
                    >
                      <span className="text-sm font-medium min-w-0 truncate">{a.mitarbeiterName}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-muted-foreground text-xs">→</span>
                        <span className="text-xs bg-primary/10 text-primary rounded px-2 py-0.5 font-medium">
                          {a.schichttypName}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <Button
              variant="outline"
              onClick={handleReset}
              className="gap-2"
            >
              <IconCalendar size={16} />
              Neuen Tag planen
            </Button>
            <a href="#/schichtplan">
              <Button className="gap-2">
                <IconChevronRight size={16} />
                Zum Schichtplan
              </Button>
            </a>
          </div>
        </div>
      )}

      {/* Dialogs */}
      <MitarbeiterDialog
        open={mitarbeiterDialogOpen}
        onClose={() => setMitarbeiterDialogOpen(false)}
        onSubmit={handleMitarbeiterCreated}
        defaultValues={undefined}
        enablePhotoScan={false}
        enablePhotoLocation={false}
      />
      <SchichttypenDialog
        open={schichttypenDialogOpen}
        onClose={() => setSchichttypenDialogOpen(false)}
        onSubmit={handleSchichttypenCreated}
        defaultValues={undefined}
        enablePhotoScan={false}
        enablePhotoLocation={false}
      />
    </IntentWizardShell>
  );
}
