/* ============================================================
   KARYON — app.js
   The post-login single-page application. Handles routing
   between Overview / Projects / Project Detail, and every
   piece of interactivity therein.
   ============================================================ */

const STATUSES = ['To Do', 'In Progress', 'Code Review', 'Testing', 'Completed'];

const App = {
  currentUser: null,
  activeProjectId: null,
  activeTab: 'board',
  activeTaskId: null,
  dangerAction: null,
  boardFilters: { assignee: '', priority: '', category: '' },

  init() {
    if (!Auth.requireAuth()) return;
    this.currentUser = DB.currentUser();
    this.renderSidebarUser();
    this.renderSidebarProjects();
    this.wireGlobalUI();
    this.checkDeadlineNotifications();

    const params = new URLSearchParams(window.location.search);
    if (params.get('welcome')) {
      this.toast(`Welcome to Karyon, ${this.currentUser.name.split(' ')[0]}.`);
      history.replaceState(null, '', 'dashboard.html');
    }

    const hash = window.location.hash.replace('#', '');
    if (hash === 'projects') this.showView('projects');
    else this.showView('overview');

    window.addEventListener('hashchange', () => {
      const h = window.location.hash.replace('#', '');
      if (h === 'projects') this.showView('projects');
      else if (h === 'overview' || h === '') this.showView('overview');
    });
  },

  /* ================= NAVIGATION ================= */
  showView(view, projectId) {
    document.querySelectorAll('.view').forEach(v => v.classList.add('view-hidden'));
    document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));

    if (view === 'overview') {
      document.getElementById('view-overview').classList.remove('view-hidden');
      document.querySelector('.sidebar-link[data-view="overview"]').classList.add('active');
      document.getElementById('topbar-eyebrow').textContent = 'Workspace';
      document.getElementById('topbar-title').textContent = 'Overview';
      this.renderOverview();
    } else if (view === 'projects') {
      document.getElementById('view-projects').classList.remove('view-hidden');
      document.querySelector('.sidebar-link[data-view="projects"]').classList.add('active');
      document.getElementById('topbar-eyebrow').textContent = 'Workspace';
      document.getElementById('topbar-title').textContent = 'All Projects';
      this.renderProjectGrid();
    } else if (view === 'project') {
      document.getElementById('view-project').classList.remove('view-hidden');
      this.activeProjectId = projectId;
      this.renderProjectDetail();
    }
    this.renderSidebarProjects();
  },

  wireGlobalUI() {
    document.querySelectorAll('.sidebar-link[data-view]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        this.showView(link.dataset.view);
      });
    });

    document.getElementById('logout-btn').addEventListener('click', () => {
      Auth.logout();
      window.location.href = 'index.html';
    });

    document.getElementById('new-project-btn').addEventListener('click', () => openModal('modal-new-project'));
    document.getElementById('form-new-project').addEventListener('submit', (e) => this.handleNewProject(e));

    // Notification bell
    const bellBtn = document.getElementById('bell-btn');
    const notifPanel = document.getElementById('notif-panel');
    bellBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      notifPanel.classList.toggle('open');
      this.renderNotifications();
    });
    document.addEventListener('click', (e) => {
      if (!notifPanel.contains(e.target) && e.target !== bellBtn) notifPanel.classList.remove('open');
    });
    document.getElementById('mark-all-read').addEventListener('click', () => {
      const list = DB.getNotifications().map(n => n.userId === this.currentUser.id ? { ...n, read: true } : n);
      DB.saveNotifications(list);
      this.renderNotifications();
      this.updateBellBadge();
    });

    // Global search (across tasks + projects), simple inline filter feedback via toast-free redirect
    document.getElementById('global-search').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.handleGlobalSearch(e.target.value);
    });

    // modal close wiring (shared)
    document.querySelectorAll('[data-close-modal]').forEach(btn => btn.addEventListener('click', closeAllModals));
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => { if (e.target === overlay) closeAllModals(); });
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAllModals(); });

    // Project detail tabs
    document.getElementById('pd-tabs').addEventListener('click', (e) => {
      const btn = e.target.closest('.tab-btn');
      if (!btn) return;
      this.switchTab(btn.dataset.tab);
    });

    document.getElementById('pd-new-task-btn').addEventListener('click', () => this.openNewTaskModal());
    document.getElementById('form-new-task').addEventListener('submit', (e) => this.handleNewTask(e));

    document.getElementById('pd-manage-team-btn').addEventListener('click', () => this.openTeamModal());
    document.getElementById('team-add-btn').addEventListener('click', () => this.handleAddTeamMember());
    document.getElementById('leave-project-btn').addEventListener('click', () => this.requestLeaveProject());
    document.getElementById('leave-organization-btn').addEventListener('click', () => this.requestLeaveOrganization());
    document.getElementById('confirm-delete-input').addEventListener('input', (e) => {
      document.getElementById('confirm-delete-button').disabled = e.target.value.trim() !== 'Delete';
    });
    document.getElementById('confirm-delete-button').addEventListener('click', () => this.confirmDangerAction());
    document.getElementById('owner-manage-btn').addEventListener('click', () => {
      closeAllModals();
      this.openTeamModal();
    });

    document.getElementById('pd-upload-file-btn').addEventListener('click', () => openModal('modal-file'));
    document.getElementById('tab-upload-file-btn').addEventListener('click', () => openModal('modal-file'));
    document.getElementById('file-add-btn').addEventListener('click', () => this.handleAddFile());

    document.getElementById('new-sprint-btn').addEventListener('click', () => this.openSprintModal());
    document.getElementById('form-new-sprint').addEventListener('submit', (e) => this.handleNewSprint(e));

    // task detail modal
    document.getElementById('td-edit-btn').addEventListener('click', () => this.openEditTaskModal());
    document.getElementById('td-delete-btn').addEventListener('click', () => this.requestDeleteTask());
    document.getElementById('form-edit-task').addEventListener('submit', (e) => this.handleEditTask(e));
    document.getElementById('td-status').addEventListener('change', (e) => this.handleStatusChange(e.target.value));
    document.getElementById('td-comment-submit').addEventListener('click', () => this.handleAddComment());
    document.getElementById('td-comment-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !document.getElementById('mention-dropdown').classList.contains('open')) {
        this.handleAddComment();
      }
    });
    document.getElementById('td-comment-input').addEventListener('input', (e) => this.handleMentionInput(e));

    // board filters
    ['assignee', 'priority', 'category'].forEach(key => {
      document.getElementById(`board-filter-${key}`).addEventListener('change', (e) => {
        this.boardFilters[key] = e.target.value;
        this.renderKanban();
      });
    });
  },

  /* ================= SIDEBAR ================= */
  renderSidebarUser() {
    const u = this.currentUser;
    document.getElementById('sidebar-avatar').textContent = initials(u.name);
    document.getElementById('sidebar-user-name').textContent = u.name;
    document.getElementById('sidebar-user-role').textContent = u.role;
  },

  renderSidebarProjects() {
    const projects = DB.getProjects().filter(p => p.members.some(m => m.userId === this.currentUser.id) || p.ownerId === this.currentUser.id);
    const container = document.getElementById('sidebar-project-list');
    container.innerHTML = projects.map(p => `
      <a href="#" data-project-id="${p.id}" class="${this.activeProjectId === p.id ? 'active' : ''}">${escapeHtml(p.name)}</a>
    `).join('') || `<a href="#" style="color:var(--text-faint); pointer-events:none;">No projects yet</a>`;

    container.querySelectorAll('a[data-project-id]').forEach(a => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        this.showView('project', a.dataset.projectId);
      });
    });
  },

  /* ================= OVERVIEW ================= */
  renderOverview() {
    const myProjects = this.getMyProjects();
    const myProjectIds = myProjects.map(p => p.id);
    const allTasks = DB.getTasks().filter(t => myProjectIds.includes(t.projectId));

    const completed = allTasks.filter(t => t.status === 'Completed').length;
    const active = allTasks.filter(t => t.status !== 'Completed').length;
    const overdue = allTasks.filter(t => t.status !== 'Completed' && isOverdue(t.deadline)).length;

    document.getElementById('ov-total-projects').textContent = myProjects.length;
    document.getElementById('ov-active-tasks').textContent = active;
    document.getElementById('ov-completed-tasks').textContent = completed;
    document.getElementById('ov-overdue-tasks').textContent = overdue;

    const pct = allTasks.length ? Math.round((completed / allTasks.length) * 100) : 0;
    document.getElementById('ov-progress-pct').textContent = `${pct}%`;
    requestAnimationFrame(() => { document.getElementById('ov-progress-fill').style.width = `${pct}%`; });

    const upcoming = allTasks
      .filter(t => t.status !== 'Completed' && t.deadline)
      .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
      .slice(0, 6);
    const deadlinesEl = document.getElementById('ov-deadlines');
    deadlinesEl.innerHTML = upcoming.length ? upcoming.map(t => {
      const proj = DB.getProject(t.projectId);
      const overdueNow = isOverdue(t.deadline);
      return `<div class="deadline-row">
        <div><div class="dtitle">${escapeHtml(t.title)}</div><div class="dmeta">${escapeHtml(proj ? proj.name : '')}</div></div>
        <span class="pill ${overdueNow ? 'pill-overdue' : priorityPillClass(t.priority)}">${overdueNow ? 'Overdue' : t.deadline}</span>
      </div>`;
    }).join('') : `<div class="empty-state">No upcoming deadlines. You're clear.</div>`;

    const activity = DB.getActivity().filter(a => myProjectIds.includes(a.projectId)).sort((a, b) => b.createdAt - a.createdAt).slice(0, 8);
    document.getElementById('ov-activity').innerHTML = renderActivityRows(activity);
    this.renderOverviewAdditions(myProjects.find(project => project.id === this.activeProjectId) || myProjects[0] || null);
  },

  renderOverviewAdditions(project) {
    const memberList = document.getElementById('dashboard-member-list');
    const sprintChart = document.getElementById('dashboard-sprint-chart');
    document.getElementById('dashboard-team-project').textContent = project ? project.name : 'No project selected';
    document.getElementById('dashboard-sprint-project').textContent = project ? project.name : 'No project selected';
    if (!project) {
      document.getElementById('dashboard-team-count').textContent = '0 members';
      memberList.innerHTML = '<div class="dashboard-sprint-empty">No project yet.</div>';
      document.getElementById('dashboard-sprint-pct').textContent = '—';
      sprintChart.innerHTML = '<div class="dashboard-sprint-empty">No active sprint.</div>';
      document.getElementById('dashboard-sprint-meta').innerHTML = '';
      return;
    }

    const members = (project.members || []).map(m => ({ membership: m, user: DB.getUserById(m.userId) })).filter(item => item.user);
    document.getElementById('dashboard-team-count').textContent = `${members.length} member${members.length === 1 ? '' : 's'}`;
    memberList.innerHTML = members.length ? members.map(({ membership, user }) => `
      <button class="dashboard-member" data-member-id="${user.id}" title="Open team management">
        <span class="avatar dashboard-member-avatar">${initials(user.name)}</span>
        <span class="dashboard-member-name">${escapeHtml(user.name)}</span>
        <span class="dashboard-member-tooltip">${escapeHtml(user.name)}<small>${escapeHtml(membership.role || user.role || 'Member')}</small></span>
      </button>
    `).join('') : '<div class="dashboard-sprint-empty">No members yet.</div>';
    memberList.querySelectorAll('.dashboard-member').forEach(member => member.addEventListener('click', () => {
      this.activeProjectId = project.id;
      this.openTeamModal();
    }));

    const sprint = DB.getSprintsByProject(project.id).sort((a, b) => b.createdAt - a.createdAt)[0];
    const sprintTasks = sprint ? (sprint.taskIds || []).map(id => DB.getTask(id)).filter(task => task && task.projectId === project.id) : [];
    const completed = sprintTasks.filter(task => task.status === 'Completed').length;
    const pct = sprintTasks.length ? Math.round((completed / sprintTasks.length) * 100) : null;
    document.getElementById('dashboard-sprint-pct').textContent = pct === null ? '—' : `${pct}%`;
    document.getElementById('dashboard-sprint-meta').innerHTML = sprint ? `<span>${escapeHtml(sprint.name)}</span><span>${completed} / ${sprintTasks.length} tasks completed</span>` : '';
    if (!sprint || !sprintTasks.length) {
      sprintChart.innerHTML = '<div class="dashboard-sprint-empty">No tasks</div>';
      return;
    }

    const ordered = sprintTasks.slice().sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    let done = 0;
    const points = ordered.map((task, index) => {
      if (task.status === 'Completed') done += 1;
      return `${Math.round((index / Math.max(1, ordered.length - 1)) * 100)},${100 - Math.round((done / ordered.length) * 100)}`;
    });
    if (points.length === 1) points.push(`100,${100 - (ordered[0].status === 'Completed' ? 100 : 0)}`);
    const linePoints = points.join(' ');
    const areaPoints = `0,100 ${linePoints} 100,100`;
    sprintChart.innerHTML = `<svg class="dashboard-sprint-svg" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="${pct}% of sprint tasks completed">
      <line class="dashboard-sprint-grid" x1="0" y1="25" x2="100" y2="25"></line><line class="dashboard-sprint-grid" x1="0" y1="50" x2="100" y2="50"></line><line class="dashboard-sprint-grid" x1="0" y1="75" x2="100" y2="75"></line>
      <polygon class="dashboard-sprint-area" points="${areaPoints}"></polygon><polyline class="dashboard-sprint-line" points="${linePoints}"></polyline>
    </svg>`;
  },

  getMyProjects() {
    return DB.getProjects().filter(p => p.members.some(m => m.userId === this.currentUser.id) || p.ownerId === this.currentUser.id);
  },

  /* ================= PROJECTS GRID ================= */
  renderProjectGrid() {
    const projects = this.getMyProjects();
    const grid = document.getElementById('project-grid');
    if (!projects.length) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">No projects yet. Start one to see it here.<br><button class="btn btn-accent btn-sm" id="empty-new-project">+ New Project</button></div>`;
      document.getElementById('empty-new-project').addEventListener('click', () => openModal('modal-new-project'));
      return;
    }
    grid.innerHTML = projects.map(p => {
      const tasks = DB.getTasksByProject(p.id);
      const completed = tasks.filter(t => t.status === 'Completed').length;
      const pct = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;
      return `
      <div class="project-card" data-id="${p.id}">
        <h4>${escapeHtml(p.name)}</h4>
        <p>${escapeHtml(p.description || 'No description yet.')}</p>
        <div class="pmeta"><span>${tasks.length} tasks · ${pct}% done</span><span>${p.deadline || '—'}</span></div>
        <div class="avatar-stack">
          ${p.members.slice(0, 4).map(m => {
            const u = DB.getUserById(m.userId);
            return u ? `<div class="avatar" title="${escapeHtml(u.name)}">${initials(u.name)}</div>` : '';
          }).join('')}
        </div>
      </div>`;
    }).join('');
    grid.querySelectorAll('.project-card').forEach(card => {
      card.addEventListener('click', () => this.showView('project', card.dataset.id));
    });
  },

  handleNewProject(e) {
    e.preventDefault();
    const name = document.getElementById('np-name').value.trim();
    if (!name) return;
    const project = {
      id: DB.uid('proj'),
      orgId: null,
      name,
      description: document.getElementById('np-desc').value.trim(),
      startDate: document.getElementById('np-start').value,
      deadline: document.getElementById('np-deadline').value,
      visibility: document.getElementById('np-visibility').value,
      ownerId: this.currentUser.id,
      members: [{ userId: this.currentUser.id, role: this.currentUser.role || 'Project Manager' }],
      createdAt: Date.now()
    };
    const list = DB.getProjects();
    list.push(project);
    DB.saveProjects(list);
    DB.logActivity(project.id, this.currentUser.name, 'created the project');
    closeAllModals();
    e.target.reset();
    this.toast(`Project "${name}" created.`);
    this.showView('project', project.id);
  },

  /* ================= PROJECT DETAIL ================= */
  renderProjectDetail() {
    const project = DB.getProject(this.activeProjectId);
    if (!project) { this.showView('projects'); return; }

    document.getElementById('topbar-eyebrow').textContent = 'Project';
    document.getElementById('topbar-title').textContent = project.name;
    document.getElementById('pd-org').textContent = project.visibility + ' · Project';
    document.getElementById('pd-name').textContent = project.name;

    this.populateAssigneeSelects(project);
    this.switchTab(this.activeTab || 'board');
  },

  switchTab(tab) {
    this.activeTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.pd-tab-panel').forEach(p => p.classList.add('view-hidden'));
    document.getElementById(`tab-${tab}`).classList.remove('view-hidden');

    if (tab === 'board') this.renderKanban();
    else if (tab === 'sprints') this.renderSprints();
    else if (tab === 'files') this.renderFiles();
    else if (tab === 'activity') this.renderProjectActivity();
    else if (tab === 'analytics') this.renderAnalytics();
  },

  populateAssigneeSelects(project) {
    const members = project.members.map(m => DB.getUserById(m.userId)).filter(Boolean);
    const opts = members.map(u => `<option value="${u.id}">${escapeHtml(u.name)}</option>`).join('');
    document.getElementById('nt-assignee').innerHTML = opts;
    document.getElementById('board-filter-assignee').innerHTML = `<option value="">All assignees</option>${opts}`;

    const categories = [...new Set(DB.getTasksByProject(project.id).map(t => t.category))];
    document.getElementById('board-filter-category').innerHTML = `<option value="">All categories</option>` +
      categories.map(c => `<option value="${c}">${c}</option>`).join('');
  },

  /* ================= KANBAN ================= */
  renderKanban() {
    const project = DB.getProject(this.activeProjectId);
    let tasks = DB.getTasksByProject(project.id);

    const f = this.boardFilters;
    if (f.assignee) tasks = tasks.filter(t => t.assigneeId === f.assignee);
    if (f.priority) tasks = tasks.filter(t => t.priority === f.priority);
    if (f.category) tasks = tasks.filter(t => t.category === f.category);

    const board = document.getElementById('kanban-board');
    board.innerHTML = STATUSES.map(status => {
      const colTasks = tasks.filter(t => t.status === status);
      return `
      <div class="kanban-col">
        <div class="kanban-col-head">
          <span class="colname">${status}</span>
          <span class="colcount">${colTasks.length}</span>
        </div>
        <div class="kanban-col-body" data-status="${status}">
          ${colTasks.map(t => renderTaskCard(t)).join('')}
        </div>
      </div>`;
    }).join('');

    // wire card clicks
    board.querySelectorAll('.task-card').forEach(card => {
      card.addEventListener('click', () => this.openTaskDetail(card.dataset.id));
      wireDrag(card);
    });
    // wire column drop zones
    board.querySelectorAll('.kanban-col-body').forEach(col => wireDropZone(col, (taskId, newStatus) => {
      this.moveTask(taskId, newStatus);
    }));
  },

  moveTask(taskId, newStatus) {
    const tasks = DB.getTasks();
    const task = tasks.find(t => t.id === taskId);
    if (!task || task.status === newStatus) return;
    const oldStatus = task.status;
    task.status = newStatus;
    DB.saveTasks(tasks);

    const project = DB.getProject(task.projectId);
    DB.logActivity(task.projectId, this.currentUser.name, `moved "${task.title}" from ${oldStatus} to ${newStatus}`);

    if (task.assigneeId && task.assigneeId !== this.currentUser.id) {
      DB.notify(task.assigneeId, 'status', `${this.currentUser.name} moved "${task.title}" to ${newStatus}`, { view: 'task', projectId: task.projectId, taskId: task.id });
    }
    if (newStatus === 'Completed') this.toast(`"${task.title}" marked complete.`);
    this.renderKanban();
    this.updateBellBadge();
  },

  openNewTaskModal() {
    document.getElementById('form-new-task').reset();
    openModal('modal-new-task');
  },

    validateTaskForm(title, deadline) {
    if (!title) {
      this.toast('Task title is required.');
      return false;
    }

    if (title.length < 3) {
      this.toast('Task title must be at least 3 characters.');
      return false;
    }

    if (deadline) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const selectedDate = new Date(`${deadline}T00:00:00`);

      if (selectedDate < today) {
        this.toast('Task deadline cannot be in the past.');
        return false;
      }
    }

    return true;
  },

  handleNewTask(e) {
  e.preventDefault();

  const title = document.getElementById('nt-title').value.trim();
  const deadline = document.getElementById('nt-deadline').value;

  if (!this.validateTaskForm(title, deadline)) {
    return;
  }
    const task = {
      id: DB.uid('task'),
      projectId: this.activeProjectId,
      title,
      description: document.getElementById('nt-desc').value.trim(),
      category: document.getElementById('nt-category').value,
      assigneeId: document.getElementById('nt-assignee').value,
      priority: document.getElementById('nt-priority').value,
      deadline: document.getElementById('nt-deadline').value,
      status: 'To Do',
      createdAt: Date.now()
    };
    const list = DB.getTasks();
    list.push(task);
    DB.saveTasks(list);

    DB.logActivity(this.activeProjectId, this.currentUser.name, `created task "${title}"`);
    if (task.assigneeId && task.assigneeId !== this.currentUser.id) {
      DB.notify(task.assigneeId, 'assignment', `${this.currentUser.name} assigned you "${title}"`, { view: 'task', projectId: this.activeProjectId, taskId: task.id });
    }
    closeAllModals();
    this.toast(`Task "${title}" created.`);
    this.populateAssigneeSelects(DB.getProject(this.activeProjectId));
    this.renderKanban();
    this.updateBellBadge();
  },

  /* ================= TASK DETAIL ================= */
  openTaskDetail(taskId) {
  this.activeTaskId = taskId;

  const task = DB.getTask(taskId);

  if (!task) {
    this.toast('Task no longer exists.');
    return;
  }

  const project = DB.getProject(task.projectId);

  if (!project) {
    this.toast('Project no longer exists.');
    return;
  }
    const assignee = DB.getUserById(task.assigneeId);

    document.getElementById('td-category').textContent = task.category;
    document.getElementById('td-title').textContent = task.title;
    document.getElementById('td-desc').textContent = task.description || 'No description provided.';
    document.getElementById('td-status').value = task.status;
    document.getElementById('td-assignee').textContent = assignee ? assignee.name : 'Unassigned';
    document.getElementById('td-priority').innerHTML = `<span class="pill ${priorityPillClass(task.priority)}">${task.priority}</span>`;
    document.getElementById('td-deadline').textContent = task.deadline || '—';
    document.getElementById('td-created').textContent = new Date(task.createdAt).toLocaleDateString();

    this.renderComments(task.id);
    document.getElementById('td-comment-input').value = '';
    openModal('modal-task-detail');
  },

  handleStatusChange(newStatus) {
    this.moveTask(this.activeTaskId, newStatus);
  },
  openEditTaskModal() {
  const task = DB.getTask(this.activeTaskId);

  if (!task) {
    this.toast('Task no longer exists.');
    return;
  }

  const project = DB.getProject(task.projectId);

  if (!project) {
    this.toast('Project no longer exists.');
    return;
  }

  document.getElementById('et-title').value = task.title || '';
  document.getElementById('et-desc').value = task.description || '';
  document.getElementById('et-category').value = task.category || 'Frontend';
  document.getElementById('et-priority').value = task.priority || 'Medium';
  document.getElementById('et-deadline').value = task.deadline || '';
  document.getElementById('et-status').value = task.status || 'To Do';

  const assigneeSelect = document.getElementById('et-assignee');

  const members = project.members
    .map(m => DB.getUserById(m.userId))
    .filter(Boolean);

  assigneeSelect.innerHTML = members
    .map(u => `<option value="${u.id}">${escapeHtml(u.name)}</option>`)
    .join('');

  assigneeSelect.value = task.assigneeId || '';

  openModal('modal-edit-task');
},

