const Api = (() => {
  function getToken() { return sessionStorage.getItem('owner_token'); }
  function setToken(t) { t ? sessionStorage.setItem('owner_token', t) : sessionStorage.removeItem('owner_token'); }

  async function call(action, payload = {}) {
    const body = Object.assign({ action, token: getToken() }, payload);
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!data.ok && /session/i.test(data.error || '')) { setToken(null); window.location.reload(); }
    return data;
  }

  async function login(username, password) {
    const res = await call('login', { username, password, role: 'owner' });
    if (res.ok) setToken(res.token);
    return res;
  }
  function logout() { call('logout'); setToken(null); }

  return {
    getToken, setToken, login, logout,
    getApplications: () => call('getApplications'),
    getBlocks: () => call('getBlocks')
  };
})();
