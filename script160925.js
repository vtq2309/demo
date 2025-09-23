document.addEventListener('DOMContentLoaded', () => {
  let data = [];
  let currentState = null;

  // Map state -> data file (trong thư mục con /data)
  const DATA_URLS = {
    NSW: 'data/dataNSW.json',
    VIC: 'data/dataVIC.json',
    QLD: 'data/dataQLD.json',
    WA : 'data/dataWA.json',
    SA : 'data/dataSA.json',
    TAS: 'data/dataTAS.json',
    NT : 'data/dataNT.json',
    ACT: 'data/dataACT.json'
  };

  // DOM refs
  const combo           = document.getElementById('state-combobox');
  const trigger         = document.getElementById('state-trigger');
  const listbox         = document.getElementById('state-list');
  const suburbInput     = document.getElementById('suburb-input');
  const suggestions     = document.getElementById('suggestions');
  const result          = document.getElementById('result');
  const suburbNameEl    = document.getElementById('suburb');
  const postcodeEl      = document.getElementById('postcode');
  const sortcodeEl      = document.getElementById('sortcode');
  const mapBtnContainer = document.getElementById('map-button-container');

  // ====== NEW: Sắp xếp các option state theo A→Z ======
  (function sortStateOptions() {
    const options = Array.from(listbox.querySelectorAll('.combo-option'));
    options
      .sort((a, b) =>
        a.textContent.trim().toLowerCase().localeCompare(b.textContent.trim().toLowerCase())
      )
      .forEach(opt => listbox.appendChild(opt)); // re-append theo thứ tự mới
  })();
  // ====================================================

  // Helpers
  function clearUI() {
    suggestions.innerHTML = '';
    suggestions.style.display = 'none';
    result.style.display = 'none';
    suburbNameEl.textContent = '';
    postcodeEl.textContent   = '';
    sortcodeEl.textContent   = '';
  }

  async function loadDataFor(stateCode) {
    const url = DATA_URLS[stateCode];
    if (!url) return;
    clearUI();
    data = [];
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      data = Array.isArray(json) ? json : [];
    } catch (e) {
      console.error('Error loading data:', e);
      data = [];
    }
  }

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
    trigger.textContent = label || 'Choose…'; // hiển thị state đã chọn
    currentState = value || null;

    // Nút map chỉ hiện khi NSW
    if (mapBtnContainer) {
      mapBtnContainer.style.display = (currentState === 'NSW') ? 'block' : 'none';
    }

    // Enable/disable input + placeholder
    suburbInput.value = '';
    suburbInput.disabled = !currentState;
    suburbInput.placeholder = currentState ? ' ' : '';

    // Tải lại data
    loadDataFor(currentState);
  }

  // Ẩn map button ban đầu
  if (mapBtnContainer) mapBtnContainer.style.display = 'none';

  // Events cho combobox
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleCombo();
  });

  // Gắn sự kiện chọn option (sau khi đã sort)
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

  // Search by suburb or postcode
  suburbInput.addEventListener('input', function () {
    const input = suburbInput.value.trim().toLowerCase();
    suggestions.innerHTML = '';

    // Yêu cầu chọn state trước
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

    // Match: Suburb startsWith OR Postcode startsWith
    let matched = data.filter(item => {
      const suburb = (item.Suburb || '').toLowerCase();
      const pcStr  = item.Postcode != null ? String(item.Postcode) : '';
      return suburb.startsWith(input) || pcStr.startsWith(input);
    });

    // Sort by Suburb asc, then Postcode asc
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
      // Gợi ý: chỉ hiển thị Suburb + Postcode
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
