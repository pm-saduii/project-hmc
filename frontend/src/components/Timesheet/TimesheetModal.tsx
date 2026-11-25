import React, { useEffect, useMemo, useState } from 'react';
import { addMonths, endOfMonth, format, getDaysInMonth, getDay, startOfMonth, subMonths } from 'date-fns';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { CalendarDays, ChevronLeft, ChevronRight, Download, Plus, Trash2 } from 'lucide-react';
import type { TimesheetEntry } from '../../types';
import { timesheetApi } from '../../services/api';
import { useStore } from '../../store';
import { Btn, C, ConfirmModal, FormRow, Input, Modal, Textarea } from '../Common';

interface Props {
  onClose: () => void;
  /** Render as a page section instead of a popup. */
  inline?: boolean;
}

interface TimesheetDraft {
  workDate: string;
  projectKey: string;
  description: string;
  hours: string;
}

interface ProjectSummaryRow {
  projectKey: string;
  description: string;
  hoursByDay: Record<number, number>;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toIsoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function displayHours(hours: number): string {
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function summarizeProjects(entries: TimesheetEntry[], firstDay: number, lastDay: number): ProjectSummaryRow[] {
  const grouped = new Map<string, { descriptions: Set<string>; hoursByDay: Record<number, number> }>();
  entries.forEach((entry) => {
    const day = Number(entry.workDate.slice(-2));
    if (day < firstDay || day > lastDay) return;
    const row = grouped.get(entry.projectKey) || { descriptions: new Set<string>(), hoursByDay: {} };
    if (entry.description.trim()) row.descriptions.add(entry.description.trim());
    row.hoursByDay[day] = (row.hoursByDay[day] || 0) + Number(entry.hours);
    grouped.set(entry.projectKey, row);
  });

  return Array.from(grouped, ([projectKey, value]) => ({
    projectKey,
    description: Array.from(value.descriptions).join('; '),
    hoursByDay: value.hoursByDay,
  })).sort((a, b) => a.projectKey.localeCompare(b.projectKey));
}

function sumDayHours(entries: TimesheetEntry[]): Map<string, number> {
  const totals = new Map<string, number>();
  entries.forEach((entry) => totals.set(entry.workDate, (totals.get(entry.workDate) || 0) + Number(entry.hours)));
  return totals;
}

export default function TimesheetModal({ onClose, inline = false }: Props) {
  const projects = useStore((state) => state.projects);
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [entries, setEntries] = useState<TimesheetEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [editing, setEditing] = useState<{ entry: TimesheetEntry | null; date: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const monthStart = format(startOfMonth(month), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(month), 'yyyy-MM-dd');
  const monthKey = format(month, 'yyyy-MM');
  const daysInMonth = getDaysInMonth(month);
  const startOffset = getDay(startOfMonth(month));
  const dailyHours = useMemo(() => sumDayHours(entries), [entries]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError('');
    timesheetApi.getByDateRange(monthStart, monthEnd)
      .then(({ data }) => {
        if (active) setEntries(data);
      })
      .catch((error: unknown) => {
        if (!active) return;
        const message = error instanceof Error ? error.message : 'Failed to load timesheets';
        setLoadError(message);
        toast.error(message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [monthStart, monthEnd]);

  const entriesByDate = useMemo(() => {
    const grouped = new Map<string, TimesheetEntry[]>();
    entries.forEach((entry) => {
      const current = grouped.get(entry.workDate) || [];
      current.push(entry);
      grouped.set(entry.workDate, current);
    });
    return grouped;
  }, [entries]);

  const calendarDays = useMemo(() => {
    const cells: Array<number | null> = Array.from({ length: startOffset }, () => null);
    for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [daysInMonth, startOffset]);

  const openNewEntry = (day: number) => {
    setEditing({ entry: null, date: toIsoDate(month.getFullYear(), month.getMonth(), day) });
  };

  const saveEntry = async (draft: TimesheetDraft, entry: TimesheetEntry | null) => {
    const hours = Number(draft.hours);
    if (!draft.projectKey.trim() || !draft.description.trim() || !draft.workDate || !Number.isFinite(hours) || hours <= 0 || hours > 24) {
      toast.error('Please enter a project, a description and valid hours (0–24)');
      return;
    }

    const existingHours = entries
      .filter((item) => item.workDate === draft.workDate && item.id !== entry?.id)
      .reduce((total, item) => total + Number(item.hours), 0);
    if (existingHours + hours > 24) {
      toast.error('Total hours for a day cannot exceed 24');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        workDate: draft.workDate,
        projectKey: draft.projectKey.trim(),
        description: draft.description.trim(),
        hours,
      };
      const { data } = entry
        ? await timesheetApi.update(entry.id, payload)
        : await timesheetApi.create(payload);
      setEntries((current) => entry
        ? current.map((item) => item.id === data.id ? data : item)
        : [...current, data]);
      setEditing(null);
      toast.success(entry ? 'Timesheet entry updated' : 'Timesheet entry added');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save timesheet');
    } finally {
      setSaving(false);
    }
  };

  const deleteEntry = async (entry: TimesheetEntry): Promise<boolean> => {
    try {
      await timesheetApi.remove(entry.id);
      setEntries((current) => current.filter((item) => item.id !== entry.id));
      setEditing(null);
      toast.success('Timesheet entry deleted');
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete timesheet');
      return false;
    }
  };

  const firstHalfRows = useMemo(() => summarizeProjects(entries, 1, 15), [entries]);
  const secondHalfRows = useMemo(() => summarizeProjects(entries, 16, daysInMonth), [entries, daysInMonth]);

  const exportExcel = () => {
    const workbook = XLSX.utils.book_new();
    const addHalfMonthSheet = (name: string, rows: ProjectSummaryRow[], firstDay: number, lastDay: number) => {
      const dayNumbers = Array.from({ length: lastDay - firstDay + 1 }, (_, index) => firstDay + index);
      const data = [
        ['Project', 'Description', ...dayNumbers.map(String), 'Total Hours'],
        ...rows.map((row) => [
          row.projectKey,
          row.description,
          ...dayNumbers.map((day) => Number((row.hoursByDay[day] || 0).toFixed(2))),
          Number(dayNumbers.reduce((total, day) => total + (row.hoursByDay[day] || 0), 0).toFixed(2)),
        ]),
      ];
      const sheet = XLSX.utils.aoa_to_sheet(data);
      sheet['!cols'] = [{ wch: 20 }, { wch: 48 }, ...dayNumbers.map(() => ({ wch: 9 })), { wch: 14 }];
      XLSX.utils.book_append_sheet(workbook, sheet, name);
    };

    addHalfMonthSheet('Days 1-15', firstHalfRows, 1, Math.min(15, daysInMonth));
    addHalfMonthSheet('Days 16-End', secondHalfRows, 16, daysInMonth);
    XLSX.writeFile(workbook, `timesheet-${monthKey}.xlsx`);
  };

  const projectLabel = (key: string) => {
    const project = projects.find((item) => item.code === key);
    return project ? `${project.code} · ${project.name}` : key;
  };
  const editedEntry = editing?.entry;

  return (
    <Modal title="Personal Timesheet" onClose={onClose} width={1240} height={inline ? undefined : "92vh"} closeOnBackdrop={false} inline={inline}
      contentStyle={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Btn variant="ghost" small title="Previous month" onClick={() => setMonth((current) => subMonths(current, 1))}><ChevronLeft size={16} /></Btn>
          <strong style={{ minWidth: 150, textAlign: 'center', fontSize: 16, color: C.text }}>{format(month, 'MMMM yyyy')}</strong>
          <Btn variant="ghost" small title="Next month" onClick={() => setMonth((current) => addMonths(current, 1))}><ChevronRight size={16} /></Btn>
        </div>
        <Btn small variant="outline" onClick={exportExcel}><Download size={14} /> Export Excel</Btn>
      </div>

      {loadError && (
        <div role="alert" style={{ padding: 12, borderRadius: 8, color: C.red, background: C.redBg, fontSize: 13 }}>
          Unable to load timesheet: {loadError}
        </div>
      )}

      <section aria-label="Monthly calendar" style={{ border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', flex: '0 0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', background: C.bg }}>
          {WEEKDAYS.map((day) => (
            <div key={day} style={{ textAlign: 'center', padding: '9px 4px', fontSize: 11, fontWeight: 700, color: C.text2 }}>{day}</div>
          ))}
        </div>
        {loading ? (
          <div style={{ padding: 36, textAlign: 'center', color: C.text2 }}>Loading timesheet…</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gridAutoRows: 'minmax(112px, auto)' }}>
            {calendarDays.map((day, index) => {
              if (!day) return <div key={`blank-${index}`} style={{ minHeight: 112, borderTop: `1px solid ${C.border}`, borderRight: `1px solid ${C.border}`, background: C.bg }} />;
              const date = toIsoDate(month.getFullYear(), month.getMonth(), day);
              const hours = dailyHours.get(date) || 0;
              const dayEntries = entriesByDate.get(date) || [];
              const weekday = new Date(month.getFullYear(), month.getMonth(), day).getDay();
              const weekend = weekday === 0 || weekday === 6;
              const incomplete = !weekend && hours < 8;
              return (
                <div
                  key={date}
                  role="button"
                  tabIndex={0}
                  aria-label={`${date}, ${displayHours(hours)} hours. Add timesheet entry.`}
                  onClick={() => openNewEntry(day)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      openNewEntry(day);
                    }
                  }}
                  style={{
                    minHeight: 112, padding: 6, borderTop: `1px solid ${C.border}`, borderRight: `1px solid ${C.border}`,
                    background: weekend ? C.bg : C.white, cursor: 'pointer', overflow: 'hidden',
                  }}
                  title="Click to add an entry"
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4, marginBottom: 5 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{day}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: incomplete ? C.red : weekend ? C.text3 : C.green }}>
                      {weekend ? `${displayHours(hours)} h · Weekend` : `${displayHours(hours)} / 8 h`}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {dayEntries.map((entry) => (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setEditing({ entry, date: entry.workDate });
                        }}
                        title={`${projectLabel(entry.projectKey)} · ${entry.description} · ${displayHours(Number(entry.hours))} h · Click to edit`}
                        style={{
                          width: '100%', overflow: 'hidden', textAlign: 'left', cursor: 'pointer', border: '1px solid #D9E2FF',
                          borderRadius: 5, padding: '3px 5px', background: '#EEF2FF', color: C.primary, fontSize: 11,
                          whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                        }}
                      >
                        {entry.projectKey} · {displayHours(Number(entry.hours))} h · {entry.description}
                      </button>
                    ))}
                    {dayEntries.length === 0 && !weekend && (
                      <span style={{ color: C.text3, fontSize: 11, padding: '4px 2px' }}>+ Add entry</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: C.text2 }}>
        <span style={{ width: 12, height: 12, borderRadius: 3, background: '#FFF1F2', border: '1px solid #FECDD3' }} />
        Working days with less than 8 hours logged (weekends excluded)
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0, color: C.text, fontSize: 16 }}>
          <CalendarDays size={17} /> Monthly Summary
        </h3>
        <span style={{ fontSize: 11, color: C.text2 }}>Daily hours by project</span>
      </div>

      <HalfMonthSummary
        title={`Days 1–15 ${format(month, 'MMMM')}`}
        rows={firstHalfRows}
        firstDay={1}
        lastDay={Math.min(15, daysInMonth)}
      />
      <HalfMonthSummary
        title={`Days 16–${daysInMonth} ${format(month, 'MMMM')}`}
        rows={secondHalfRows}
        firstDay={16}
        lastDay={daysInMonth}
      />

      {editing && (
        <TimesheetEntryModal
          entry={editing.entry}
          date={editing.date}
          projectKeys={Array.from(new Set(projects.map((project) => project.customerAbbreviation.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b))}
          saving={saving}
          onClose={() => setEditing(null)}
          onSave={(draft) => saveEntry(draft, editing.entry)}
          onDelete={editedEntry ? () => deleteEntry(editedEntry) : undefined}
        />
      )}
    </Modal>
  );
}

function HalfMonthSummary({
  title,
  rows,
  firstDay,
  lastDay,
}: {
  title: string;
  rows: ProjectSummaryRow[];
  firstDay: number;
  lastDay: number;
}) {
  const dayNumbers = Array.from({ length: Math.max(0, lastDay - firstDay + 1) }, (_, index) => firstDay + index);
  return (
    <section style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden', flex: '0 0 auto' }}>
      <div style={{ padding: '10px 12px', background: C.bg, color: C.text, fontWeight: 700, fontSize: 13 }}>{title}</div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 600, borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr>
              <th style={summaryHeaderStyle}>Project</th>
              <th style={{ ...summaryHeaderStyle, minWidth: 220 }}>Description</th>
              {dayNumbers.map((day) => <th key={day} style={{ ...summaryHeaderStyle, minWidth: 34, textAlign: 'center' }}>{day}</th>)}
              <th style={{ ...summaryHeaderStyle, minWidth: 58, textAlign: 'center' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const total = dayNumbers.reduce((sum, day) => sum + (row.hoursByDay[day] || 0), 0);
              return (
                <tr key={row.projectKey}>
                  <td style={{ ...summaryCellStyle, fontWeight: 700, whiteSpace: 'nowrap' }}>{row.projectKey}</td>
                  <td title={row.description} style={{ ...summaryCellStyle, width: 280, minWidth: 220, whiteSpace: 'normal', overflowWrap: 'anywhere' }}>
                    {row.description}
                  </td>
                  {dayNumbers.map((day) => (
                    <td key={day} style={{ ...summaryCellStyle, textAlign: 'center' }}>
                      {row.hoursByDay[day] ? displayHours(row.hoursByDay[day]) : '–'}
                    </td>
                  ))}
                  <td style={{ ...summaryCellStyle, textAlign: 'center', fontWeight: 700 }}>{displayHours(total)}</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={dayNumbers.length + 3} style={{ ...summaryCellStyle, textAlign: 'center', color: C.text3 }}>No entries in this period</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TimesheetEntryModal({
  entry,
  date,
  projectKeys,
  saving,
  onClose,
  onSave,
  onDelete,
}: {
  entry: TimesheetEntry | null;
  date: string;
  projectKeys: string[];
  saving: boolean;
  onClose: () => void;
  onSave: (draft: TimesheetDraft) => Promise<void>;
  onDelete?: () => Promise<boolean>;
}) {
  const [draft, setDraft] = useState<TimesheetDraft>({
    workDate: entry?.workDate || date,
    projectKey: entry?.projectKey || '',
    description: entry?.description || '',
    hours: entry ? String(entry.hours) : '',
  });
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setDraft({
      workDate: entry?.workDate || date,
      projectKey: entry?.projectKey || '',
      description: entry?.description || '',
      hours: entry ? String(entry.hours) : '',
    });
  }, [entry, date]);

  const update = (key: keyof TimesheetDraft, value: string) => setDraft((current) => ({ ...current, [key]: value }));

  const handleDelete = async () => {
    if (!onDelete) return;
    setDeleting(true);
    try {
      if (await onDelete()) setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal title={entry ? 'Edit Timesheet Entry' : 'Add Timesheet Entry'} onClose={onClose} width={560} closeOnBackdrop={false}>
      <FormRow label="Date" required>
        <Input type="date" value={draft.workDate} onChange={(value) => update('workDate', value)} />
      </FormRow>
      <FormRow label="Project Key (Customer Abbreviation)" required>
        <Input
          value={draft.projectKey}
          onChange={(value) => update('projectKey', value)}
          placeholder="Select or type a customer abbreviation"
          list="timesheet-project-keys"
        />
        <datalist id="timesheet-project-keys">
          {projectKeys.map((key) => <option key={key} value={key} />)}
        </datalist>
      </FormRow>
      <FormRow label="Description" required>
        <Textarea value={draft.description} onChange={(value) => update('description', value)} rows={3} placeholder="What did you work on?" />
      </FormRow>
      <FormRow label="Hours" required>
        <Input
          type="number"
          value={draft.hours}
          onChange={(value) => update('hours', value)}
          placeholder="e.g. 2 or 7.5"
          style={{ maxWidth: 180 }}
        />
      </FormRow>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 18 }}>
        {onDelete ? (
          <Btn variant="danger" disabled={saving || deleting} onClick={() => setConfirmDelete(true)}><Trash2 size={14} /> Delete</Btn>
        ) : <span />}
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn disabled={saving || deleting} onClick={() => onSave(draft)}>
            <Plus size={14} /> {saving ? 'Saving…' : 'Save'}
          </Btn>
        </div>
      </div>
      {confirmDelete && (
        <ConfirmModal
          message={`Delete the timesheet entry for ${entry?.workDate}?`}
          onConfirm={() => { void handleDelete(); }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </Modal>
  );
}

const summaryHeaderStyle: React.CSSProperties = {
  padding: '7px 8px',
  borderBottom: `1px solid ${C.border}`,
  background: '#F8FAFC',
  color: C.text2,
  fontWeight: 700,
  whiteSpace: 'nowrap',
};

const summaryCellStyle: React.CSSProperties = {
  padding: '7px 8px',
  borderBottom: `1px solid ${C.border}`,
  color: C.text,
  verticalAlign: 'top',
};
