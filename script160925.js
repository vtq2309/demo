document.addEventListener('DOMContentLoaded', () => {
  let data = [];
  let currentState = null;
  let currentStateLabel = null;

  // Map state -> data file
  const DATA_URLS = {
    NSW: 'data/dataNSW.json',                        // Suburb, Postcode, SortCode
    NSW_SYDNEYZONE: 'data/dataNSW-SydneyZone.json',  // Suburb, Postcode, Zone, Run, Chute
    VIC: 'data/dataVIC.json',                        // Suburb, Postcode, SortCode
  };

  // DOM refs
  const combo            = document.getElementById('state-combobox');
  const trigger          = document.getElementById('state-trigger');
  const listbox          = document.getElementById('state-list');
  const suburbInput      = document.getElementById('suburb-input');
  const suggestions      = document.getElementById('suggestions');
  const result           = document.getElementById('result');
  const suburbNameEl     = document.getElementById('suburb');
  const postcodeEl       = document.getElementById('postcode');
  const dynamicFieldsEl  = document.getElementById('dynamic-fields');
  const mapBtnContainer  = document.getElementById('map-button-container');

  // Popup (Show all runs in Zone)
  const popupOverlay     = document.getElementById('popupOverlay');
  const modalTitle       = document.getElementById('modal-title');
  const modalRunList     = document.getElementById('modalRunList');
  const modalCloseButton = document.getElementById('modalCloseButton');

  // Toast + progress
  const dataToast        = document.getElementById('data-toast');
  const progressWrap     = document.getElementById('data-progress');
  const progressBar      = document.getElementById('data-progress-bar');

  // ---------- UI Helpers ----------
  function clearUI() {
    suggestions.innerHTML = '';
    suggestions.style.display = 'none';
    result.style.display = 'none';

    suburbNameEl.textContent = '';
    postcodeEl.textContent   = '';
    if (dynamicFieldsEl) dynamicFieldsEl.innerHTML = '';

    // Gỡ link show-all cũ nếu có
    const old = document.getElementById('show-all-runs');
    if (old) old.remove();

    // Đóng popup nếu đang mở
    if (popupOverlay) popupOverlay.style.display = 'none';
  }

  function setProgress(pct) {
    if (!progressWrap || !progressBar) return;
    progressWrap.style.display = 'block';
    progressWrap.setAttribute('aria-hidden', 'false');
    progressBar.classList.remove('indeterminate');
    progressBar.style.width = `${pct}%`;
    progressWrap.setAttribute('aria-valuenow', String(Math.floor(pct)));
  }
  function setProgressIndeterminate() {
    if (!progressWrap || !progressBar) return;
    progressWrap.style.display = 'block';
    progressWrap.setAttribute('aria-hidden', 'false');
    progressBar.style.width = '30%';
    progressBar.classList.add('indeterminate');
    progressWrap.setAttribute('aria-valuenow', '0');
  }
  function hideProgress() {
    if (!progressWrap || !progressBar) return;
    progressWrap.style.display = 'none';
    progressWrap.setAttribute('aria-hidden', 'true');
    progressBar.classList.remove('indeterminate');
    progressBar.style.width = '0%';
  }

  const TOAST_DURATION_MS = 2000;
  function showToastLoaded(label) {
    if (!dataToast) return;
    dataToast.classList.remove('error');
    dataToast.innerHTML = `<span class="check">✔</span> Data for ${label} loaded`;
    dataToast.style.display = 'block';
    setTimeout(() => { dataToast.style.display = 'none'; }, TOAST_DURATION_MS);
  }
  function showToastError(message) {
    if (!dataToast) return;
    dataToast.classList.add('error');
    dataToast.innerHTML = `<span class="cross">❌</span> ${message}`;
    dataToast.style.display = 'block';
    setTimeout(() => { dataToast.style.display = 'none'; }, 2500);
  }

  // ---------- Fetch with real progress ----------
  async function fetchJsonWithProgress(url) {
    let total = null;
    try {
      const head = await fetch(url, { method: 'HEAD', cache: 'no-store' });
      const len = head.headers.get('content-length') || head.headers.get('Content-Length');
      if (len && !isNaN(parseInt(len, 10))) total = parseInt(len, 10);
    } catch {/* ignore */}

    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    if (total && total > 0) setProgress(0); else setProgressIndeterminate();

    if (!res.body) {
      const text = await res.text();
      hideProgress();
      return JSON.parse(text);
    }

    const reader = res.body.getReader();
    const chunks = [];
    let received = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.byteLength;
      if (total && total > 0) {
        const pct = Math.max(0.01, Math.min(99.0, (received / total) * 100));
        setProgress(pct);
      }
    }

    const blob = new Blob(chunks, { type: 'application/json' });
    const text = await blob.text();
    hideProgress();
    return JSON.parse(text);
  }

  async function loadDataFor(stateCode, displayLabel = '') {
    const url = DATA_URLS[stateCode];
    if (!url) return;
    clearUI();
    data = [];

    try {
      const json = await fetchJsonWithProgress(url);
      data = Array.isArray(json) ? json : [];
      showToastLoaded(displayLabel || stateCode);
    } catch (e) {
      console.error('Error loading data:', e);
      data = [];
      hideProgress();
      showToastError('Failed to load data. Please check your network and try again.');
    }
  }

  // ---------- Combobox behaviors ----------
  function openCombo() {
    combo.classList.add('open');
    combo.setAttribute('aria-expanded', 'true');
  }
  function closeCombo() {
    combo.classList.remove('open');
    combo.setAttribute('aria-expanded', 'false');
  }
  function toggleCombo() {
    if (combo.classList.contains('open')) closeCombo(); else openCombo();
  }

  function selectState(value, label) {
    trigger.textContent = label || 'Choose…';
    currentState = value || null;
    currentStateLabel = label || value || '';

    // Map button chỉ hiển thị khi chọn NSW - SydneyZone
    if (mapBtnContainer) {
      mapBtnContainer.style.display = (currentState === 'NSW_SYDNEYZONE') ? 'block' : 'none';
    }

    // Reset input + enable khi có state
    suburbInput.value = '';
    suburbInput.disabled = !currentState;
    suburbInput.placeholder = currentState ? ' ' : '';

    // Tải dữ liệu
    loadDataFor(currentState, currentStateLabel);
  }

  // Ẩn map button ban đầu
  if (mapBtnContainer) mapBtnContainer.style.display = 'none';

  // Events cho combobox
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleCombo();
  });
  listbox.querySelectorAll('.combo-option').forEach(opt => {
    opt.addEventListener('click', () => {
      const value = opt.getAttribute('data-value');
      const label = opt.textContent.trim();
      listbox.querySelectorAll('.combo-option').forEach(o => o.removeAttribute('aria-selected'));
      opt.setAttribute('aria-selected', 'true');
      selectState(value, label);
      closeCombo();
    });
  });
  document.addEventListener('click', () => closeCombo());
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeCombo(); });

  // ---------- Render kết quả động ----------
  const PREFERRED_ORDER = ['SortCode', 'Zone', 'Run', 'Chute']; // ưu tiên hiển thị nếu có
  function renderDynamicFields(item) {
    if (!dynamicFieldsEl) return;
    dynamicFieldsEl.innerHTML = '';

    // Lấy tất cả key trừ Suburb, Postcode
    const keys = Object.keys(item || {}).filter(k => k !== 'Suburb' && k !== 'Postcode');

    if (!keys.length) return;

    // Sắp xếp: các key trong PREFERRED_ORDER trước, còn lại theo alphabet
    keys.sort((a, b) => {
      const ia = PREFERRED_ORDER.indexOf(a);
      const ib = PREFERRED_ORDER.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b);
    });

    // Render
    for (const key of keys) {
      const value = item[key];
      // Bỏ qua undefined/null/chuỗi rỗng
      if (value === undefined || value === null || String(value).trim() === '') continue;

      const p = document.createElement('p');
      const strong = document.createElement('strong');
      strong.textContent = key + ':';
      const span = document.createElement('span');
      span.textContent = ' ' + String(value);

      p.appendChild(strong);
      p.appendChild(span);
      dynamicFieldsEl.appendChild(p);
    }
  }

  // ---------- Suburb/Postcode search ----------
  suburbInput.addEventListener('input', function () {
    const input = suburbInput.value.trim().toLowerCase();
    suggestions.innerHTML = '';

    if (!currentState) {
      suggestions.style.display = 'block';
      suggestions.innerHTML = `<div>Please select a state first.</div>`;
      result.style.display = 'none';
      return;
    }

    if (!input) {
      suggestions.style.display = 'none';
      result.style.display = 'none';
      return;
    }

    let matched = data.filter(item => {
      const suburb = (item.Suburb || '').toLowerCase();
      const pcStr  = item.Postcode != null ? String(item.Postcode) : '';
      return suburb.startsWith(input) || pcStr.startsWith(input);
    });

    matched.sort((a, b) => {
      const bySuburb = (a.Suburb || '').localeCompare(b.Suburb || '');
      if (bySuburb !== 0) return bySuburb;
      return (a.Postcode ?? 0) - (b.Postcode ?? 0);
    });

    if (!matched.length) {
      suggestions.style.display = 'block';
      suggestions.innerHTML = `<div>No match found.</div>`;
      return;
    }

    suggestions.style.display = 'block';
    matched.forEach(item => {
      const row = document.createElement('div');
      row.textContent = `${item.Suburb} (${item.Postcode})`;
      row.addEventListener('click', () => {
        // Clear input + fill common
        suburbInput.value = '';
        suburbNameEl.textContent = item.Suburb ?? '';
        postcodeEl.textContent   = item.Postcode ?? '';

        // Render động các field còn lại
        renderDynamicFields(item);

        // THÊM LINK: “Show all Run Numbers in Zone …” (chỉ NSW_SYDNEYZONE & có Zone)
        const old = document.getElementById('show-all-runs');
        if (old) old.remove();

        if (currentState === 'NSW_SYDNEYZONE' && item.Zone != null && String(item.Zone).trim() !== '') {
          const showAll = document.createElement('p');
          showAll.id = 'show-all-runs';
          showAll.classList.add('small-text', 'clickable');
          showAll.textContent = `Show all Run Numbers in Zone ${item.Zone}`;
          showAll.addEventListener('click', () => showRunPopup(item.Zone));
          result.appendChild(showAll);
        }

        result.style.display = 'block';
        suggestions.innerHTML = '';
        suggestions.style.display = 'none';
      });
      suggestions.appendChild(row);
    });
  });

  // ---------- “Show all Run Numbers in Zone …” ----------
  function removeRunDuplicates(arr) {
    const seen = new Set();
    return arr.filter(item => {
      const runVal = item.Run != null ? String(item.Run) : '';
      if (!runVal) return false;
      if (seen.has(runVal)) return false;
      seen.add(runVal);
      return true;
    });
  }

  function showRunPopup(zoneNumber) {
    if (currentState !== 'NSW_SYDNEYZONE') return; // chỉ cho SydneyZone
    // Lọc các record trong Zone, có Run
    let runsInZone = data.filter(item => String(item.Zone) === String(zoneNumber) && item.Run != null);
    let uniqueRuns = removeRunDuplicates(runsInZone);
    uniqueRuns.sort((a, b) => Number(a.Run) - Number(b.Run));

    // Render modal
    modalTitle.textContent = `Run Numbers in Zone ${zoneNumber}`;
    let html = `<table class="run-table"><thead><tr><th>Run Number</th></tr></thead><tbody>`;
    uniqueRuns.forEach(item => {
      html += `<tr><td>Run ${item.Run}</td></tr>`;
    });
    html += `</tbody></table>`;
    modalRunList.innerHTML = html;

    popupOverlay.style.display = 'flex';
  }

  if (modalCloseButton) {
    modalCloseButton.addEventListener('click', () => { popupOverlay.style.display = 'none'; });
  }
  
  // --- Auto reload khi quay lại tab trình duyệt ---
(function enableAutoReloadOnTabFocus() {
  const MIN_RELOAD_INTERVAL_MS = 5000; // tránh reload liên tục nếu chuyển tab nhanh
  let lastReload = Date.now();

  function safeReload(hard = false) {
    const now = Date.now();
    if (now - lastReload < MIN_RELOAD_INTERVAL_MS) return;
    lastReload = now;
    // hard=true sẽ bỏ cache (như Ctrl+F5); false là reload thường
    window.location.reload(hard);
  }

  // Ưu tiên Page Visibility API
  document.addEventListener('visibilitychange', () => {
    // Khi tab trở lại visible thì reload
    if (!document.hidden) safeReload(false);
  });

  // Fallback: một số trình duyệt tin vào focus hơn
  window.addEventListener('focus', () => {
    // Chỉ reload nếu thực sự quay lại cửa sổ/tab này
    safeReload(false);
  });
})();


  // ===== Default chọn NSW - SydneyZone khi vào trang =====
  const defaultOpt = listbox.querySelector('[data-value="NSW_SYDNEYZONE"]');
  if (defaultOpt) defaultOpt.setAttribute('aria-selected', 'true');
  selectState('NSW_SYDNEYZONE', 'NSW - SydneyZone');
});
