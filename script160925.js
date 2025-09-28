document.addEventListener('DOMContentLoaded', () => {
  let data = [];
  let currentState = null;

  // Map state -> data file (trong thư mục con /data)
  const DATA_URLS = {
    ALL: 'data/dataAll.json',
    ACT: 'data/dataACT.json',
    NT : 'data/dataNT.json',
    NSW: 'data/dataNSW.json',
    QLD: 'data/dataQLD.json',
    SA : 'data/dataSA.json',
    TAS: 'data/dataTAS.json',
    VIC: 'data/dataVIC.json',
    WA : 'data/dataWA.json'
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
  const sortcodeEl       = document.getElementById('sortcode');
  const mapBtnContainer  = document.getElementById('map-button-container');
  const dataToast        = document.getElementById('data-toast');
  const progressWrap     = document.getElementById('data-progress');
  const progressBar      = document.getElementById('data-progress-bar');

  // ====== Sort options A→Z nhưng luôn giữ "All" ở đầu ======
  (function sortStateOptionsKeepAllOnTop() {
    const options = Array.from(listbox.querySelectorAll('.combo-option'));
    const allOpt = options.find(o => o.textContent.trim().toLowerCase() === 'all');
    const rest = options.filter(o => o !== allOpt);
    rest.sort((a, b) =>
      a.textContent.trim().toLowerCase().localeCompare(b.textContent.trim().toLowerCase())
    );
    listbox.innerHTML = '';
    if (allOpt) listbox.appendChild(allOpt);
    rest.forEach(opt => listbox.appendChild(opt));
  })();

  // ---------- UI Helpers ----------
  function clearUI() {
    suggestions.innerHTML = '';
    suggestions.style.display = 'none';
    result.style.display = 'none';
    suburbNameEl.textContent = '';
    postcodeEl.textContent   = '';
    sortcodeEl.textContent   = '';
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

  // ---------- Fetch with REAL progress ----------
  async function fetchJsonWithProgress(url) {
    // 1) Thử HEAD để lấy Content-Length
    let total = null;
    try {
      const head = await fetch(url, { method: 'HEAD', cache: 'no-store' });
      const len = head.headers.get('content-length') || head.headers.get('Content-Length');
      if (len && !isNaN(parseInt(len, 10))) total = parseInt(len, 10);
    } catch {
      // HEAD có thể bị chặn; bỏ qua -> sẽ dùng indeterminate
    }

    // 2) GET + stream
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    // Nếu có tổng dung lượng -> determinate, ngược lại indeterminate
    if (total && total > 0) setProgress(0); else setProgressIndeterminate();

    if (!res.body) {
      // Không có readable stream: fallback tải thường
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

    // Gộp -> parse
    const blob = new Blob(chunks, { type: 'application/json' });
    const text = await blob.text();
    hideProgress();
    return JSON.parse(text);
  }

  async function loadDataFor(stateCode) {
    const url = DATA_URLS[stateCode];
    if (!url) return;
    clearUI();
    data = [];

    try {
      const json = await fetchJsonWithProgress(url);
      data = Array.isArray(json) ? json : [];
      showToastLoaded(stateCode);
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

    // Nút map chỉ hiện khi NSW
    if (mapBtnContainer) {
      mapBtnContainer.style.display = (currentState === 'NSW') ? 'block' : 'none';
    }

    // Enable/disable input + placeholder
    suburbInput.value = '';
    suburbInput.disabled = !currentState;
    suburbInput.placeholder = currentState ? ' ' : '';

    // Tải dữ liệu
    loadDataFor(currentState);
  }

  // Ẩn map button ban đầu
  if (mapBtnContainer) mapBtnContainer.style.display = 'none';

  // Events cho combobox
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleCombo();
  });

  // Gắn sự kiện chọn option
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

  // Click ngoài để đóng
  document.addEventListener('click', () => closeCombo());
  // ESC để đóng
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeCombo();
  });

  // ---------- Search by suburb or postcode ----------
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
        suburbInput.value = '';
        suburbNameEl.textContent = item.Suburb ?? '';
        postcodeEl.textContent   = item.Postcode ?? '';
        sortcodeEl.textContent   = item.SortCode ?? '';

        result.style.display = 'block';
        suggestions.innerHTML = '';
        suggestions.style.display = 'none';
      });
      suggestions.appendChild(row);
    });
  });
});
