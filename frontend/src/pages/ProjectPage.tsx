import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { useStore } from '../store';
import ProjectDetail from '../components/Dashboard/ProjectDetail';
import { C } from '../components/Common';

/**
 * /projects/:projectId/* — resolves the project from the URL, makes it the active
 * project (the store and realtime subscriptions key off it) and renders its workspace.
 */
export default function ProjectPage() {
  const { projectId = '' } = useParams();
  const projects = useStore((state) => state.projects);
  const projectsLoading = useStore((state) => state.projectsLoading);
  const activeProject = useStore((state) => state.activeProject);
  const setActiveProject = useStore((state) => state.setActiveProject);
  const project = projects.find((item) => item.id === projectId) || null;

  React.useEffect(() => {
    if (project && activeProject?.id !== project.id) setActiveProject(project);
  }, [project?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Leaving the workspace: clear the active project so other pages start clean.
  React.useEffect(() => () => { useStore.getState().setActiveProject(null); }, []);

  if (!project) {
    if (projectsLoading || !projects.length) {
      return <div style={{ padding: 32, color: C.text2, fontSize: 13 }}>Loading project…</div>;
    }
    return (
      <div style={{ padding: 32, fontFamily: 'Poppins, sans-serif' }}>
        <h2 style={{ margin: '0 0 6px', fontSize: 16, color: C.text }}>Project not found</h2>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: C.text2 }}>It may have been deleted, or your account cannot access it.</p>
        <Link to="/projects" style={{ fontSize: 13, color: C.primary, fontWeight: 600 }}>Back to Projects</Link>
      </div>
    );
  }

  // Wait until the store switched to this project so no other project's data flashes.
  if (activeProject?.id !== project.id) {
    return <div style={{ padding: 32, color: C.text2, fontSize: 13 }}>Loading project…</div>;
  }
  return <ProjectDetail project={activeProject} />;
}
