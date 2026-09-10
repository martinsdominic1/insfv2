const Api = (() => {
  function getToken() { return sessionStorage.getItem('hm_token'); }
  function setToken(t) { t ? sessionStorage.setItem('hm_token', t) : sessionStorage.removeItem('hm_token'); }

  async function call(action, payload = {}) {
    const body = Object.assign({ action, token: getToken() }, payload);
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // avoids CORS preflight against Apps Script
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!data.ok && /session/i.test(data.error || '')) {
      setToken(null);
      window.location.reload();
    }
    return data;
  }

  async function login(username, password) {
    const res = await call('login', { username, password, role: 'manager' });
    if (res.ok) setToken(res.token);
    return res;
  }
  function logout() { call('logout'); setToken(null); }

  return {
    getToken, setToken, login, logout,
    getApplications: () => call('getApplications'),
    getConfig: () => call('getConfig'),
    createApplication: (fields) => call('createApplication', { fields }),
    updateApplication: (id, fields) => call('updateApplication', { id, fields }),
    generatePrice: (id) => call('generatePrice', { id }),
    setStatus: (id, status, reason, reasonOther, refundAmount, refundStatus) =>
      call('setStatus', { id, status, reason, reasonOther, refundAmount, refundStatus }),
    logPayment: (id, amountReceived) => call('logPayment', { id, amountReceived }),

    getBlocks: () => call('getBlocks'),
    createBlock: (block) => call('createBlock', block),
    updateBlock: (id, fields) => call('updateBlock', { id, fields }),

    getCharges: (applicationId) => call('getCharges', { applicationId }),
    addCharge: (charge) => call('addCharge', charge),
    updateCharge: (id, fields, applicationId) => call('updateCharge', { id, fields, applicationId }),

    prepareEmail: (id, emailType) => call('prepareEmail', { id, emailType }),
    dispatchEmail: (id, emailType, subject, body, action) => call('dispatchEmail', { id, emailType, subject, body, action }),

    uploadDamageMedia: (applicationId, fileName, mimeType, base64Data) =>
      call('uploadDamageMedia', { applicationId, fileName, mimeType, base64Data }),
    getDamageMedia: (applicationId) => call('getDamageMedia', { applicationId }),
    uploadProofOfPayment: (applicationId, fileName, mimeType, base64Data) =>
      call('uploadProofOfPayment', { applicationId, fileName, mimeType, base64Data }),
    getProofOfPayment: (applicationId) => call('getProofOfPayment', { applicationId })
  };
})();
