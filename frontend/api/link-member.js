import { getServiceClient, getCaller, escapeLike } from '../server/auth.js';

// Links a user account to every project whose members list contains the user's email.
// The user id is never taken from the request body:
//  - linking yourself: the id comes from the verified access token
//  - linking another email (after adding a member): the id is looked up from profiles by email
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const supabase = getServiceClient();
  if (!supabase) return res.status(500).json({ error: 'Missing Supabase service env' });

  const caller = await getCaller(supabase, req);
  if (!caller) return res.status(401).json({ error: 'Unauthorized' });

  const email = String(req.body?.email || caller.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'Missing email' });

  try {
    let userId = '';
    if (email === caller.email) {
      userId = caller.id;
    } else {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .limit(1)
        .maybeSingle();
      if (profileError) throw profileError;
      userId = profile?.id || '';
    }
    if (!userId) return res.status(200).json({ message: 'No linked auth user found for email', linked: [] });

    const { data: memberRows, error: memberError } = await supabase
      .from('members')
      .select('project_id')
      .ilike('email', escapeLike(email));
    if (memberError) throw memberError;

    const projectIds = Array.from(new Set((memberRows || []).map((row) => row.project_id).filter(Boolean)));
    if (!projectIds.length) return res.status(200).json({ message: 'No matching member rows', linked: [] });

    const { data: existing, error: existingError } = await supabase
      .from('project_members')
      .select('project_id')
      .eq('user_id', userId);
    if (existingError) throw existingError;
    const existingIds = new Set((existing || []).map((row) => row.project_id));

    const toInsert = projectIds
      .filter((projectId) => !existingIds.has(projectId))
      .map((projectId) => ({ project_id: projectId, user_id: userId }));
    if (!toInsert.length) return res.status(200).json({ message: 'Already linked', linked: projectIds });

    const { data: inserted, error: insertError } = await supabase
      .from('project_members')
      .insert(toInsert)
      .select();
    if (insertError) throw insertError;
    return res.status(200).json({ message: 'Linked', linked: inserted || [] });
  } catch (e) {
    console.error('link-member error', e);
    return res.status(500).json({ error: 'Server error' });
  }
}
