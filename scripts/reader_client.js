// Reader Client JavaScript

let activePageNumber = 1;
let currentFontSize = 16.5;
let isDark = false;
let isUserNavigating = false;

function toggleRightSidebar() {
  const sb = document.getElementById('sidebarRight');
  const mc = document.getElementById('mainContainer');
  const btn = document.getElementById('btnToggleToc');
  sb.classList.toggle('collapsed');
  mc.classList.toggle('sidebar-right-closed');
  btn.classList.toggle('active-btn', !sb.classList.contains('collapsed'));
}

function toggleLeftSidebar() {
  const sb = document.getElementById('sidebarLeft');
  const mc = document.getElementById('mainContainer');
  const btn = document.getElementById('btnToggleLocs');
  sb.classList.toggle('collapsed');
  mc.classList.toggle('sidebar-left-closed');
  btn.classList.toggle('active-btn', !sb.classList.contains('collapsed'));
}

function toggleDarkMode() {
  isDark = !isDark;
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
}

function changeFontSize(delta) {
  currentFontSize = Math.max(13, Math.min(24, currentFontSize + delta));
  document.querySelectorAll('.page-content').forEach(el => {
    el.style.fontSize = currentFontSize + 'px';
  });
}

function copyPageLink(pageNum) {
  const url = window.location.origin + window.location.pathname + '#page-' + pageNum;
  navigator.clipboard.writeText(url).then(() => {
    showToast('הקישור לעמוד ' + pageNum + ' הועתק ללוח: #page-' + pageNum);
  });
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.display = 'block';
  setTimeout(() => { t.style.display = 'none'; }, 3000);
}

function navigateToPage(pageNum) {
  const el = document.getElementById('page-' + pageNum);
  if (el) {
    isUserNavigating = true;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    highlightPage(el);
    window.history.replaceState(null, null, '#page-' + pageNum);
    showLocationsForPage(pageNum);
    setTimeout(() => { isUserNavigating = false; }, 800);
  }
}

function jumpToPageInput() {
  const val = parseInt(document.getElementById('pageJumpInput').value, 10);
  if (val >= 1 && val <= 446) {
    navigateToPage(val);
  }
}

function highlightPage(el) {
  document.querySelectorAll('.page-container').forEach(p => p.classList.remove('highlighted-page'));
  el.classList.add('highlighted-page');
  setTimeout(() => el.classList.remove('highlighted-page'), 3000);
}

// Helper for Site Type Icons
function getSiteIcon(type) {
  const t = (type || '').toLowerCase();
  if (t.includes('tell') || t.includes('תל')) return '🏛️';
  if (t.includes('cave') || t.includes('מער')) return '🕳️';
  if (t.includes('well') || t.includes('באר')) return '💧';
  if (t.includes('spring') || t.includes('מעיין')) return '🌿';
  if (t.includes('pool') || t.includes('בריכ')) return '🏊';
  if (t.includes('aqueduct') || t.includes('אמת')) return '🏛️';
  if (t.includes('valley') || t.includes('בקע') || t.includes('עמק')) return '🌄';
  if (t.includes('mountain') || t.includes('הר')) return '🏔️';
  if (t.includes('comparative') || t.includes('השווא')) return '🌐';
  if (t.includes('region') || t.includes('אזור')) return '🗺️';
  return '📍';
}

const EXCLUDED_TYPES = new Set([
  'region',
  'valley',
  'mountain',
  'river',
  'lake',
  'bay',
  'fortifications',
  'sea'
]);

let currentActivePageLocations = [];
let highlightedLocationName = null;

function clearLocationHighlights() {
  document.querySelectorAll('.loc-mention-highlight').forEach(el => {
    const parent = el.parentNode;
    if (parent) {
      parent.replaceChild(document.createTextNode(el.textContent), el);
      parent.normalize();
    }
  });
  highlightedLocationName = null;
}