handleEditTask(e) {
  e.preventDefault();

  const tasks = DB.getTasks();
  const task = tasks.find(t => t.id === this.activeTaskId);

  if (!task) {
    this.toast('Task no longer exists.');
    closeAllModals();
    return;
  }

  const title = document.getElementById('et-title').value.trim();
const deadline = document.getElementById('et-deadline').value;

if (!this.validateTaskForm(title, deadline)) {
  return;
}

const oldTitle = task.title;

task.title = title;
task.description = document.getElementById('et-desc').value.trim();
task.category = document.getElementById('et-category').value;
task.priority = document.getElementById('et-priority').value;
task.assigneeId = document.getElementById('et-assignee').value;
task.deadline = deadline;
task.status = document.getElementById('et-status').value;
task.updatedAt = Date.now();

  DB.saveTasks(tasks);

  DB.logActivity(
    task.projectId,
    this.currentUser.name,
    `updated task "${oldTitle}"`
  );

  closeAllModals();

  this.toast(`Task "${task.title}" updated.`);

  this.renderKanban();

  this.openTaskDetail(task.id);

  this.renderOverview();
  this.renderAnalytics();
},
requestDeleteTask() {
  const task = DB.getTask(this.activeTaskId);

  if (!task) {
    this.toast('Task no longer exists.');
    return;
  }

  this.openDangerAction(
    'Delete Task?',
    `You are about to permanently delete "${task.title}". This action cannot be undone.`,
    {
      type: 'delete-task',
      taskId: task.id,
      projectId: task.projectId
    }
  );
},


  renderComments(taskId) {
    const comments = DB.getCommentsByTask(taskId);
    const el = document.getElementById('td-comments');
    el.innerHTML = comments.length ? comments.map(c => {
      const u = DB.getUserById(c.userId);
      return `<div class="comment-item">
        <div class="avatar">${initials(u ? u.name : '?')}</div>
        <div class="comment-body">
          <div class="comment-author">${escapeHtml(u ? u.name : 'Unknown')}</div>
          <div class="comment-text">${formatCommentText(c.text)}</div>
          <div class="comment-time">${timeAgo(c.createdAt)}</div>
        </div>
      </div>`;
    }).join('') : `<div class="empty-state" style="padding:16px 4px;">No comments yet. Start the thread.</div>`;
    el.scrollTop = el.scrollHeight;
  },

  handleMentionInput(e) {
    const input = e.target;
    const val = input.value;
    const caret = input.selectionStart;
    const upToCaret = val.slice(0, caret);
    const match = upToCaret.match(/@([a-zA-Z]*)$/);
    const dropdown = document.getElementById('mention-dropdown');

    if (!match) { dropdown.classList.remove('open'); return; }

    const project = DB.getProject(this.activeProjectId);
    const members = project.members.map(m => DB.getUserById(m.userId)).filter(Boolean);
    const query = match[1].toLowerCase();
    const results = members.filter(u => u.name.toLowerCase().includes(query));

    if (!results.length) { dropdown.classList.remove('open'); return; }

    dropdown.innerHTML = results.map(u => `<div class="mention-item" data-name="${escapeHtml(u.name)}">${escapeHtml(u.name)}</div>`).join('');
    dropdown.classList.add('open');
    dropdown.querySelectorAll('.mention-item').forEach(item => {
      item.addEventListener('click', () => {
        const name = item.dataset.name;
        input.value = val.slice(0, caret).replace(/@([a-zA-Z]*)$/, `@${name} `) + val.slice(caret);
        dropdown.classList.remove('open');
        input.focus();
      });
    });
  },

  handleAddComment() {
    const input = document.getElementById('td-comment-input');
    const text = input.value.trim();
    if (!text) return;
    const task = DB.getTask(this.activeTaskId);

    const comment = { id: DB.uid('cmt'), taskId: task.id, userId: this.currentUser.id, text, createdAt: Date.now() };
    const list = DB.getComments();
    list.push(comment);
    DB.saveComments(list);

    DB.logActivity(task.projectId, this.currentUser.name, `commented on "${task.title}"`);

    // notify assignee if not self
    if (task.assigneeId && task.assigneeId !== this.currentUser.id) {
      DB.notify(task.assigneeId, 'comment', `${this.currentUser.name} commented on "${task.title}"`, { view: 'task', projectId: task.projectId, taskId: task.id });
    }
    // notify mentioned users
    const project = DB.getProject(task.projectId);
    const members = project.members.map(m => DB.getUserById(m.userId)).filter(Boolean);
    members.forEach(u => {
      if (u.id !== this.currentUser.id && text.includes(`@${u.name}`)) {
        DB.notify(u.id, 'mention', `${this.currentUser.name} mentioned you in "${task.title}"`, { view: 'task', projectId: task.projectId, taskId: task.id });
      }
    });

    input.value = '';
    this.renderComments(task.id);
    this.updateBellBadge();
  },

  /* ================= TEAM ================= */
  openTeamModal() {
    this.renderTeamList();
    document.getElementById('team-add-error').textContent = '';
    openModal('modal-team');
  },

  renderTeamList() {
    const project = DB.getProject(this.activeProjectId);
    const el = document.getElementById('team-current-list');
    if (!project) { el.innerHTML = '<div class="empty-state">Project no longer exists.</div>'; return; }
    const membership = (project.members || []).find(m => m.userId === this.currentUser.id);
    const canManage = project.ownerId === this.currentUser.id || ['Project Manager', 'Project Owner', 'Leader'].includes(membership?.role);
    el.innerHTML = (project.members || []).map(m => {
      const u = DB.getUserById(m.userId);
      if (!u) return '';
      const canRemove = canManage && u.id !== this.currentUser.id && u.id !== project.ownerId;
      return `<div class="deadline-row"><div class="user-chip" style="padding:0;"><div class="avatar">${initials(u.name)}</div><div class="user-chip-info"><div class="user-chip-name">${escapeHtml(u.name)}</div><div class="user-chip-role">${escapeHtml(u.email)}</div></div></div><div style="display:flex;align-items:center;gap:8px;"><span class="pill pill-low">${escapeHtml(m.role || u.role || 'Member')}</span>${canRemove ? `<button class="btn btn-outline team-remove-btn" data-remove-member="${u.id}">Remove</button>` : ''}</div></div>`;
    }).join('');
    el.querySelectorAll('[data-remove-member]').forEach(button => button.addEventListener('click', () => this.requestRemoveMember(button.dataset.removeMember)));
  },

  requestLeaveProject() {
    const project = DB.getProject(this.activeProjectId);
    if (!project) return;
    if (project.ownerId === this.currentUser.id) {
      this.showOwnerAction('Project Owner Action Required', 'You are currently the owner of this project. Transfer project ownership to another member before leaving.');
      return;
    }
    this.openDangerAction('Leave Project?', `You are about to leave ${project.name}. Your membership will be removed from this project. This action cannot be undone automatically.`, { type: 'leave-project', projectId: project.id });
  },

  requestLeaveOrganization() {
    const org = DB.getOrgs().find(item => item.name && item.name.toLowerCase() === (this.currentUser.org || '').toLowerCase());
    if (!org) {
      this.toast('You are not connected to an organization.');
      return;
    }
    if (org.ownerId === this.currentUser.id) {
      this.showOwnerAction('Organization Owner Action Required', 'Transfer organization ownership before leaving.');
      document.getElementById('owner-manage-btn').textContent = 'Manage Organization';
      return;
    }
    this.openDangerAction('Leave Organization?', `Organization: ${org.name}. You will lose access to projects and organization resources associated with this organization.`, { type: 'leave-organization', orgId: org.id });
  },

  requestRemoveMember(userId) {
    const project = DB.getProject(this.activeProjectId);
    const member = project?.members?.find(item => item.userId === userId);
    const user = DB.getUserById(userId);
    const managerMembership = project?.members?.find(item => item.userId === this.currentUser.id);
    const canManage = project && (project.ownerId === this.currentUser.id || ['Project Manager', 'Project Owner', 'Leader'].includes(managerMembership?.role));
    if (!project || !member || !user || !canManage || userId === this.currentUser.id || userId === project.ownerId) return;
    this.openDangerAction('Remove Member?', `Member: ${user.name}. Project: ${project.name}.`, { type: 'remove-member', projectId: project.id, userId });
  },

  showOwnerAction(title, copy) {
    document.getElementById('owner-modal-title').textContent = title;
    document.getElementById('owner-modal-copy').textContent = copy;
    document.getElementById('owner-manage-btn').textContent = title.startsWith('Organization') ? 'Manage Organization' : 'Manage Team';
    openModal('modal-owner-action');
  },

  openDangerAction(title, copy, action) {
    this.dangerAction = action;
    document.getElementById('danger-modal-title').textContent = title;
    document.getElementById('danger-modal-copy').textContent = copy;
    document.getElementById('danger-modal-error').textContent = '';
    const input = document.getElementById('confirm-delete-input');
    input.value = '';
    document.getElementById('confirm-delete-button').disabled = true;
    document.getElementById('confirm-delete-button').textContent =
  action.type === 'remove-member'
    ? 'Remove Member'
    : action.type === 'leave-project'
      ? 'Leave Project'
      : action.type === 'leave-organization'
        ? 'Leave Organization'
        : 'Delete Task';
openModal('modal-danger-action');
  },

  confirmDangerAction() {
    if (!this.dangerAction || document.getElementById('confirm-delete-input').value.trim() !== 'Delete') return;
    const currentUser = DB.currentUser();
    if (!currentUser) { document.getElementById('danger-modal-error').textContent = 'Your account is no longer available.'; return; }
    const action = this.dangerAction;
    if (action.type === 'leave-project') {
      const projects = DB.getProjects();
      const project = projects.find(item => item.id === action.projectId);
      if (!project || project.ownerId === currentUser.id || !(project.members || []).some(item => item.userId === currentUser.id)) {
        document.getElementById('danger-modal-error').textContent = 'This project membership has changed. Refresh and try again.';
        return;
      }
      project.members = project.members.filter(item => item.userId !== currentUser.id);
      DB.saveProjects(projects);
      DB.logActivity(project.id, currentUser.name, 'left the project');
      closeAllModals();
      this.activeProjectId = null;
      this.toast('You left the project.');
      this.showView('projects');
    } else if (action.type === 'remove-member') {
      const projects = DB.getProjects();
      const project = projects.find(item => item.id === action.projectId);
      const managerMembership = project?.members?.find(item => item.userId === currentUser.id);
      const member = project?.members?.find(item => item.userId === action.userId);
      const removedUser = DB.getUserById(action.userId);
      const canManage = project && (project.ownerId === currentUser.id || ['Project Manager', 'Project Owner', 'Leader'].includes(managerMembership?.role));
      if (!project || !member || !removedUser || !canManage || action.userId === project.ownerId) {
        document.getElementById('danger-modal-error').textContent = 'This membership cannot be removed.';
        return;
      }
      project.members = project.members.filter(item => item.userId !== action.userId);
      DB.saveProjects(projects);
      DB.logActivity(project.id, currentUser.name, `removed ${removedUser.name} from the project`);
      DB.notify(action.userId, 'assignment', `${currentUser.name} removed you from "${project.name}"`, { view: 'projects' });
      closeAllModals();
      this.renderTeamList();
      this.renderOverviewAdditions(project);
      this.toast(`${removedUser.name} removed from the project.`);
      } else if (action.type === 'delete-task') {
  const tasks = DB.getTasks();
  const task = tasks.find(item => item.id === action.taskId);

  if (!task || task.projectId !== action.projectId) {
    document.getElementById('danger-modal-error').textContent =
      'This task no longer exists.';
    return;
  }

  const taskTitle = task.title;

  const updatedTasks = tasks.filter(item => item.id !== action.taskId);

  DB.saveTasks(updatedTasks);

  DB.logActivity(
    action.projectId,
    currentUser.name,
    `deleted task "${taskTitle}"`
  );

  closeAllModals();

  this.activeTaskId = null;

  this.toast(`Task "${taskTitle}" deleted.`);

  this.renderKanban();
  this.renderOverview();
  this.renderAnalytics();

  this.dangerAction = null;
  return;
    } else if (action.type === 'leave-organization') {
      const orgs = DB.getOrgs();
      const org = orgs.find(item => item.id === action.orgId);
      const user = DB.getUserById(currentUser.id);
      if (!org || !user || org.ownerId === currentUser.id || (user.org || '').toLowerCase() !== (org.name || '').toLowerCase()) {
        document.getElementById('danger-modal-error').textContent = 'This organization membership has changed. Refresh and try again.';
        return;
      }
      if (Array.isArray(org.members)) org.members = org.members.filter(member => member.userId !== currentUser.id);
      user.org = '';
      DB.saveOrgs(orgs);
      const projects = DB.getProjects();
      projects.forEach(project => {
        if (project.orgId === org.id && Array.isArray(project.members)) project.members = project.members.filter(member => member.userId !== currentUser.id);
      });
      DB.saveProjects(projects);
      this.currentUser = user;
      closeAllModals();
      this.activeProjectId = null;
      this.renderSidebarUser();
      this.toast('You left the organization.');
      this.showView('overview');
    }
    this.dangerAction = null;
  },

  handleAddTeamMember() {
    const email = document.getElementById('team-add-email').value.trim();
    const role = document.getElementById('team-add-role').value;
    const errEl = document.getElementById('team-add-error');
    errEl.textContent = '';

    const user = DB.findUserByEmail(email);
    if (!user) { errEl.textContent = 'No Karyon user found with that email.'; return; }

    const projects = DB.getProjects();
    const project = projects.find(p => p.id === this.activeProjectId);
    if (project.members.some(m => m.userId === user.id)) { errEl.textContent = 'That person is already on this project.'; return; }

    project.members.push({ userId: user.id, role });
    DB.saveProjects(projects);
    DB.logActivity(project.id, this.currentUser.name, `added ${user.name} as ${role}`);
    DB.notify(user.id, 'assignment', `${this.currentUser.name} added you to "${project.name}"`, { view: 'project', projectId: project.id });

    document.getElementById('team-add-email').value = '';
    this.renderTeamList();
    this.populateAssigneeSelects(project);
    this.toast(`${user.name} added to the project.`);
  },

  /* ================= FILES ================= */
  handleAddFile() {
    const input = document.getElementById('file-input');
    const errEl = document.getElementById('file-add-error');
    errEl.textContent = '';
    if (!input.files.length) { errEl.textContent = 'Choose a file first.'; return; }
    const file = input.files[0];
    const ext = (file.name.split('.').pop() || 'file').slice(0, 4);

    const list = DB.getFiles();
    list.push({
      id: DB.uid('file'),
      projectId: this.activeProjectId,
      taskId: null,
      name: file.name,
      type: ext,
      uploadedBy: this.currentUser.name,
      createdAt: Date.now()
    });
    DB.saveFiles(list);
    DB.logActivity(this.activeProjectId, this.currentUser.name, `uploaded "${file.name}"`);

    input.value = '';
    closeAllModals();
    this.toast(`"${file.name}" attached to project.`);
    if (this.activeTab === 'files') this.renderFiles();
  },

  renderFiles() {
    const files = DB.getFilesByProject(this.activeProjectId).sort((a, b) => b.createdAt - a.createdAt);
    const el = document.getElementById('file-list');
    el.innerHTML = files.length ? files.map(f => `
      <div class="file-row">
        <div class="file-icon">${escapeHtml(f.type)}</div>
        <div style="flex:1;">
          <div class="file-name">${escapeHtml(f.name)}</div>
          <div class="file-meta">Uploaded by ${escapeHtml(f.uploadedBy)} · ${timeAgo(f.createdAt)}</div>
        </div>
      </div>
    `).join('') : `<div class="empty-state">No files yet. Attach requirements, mockups, or notes.</div>`;
  },

  /* ================= SPRINTS ================= */
  openSprintModal() {
    const tasks = DB.getTasksByProject(this.activeProjectId);
    const checklist = document.getElementById('ns-task-checklist');
    checklist.innerHTML = tasks.length ? tasks.map(t => `
      <label style="display:flex; align-items:center; gap:8px; padding:6px 4px; font-size:13px;">
        <input type="checkbox" class="checkbox-native" value="${t.id}"> ${escapeHtml(t.title)}
      </label>
    `).join('') : `<div class="text-muted" style="font-size:12.5px; padding:6px;">No tasks yet — create tasks first.</div>`;
    document.getElementById('form-new-sprint').reset();
    openModal('modal-sprint');
  },

  handleNewSprint(e) {
    e.preventDefault();
    const name = document.getElementById('ns-name').value.trim();
    if (!name) return;
    const taskIds = Array.from(document.querySelectorAll('#ns-task-checklist input:checked')).map(i => i.value);

    const sprint = {
      id: DB.uid('sprint'),
      projectId: this.activeProjectId,
      name,
      startDate: document.getElementById('ns-start').value,
      endDate: document.getElementById('ns-end').value,
      taskIds,
      createdAt: Date.now()
    };
    const list = DB.getSprints();
    list.push(sprint);
    DB.saveSprints(list);
    DB.logActivity(this.activeProjectId, this.currentUser.name, `created sprint "${name}"`);

    closeAllModals();
    this.toast(`Sprint "${name}" created.`);
    this.renderSprints();
  },

  renderSprints() {
    const sprints = DB.getSprintsByProject(this.activeProjectId).sort((a, b) => b.createdAt - a.createdAt);
    const el = document.getElementById('sprint-list');
    if (!sprints.length) {
      el.innerHTML = `<div class="empty-state">No sprints yet. Bundle tasks into a dated cycle to track velocity.</div>`;
      return;
    }
    el.innerHTML = sprints.map(s => {
      const tasks = s.taskIds.map(id => DB.getTask(id)).filter(Boolean);
      const completed = tasks.filter(t => t.status === 'Completed').length;
      const pct = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;
      return `
      <div class="sprint-card">
        <div class="sprint-card-head">
          <div><h4>${escapeHtml(s.name)}</h4><span class="sprint-dates">${s.startDate || '—'} → ${s.endDate || '—'}</span></div>
          <span class="eyebrow">${pct}% complete</span>
        </div>
        <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
        <div class="sprint-tasklist">
          ${tasks.map(t => `
            <div class="sprint-task-row ${t.status === 'Completed' ? 'done' : ''}">
              <input type="checkbox" class="checkbox-native sprint-task-check" data-sprint="${s.id}" data-task="${t.id}" ${t.status === 'Completed' ? 'checked' : ''}>
              <span class="stitle" style="flex:1;">${escapeHtml(t.title)}</span>
              <span class="pill ${priorityPillClass(t.priority)}">${t.priority}</span>
            </div>
          `).join('') || `<div class="text-muted" style="font-size:12.5px;">No tasks in this sprint.</div>`}
        </div>
      </div>`;
    }).join('');

    el.querySelectorAll('.sprint-task-check').forEach(box => {
      box.addEventListener('change', (e) => {
        this.moveTask(e.target.dataset.task, e.target.checked ? 'Completed' : 'To Do');
        this.renderSprints();
      });
    });
  },

  /* ================= ACTIVITY ================= */
  renderProjectActivity() {
    const activity = DB.getActivityByProject(this.activeProjectId);
    document.getElementById('pd-activity-feed').innerHTML = activity.length
      ? renderActivityRows(activity)
      : `<div class="empty-state">No activity yet.</div>`;
  },

  /* ================= ANALYTICS ================= */
  renderAnalytics() {
    const project = DB.getProject(this.activeProjectId);
    const tasks = DB.getTasksByProject(project.id);

    const counts = {};
    STATUSES.forEach(s => counts[s] = tasks.filter(t => t.status === s).length);
    const max = Math.max(1, ...Object.values(counts));

    document.getElementById('analytics-bar-chart').innerHTML = STATUSES.map(s => `
      <div class="bar-col">
        <span class="bar-value">${counts[s]}</span>
        <div class="bar-fill" style="height:0%" data-target="${(counts[s] / max) * 100}"></div>
        <span class="bar-label">${s}</span>
      </div>
    `).join('');
    requestAnimationFrame(() => {
      document.querySelectorAll('#analytics-bar-chart .bar-fill').forEach(bar => {
        bar.style.height = `${bar.dataset.target}%`;
      });
    });

    const overdue = tasks.filter(t => t.status !== 'Completed' && isOverdue(t.deadline)).length;
    const statList = [
      ['Total Tasks', tasks.length],
      ['Completed', counts['Completed']],
      ['In Progress', counts['In Progress']],
      ['Pending (To Do)', counts['To Do']],
      ['Overdue', overdue]
    ];
    document.getElementById('analytics-stat-list').innerHTML = statList.map(([label, val]) => `
      <div class="flex-between"><span class="text-muted" style="font-size:13px;">${label}</span><span style="font-family:var(--font-mono); font-weight:700;">${val}</span></div>
    `).join('');

    const members = project.members.map(m => DB.getUserById(m.userId)).filter(Boolean);
    document.getElementById('member-table-body').innerHTML = members.map(u => {
      const mine = tasks.filter(t => t.assigneeId === u.id);
      const completed = mine.filter(t => t.status === 'Completed').length;
      const inProgress = mine.filter(t => t.status === 'In Progress').length;
      const role = project.members.find(m => m.userId === u.id)?.role || '—';
      return `<tr><td>${escapeHtml(u.name)}</td><td>${role}</td><td>${completed}</td><td>${inProgress}</td><td>${mine.length}</td></tr>`;
    }).join('') || `<tr><td colspan="5" class="text-muted">No members yet.</td></tr>`;
  },

  /* ================= NOTIFICATIONS ================= */
  renderNotifications() {
    const notifs = DB.getNotificationsForUser(this.currentUser.id).slice(0, 20);
    const el = document.getElementById('notif-list');
    el.innerHTML = notifs.length ? notifs.map(n => `
      <div class="notif-item ${n.read ? '' : 'unread'}" data-id="${n.id}">
        <div class="notif-text">${escapeHtml(n.text)}</div>
        <span class="notif-time">${timeAgo(n.createdAt)}</span>
      </div>
    `).join('') : `<div class="notif-empty">You're all caught up.</div>`;

    el.querySelectorAll('.notif-item').forEach(item => {
      item.addEventListener('click', () => this.handleNotifClick(item.dataset.id));
    });
    this.updateBellBadge();
  },

  handleNotifClick(id) {
    const list = DB.getNotifications();
    const notif = list.find(n => n.id === id);
    if (!notif) return;
    notif.read = true;
    DB.saveNotifications(list);
    document.getElementById('notif-panel').classList.remove('open');
    this.updateBellBadge();

    if (notif.link) {
      if (notif.link.view === 'task' && notif.link.projectId) {
        this.showView('project', notif.link.projectId);
        setTimeout(() => this.openTaskDetail(notif.link.taskId), 50);
      } else if (notif.link.projectId) {
        this.showView('project', notif.link.projectId);
      }
    }
  },

  updateBellBadge() {
    const unread = DB.getNotificationsForUser(this.currentUser.id).filter(n => !n.read).length;
    const badge = document.getElementById('bell-badge');
    if (unread > 0) { badge.textContent = unread; badge.classList.remove('hidden'); }
    else badge.classList.add('hidden');
  },

  checkDeadlineNotifications() {
    // Generate a deadline notification once per task per day if due within 2 days
    const myProjects = this.getMyProjects().map(p => p.id);
    const tasks = DB.getTasks().filter(t => myProjects.includes(t.projectId) && t.assigneeId === this.currentUser.id && t.status !== 'Completed');
    const existing = DB.getNotifications();
    const todayKey = new Date().toDateString();

    tasks.forEach(t => {
      if (!t.deadline) return;
      const days = daysUntil(t.deadline);
      if (days !== null && days <= 2 && days >= 0) {
        const already = existing.some(n => n.userId === this.currentUser.id && n.type === 'deadline' && n.link && n.link.taskId === t.id && new Date(n.createdAt).toDateString() === todayKey);
        if (!already) {
          DB.notify(this.currentUser.id, 'deadline', `"${t.title}" is due ${days === 0 ? 'today' : `in ${days} day(s)`}`, { view: 'task', projectId: t.projectId, taskId: t.id });
        }
      }
    });
    this.updateBellBadge();
  },

  handleGlobalSearch(query) {
    query = query.trim().toLowerCase();
    if (!query) return;
    const myProjects = this.getMyProjects().map(p => p.id);
    const matchTask = DB.getTasks().find(t => myProjects.includes(t.projectId) && t.title.toLowerCase().includes(query));
    if (matchTask) {
      this.showView('project', matchTask.projectId);
      setTimeout(() => this.openTaskDetail(matchTask.id), 50);
      return;
    }
    const matchProject = this.getMyProjects().find(p => p.name.toLowerCase().includes(query));
    if (matchProject) { this.showView('project', matchProject.id); return; }
    this.toast('No matches found.');
  },

  /* ================= TOAST ================= */
  toast(message) {
    const stack = document.getElementById('toast-stack');
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = message;
    stack.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 300);
    }, 3400);
  }
};

