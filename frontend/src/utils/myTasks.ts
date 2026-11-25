import type { Member, Task } from '../types';

const norm = (value: unknown) => String(value ?? '').trim().toLowerCase();

/**
 * Names a task's Resource may use for the signed-in user: their email, profile name, and the
 * name / nickname / Thai name of every member row with the same email (same rule as the reminder email).
 */
export function myIdentityNames(email: string, fullName: string, members: Member[]): Set<string> {
  const names = new Set<string>();
  const me = norm(email);
  if (me) names.add(me);
  if (norm(fullName)) names.add(norm(fullName));
  members.filter((m) => norm(m.email) === me && me).forEach((m) => {
    [m.name, m.nickname, m.thaiName].forEach((value) => { if (norm(value)) names.add(norm(value)); });
  });
  return names;
}

/** A leaf task (not a summary row) whose Resource names the user. */
export function isMyTask(task: Task, names: Set<string>, parentIds: Set<string>): boolean {
  if (!names.size || parentIds.has(task.id)) return false;
  const owners = String(task.resource || '').split(/[,;/]/).map(norm).filter(Boolean);
  return owners.some((owner) => names.has(owner));
}
