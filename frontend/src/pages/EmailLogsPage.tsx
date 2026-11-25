import React from 'react';
import toast from 'react-hot-toast';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';
import { Mail } from 'lucide-react';
import { supabase } from '../services/supabase';
import { Btn, C } from '../components/Common';
type EmailLog = {
  id: string;
  project_id: string | null;
  project_name: string | null;
  project_code: string | null;
  type: 'auto' | 'manual';
  scheduled_time: string | null;
  sent_at: string | null;
  status: 'sent' | 'skipped' | 'failed';
  recipient: string | null;
  tasks_count: number;
  error_message: string | null;
  created_at: string;
};

export default function EmailLogsPage() {
  const [sendingAll, setSendingAll] = React.useState(false);

  const sendRemindersNow = async () => {
    setSendingAll(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      const res = await fetch('/api/send-task-reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
        body: JSON.stringify({ force: true }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || 'Send email failed');
      const results = Array.isArray(result.results) ? result.results : [];
      const sentCount = results.filter((r: any) => r.recipient && !r.error).length;
      const failedCount = results.filter((r: any) => r.recipient && r.error).length;
      if (failedCount) toast.error(`Failed to send to ${failedCount} recipient(s)`);
      toast.success(`Sent reminders to ${sentCount} recipient(s)`);
      await reloadLogs();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send email reminders');
    } finally {
      setSendingAll(false);
    }
  };
  const [logs, setLogs] = React.useState<EmailLog[]>([]);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [filterProject, setFilterProject] = React.useState('');
  const [deleting, setDeleting] = React.useState(false);

  React.useEffect(() => {
    const loadLogs = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase
          .from('email_reminder_logs')
          .select('id,project_id,project_name,project_code,type,scheduled_time,sent_at,status,recipient,tasks_count,error_message,created_at')
          .order('created_at', { ascending: false })
          .limit(200);
        if (error) throw new Error(error.message);
        setLogs((data || []) as EmailLog[]);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load');
      }
      setLoading(false);
    };
    loadLogs();
  }, []);

  const reloadLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('email_reminder_logs')
        .select('id,project_id,project_name,project_code,type,scheduled_time,sent_at,status,recipient,tasks_count,error_message,created_at')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw new Error(error.message);
      setLogs((data || []) as EmailLog[]);
      setSelectedIds([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
    setLoading(false);
  };

  const handleDeleteSelected = async () => {
    if (!selectedIds.length) return;
    const confirmation = await Swal.fire({
      title: 'Delete selected email logs?',
      text: `${selectedIds.length} log(s) will be permanently deleted.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Delete logs',
      cancelButtonText: 'Cancel',
      confirmButtonColor: C.red,
      cancelButtonColor: C.text3,
      reverseButtons: true,
      focusCancel: true,
    });
    if (!confirmation.isConfirmed) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('email_reminder_logs').delete().in('id', selectedIds);
      if (error) throw new Error(error.message);
      await reloadLogs();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete logs');
    } finally {
      setDeleting(false);
    }
  };

  const filteredLogs = filterProject
    ? logs.filter((l) =>
        (l.project_name || '').toLowerCase().includes(filterProject.toLowerCase()) ||
        (l.project_code || '').toLowerCase().includes(filterProject.toLowerCase())
      )
    : logs;

  const statusColor = (s: string) => {
    if (s === 'sent') return C.green;
    if (s === 'failed') return C.red;
    return C.text3;
  };
  const statusBg = (s: string) => {
    if (s === 'sent') return C.greenBg;
    if (s === 'failed') return '#FEE2E2';
    return C.bg2;
  };

  const fmtTime = (iso: string | null) => {
    if (!iso) return '-';
    try {
      return new Date(iso).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch {
      return iso;
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ background: C.white, borderRadius: 12, border: `1px solid ${C.border}`, width: '100%', display: 'flex', flexDirection: 'column', boxShadow: C.shadow }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Mail size={16} color={C.primary} />
            <span style={{ fontSize: 15, fontWeight: 700, color: C.text, fontFamily: 'Poppins, sans-serif' }}>Email Logs</span>
            <span style={{ fontSize: 12, color: C.text2 }}>({filteredLogs.length} records)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Filter by project..."
              value={filterProject}
              onChange={(e) => setFilterProject(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12, color: C.text, outline: 'none', width: 180 }}
            />
            <button
              type="button"
              disabled={!selectedIds.length || deleting}
              onClick={handleDeleteSelected}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: `1px solid ${selectedIds.length ? C.red : C.border}`,
                background: selectedIds.length ? C.redBg : C.bg2,
                color: selectedIds.length ? C.red : C.text2,
                cursor: selectedIds.length ? 'pointer' : 'not-allowed',
                fontSize: 12,
                fontWeight: 700,
                whiteSpace: 'nowrap',
              }}
            >
              {deleting ? 'Deleting…' : `Delete ${selectedIds.length ? `(${selectedIds.length})` : ''}`}
            </button>
            <Btn small onClick={sendRemindersNow} disabled={sendingAll} title="Send reminder emails for all projects now">{sendingAll ? 'Sending…' : 'Send reminders now'}</Btn>
          </div>
        </div>

        {/* Body */}
        <div style={{ overflow: 'auto', flex: 1 }}>
          {loading && (
            <div style={{ padding: 40, textAlign: 'center', color: C.text2, fontSize: 13 }}>Loading…</div>
          )}
          {!loading && error && (
            <div style={{ padding: 40, textAlign: 'center', color: C.red, fontSize: 13 }}>{error}</div>
          )}
          {!loading && !error && filteredLogs.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: C.text2, fontSize: 13 }}>No logs found.</div>
          )}
          {!loading && !error && filteredLogs.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: C.bg, position: 'sticky', top: 0, zIndex: 1 }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: C.text2, borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' }}>
                <input
                  type="checkbox"
                  checked={filteredLogs.length > 0 && selectedIds.length === filteredLogs.length}
                  onChange={(e) => {
                    if (e.currentTarget.checked) setSelectedIds(filteredLogs.map((log) => log.id));
                    else setSelectedIds([]);
                  }}
                />
              </th>
              {['Project ID', 'Project Name', 'Type', 'Scheduled', 'Sent At', 'Recipient', 'Tasks', 'Status', 'Error'].map((h) => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: C.text2, borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: `1px solid ${C.border}` }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = '#F8FAFF'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'; }}>
                    <td style={{ padding: '10px 12px' }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(log.id)}
                        onChange={(e) => {
                          if (e.currentTarget.checked) {
                            setSelectedIds((prev) => [...prev, log.id]);
                          } else {
                            setSelectedIds((prev) => prev.filter((id) => id !== log.id));
                          }
                        }}
                      />
                    </td>
                    <td style={{ padding: '9px 12px', color: C.primary, fontWeight: 700, fontFamily: 'Poppins, sans-serif', whiteSpace: 'nowrap' }}>{log.project_code || '-'}</td>
                    <td style={{ padding: '9px 12px', color: C.text, maxWidth: 200 }}>{log.project_name || '-'}</td>
                    <td style={{ padding: '9px 12px' }}>
                      <span style={{ background: log.type === 'manual' ? C.primaryBg : C.bg2, color: log.type === 'manual' ? C.primary : C.text2, borderRadius: 6, padding: '2px 7px', fontWeight: 600, fontSize: 11, whiteSpace: 'nowrap' }}>
                        {log.type === 'manual' ? 'Manual' : 'Auto'}
                      </span>
                    </td>
                    <td style={{ padding: '9px 12px', color: C.text2, whiteSpace: 'nowrap' }}>{log.scheduled_time || '-'}</td>
                    <td style={{ padding: '9px 12px', color: C.text2, whiteSpace: 'nowrap' }}>{fmtTime(log.sent_at)}</td>
                    <td style={{ padding: '9px 12px', color: C.text, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.recipient || '-'}</td>
                    <td style={{ padding: '9px 12px', color: C.text, textAlign: 'center' }}>{log.tasks_count}</td>
                    <td style={{ padding: '9px 12px' }}>
                      <span style={{ background: statusBg(log.status), color: statusColor(log.status), borderRadius: 6, padding: '2px 8px', fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap' }}>
                        {log.status.charAt(0).toUpperCase() + log.status.slice(1)}
                      </span>
                    </td>
                    <td style={{ padding: '9px 12px', color: C.red, fontSize: 11, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.error_message || ''}>{log.error_message || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
