// =============================================
// Türkiye Camileri Ansiklopedisi - Ana Uygulama
// =============================================

let map;
let markers = [];
let markerGroup;
let filteredData = [...mosqueData];
let detailMap = null;

// Custom mosque icon
const mosqueIcon = L.divIcon({
    html: '<div style="background:#1a6b4a;color:white;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 2px 6px rgba(0,0,0,0.3);border:2px solid white;">&#9770;</div>',
    className: 'custom-mosque-icon',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
});

const mosqueIconActive = L.divIcon({
    html: '<div style="background:#e74c3c;color:white;width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 3px 10px rgba(231,76,60,0.4);border:2px solid white;">&#9770;</div>',
    className: 'custom-mosque-icon-active',
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -19]
});

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    populateCityFilter();
    renderList(mosqueData);
    addMarkers(mosqueData);
    bindEvents();
    updateResultCount(mosqueData.length);
});

// Initialize Leaflet Map
function initMap() {
    map = L.map('map', {
        center: [39.0, 35.0],
        zoom: 6,
        minZoom: 5,
        maxZoom: 18
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19
    }).addTo(map);

    markerGroup = L.layerGroup().addTo(map);
}

// Populate city filter dropdown
function populateCityFilter() {
    const cities = [...new Set(mosqueData.map(m => m.city))].sort((a, b) => a.localeCompare(b, 'tr'));
    const cityFilter = document.getElementById('cityFilter');
    cities.forEach(city => {
        const option = document.createElement('option');
        option.value = city;
        option.textContent = city;
        cityFilter.appendChild(option);
    });
}

// Render mosque list
function renderList(data) {
    const container = document.getElementById('mosqueList');

    if (data.length === 0) {
        container.innerHTML = `
            <div class="no-results">
                <h3>Sonuç bulunamadı</h3>
                <p>Arama kriterlerinizi değiştirerek tekrar deneyin.</p>
            </div>`;
        return;
    }

    container.innerHTML = data.map(mosque => `
        <div class="mosque-card" data-id="${mosque.id}" onclick="handleCardClick(${mosque.id})">
            <div class="card-header">
                <h3>${mosque.name}</h3>
                <span class="card-badge">${mosque.period}</span>
            </div>
            <div class="card-city">${mosque.city} / ${mosque.district}</div>
            <p class="card-desc">${mosque.description}</p>
            <div class="card-meta">
                <span>&#128197; ${mosque.year}</span>
                ${mosque.architect !== 'Bilinmiyor' ? `<span>&#9997; ${mosque.architect}</span>` : ''}
                ${mosque.minarets > 0 ? `<span>${mosque.minarets} Minare</span>` : ''}
            </div>
            <button class="btn-detail" onclick="event.stopPropagation(); openDetail(${mosque.id})">Detaylı Bilgi</button>
        </div>
    `).join('');
}

// Add markers to the map
function addMarkers(data) {
    markerGroup.clearLayers();
    markers = [];

    data.forEach(mosque => {
        const marker = L.marker([mosque.lat, mosque.lng], { icon: mosqueIcon })
            .bindPopup(`
                <div class="popup-content">
                    <h4>${mosque.name}</h4>
                    <p>${mosque.city} / ${mosque.district}</p>
                    <p>${mosque.period} - ${mosque.year}</p>
                    <span class="popup-link" onclick="openDetail(${mosque.id})">Detaylı Bilgi &rarr;</span>
                </div>
            `);

        marker.mosqueId = mosque.id;
        markers.push(marker);
        markerGroup.addLayer(marker);
    });

    // Fit map to show all markers
    if (data.length > 0) {
        const group = L.featureGroup(markers);
        map.fitBounds(group.getBounds().pad(0.1));
    }
}

// Handle card click - highlight on map
function handleCardClick(id) {
    // Remove active state from all cards
    document.querySelectorAll('.mosque-card').forEach(c => c.classList.remove('active'));

    // Add active state to clicked card
    const card = document.querySelector(`.mosque-card[data-id="${id}"]`);
    if (card) card.classList.add('active');

    // Find and highlight marker
    const mosque = mosqueData.find(m => m.id === id);
    if (!mosque) return;

    // Reset all icons
    markers.forEach(m => m.setIcon(mosqueIcon));

    // Find the marker and highlight it
    const targetMarker = markers.find(m => m.mosqueId === id);
    if (targetMarker) {
        targetMarker.setIcon(mosqueIconActive);
        map.setView([mosque.lat, mosque.lng], 13, { animate: true });
        targetMarker.openPopup();
    }
}

// Open detail modal
function openDetail(id) {
    const mosque = mosqueData.find(m => m.id === id);
    if (!mosque) return;

    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${mosque.lat},${mosque.lng}`;

    const modalBody = document.getElementById('modalBody');
    modalBody.innerHTML = `
        <h2>${mosque.name}</h2>
        <div class="modal-city">&#128205; ${mosque.city} / ${mosque.district}</div>
        <span class="modal-badge">${mosque.period} Dönemi</span>

        <div class="info-grid">
            <div class="info-item">
                <div class="label">Yapım Yılı</div>
                <div class="value">${mosque.year}</div>
            </div>
            <div class="info-item">
                <div class="label">Mimar</div>
                <div class="value">${mosque.architect}</div>
            </div>
            <div class="info-item">
                <div class="label">Mimari Üslup</div>
                <div class="value">${mosque.style}</div>
            </div>
            <div class="info-item">
                <div class="label">Minare Sayısı</div>
                <div class="value">${mosque.minarets}</div>
            </div>
            ${mosque.capacity ? `
            <div class="info-item">
                <div class="label">Kapasite</div>
                <div class="value">${mosque.capacity.toLocaleString('tr-TR')} kişi</div>
            </div>` : ''}
            ${mosque.domes !== undefined ? `
            <div class="info-item">
                <div class="label">Kubbe Sayısı</div>
                <div class="value">${mosque.domes}</div>
            </div>` : ''}
        </div>

        <div class="modal-section">
            <h4>Genel Bilgi</h4>
            <p>${mosque.description}</p>
        </div>

        ${mosque.history ? `
        <div class="modal-section">
            <h4>Tarihçe</h4>
            <p>${mosque.history}</p>
        </div>` : ''}

        ${mosque.features && mosque.features.length > 0 ? `
        <div class="modal-section">
            <h4>Öne Çıkan Özellikler</h4>
            <div style="display:flex;flex-wrap:wrap;gap:0.4rem;">
                ${mosque.features.map(f => `<span style="background:#e8f5e9;color:#1a6b4a;padding:0.3rem 0.7rem;border-radius:20px;font-size:0.8rem;font-weight:500;">${f}</span>`).join('')}
            </div>
        </div>` : ''}

        <div class="modal-section">
            <h4>Konum</h4>
            <p>Enlem: ${mosque.lat} | Boylam: ${mosque.lng}</p>
            <div id="detailMap" class="modal-map"></div>
            <a href="${googleMapsUrl}" target="_blank" rel="noopener noreferrer" class="btn-google-maps">
                &#128506; Google Haritalar'da Aç
            </a>
        </div>
    `;

    // Show modal
    document.getElementById('modalOverlay').classList.add('active');
    document.body.style.overflow = 'hidden';

    // Initialize detail map after DOM is ready
    setTimeout(() => {
        if (detailMap) {
            detailMap.remove();
        }
        detailMap = L.map('detailMap', {
            center: [mosque.lat, mosque.lng],
            zoom: 15,
            zoomControl: true
        });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap',
            maxZoom: 19
        }).addTo(detailMap);
        L.marker([mosque.lat, mosque.lng], { icon: mosqueIcon }).addTo(detailMap);
    }, 100);
}