/* ================= RENDER HELPERS ================= */
function renderTaskCard(t) {
  const assignee = DB.getUserById(t.assigneeId);
  const overdueNow = t.status !== 'Completed' && isOverdue(t.deadline);
  return `
  <div class="task-card" draggable="true" data-id="${t.id}">
    <span class="tcat">${escapeHtml(t.category)}</span>
    <div class="ttitle">${escapeHtml(t.title)}</div>
    <div class="tfoot">
      <span class="pill ${overdueNow ? 'pill-overdue' : priorityPillClass(t.priority)}">${overdueNow ? 'Overdue' : t.priority}</span>
      <div class="avatar" style="width:24px;height:24px;font-size:10px;" title="${assignee ? escapeHtml(assignee.name) : 'Unassigned'}">${assignee ? initials(assignee.name) : '?'}</div>
    </div>
  </div>`;
}

function renderActivityRows(list) {
  return list.map(a => `
    <div class="activity-row">
      <div class="activity-dot"></div>
      <div style="flex:1;">
        <div class="activity-text"><b>${escapeHtml(a.userName)}</b> ${escapeHtml(a.text)}</div>
        <div class="activity-time">${timeAgo(a.createdAt)}</div>
      </div>
    </div>
  `).join('');
}

function formatCommentText(text) {
  const escaped = escapeHtml(text);
  return escaped.replace(/@([A-Za-z]+(?:\s[A-Za-z]+)?)/g, (match) => `<span class="mention">${match}</span>`);
}