function highlightLocationMentions(loc) {
  clearLocationHighlights();
  if (!loc) return;

  highlightedLocationName = loc.name;

  const rawTerms = [];
  if (loc.name) rawTerms.push(loc.name);
  if (loc.heb_aliases) {
    loc.heb_aliases.split(';').forEach(a => rawTerms.push(a));
  }
  if (loc.eng) rawTerms.push(loc.eng);
  if (loc.eng_aliases) {
    loc.eng_aliases.split(';').forEach(a => rawTerms.push(a));
  }

  const terms = [...new Set(rawTerms.map(t => (t || '').trim()).filter(t => t.length >= 2))]
    .sort((a, b) => b.length - a.length);

  if (terms.length === 0) return;

  const escaped = terms.map(t => t.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|');
  const regex = new RegExp('(' + escaped + ')', 'gi');

  const pageContainer = document.getElementById('page-' + activePageNumber);
  const targetArea = pageContainer ? (pageContainer.querySelector('.page-content') || pageContainer) : document;

  const textNodes = [];
  const walker = document.createTreeWalker(targetArea, NodeFilter.SHOW_TEXT, {
    acceptNode: function(node) {
      if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      const p = node.parentElement;
      if (p && (p.tagName === 'SCRIPT' || p.tagName === 'STYLE' || p.classList.contains('loc-mention-highlight'))) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  let currentNode;
  while ((currentNode = walker.nextNode())) {
    if (regex.test(currentNode.nodeValue)) {
      textNodes.push(currentNode);
    }
  }

  let firstMatch = null;
  textNodes.forEach(node => {
    const text = node.nodeValue;
    const frag = document.createDocumentFragment();
    let lastIdx = 0;
    regex.lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIdx) {
        frag.appendChild(document.createTextNode(text.substring(lastIdx, match.index)));
      }
      const mark = document.createElement('mark');
      mark.className = 'loc-mention-highlight';
      mark.textContent = match[0];
      frag.appendChild(mark);
      if (!firstMatch) firstMatch = mark;
      lastIdx = regex.lastIndex;
    }

    if (lastIdx < text.length) {
      frag.appendChild(document.createTextNode(text.substring(lastIdx)));
    }

    if (node.parentNode) {
      node.parentNode.replaceChild(frag, node);
    }
  });

  if (firstMatch) {
    firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function formatSourceBadge(source) {
  if (!source) return '';
  const s = String(source).trim();
  if (s.toLowerCase() === 'phd') {
    return '<span class="loc-source-pill source-phd" title="מקור הקואורדינטות: עבודת הדוקטורט (צוק 2000)">PhD</span>';
  }
  if (s.toLowerCase() === 'iaa') {
    return '<span class="loc-source-pill source-iaa" title="מקור הקואורדינטות: סקר רשות העתיקות">IAA</span>';
  }
  if (s.startsWith('http')) {
    let articleName = 'ויקיפדיה';
    try {
      const parts = s.split('/');
      const last = decodeURIComponent(parts[parts.length - 1]).replace(/_/g, ' ');
      if (last) articleName = last;
    } catch(e) {}
    return '<a href="' + s + '" target="_blank" rel="noopener" class="loc-source-pill source-wiki" title="מקור הקואורדינטות: ויקיפדיה (' + articleName + ')" onclick="event.stopPropagation()">🌐 ' + articleName + ' ↗</a>';
  }
  return '<span class="loc-source-pill" title="מקור: ' + s + '">' + s + '</span>';
}

function formatSourceDetail(source) {
  if (!source) return 'לא צוין';
  const s = String(source).trim();
  if (s.toLowerCase() === 'phd') {
    return '<span>עבודת הדוקטורט (ד"ר צביקה צוק 2000) / רשת ישראל</span>';
  }
  if (s.toLowerCase() === 'iaa') {
    return '<span>מאגר אתרי סקר רשות העתיקות (IAA Archaeological Survey)</span>';
  }
  if (s.startsWith('http')) {
    let articleName = s;
    try {
      const parts = s.split('/');
      articleName = decodeURIComponent(parts[parts.length - 1]).replace(/_/g, ' ');
    } catch(e) {}
    return '<a href="' + s + '" target="_blank" rel="noopener" class="loc-source-link">🌐 ויקיפדיה: ' + articleName + ' ↗</a>';
  }
  return '<span>' + s + '</span>';
}

// Render Locations in Left Sidebar
function showLocationsForPage(pageNum) {
  clearLocationHighlights();
  activePageNumber = pageNum;
  const pageLabel = document.getElementById('locCurrentPage');
  if (pageLabel) pageLabel.textContent = pageNum;
  
  const rawLocList = (typeof LOCATIONS_BY_PAGE !== 'undefined' && LOCATIONS_BY_PAGE[pageNum]) ? LOCATIONS_BY_PAGE[pageNum] : [];
  const locList = rawLocList.filter(l => !EXCLUDED_TYPES.has((l.type || '').toLowerCase().trim()));
  
  const badge = document.getElementById('locCountBadge');
  if (badge) badge.textContent = locList.length + ' אתרים';

  const container = document.getElementById('locListContainer');
  if (!container) return;

  const filterInput = document.getElementById('locFilterInput');
  const filterVal = (filterInput ? filterInput.value : '').trim().toLowerCase();

  if (locList.length === 0) {
    container.innerHTML = '<div class="loc-empty-state">ℹ️ אין אזכורי אתרים בעמוד זה</div>';
    currentActivePageLocations = [];
    return;
  }

  const filtered = locList.filter(l => {
    if (!filterVal) return true;
    return (l.name && l.name.toLowerCase().includes(filterVal)) ||
           (l.eng && l.eng.toLowerCase().includes(filterVal)) ||
           (l.heb_aliases && l.heb_aliases.toLowerCase().includes(filterVal)) ||
           (l.eng_aliases && l.eng_aliases.toLowerCase().includes(filterVal)) ||
           (l.type && l.type.toLowerCase().includes(filterVal)) ||
           (l.coord_source && l.coord_source.toLowerCase().includes(filterVal));
  });

  currentActivePageLocations = filtered;

  if (filtered.length === 0) {
    container.innerHTML = '<div class="loc-empty-state">לא נמצאו אתרים התואמים לסינון</div>';
    return;
  }

  let html = '';
  filtered.forEach((loc, idx) => {
    const icon = getSiteIcon(loc.type);
    const cardId = 'loc-card-' + idx;

    // Clickable page chips
    let pageChipsHtml = '';
    if (Array.isArray(loc.pages)) {
      pageChipsHtml = loc.pages.map(p => {
        const isCurrent = p === activePageNumber ? 'active-page-chip' : '';
        return '<a href="#page-' + p + '" onclick="navigateToPage(' + p + '); return false;" class="loc-page-chip ' + isCurrent + '" title="עבור לעמוד ' + p + '">עמוד ' + p + '</a>';
      }).join(' ');
    }

    // Coordinates and Map link
    let coordsHeaderHtml = '';
    let mapUrl = '';
    if (loc.lat && loc.lon) {
      mapUrl = loc.map_url || ('https://www.google.com/maps?q=' + loc.lat + ',' + loc.lon + '&ll=' + loc.lat + ',' + loc.lon + '&z=17');
      const sourceBadge = formatSourceBadge(loc.coord_source);
      coordsHeaderHtml = '<div class="loc-coords-row">' +
        '<a href="' + mapUrl + '" target="_blank" rel="noopener" class="loc-coords-chip" title="פתח מיקום ב-Google Maps (זום 17)" onclick="event.stopPropagation()">' +
          '📍 ' + loc.lat + ', ' + loc.lon + ' ↗' +
        '</a>' +
        sourceBadge +
      '</div>';
    }

    // External IAA Links
    let extLinksHtml = '';
    if (loc.iaa_url) {
      extLinksHtml += '<a href="' + loc.iaa_url + '" target="_blank" rel="noopener" class="loc-btn-link iaa-link" title="פתח כרטיס אתר בסקר רשות העתיקות">🏛️ סקר רשות העתיקות ↗</a>';
    }
    if (loc.iaa_eng_url) {
      extLinksHtml += '<a href="' + loc.iaa_eng_url + '" target="_blank" rel="noopener" class="loc-btn-link iaa-link" title="Open site in IAA English Survey">🌐 IAA English ↗</a>';
    }
    if (loc.lat && loc.lon && mapUrl) {
      extLinksHtml += '<a href="' + mapUrl + '" target="_blank" rel="noopener" class="loc-btn-link map-btn-link" title="הצג מיקום ב-Google Maps (זום 17)">🗺️ Google Maps (זום 17) ↗</a>';
    }

    html += '<div class="loc-card" id="' + cardId + '">' +
      '<div class="loc-card-header" onclick="toggleLocationCard(\'' + cardId + '\', ' + idx + ')">' +
        '<div class="loc-card-title-group">' +
          '<div class="loc-card-name">' +
            '<span>' + icon + '</span>' +
            '<span>' + loc.name + '</span>' +
          '</div>' +
          (loc.eng ? '<div class="loc-card-eng">' + loc.eng + '</div>' : '') +
          coordsHeaderHtml +
        '</div>' +
        '<div style="display:flex; align-items:center; gap:6px;">' +
          '<span class="loc-type-badge">' + loc.type + '</span>' +
          '<span class="loc-chevron">▼</span>' +
        '</div>' +
      '</div>' +
      '<div class="loc-details-body">' +
        (loc.lat && loc.lon ? '<div class="loc-detail-row"><span class="loc-detail-label">קואורדינטות (WGS84)</span><span class="loc-detail-value"><a href="' + mapUrl + '" target="_blank" rel="noopener" class="loc-coords-btn" title="פתח ב-Google Maps (זום 17)">📍 ' + loc.lat + ', ' + loc.lon + ' &nbsp;[פתח מפה בזום 17 ↗]</a></span></div>' : '') +
        (loc.coord_source ? '<div class="loc-detail-row"><span class="loc-detail-label">מקור הקואורדינטות</span><span class="loc-detail-value">' + formatSourceDetail(loc.coord_source) + '</span></div>' : '') +
        (loc.num_candidates && loc.num_candidates > 1 ? '<div class="loc-detail-row"><span class="loc-detail-label">בקרת איכות ואימות</span><span class="loc-detail-value">נבחנו ' + loc.num_candidates + ' אפשרויות זיהוי (הקואורדינטה המדויקת ביותר נבחרה)</span></div>' : '') +
        (loc.eng ? '<div class="loc-detail-row"><span class="loc-detail-label">שם באנגלית</span><span class="loc-detail-value">' + loc.eng + '</span></div>' : '') +
        (loc.heb_aliases ? '<div class="loc-detail-row"><span class="loc-detail-label">שמות נרדפים בעברית</span><span class="loc-detail-value">' + loc.heb_aliases + '</span></div>' : '') +
        (loc.eng_aliases ? '<div class="loc-detail-row"><span class="loc-detail-label">שמות נרדפים באנגלית</span><span class="loc-detail-value">' + loc.eng_aliases + '</span></div>' : '') +
        '<div class="loc-detail-row"><span class="loc-detail-label">סוג ישות / אתר</span><span class="loc-detail-value">' + loc.type + '</span></div>' +
        '<div class="loc-detail-row"><span class="loc-detail-label">הופעה ראשונה בחיבור</span><span class="loc-detail-value"><a href="#page-' + loc.first_page + '" onclick="navigateToPage(' + loc.first_page + '); return false;" class="loc-page-chip">עמוד ' + loc.first_page + '</a></span></div>' +
        '<div class="loc-detail-row"><span class="loc-detail-label">כל העמודים שבהם מוזכר (' + (loc.pages ? loc.pages.length : 0) + ')</span><div class="loc-page-badges-container">' + pageChipsHtml + '</div></div>' +
        (loc.iaa_map ? '<div class="loc-detail-row"><span class="loc-detail-label">מפת סקר רשות העתיקות</span><span class="loc-detail-value">' + loc.iaa_map + (loc.iaa_id ? ' (מספר אתר: ' + loc.iaa_id + ')' : '') + '</span></div>' : '') +
        (extLinksHtml ? '<div class="loc-detail-row" style="margin-top: 6px;"><span class="loc-detail-label">קישורים ומפות</span><div class="loc-links-group">' + extLinksHtml + '</div></div>' : '') +
      '</div>' +
    '</div>';
  });

  container.innerHTML = html;
}

function toggleLocationCard(cardId, idx) {
  const card = document.getElementById(cardId);
  if (!card) return;

  const wasExpanded = card.classList.contains('expanded');

  // Collapse all other location cards
  document.querySelectorAll('.loc-card.expanded').forEach(c => {
    if (c.id !== cardId) c.classList.remove('expanded');
  });

  if (wasExpanded) {
    card.classList.remove('expanded');
    clearLocationHighlights();
  } else {
    card.classList.add('expanded');
    const loc = currentActivePageLocations[idx];
    if (loc) {
      highlightLocationMentions(loc);
    }
  }
}

function filterLocationsList() {
  showLocationsForPage(activePageNumber);
}

// Scroll Observer: Dynamically sync Left Sidebar with the page in view
const observerOptions = {
  root: null,
  rootMargin: '-20% 0px -60% 0px',
  threshold: 0
};

const pageObserver = new IntersectionObserver((entries) => {
  if (isUserNavigating) return;
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const pageNum = parseInt(entry.target.getAttribute('data-page'), 10);
      if (pageNum && pageNum !== activePageNumber) {
        showLocationsForPage(pageNum);
      }
    }
  });
}, observerOptions);

// Live search highlight across all pages
let searchDebounce = null;
function handleSearch() {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => {
    const query = document.getElementById('searchInput').value.trim();
    const countSpan = document.getElementById('searchCount');
    
    document.querySelectorAll('.search-highlight').forEach(el => {
      const parent = el.parentNode;
      parent.replaceChild(document.createTextNode(el.textContent), el);
      parent.normalize();
    });

    if (!query || query.length < 2) {
      countSpan.textContent = '';
      return;
    }

    let matchesCount = 0;
    let firstMatch = null;
    const regex = new RegExp('(' + query.replace(/[-\\/\\\\^$*+?.()|[\\]{}]/g, '\\\\$&') + ')', 'gi');

    document.querySelectorAll('.page-content').forEach(pc => {
      const paragraphs = pc.querySelectorAll('p, h2, h3, li, div');
      paragraphs.forEach(p => {
        if (p.textContent.toLowerCase().includes(query.toLowerCase())) {
          p.innerHTML = p.innerHTML.replace(regex, '<mark class="search-highlight">$1</mark>');
          matchesCount++;
          if (!firstMatch) firstMatch = p;
        }
      });
    });

    countSpan.textContent = matchesCount > 0 ? (matchesCount + ' תוצאות') : 'לא נמצאו תוצאות';
    if (firstMatch) {
      firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, 300);
}

// Expose functions globally to window for inline onclick handlers
window.toggleRightSidebar = toggleRightSidebar;
window.toggleLeftSidebar = toggleLeftSidebar;
window.toggleDarkMode = toggleDarkMode;
window.changeFontSize = changeFontSize;
window.copyPageLink = copyPageLink;
window.showToast = showToast;
window.navigateToPage = navigateToPage;
window.jumpToPageInput = jumpToPageInput;
window.highlightPage = highlightPage;
window.getSiteIcon = getSiteIcon;
window.showLocationsForPage = showLocationsForPage;
window.toggleLocationCard = toggleLocationCard;
window.filterLocationsList = filterLocationsList;
window.handleSearch = handleSearch;
window.highlightLocationMentions = highlightLocationMentions;
window.clearLocationHighlights = clearLocationHighlights;

// Initialize on Load
function initReader() {
  document.querySelectorAll('.page-container').forEach(p => pageObserver.observe(p));

  const hash = window.location.hash;
  let initPage = 1;
  if (hash) {
    const pageMatch = hash.match(/page-(\d+)/) || hash.match(/p(\d+)/);
    if (pageMatch) {
      initPage = parseInt(pageMatch[1], 10);
      setTimeout(() => navigateToPage(initPage), 250);
    }
  }
  showLocationsForPage(initPage);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initReader);
} else {
  initReader();
}