// Close modal
function closeModal() {
    document.getElementById('modalOverlay').classList.remove('active');
    document.body.style.overflow = '';
    if (detailMap) {
        detailMap.remove();
        detailMap = null;
    }
}

// Search and filter
function applyFilters() {
    const searchText = document.getElementById('searchInput').value.toLowerCase().trim();
    const cityValue = document.getElementById('cityFilter').value;
    const periodValue = document.getElementById('periodFilter').value;

    filteredData = mosqueData.filter(mosque => {
        const matchesSearch = !searchText ||
            mosque.name.toLowerCase().includes(searchText) ||
            mosque.city.toLowerCase().includes(searchText) ||
            mosque.district.toLowerCase().includes(searchText) ||
            mosque.description.toLowerCase().includes(searchText) ||
            mosque.architect.toLowerCase().includes(searchText);

        const matchesCity = !cityValue || mosque.city === cityValue;
        const matchesPeriod = !periodValue || mosque.period === periodValue;

        return matchesSearch && matchesCity && matchesPeriod;
    });

    renderList(filteredData);
    addMarkers(filteredData);
    updateResultCount(filteredData.length);
}

// Reset filters
function resetFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('cityFilter').value = '';
    document.getElementById('periodFilter').value = '';
    filteredData = [...mosqueData];
    renderList(mosqueData);
    addMarkers(mosqueData);
    updateResultCount(mosqueData.length);
}

// Update result count text
function updateResultCount(count) {
    const el = document.getElementById('resultCount');
    el.textContent = `Toplam ${count} cami listeleniyor (veritabanında ${mosqueData.length} cami)`;
}

// Bind events
function bindEvents() {
    document.getElementById('searchBtn').addEventListener('click', applyFilters);
    document.getElementById('searchInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') applyFilters();
    });
    document.getElementById('searchInput').addEventListener('input', () => {
        // Auto-search after short delay
        clearTimeout(window._searchTimeout);
        window._searchTimeout = setTimeout(applyFilters, 300);
    });
    document.getElementById('cityFilter').addEventListener('change', applyFilters);
    document.getElementById('periodFilter').addEventListener('change', applyFilters);
    document.getElementById('resetBtn').addEventListener('click', resetFilters);
    document.getElementById('modalClose').addEventListener('click', closeModal);
    document.getElementById('modalOverlay').addEventListener('click', (e) => {
        if (e.target === document.getElementById('modalOverlay')) closeModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });
}