function priorityPillClass(p) {
  if (p === 'High') return 'pill-high';
  if (p === 'Medium') return 'pill-medium';
  return 'pill-low';
}

function initials(name) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str == null ? '' : String(str);
  return d.innerHTML;
}

function isOverdue(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d - today) / 86400000);
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

/* ================= DRAG AND DROP (Kanban) ================= */
function wireDrag(card) {
  card.addEventListener('dragstart', (e) => {
    card.classList.add('dragging');
    e.dataTransfer.setData('text/plain', card.dataset.id);
    e.dataTransfer.effectAllowed = 'move';
    requestAnimationFrame(() => card.classList.add('lifted'));
  });
  card.addEventListener('dragend', () => {
    card.classList.remove('dragging', 'lifted');
  });
}

function wireDropZone(col, onDrop) {
  col.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    col.classList.add('drag-over');
  });
  col.addEventListener('dragleave', () => col.classList.remove('drag-over'));
  col.addEventListener('drop', (e) => {
    e.preventDefault();
    col.classList.remove('drag-over');
    const taskId = e.dataTransfer.getData('text/plain');
    const newStatus = col.dataset.status;
    onDrop(taskId, newStatus);
  });
}

/* ================= MODAL HELPERS (shared style with landing.js) ================= */
function openModal(id) {
  closeAllModals();
  document.getElementById(id).classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeAllModals() {
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
  document.body.style.overflow = '';
}

document.addEventListener('DOMContentLoaded', () => App.init());
