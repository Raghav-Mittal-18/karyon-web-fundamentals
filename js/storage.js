/* ============================================================
   KARYON — storage.js
   Single source of truth for all persisted data.
   Everything lives in localStorage as JSON under the "karyon_*"
   keys below. No backend, no network calls — this file IS the
   database layer.
   ============================================================ */

const DB_KEYS = {
  users: 'karyon_users',
  session: 'karyon_currentSession',
  orgs: 'karyon_orgs',
  projects: 'karyon_projects',
  tasks: 'karyon_tasks',
  sprints: 'karyon_sprints',
  comments: 'karyon_comments',
  notifications: 'karyon_notifications',
  files: 'karyon_files',
  activity: 'karyon_activity',
  seeded: 'karyon_seeded'
};

const DB = {
  // ---- low level helpers ----
  _get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      console.error('DB read error', key, e);
      return fallback;
    }
  },
  _set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },

  uid(prefix = 'id') {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  },

  // ---- users ----
  getUsers() { return this._get(DB_KEYS.users, []); },
  saveUsers(list) { this._set(DB_KEYS.users, list); },
  findUserByEmail(email) {
    return this.getUsers().find(u => u.email.toLowerCase() === email.toLowerCase());
  },
  getUserById(id) { return this.getUsers().find(u => u.id === id); },

  // ---- session ----
  getSession() { return this._get(DB_KEYS.session, null); },
  setSession(session) { this._set(DB_KEYS.session, session); },
  clearSession() { localStorage.removeItem(DB_KEYS.session); },
  currentUser() {
    const s = this.getSession();
    if (!s) return null;
    return this.getUserById(s.userId) || null;
  },

  // ---- orgs ----
  getOrgs() { return this._get(DB_KEYS.orgs, []); },
  saveOrgs(list) { this._set(DB_KEYS.orgs, list); },

  // ---- projects ----
  getProjects() { return this._get(DB_KEYS.projects, []); },
  saveProjects(list) { this._set(DB_KEYS.projects, list); },
  getProject(id) { return this.getProjects().find(p => p.id === id); },

  // ---- tasks ----
  getTasks() { return this._get(DB_KEYS.tasks, []); },
  saveTasks(list) { this._set(DB_KEYS.tasks, list); },
  getTasksByProject(projectId) { return this.getTasks().filter(t => t.projectId === projectId); },
  getTask(id) { return this.getTasks().find(t => t.id === id); },

  // ---- sprints ----
  getSprints() { return this._get(DB_KEYS.sprints, []); },
  saveSprints(list) { this._set(DB_KEYS.sprints, list); },
  getSprintsByProject(projectId) { return this.getSprints().filter(s => s.projectId === projectId); },

  // ---- comments ----
  getComments() { return this._get(DB_KEYS.comments, []); },
  saveComments(list) { this._set(DB_KEYS.comments, list); },
  getCommentsByTask(taskId) {
    return this.getComments()
      .filter(c => c.taskId === taskId)
      .sort((a, b) => a.createdAt - b.createdAt);
  },

  // ---- notifications ----
  getNotifications() { return this._get(DB_KEYS.notifications, []); },
  saveNotifications(list) { this._set(DB_KEYS.notifications, list); },
  getNotificationsForUser(userId) {
    return this.getNotifications()
      .filter(n => n.userId === userId)
      .sort((a, b) => b.createdAt - a.createdAt);
  },

  // ---- files (metadata only) ----
  getFiles() { return this._get(DB_KEYS.files, []); },
  saveFiles(list) { this._set(DB_KEYS.files, list); },
  getFilesByProject(projectId) { return this.getFiles().filter(f => f.projectId === projectId); },

  // ---- activity log ----
  getActivity() { return this._get(DB_KEYS.activity, []); },
  saveActivity(list) { this._set(DB_KEYS.activity, list); },
  getActivityByProject(projectId) {
    return this.getActivity()
      .filter(a => a.projectId === projectId)
      .sort((a, b) => b.createdAt - a.createdAt);
  },
  logActivity(projectId, userName, text) {
    const list = this.getActivity();
    list.push({
      id: this.uid('act'),
      projectId,
      userName,
      text,
      createdAt: Date.now()
    });
    this.saveActivity(list);
  },

  // ---- notifications helper ----
  notify(userId, type, text, link) {
    if (!userId) return;
    const list = this.getNotifications();
    list.push({
      id: this.uid('notif'),
      userId,
      type,       // 'assignment' | 'comment' | 'status' | 'deadline' | 'mention'
      text,
      link,       // { view, projectId, taskId }
      read: false,
      createdAt: Date.now()
    });
    this.saveNotifications(list);
  }
};

/* ============================================================
   SEED DATA — only runs once, so a fresh visitor has something
   real to look at instead of an empty void. Demo login is
   shown on the login screen.
   ============================================================ */
