import { getServiceClient, getCaller, canAccessProject } from '../server/auth.js';

// Roles whose project access comes from the project's members list.
const LINKED_ROLES = new Set(['member', 'client', 'pm']);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  const { projectId } = req.body || {};
  if (!projectId) return res.status(400).json({ error: 'Missing projectId' });

  const supabase = getServiceClient();
  if (!supabase) return res.status(500).json({ error: 'Missing Supabase service env' });

  const caller = await getCaller(supabase, req);
  if (!caller) return res.status(401).json({ error: 'Unauthorized' });
  if (caller.role === 'client' || !(await canAccessProject(supabase, caller, projectId))) {
    return res.status(403).json({ error: 'FORBIDDEN' });
  }

  try {
    const { data: members, error: membersError } = await supabase
      .from('members')
      .select('email')
      .eq('project_id', projectId);
    if (membersError) throw membersError;

    const emails = Array.from(
      new Set(
        (members || [])
          .map((row) => String(row.email || '').trim().toLowerCase())
          .filter((email) => email)
      )
    );

    const profilesQuery = emails.length
      ? await supabase.from('profiles').select('id,email,role').in('email', emails)
      : { data: [], error: null };
    if (profilesQuery.error) throw profilesQuery.error;

    const profileByEmail = new Map();
    const linkedRoleUserIds = new Set();
    (profilesQuery.data || []).forEach((row) => {
      const role = String(row.role || '').trim().toLowerCase();
      if (row.email && LINKED_ROLES.has(role)) {
        profileByEmail.set(String(row.email).trim().toLowerCase(), row.id);
        linkedRoleUserIds.add(row.id);
      }
    });

    const { data: existingRows, error: existingError } = await supabase
      .from('project_members')
      .select('id,user_id')
      .eq('project_id', projectId);
    if (existingError) throw existingError;

    const existingUserIds = new Set((existingRows || []).map((row) => row.user_id));
    const desiredUserIds = Array.from(new Set(emails.map((email) => profileByEmail.get(email)).filter(Boolean)));

    const inserted = [];
    const toInsert = desiredUserIds
      .filter((userId) => !existingUserIds.has(userId))
      .map((userId) => ({ project_id: projectId, user_id: userId }));
    if (toInsert.length > 0) {
      const { data: insertedRows, error: insertError } = await supabase
        .from('project_members')
        .insert(toInsert)
        .select();
      if (insertError) throw insertError;
      inserted.push(...(insertedRows || []));
    }

    // Only remove links of users whose role is managed by the members list
    // and who are no longer listed. Admin (and other) links are left alone.
    const { data: existingProfiles, error: existingProfilesError } = existingRows?.length
      ? await supabase.from('profiles').select('id,role').in('id', existingRows.map((row) => row.user_id))
      : { data: [], error: null };
    if (existingProfilesError) throw existingProfilesError;
    const managedIds = new Set(
      (existingProfiles || [])
        .filter((row) => LINKED_ROLES.has(String(row.role || '').trim().toLowerCase()))
        .map((row) => row.id)
    );

    const desiredSet = new Set(desiredUserIds);
    const toDeleteIds = (existingRows || [])
      .filter((row) => row.user_id && managedIds.has(row.user_id) && !desiredSet.has(row.user_id))
      .map((row) => row.id);

    const deleted = [];
    if (toDeleteIds.length > 0) {
      const { data: deletedRows, error: deleteError } = await supabase
        .from('project_members')
        .delete()
        .in('id', toDeleteIds)
        .select();
      if (deleteError) throw deleteError;
      deleted.push(...(deletedRows || []));
    }

    return res.status(200).json({
      message: 'Sync completed',
      insertedCount: inserted.length,
      deletedCount: deleted.length,
      missingProfiles: emails.filter((email) => !profileByEmail.has(email)),
    });
  } catch (e) {
    console.error('sync-project-members error', e);
    return res.status(500).json({ error: 'Server error' });
  }
}
