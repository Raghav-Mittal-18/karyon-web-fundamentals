/* ============================================================
   KARYON — auth.js
   Local-only authentication. Passwords are stored in plain text
   in localStorage for demo purposes (no backend exists to hash
   them against) — this is explicitly a frontend-only prototype.
   ============================================================ */

const Auth = {
  EMAIL_RE: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,

  validateSignup({ name, email, password, org, role }) {
    const errors = {};
    if (!name || !name.trim()) errors.name = 'Enter your full name.';
    if (!email || !email.trim()) errors.email = 'Enter an email address.';
    else if (!this.EMAIL_RE.test(email)) errors.email = 'That email doesn\'t look valid.';
    else if (DB.findUserByEmail(email)) errors.email = 'An account with this email already exists.';
    if (!password || password.length < 6) errors.password = 'Password needs at least 6 characters.';
    if (!org || !org.trim()) errors.org = 'Enter your organization name.';
    if (!role) errors.role = 'Choose a role.';
    return errors;
  },

  validateLogin({ email, password }) {
    const errors = {};
    if (!email || !email.trim()) errors.email = 'Enter your email address.';
    if (!password) errors.password = 'Enter your password.';
    return errors;
  },

  signup({ name, email, password, org, role }) {
    const errors = this.validateSignup({ name, email, password, org, role });
    if (Object.keys(errors).length) return { ok: false, errors };

    const user = {
      id: DB.uid('user'),
      name: name.trim(),
      email: email.trim(),
      password,
      org: org.trim(),
      role,
      createdAt: Date.now()
    };
    const users = DB.getUsers();
    users.push(user);
    DB.saveUsers(users);

    // ensure an org record exists for this user
    const orgs = DB.getOrgs();
    if (!orgs.find(o => o.name.toLowerCase() === user.org.toLowerCase() && o.ownerId === user.id)) {
      orgs.push({ id: DB.uid('org'), name: user.org, ownerId: user.id, createdAt: Date.now() });
      DB.saveOrgs(orgs);
    }

    this.startSession(user);
    return { ok: true, user };
  },

  login({ email, password }) {
    const errors = this.validateLogin({ email, password });
    if (Object.keys(errors).length) return { ok: false, errors };

    const user = DB.findUserByEmail(email);
    if (!user || user.password !== password) {
      return { ok: false, errors: { form: 'Email or password is incorrect.' } };
    }
    this.startSession(user);
    return { ok: true, user };
  },

  startSession(user) {
    DB.setSession({ userId: user.id, startedAt: Date.now() });
  },

  logout() {
    DB.clearSession();
  },

  isAuthed() {
    return !!DB.getSession() && !!DB.currentUser();
  },

  requireAuth() {
    if (!this.isAuthed()) {
      window.location.href = 'index.html?auth=required';
      return false;
    }
    return true;
  }
};