function seedDemoData() {
  if (DB._get(DB_KEYS.seeded, false)) return;

  const demoUser = {
    id: DB.uid('user'),
    name: 'Aria Shah',
    email: 'demo@karyon.app',
    password: 'demo1234',
    org: 'Northlight Studio',
    role: 'Project Manager',
    createdAt: Date.now()
  };
  const teammates = [
    { id: DB.uid('user'), name: 'Devon Park', email: 'devon@karyon.app', password: 'demo1234', org: 'Northlight Studio', role: 'Developer', createdAt: Date.now() },
    { id: DB.uid('user'), name: 'Priya Nair', email: 'priya@karyon.app', password: 'demo1234', org: 'Northlight Studio', role: 'Developer', createdAt: Date.now() },
    { id: DB.uid('user'), name: 'Marcus Lee', email: 'marcus@karyon.app', password: 'demo1234', org: 'Northlight Studio', role: 'QA', createdAt: Date.now() }
  ];
  DB.saveUsers([demoUser, ...teammates]);

  const org = { id: DB.uid('org'), name: 'Northlight Studio', ownerId: demoUser.id, createdAt: Date.now() };
  DB.saveOrgs([org]);

  const project = {
    id: DB.uid('proj'),
    orgId: org.id,
    name: 'Aperture — Client Portal Revamp',
    description: 'Rebuild the client-facing portal with a new design system, faster reporting, and self-serve billing.',
    startDate: '2026-07-01',
    deadline: '2026-10-15',
    visibility: 'Team',
    ownerId: demoUser.id,
    members: [
      { userId: demoUser.id, role: 'Project Manager' },
      { userId: teammates[0].id, role: 'Developer' },
      { userId: teammates[1].id, role: 'Developer' },
      { userId: teammates[2].id, role: 'QA' }
    ],
    createdAt: Date.now()
  };
  DB.saveProjects([project]);

  const statuses = ['To Do', 'In Progress', 'Code Review', 'Testing', 'Completed'];
  const categories = ['Frontend', 'Backend', 'Testing'];
  const titles = [
    'Design token audit', 'Set up component library', 'Build auth screens',
    'Wire billing API', 'Portal dashboard layout', 'Notification center',
    'QA pass on onboarding flow', 'Fix Safari flexbox bug', 'Write API integration tests',
    'Set up CI pipeline', 'Empty states for tables', 'Accessibility audit'
  ];
  const tasks = titles.map((title, i) => {
    const assignee = [demoUser, ...teammates][i % 4];
    return {
      id: DB.uid('task'),
      projectId: project.id,
      title,
      description: `Work item: ${title.toLowerCase()}.`,
      category: categories[i % categories.length],
      assigneeId: assignee.id,
      priority: ['Low', 'Medium', 'High'][i % 3],
      deadline: `2026-0${8 + (i % 2)}-${10 + (i % 15)}`,
      status: statuses[i % statuses.length],
      createdAt: Date.now() - (titles.length - i) * 86400000
    };
  });
  DB.saveTasks(tasks);

  const sprint = {
    id: DB.uid('sprint'),
    projectId: project.id,
    name: 'Sprint 1 — Foundations',
    startDate: '2026-08-01',
    endDate: '2026-08-14',
    taskIds: tasks.slice(0, 6).map(t => t.id),
    createdAt: Date.now()
  };
  DB.saveSprints([sprint]);

  DB.saveComments([
    {
      id: DB.uid('cmt'), taskId: tasks[0].id, userId: teammates[0].id,
      text: `Started the audit, will loop in @${demoUser.name} once the token sheet is ready.`,
      createdAt: Date.now() - 3600000
    }
  ]);

  DB.saveFiles([
    { id: DB.uid('file'), projectId: project.id, taskId: null, name: 'design-tokens.fig', type: 'fig', uploadedBy: demoUser.name, createdAt: Date.now() - 7200000 },
    { id: DB.uid('file'), projectId: project.id, taskId: null, name: 'requirements.pdf', type: 'pdf', uploadedBy: demoUser.name, createdAt: Date.now() - 86400000 }
  ]);

  DB.saveActivity([
    { id: DB.uid('act'), projectId: project.id, userName: demoUser.name, text: 'created the project', createdAt: Date.now() - 172800000 },
    { id: DB.uid('act'), projectId: project.id, userName: demoUser.name, text: 'added 4 team members', createdAt: Date.now() - 172000000 },
    { id: DB.uid('act'), projectId: project.id, userName: teammates[0].name, text: `moved "${tasks[0].title}" to In Progress`, createdAt: Date.now() - 3600000 }
  ]);

  DB.notify(demoUser.id, 'comment', `${teammates[0].name} commented on "${tasks[0].title}"`, { view: 'task', projectId: project.id, taskId: tasks[0].id });
  DB.notify(demoUser.id, 'deadline', `"${tasks[7].title}" is due soon`, { view: 'task', projectId: project.id, taskId: tasks[7].id });

  DB._set(DB_KEYS.seeded, true);
}
