const API = {
  async request(method, url, body, isForm) {
    const opts = { method, headers: {} };
    if (body !== undefined) {
      if (isForm) {
        opts.body = body;
      } else {
        opts.headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(body);
      }
    }
    const res = await fetch(url, opts);
    if (res.status === 401 && !url.startsWith('/api/auth/')) {
      window.location.href = '/login.html';
      return new Promise(() => {}); // stop further processing; navigation is in flight
    }
    if (res.status === 204) return null;
    const text = await res.text();
    let data;
    try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
    if (!res.ok) {
      const message = (data && data.error) || `Request failed (${res.status})`;
      throw new Error(message);
    }
    return data;
  },
  get(url) { return this.request('GET', url); },
  post(url, body, isForm) { return this.request('POST', url, body, isForm); },
  put(url, body, isForm) { return this.request('PUT', url, body, isForm); },
  del(url) { return this.request('DELETE', url); },

  listProjects() { return this.get('/api/projects'); },
  createProject(data) { return this.post('/api/projects', data); },
  getProject(id) { return this.get(`/api/projects/${id}`); },
  updateProject(id, data) { return this.put(`/api/projects/${id}`, data); },
  deleteProject(id) { return this.del(`/api/projects/${id}`); },
  cloneProject(id) { return this.post(`/api/projects/${id}/clone`); },
  createShare(id) { return this.post(`/api/projects/${id}/share`); },
  revokeShare(id) { return this.del(`/api/projects/${id}/share`); },
  getCollaborators(id) { return this.get(`/api/projects/${id}/collaborators`); },
  addCollaborator(id, email, role) { return this.post(`/api/projects/${id}/collaborators`, { email, role }); },
  removeCollaborator(id, userId) { return this.del(`/api/projects/${id}/collaborators/${userId}`); },
  uploadLogo(id, file) {
    const fd = new FormData();
    fd.append('logo', file);
    return this.post(`/api/projects/${id}/logo`, fd, true);
  },
  removeLogo(id) { return this.del(`/api/projects/${id}/logo`); },
  addScope(id, data) { return this.post(`/api/projects/${id}/scope`, data); },
  deleteScope(scopeId) { return this.del(`/api/projects/scope/${scopeId}`); },

  createFinding(projectId, data) { return this.post(`/api/projects/${projectId}/findings`, data); },
  getFinding(id) { return this.get(`/api/findings/${id}`); },
  updateFinding(id, data) { return this.put(`/api/findings/${id}`, data); },
  deleteFinding(id) { return this.del(`/api/findings/${id}`); },
  reorderFinding(id, direction) { return this.post(`/api/findings/${id}/reorder`, { direction }); },

  addUrl(findingId, url) { return this.post(`/api/findings/${findingId}/urls`, { url }); },
  deleteUrl(urlId) { return this.del(`/api/urls/${urlId}`); },

  addPoc(findingId, formData) { return this.post(`/api/findings/${findingId}/poc`, formData, true); },
  updatePoc(stepId, formData) { return this.put(`/api/poc/${stepId}`, formData, true); },
  deletePoc(stepId) { return this.del(`/api/poc/${stepId}`); },

  addReference(findingId, data) { return this.post(`/api/findings/${findingId}/references`, data); },
  deleteReference(refId) { return this.del(`/api/references/${refId}`); },

  calculateCvss(vector) { return this.post('/api/cvss/calculate', { vector }); },

  getThemesMeta() { return this.get('/api/projects/meta/themes'); },
  extractLogoColor(id) { return this.post(`/api/projects/${id}/logo-color`); },

  getFindingTemplates() { return this.get('/api/meta/finding-templates'); },
  getOwaspCategories() { return this.get('/api/meta/owasp-categories'); },
  getMyTemplates() { return this.get('/api/meta/my-templates'); },
  saveMyTemplate(data) { return this.post('/api/meta/my-templates', data); },
  deleteMyTemplate(id) { return this.del(`/api/meta/my-templates/${id}`); },

  addRetestEvent(findingId, data) { return this.post(`/api/findings/${findingId}/retest`, data); },
  deleteRetestEvent(eventId) { return this.del(`/api/retest/${eventId}`); },

  previewImport(projectId, file) {
    const fd = new FormData();
    fd.append('file', file);
    return this.post(`/api/import/projects/${projectId}/preview`, fd, true);
  },
  commitImport(projectId, findings) { return this.post(`/api/import/projects/${projectId}/commit`, { findings }); },

  authMe() { return this.get('/api/auth/me'); },
  authLogout() { return this.post('/api/auth/logout'); },
  twofaSetup() { return this.post('/api/auth/2fa/setup'); },
  twofaEnable(code) { return this.post('/api/auth/2fa/enable', { code }); },
  twofaDisable(data) { return this.post('/api/auth/2fa/disable', data); },
  listSessions() { return this.get('/api/auth/sessions'); },
  revokeSession(id) { return this.del(`/api/auth/sessions/${id}`); },
  revokeOtherSessions() { return this.post('/api/auth/sessions/revoke-others'); },
  adminStats() { return this.get('/api/admin/stats'); },
  adminAudit() { return this.get('/api/admin/audit'); },
  adminSetPlan(id, plan) { return this.request('PATCH', `/api/admin/users/${id}/plan`, { plan }); },
  adminProjects() { return this.get('/api/admin/projects'); },
  adminChart() { return this.get('/api/admin/chart'); },
  adminUsers() { return this.get('/api/admin/users'); },
  adminDeleteUser(id) { return this.del(`/api/admin/users/${id}`); },
  adminCreateUser(data) { return this.post('/api/admin/users', data); },
  adminSetAdmin(id, is_admin) { return this.request('PATCH', `/api/admin/users/${id}/admin`, { is_admin }); },
  deleteAccount() { return this.del('/api/auth/account'); },
};

function toast(message, isError) {
  const el = document.createElement('div');
  el.className = 'toast' + (isError ? ' error' : '');
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function qs(name) {
  return new URLSearchParams(window.location.search).get(name);
}

// Warns before leaving the page if a watched form has unsaved edits.
function guardUnsaved(form) {
  if (!form) return;
  let dirty = false;
  form.addEventListener('input', () => { dirty = true; });
  form.addEventListener('submit', () => { dirty = false; });
  window.addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
}
