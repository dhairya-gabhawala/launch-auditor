(() => {
  const frame = document.getElementById('report-frame');
  const dialog = document.getElementById('run-dialog');
  const confirmDialog = document.getElementById('confirm-dialog');
  const runList = document.getElementById('run-list');
  const sidebarTop = document.getElementById('sidebar-top');
  const sidebarBottom = document.getElementById('sidebar-bottom');


  const sidebar = document.getElementById('sidebar');
  const openSidebarBtn = document.getElementById('open-sidebar');
  const closeSidebarBtn = document.getElementById('close-sidebar');
  const sidebarOverlay = document.getElementById('mobile-sidebar-overlay');

  function openSidebar() {
    if (!sidebar) return;
    sidebar.classList.remove('translate-x-[-100%]');
    sidebar.classList.add('translate-x-0');
    if (sidebarOverlay) sidebarOverlay.classList.remove('hidden');
  }

  function closeSidebar() {
    if (!sidebar) return;
    sidebar.classList.add('translate-x-[-100%]');
    sidebar.classList.remove('translate-x-0');
    if (sidebarOverlay) sidebarOverlay.classList.add('hidden');
  }

  if (openSidebarBtn) openSidebarBtn.addEventListener('click', openSidebar);
  if (closeSidebarBtn) closeSidebarBtn.addEventListener('click', closeSidebar);
  if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeSidebar);

  // Close sidebar when selecting a report on mobile
  document.querySelectorAll('[data-report]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (window.innerWidth < 768) closeSidebar();
    });
  });


  document.querySelectorAll('[data-report]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-report]').forEach(b => b.parentElement.parentElement.classList.remove('bg-sky-50'));
      btn.parentElement.parentElement.classList.add('bg-sky-50');
      frame.src = btn.dataset.report;
      const details = btn.closest('details.site-section');
      if (details) details.open = true;
    });
  });

  function showToast(message, isError, detail, options) {
    const region = document.getElementById('toast');
    const stack = document.getElementById('toast-stack');
    region.classList.remove('hidden');
    const type = options && options.type ? options.type : (isError ? 'error' : 'success');
    const autoClose = options && options.autoClose === false ? false : true;

    function toastIcon(t) {
      if (t === 'loading') {
        return '<svg class="size-6 text-slate-400 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle class="opacity-25" cx="12" cy="12" r="9" stroke="currentColor" stroke-width="3"></circle><path class="opacity-75" d="M21 12a9 9 0 0 1-9 9" stroke="currentColor" stroke-width="3" stroke-linecap="round"></path></svg>';
      }
      if (t === 'error') {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true" class="size-6 text-rose-400"><path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a1.5 1.5 0 0 0 1.3 2.25h17.76a1.5 1.5 0 0 0 1.3-2.25L13.71 3.86a1.5 1.5 0 0 0-2.6 0Z" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      }
      if (t === 'warning') {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true" class="size-6 text-amber-400"><path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a1.5 1.5 0 0 0 1.3 2.25h17.76a1.5 1.5 0 0 0 1.3-2.25L13.71 3.86a1.5 1.5 0 0 0-2.6 0Z" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      }
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true" class="size-6 text-emerald-400"><path d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    }

    const panel = document.createElement('div');
    panel.className = 'pointer-events-auto w-full max-w-sm translate-y-0 transform rounded-lg bg-white opacity-100 shadow-lg outline-1 outline-black/5 transition duration-300 ease-out';
    panel.innerHTML =
      '<div class="p-4">' +
        '<div class="flex items-start">' +
          '<div class="shrink-0">' + toastIcon(type) + '</div>' +
          '<div class="ml-3 w-0 flex-1 pt-0.5">' +
            '<p class="text-sm font-medium text-slate-900">' + message + '</p>' +
            (detail ? '<p class="mt-1 text-sm text-slate-500">' + detail + '</p>' : '') +
          '</div>' +
          '<div class="ml-4 flex shrink-0">' +
            '<button type="button" class="inline-flex rounded-md text-slate-400 hover:text-slate-500 focus:outline-2 focus:outline-offset-2 focus:outline-slate-900">' +
              '<span class="sr-only">Close</span>' +
              '<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" class="size-5">' +
                '<path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />' +
              '</svg>' +
            '</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    panel.querySelector('button').addEventListener('click', () => panel.remove());
    stack.appendChild(panel);
    if (autoClose) {
      setTimeout(() => {
        panel.remove();
        if (!stack.children.length) region.classList.add('hidden');
      }, 3500);
    }
    return panel;
  }

  function openConfirm(message, onConfirm) {
    const confirmMessage = document.getElementById('confirm-message');
    confirmMessage.textContent = message;
    confirmDialog.showModal();
    const confirmOk = document.getElementById('confirm-ok');
    const confirmCancel = document.getElementById('confirm-cancel');
    const handleOk = async (e) => {
      e.preventDefault();
      confirmDialog.close();
      confirmOk.removeEventListener('click', handleOk);
      confirmCancel.removeEventListener('click', handleCancel);
      await onConfirm();
    };
    const handleCancel = (e) => {
      e.preventDefault();
      confirmDialog.close();
      confirmOk.removeEventListener('click', handleOk);
      confirmCancel.removeEventListener('click', handleCancel);
    };
    confirmOk.addEventListener('click', handleOk);
    confirmCancel.addEventListener('click', handleCancel);
  }

  document.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const parts = btn.dataset.delete.split('|');
      const site = parts[0];
      const run = parts[1];
      openConfirm('Delete audit "' + run + '"?', async () => {
        const res = await fetch('/run', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ site, run }) });
        if (res.ok) {
          showToast('Audit deleted', false, 'The report has been removed.');
          window.location.reload();
        } else {
          showToast('Failed to delete audit', true, 'Please try again.');
        }
      });
    });
  });

  const clearAllBtn = document.getElementById('clear-all');
  if (clearAllBtn) {
    if (window.launchAuditor && typeof window.launchAuditor.openAbout === 'function') {
      clearAllBtn.classList.add('hidden');
    }
    clearAllBtn.addEventListener('click', () => {
      openConfirm('Clear all audit runs?', async () => {
        const res = await fetch('/runs-clear', { method: 'POST' });
        if (res.ok) {
          showToast('All runs cleared', false, 'History has been reset.');
          window.location.reload();
        } else {
          showToast('Failed to clear runs', true, 'Please try again.');
        }
      });
    });
  }

  const clearLocalBtn = document.getElementById('clear-local-data');
  if (clearLocalBtn) {
    clearLocalBtn.addEventListener('click', () => {
      openConfirm('Clear all local data (runs + config)?', async () => {
        const res = await fetch('/local-clear', { method: 'POST' });
        if (res.ok) {
          showToast('Local data cleared', false, 'Config and run history were reset.');
          if (frame) frame.src = '/empty';
          window.location.href = '/';
        } else {
          showToast('Failed to clear local data', true, 'Please try again.');
        }
      });
    });
  }

  document.getElementById('new-run').addEventListener('click', () => dialog.showModal());
  document.getElementById('cancel').addEventListener('click', (e) => { e.preventDefault(); dialog.close(); });

  const envSelect = dialog.querySelector('select[name="env"]');
  const siteSelect = dialog.querySelector('select[name="site"]');
  const oldEnvSelect = dialog.querySelector('select[name="oldEnv"]');
  const newUrlInput = dialog.querySelector('input[name="newUrl"]');
  const oldUrlInput = dialog.querySelector('input[name="oldUrl"]');
  const releaseNotesInput = dialog.querySelector('input[name="releaseNotes"]');
  const swapBtn = dialog.querySelector('#swap-envs');
  const envMap = window.__ENV_MAP__ || {};

  function setDisabled(el, disabled) {
    el.disabled = disabled;
    if (disabled) {
      el.classList.add('opacity-50');
    } else {
      el.classList.remove('opacity-50');
    }
  }

  function setEnvOptions(siteName) {
    const envs = (envMap[siteName] || []).slice();
    const options = envs.map(v => '<option value="' + v + '">' + v + '</option>').join('');
    envSelect.innerHTML = options + '<option value="custom">Manual URL</option>';
    oldEnvSelect.innerHTML = '<option value="none">none</option>' + options;
    envSelect.value = envs[0] || 'custom';
    oldEnvSelect.value = 'none';
  }

  function updateInputs() {
    const hasSite = !!siteSelect.value;
    const useCustom = envSelect.value === 'custom';
    setDisabled(envSelect, !hasSite || useCustom);
    setDisabled(oldEnvSelect, !hasSite || useCustom);
    setDisabled(newUrlInput, !useCustom);
    setDisabled(oldUrlInput, !useCustom);
    setDisabled(siteSelect, useCustom);
    const isDiff = (oldEnvSelect.value && oldEnvSelect.value !== 'none') || oldUrlInput.value.trim();
    setDisabled(releaseNotesInput, !isDiff);
    if (!isDiff) {
      releaseNotesInput.checked = false;
    } else if (!releaseNotesInput.dataset.touched) {
      releaseNotesInput.checked = true;
    }
  }

  siteSelect.addEventListener('change', () => {
    if (siteSelect.value) {
      setEnvOptions(siteSelect.value);
    } else {
      envSelect.innerHTML = '';
      oldEnvSelect.innerHTML = '';
    }
    updateInputs();
  });
  envSelect.addEventListener('change', updateInputs);
  oldEnvSelect.addEventListener('change', updateInputs);
  releaseNotesInput.addEventListener('change', () => { releaseNotesInput.dataset.touched = '1'; });
  if (swapBtn) {
    swapBtn.addEventListener('click', () => {
      const tmp = envSelect.value;
      const oldVal = oldEnvSelect.value;
      envSelect.value = oldVal && oldVal !== 'none' ? oldVal : tmp;
      oldEnvSelect.value = tmp || 'none';
      updateInputs();
    });
  }
  updateInputs();
  if (siteSelect.value) {
    setEnvOptions(siteSelect.value);
    updateInputs();
  }

  function setFieldError(key, message) {
    const el = dialog.querySelector('[data-error="' + key + '"]');
    if (!el) return;
    if (message) {
      el.textContent = message;
      el.classList.remove('hidden');
    } else {
      el.textContent = '';
      el.classList.add('hidden');
    }
  }

  function isValidUrl(value) {
    try {
      const u = new URL(value);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  }

  document.getElementById('run-submit').addEventListener('click', async (e) => {
    e.preventDefault();
    const form = dialog.querySelector('form');
    const data = Object.fromEntries(new FormData(form).entries());
    setFieldError('newUrl', '');
    setFieldError('oldUrl', '');
    const useCustom = envSelect.value === 'custom';
    let hasError = false;
    if (useCustom) {
      if (!data.newUrl || !data.newUrl.trim()) {
        setFieldError('newUrl', 'New container URL is required for Manual URL.');
        hasError = true;
      } else if (!isValidUrl(data.newUrl.trim())) {
        setFieldError('newUrl', 'Enter a valid http(s) URL.');
        hasError = true;
      }
      if (data.oldUrl && data.oldUrl.trim() && !isValidUrl(data.oldUrl.trim())) {
        setFieldError('oldUrl', 'Enter a valid http(s) URL.');
        hasError = true;
      }
    }
    if (hasError) return;

    dialog.close();
    const loadingToast = showToast('Running audit…', false, 'You can continue browsing reports.', { type: 'loading', autoClose: false });
    const siteLoader = document.querySelector('.site-loading[data-site="' + (data.site || '') + '"]');
    if (siteLoader) siteLoader.classList.remove('hidden');
    const slowTimer = setTimeout(() => {
      showToast('Still working…', false, 'This can take a bit on larger containers.', { type: 'warning' });
    }, 30000);
    let res;
    try {
      res = await fetch('/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    } catch (err) {
      clearTimeout(slowTimer);
      if (loadingToast) loadingToast.remove();
      if (siteLoader) siteLoader.classList.add('hidden');
      showToast('Failed to run audit', true, 'Network error while sending request.');
      return;
    }
    clearTimeout(slowTimer);
    if (loadingToast) loadingToast.remove();
    if (siteLoader) siteLoader.classList.add('hidden');
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      showToast('Failed to run audit', true, errJson && errJson.error ? errJson.error : 'Check the URLs or site configuration.');
      if (errJson && errJson.report) {
        frame.src = errJson.report;
      }
      return;
    }
    const json = await res.json();
    showToast('Audit complete', false, 'Your report is ready.');
    window.location.href = '/?run=' + encodeURIComponent(json.run);
  });

  document.getElementById('open-config').addEventListener('click', () => {
    frame.src = '/config-ui';
    document.querySelectorAll('[data-report]').forEach(b => b.parentElement.parentElement.classList.remove('bg-sky-50'));
  });
  document.getElementById('open-docs').addEventListener('click', () => {
    frame.src = '/docs';
    document.querySelectorAll('[data-report]').forEach(b => b.parentElement.parentElement.classList.remove('bg-sky-50'));
  });
  document.getElementById('open-dev').addEventListener('click', () => {
    frame.src = '/dev';
    document.querySelectorAll('[data-report]').forEach(b => b.parentElement.parentElement.classList.remove('bg-sky-50'));
  });

  const openAboutBtn = document.getElementById('open-about');
  if (openAboutBtn) {
    if (!window.launchAuditor || typeof window.launchAuditor.openAbout !== 'function') {
      openAboutBtn.classList.add('hidden');
    }
    openAboutBtn.addEventListener('click', () => {
      if (window.launchAuditor && typeof window.launchAuditor.openAbout === 'function') {
        window.launchAuditor.openAbout();
        return;
      }
      frame.src = '/about';
      document.querySelectorAll('[data-report]').forEach(b => b.parentElement.parentElement.classList.remove('bg-sky-50'));
    });
  }

  const logoLink = document.querySelector('a[href="/"]');
  if (logoLink) {
    logoLink.addEventListener('click', () => {
      window.location.href = '/';
    });
  }

  const search = document.getElementById('search');
  const filterType = document.getElementById('filter-type');
  const filterTags = document.getElementById('filter-tags');
  function applyFilters() {
    const q = (search && search.value ? search.value : '').toLowerCase();
    const type = filterType && filterType.value ? filterType.value : '';
    document.querySelectorAll('[data-report]').forEach(btn => {
      const text = btn.textContent.toLowerCase();
      const row = btn.parentElement.parentElement;
      const run = btn.dataset.run || '';
      const typeOk = !type || run.startsWith(type + '-');
      const textOk = !q || text.includes(q);
      row.style.display = typeOk && textOk ? '' : 'none';
    });
    document.querySelectorAll('.site-section').forEach(section => {
      const anyVisible = Array.from(section.querySelectorAll('[data-report]')).some(btn => btn.parentElement.parentElement.style.display !== 'none');
      section.open = (q || type) ? anyVisible : false;
      section.style.display = (q || type) ? (anyVisible ? '' : 'none') : '';
    });
    if (filterTags) {
      if (type) {
        filterTags.classList.remove('hidden');
        filterTags.innerHTML = '<span class="px-2 py-1 rounded bg-slate-100 text-slate-700">Type: ' + type + '</span>';
      } else {
        filterTags.classList.add('hidden');
        filterTags.innerHTML = '';
      }
    }
  }
  if (search) search.addEventListener('input', applyFilters);
  if (filterType) filterType.addEventListener('change', applyFilters);

  if (runList && sidebarTop && sidebarBottom) {
    const toggleShadow = () => {
      if (runList.scrollTop > 4) {
        sidebarTop.classList.add('shadow-lg');
      } else {
        sidebarTop.classList.remove('shadow-lg');
      }
      const atBottom = Math.ceil(runList.scrollTop + runList.clientHeight) >= runList.scrollHeight;
      if (!atBottom) {
        sidebarBottom.classList.add('shadow-xl');
      } else {
        sidebarBottom.classList.remove('shadow-xl');
      }
    };
    runList.addEventListener('scroll', toggleShadow);
    toggleShadow();
  }

  const params = new URLSearchParams(window.location.search);
  const run = params.get('run');
  if (run) {
    const button = document.querySelector('[data-run="' + run + '"]');
    if (button) {
      button.click();
      const details = button.closest('details.site-section');
      if (details) details.open = true;
    }
  }
  const toastParam = params.get('toast');
  if (toastParam === 'config-saved') {
    showToast('Config saved', false, 'You can run audits now.');
  }
})();
