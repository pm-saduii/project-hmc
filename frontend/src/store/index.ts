import { create } from 'zustand';
import type { Project, Task, Member, Milestone, Effort, ChangeRequest, CRItem, Issue, Risk } from '../types';
import { projectApi, taskApi, memberApi, milestoneApi, effortApi, crApi, issueApi, riskApi } from '../services/api';

interface Store {
  projects: Project[];
  projectsLoading: boolean;
  activeProject: Project | null;
  tasks: Task[];
  members: Member[];
  milestones: Milestone[];
  efforts: Effort[];
  changeRequests: (ChangeRequest & { items: CRItem[] })[];
  issues: Issue[];
  risks: Risk[];
  dataLoading: boolean;
  error: string | null;

  fetchProjects: () => Promise<void>;
  createProject: (p: Partial<Project>) => Promise<Project>;
  updateProject: (id: string, p: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  setActiveProject: (p: Project | null) => void;

  fetchTasks:      (pid: string) => Promise<void>;
  createTask:      (t: Partial<Task>) => Promise<void>;
  updateTask:      (id: string, t: Partial<Task>) => Promise<void>;
  deleteTask:      (id: string) => Promise<void>;

  fetchMembers:    (pid: string) => Promise<void>;
  createMember:    (m: Partial<Member>) => Promise<void>;
  updateMember:    (id: string, m: Partial<Member>) => Promise<void>;
  deleteMember:    (id: string) => Promise<void>;

  fetchMilestones: (pid: string) => Promise<void>;
  createMilestone: (m: Partial<Milestone>) => Promise<void>;
  updateMilestone: (id: string, m: Partial<Milestone>) => Promise<void>;
  deleteMilestone: (id: string) => Promise<void>;

  fetchEfforts:    (pid: string) => Promise<void>;
  createEffort:    (e: Partial<Effort>) => Promise<void>;
  updateEffort:    (id: string, e: Partial<Effort>) => Promise<void>;
  updateEffortMonthly: (id: string, month: string, manday: number) => Promise<void>;
  deleteEffort:    (id: string) => Promise<void>;

  fetchCRs:        (pid: string) => Promise<void>;
  createCR:        (c: Partial<ChangeRequest> & { items?: Partial<CRItem>[] }) => Promise<void>;
  updateCR:        (id: string, c: Partial<ChangeRequest> & { items?: Partial<CRItem>[] }) => Promise<void>;
  deleteCR:        (id: string) => Promise<void>;

  fetchIssues:     (pid: string) => Promise<void>;
  createIssue:     (i: Partial<Issue>) => Promise<void>;
  updateIssue:     (id: string, i: Partial<Issue>) => Promise<void>;
  deleteIssue:     (id: string) => Promise<void>;

  fetchRisks:      (pid: string) => Promise<void>;
  createRisk:      (r: Partial<Risk>) => Promise<void>;
  updateRisk:      (id: string, r: Partial<Risk>) => Promise<void>;
  deleteRisk:      (id: string) => Promise<void>;
}

export const useStore = create<Store>((set, get) => ({
  projects: [], projectsLoading: false, activeProject: null,
  tasks: [], members: [], milestones: [], efforts: [],
  changeRequests: [], issues: [], risks: [],
  dataLoading: false, error: null,

  // ── Projects ───────────────────────────────────────────────────────────────
  fetchProjects: async () => {
    set({ projectsLoading: true, error: null });
    try { set({ projects: (await projectApi.getAll()).data, projectsLoading: false }); }
    catch (e) { set({ error: (e as Error).message, projectsLoading: false }); }
  },
  createProject: async (p) => {
    const res = await projectApi.create(p);
    set(s => ({ projects: [...s.projects, res.data] }));
    return res.data;
  },
  updateProject: async (id, p) => {
    const res = await projectApi.update(id, p);
    set(s => ({ projects: s.projects.map(x => x.id === id ? res.data : x), activeProject: s.activeProject?.id === id ? res.data : s.activeProject }));
  },
  deleteProject: async (id) => {
    await projectApi.remove(id);
    set(s => ({ projects: s.projects.filter(p => p.id !== id), activeProject: null }));
  },
  setActiveProject: (p) => set({ activeProject: p, tasks: [], members: [], milestones: [], efforts: [], changeRequests: [], issues: [], risks: [] }),

  // ── Tasks ──────────────────────────────────────────────────────────────────
  fetchTasks: async (pid?: string) => {
    try { set({ tasks: (await taskApi.getByProject(pid)).data }); }
    catch (e) { set({ error: (e as Error).message }); }
  },
  createTask: async (t) => { const r = await taskApi.create(t); set({ tasks: r.allTasks ?? get().tasks }); },
  updateTask: async (id, t) => { const r = await taskApi.update(id, t); set({ tasks: r.allTasks ?? get().tasks }); },
  deleteTask: async (id)    => { const r = await taskApi.remove(id);    set({ tasks: r.allTasks ?? get().tasks }); },

  // ── Members ────────────────────────────────────────────────────────────────
  fetchMembers: async (pid?: string) => { set({ members: (await memberApi.getByProject(pid)).data }); },
  createMember: async (m)   => { const r = await memberApi.create(m);     set(s => ({ members: [...s.members, r.data] })); },
  updateMember: async (id, m) => { const r = await memberApi.update(id, m); set(s => ({ members: s.members.map(x => x.id === id ? r.data : x) })); },
  deleteMember: async (id)  => { await memberApi.remove(id); set(s => ({ members: s.members.filter(m => m.id !== id) })); },

  // ── Milestones ─────────────────────────────────────────────────────────────
  fetchMilestones: async (pid?: string) => { set({ milestones: (await milestoneApi.getByProject(pid)).data }); },
  createMilestone: async (m)   => { const r = await milestoneApi.create(m);     set(s => ({ milestones: [...s.milestones, r.data] })); },
  updateMilestone: async (id, m) => { const r = await milestoneApi.update(id, m); set(s => ({ milestones: s.milestones.map(x => x.id === id ? r.data : x) })); },
  deleteMilestone: async (id)  => { await milestoneApi.remove(id); set(s => ({ milestones: s.milestones.filter(m => m.id !== id) })); },

  // ── Efforts ────────────────────────────────────────────────────────────────
  fetchEfforts: async (pid?: string) => { set({ efforts: (await effortApi.getByProject(pid)).data }); },
  createEffort: async (e)   => { const r = await effortApi.create(e); set(s => ({ efforts: [...s.efforts, r.data] })); },
  updateEffort: async (id, e) => { const r = await effortApi.update(id, e); set(s => ({ efforts: s.efforts.map(x => x.id === id ? { ...r.data, monthly: x.monthly } : x) })); },
  updateEffortMonthly: async (id, month, manday) => {
    set(s => ({ efforts: s.efforts.map(e => e.id === id ? { ...e, monthly: { ...e.monthly, [month]: manday } } : e) }));
    await effortApi.updateMonthly(id, month, manday);
  },
  deleteEffort: async (id)  => { await effortApi.remove(id); set(s => ({ efforts: s.efforts.filter(e => e.id !== id) })); },

  // ── Change Requests ────────────────────────────────────────────────────────
  fetchCRs: async (pid?)    => { set({ changeRequests: (await crApi.getByProject(pid)).data }); },
  createCR: async (c)      => { const r = await crApi.create(c); set(s => ({ changeRequests: [...s.changeRequests, r.data] })); },
  updateCR: async (id, c)  => { const r = await crApi.update(id, c); set(s => ({ changeRequests: s.changeRequests.map(x => x.id === id ? r.data : x) })); },
  deleteCR: async (id)     => { await crApi.remove(id); set(s => ({ changeRequests: s.changeRequests.filter(c => c.id !== id) })); },

  // ── Issues ─────────────────────────────────────────────────────────────────
  fetchIssues: async (pid?)   => { set({ issues: (await issueApi.getByProject(pid)).data }); },
  createIssue: async (i)     => { const r = await issueApi.create(i); set(s => ({ issues: [...s.issues, r.data] })); },
  updateIssue: async (id, i) => { const r = await issueApi.update(id, i); set(s => ({ issues: s.issues.map(x => x.id === id ? r.data : x) })); },
  deleteIssue: async (id)    => { await issueApi.remove(id); set(s => ({ issues: s.issues.filter(i => i.id !== id) })); },

  // ── Risks ──────────────────────────────────────────────────────────────────
  fetchRisks: async (pid?)   => { set({ risks: (await riskApi.getByProject(pid)).data }); },
  createRisk: async (r)     => { const res = await riskApi.create(r); set(s => ({ risks: [...s.risks, res.data] })); },
  updateRisk: async (id, r) => { const res = await riskApi.update(id, r); set(s => ({ risks: s.risks.map(x => x.id === id ? res.data : x) })); },
  deleteRisk: async (id)    => { await riskApi.remove(id); set(s => ({ risks: s.risks.filter(r => r.id !== id) })); },
}));
