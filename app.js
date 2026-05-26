const PRAYER_API = 'https://ezanvakti.emushaf.net';
const COUNTRY_ID = '2';
const WEATHER_API = 'https://api.open-meteo.com/v1/forecast';
const GEOCODE_API = 'https://geocoding-api.open-meteo.com/v1/search';
const REVERSE_API = 'https://api.bigdatacloud.net/data/reverse-geocode-client';
const OVERPASS_ENDPOINTS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.private.coffee/api/interpreter'
];

const KAABA = { lat: 21.422487, lon: 39.826206 };
const DATA_CACHE_PREFIX = 'vakit-data:';

const STREET_TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const SATELLITE_TILE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

const PRAYERS = [
    ['Imsak', 'İmsak'],
    ['Gunes', 'Güneş'],
    ['Ogle', 'Öğle'],
    ['Ikindi', 'İkindi'],
    ['Aksam', 'Akşam'],
    ['Yatsi', 'Yatsı']
];

const DEFAULT_LOCATION = {
    cityId: '539',
    districtId: '9541',
    cityName: 'İSTANBUL',
    districtName: 'İSTANBUL',
    coords: { lat: 41.0082, lon: 28.9784 }
};

const state = {
    cities: [],
    districts: [],
    selected: { ...DEFAULT_LOCATION },
    prayerDays: [],
    todayPrayer: null,
    nextPrayer: null,
    coords: { ...DEFAULT_LOCATION.coords },
    map: null,
    markerLayer: null,
    userMarker: null,
    qiblaMap: null,
    qiblaLine: null,
    qiblaOriginMarker: null,
    kaabaMarker: null,
    nearestMosques: [],
    activeTab: 'vakit',
    deferredInstallPrompt: null,
    qiblaRotation: 0,
    streetTile: null,
    qiblaStreetTile: null,
    compassActive: false,
    lastHeading: null
};

const el = {};

document.addEventListener('DOMContentLoaded', init);

async function init() {
    try {
        cacheDom();
        bindEvents();
        initTheme();
        initMap();
        startClock();
    } catch (error) {
        console.error('Kritik senkron başlatma hatası:', error);
    }

    try {
        await registerServiceWorker();
    } catch (error) {
        console.warn('Servis işçisi kaydı atlandı:', error);
    }

    try {
        await loadCities();
        await restoreOrDefaultLocation();
        applyInitialTab();
        await updateAll();
    } catch (error) {
        console.error('Kritik asenkron yükleme hatası:', error);
    }
}

function cacheDom() {
    el.syncStatus = document.getElementById('syncStatus');
    el.headerWeather = document.getElementById('headerWeather');
    el.appRefreshBtn = document.getElementById('appRefreshBtn');
    el.installBtn = document.getElementById('installBtn');
    el.geoBtn = document.getElementById('geoBtn');
    el.refreshBtn = document.getElementById('refreshBtn');
    el.citySelect = document.getElementById('citySelect');
    el.districtSelect = document.getElementById('districtSelect');
    el.locationSummary = document.getElementById('locationSummary');
    el.currentClock = document.getElementById('currentClock');
    el.prayerDate = document.getElementById('prayerDate');
    el.nextPrayerName = document.getElementById('nextPrayerName');
    el.countdown = document.getElementById('countdown');
    el.prayerGrid = document.getElementById('prayerGrid');
    el.topbarDate = document.getElementById('topbarDate');
    el.topbarLocation = document.getElementById('topbarLocation');
    el.themeToggleBtn = document.getElementById('themeToggleBtn');
    el.mosqueSummary = document.getElementById('mosqueSummary');
    el.mosqueList = document.getElementById('mosqueList');
    el.nearestRouteBtn = document.getElementById('nearestRouteBtn');
    el.turkeySearchInput = document.getElementById('turkeySearchInput');
    el.turkeySearchBtn = document.getElementById('turkeySearchBtn');
    el.nearbySearchBtn = document.getElementById('nearbySearchBtn');
    el.qiblaPanel = document.getElementById('qiblaPanel');
    el.qiblaGeoBtn = document.getElementById('qiblaGeoBtn');
    el.qiblaSummary = document.getElementById('qiblaSummary');
    el.qiblaBearing = document.getElementById('qiblaBearing');
    el.qiblaDistance = document.getElementById('qiblaDistance');
    el.qiblaArrow = document.getElementById('qiblaArrow');
    el.tabButtons = [...document.querySelectorAll('[data-tab]')];
    el.tabPanels = [...document.querySelectorAll('[data-tab-panel]')];
    el.toast = document.getElementById('toast');

    // Premium controllers
    el.mapScanBtn = document.getElementById('mapScanBtn');
    el.qiblaMapRotation = document.getElementById('qiblaMapRotation');
    el.rotateLeftBtn = document.getElementById('rotateLeftBtn');
    el.rotateRightBtn = document.getElementById('rotateRightBtn');
    el.alignQiblaBtn = document.getElementById('alignQiblaBtn');
    el.resetRotationBtn = document.getElementById('resetRotationBtn');
    el.qiblaZoomInBtn = document.getElementById('qiblaZoomInBtn');
    el.qiblaZoomOutBtn = document.getElementById('qiblaZoomOutBtn');
    el.autoCompassBtn = document.getElementById('autoCompassBtn');
    el.compassRose = document.getElementById('compassRose');
    el.qiblaCompassDial = document.getElementById('qiblaCompassDial');
}

function bindEvents() {
    el.citySelect.addEventListener('change', async () => {
        const city = state.cities.find(item => item.SehirID === el.citySelect.value);
        if (!city) return;
        state.selected.cityId = city.SehirID;
        state.selected.cityName = city.SehirAdi;
        state.selected.districtId = '';
        state.selected.districtName = '';
        await loadDistricts(city.SehirID);
    });

    el.districtSelect.addEventListener('change', async () => {
        const district = state.districts.find(item => item.IlceID === el.districtSelect.value);
        if (!district) return;
        state.selected.districtId = district.IlceID;
        state.selected.districtName = district.IlceAdi;
        state.selected.localityName = '';
        await applyManualSelection();
    });

    el.refreshBtn.addEventListener('click', updateAll);
    el.geoBtn.addEventListener('click', useCurrentLocation);
    el.qiblaGeoBtn.addEventListener('click', useCurrentLocation);
    el.appRefreshBtn.addEventListener('click', refreshApp);
    el.themeToggleBtn.addEventListener('click', toggleTheme);
    el.installBtn.addEventListener('click', installPwa);
    el.turkeySearchBtn.addEventListener('click', searchTurkeyMosques);
    el.nearbySearchBtn.addEventListener('click', loadNearbyMosques);
    el.turkeySearchInput.addEventListener('keydown', event => {
        if (event.key === 'Enter') searchTurkeyMosques();
    });
    el.tabButtons.forEach(button => {
        button.addEventListener('click', () => setActiveTab(button.dataset.tab));
    });

    window.addEventListener('beforeinstallprompt', event => {
        event.preventDefault();
        state.deferredInstallPrompt = event;
        el.installBtn.hidden = false;
    });
    window.addEventListener('hashchange', applyInitialTab);

    // Premium event bindings
    if (el.mapScanBtn) {
        el.mapScanBtn.addEventListener('click', scanCurrentMapArea);
    }
    if (el.qiblaMapRotation) {
        el.qiblaMapRotation.addEventListener('input', () => {
            stopAutoCompass();
            setQiblaRotation(Number(el.qiblaMapRotation.value));
        });
    }
    if (el.rotateLeftBtn) {
        el.rotateLeftBtn.addEventListener('click', () => {
            stopAutoCompass();
            const next = (state.qiblaRotation - 2 + 360) % 360;
            el.qiblaMapRotation.value = next;
            setQiblaRotation(next);
        });
    }
    if (el.rotateRightBtn) {
        el.rotateRightBtn.addEventListener('click', () => {
            stopAutoCompass();
            const next = (state.qiblaRotation + 2) % 360;
            el.qiblaMapRotation.value = next;
            setQiblaRotation(next);
        });
    }
    if (el.alignQiblaBtn) {
        el.alignQiblaBtn.addEventListener('click', () => {
            stopAutoCompass();
            const bearing = qiblaBearing(state.coords.lat, state.coords.lon);
            const rotation = (360 - Math.round(bearing)) % 360;
            el.qiblaMapRotation.value = rotation;
            setQiblaRotation(rotation);
            showToast(`Harita Kıbleye (${Math.round(bearing)}°) hizalandı. Üst yön Kıble'dir!`);
        });
    }
    if (el.resetRotationBtn) {
        el.resetRotationBtn.addEventListener('click', () => {
            stopAutoCompass(); // Stop auto compass if manual reset clicked
            el.qiblaMapRotation.value = 0;
            setQiblaRotation(0);
            showToast('Pusula yönü kuzeye sıfırlandı.');
        });
    }
    if (el.autoCompassBtn) {
        el.autoCompassBtn.addEventListener('click', toggleAutoCompass);
    }
    if (el.qiblaZoomInBtn) {
        el.qiblaZoomInBtn.addEventListener('click', () => {
            if (state.qiblaMap) state.qiblaMap.zoomIn();
        });
    }
    if (el.qiblaZoomOutBtn) {
        el.qiblaZoomOutBtn.addEventListener('click', () => {
            if (state.qiblaMap) state.qiblaMap.zoomOut();
        });
    }
}

function initMap() {
    state.map = L.map('map', {
        center: [state.coords.lat, state.coords.lon],
        zoom: 14,
        minZoom: 6,
        maxZoom: 19
    });

    state.streetTile = L.tileLayer(getStreetTileUrl(), {
        maxZoom: 19,
        attribution: '&copy; CartoDB'
    });

    const satelliteTile = L.tileLayer(SATELLITE_TILE_URL, {
        maxZoom: 19,
        attribution: '&copy; Esri World Imagery'
    });

    const baseLayers = {
        "Harita (Sokak)": state.streetTile,
        "Uydu Görüntüsü": satelliteTile
    };

    state.streetTile.addTo(state.map);
    L.control.layers(baseLayers, null, { position: 'topright' }).addTo(state.map);

    state.markerLayer = L.layerGroup().addTo(state.map);
    updateUserMarker();
}

async function loadCities() {
    setStatus('İller alınıyor');
    try {
        state.cities = await fetchJsonCached(`${PRAYER_API}/sehirler/${COUNTRY_ID}`, 'cities');
        state.cities.sort((a, b) => a.SehirAdi.localeCompare(b.SehirAdi, 'tr'));
        el.citySelect.innerHTML = state.cities.map(city => (
            `<option value="${city.SehirID}">${escapeHtml(titleCase(city.SehirAdi))}</option>`
        )).join('');
    } catch (error) {
        state.cities = [{ SehirAdi: DEFAULT_LOCATION.cityName, SehirID: DEFAULT_LOCATION.cityId }];
        el.citySelect.innerHTML = `<option value="${DEFAULT_LOCATION.cityId}">${titleCase(DEFAULT_LOCATION.cityName)}</option>`;
        showToast('İl listesi çevrimdışı yedekle açıldı.');
        setStatus('Çevrimdışı');
    }
}

async function loadDistricts(cityId, selectedDistrictId = '') {
    el.districtSelect.disabled = true;
    el.districtSelect.innerHTML = '<option value="">İlçeler yükleniyor...</option>';

    try {
        state.districts = await fetchJsonCached(`${PRAYER_API}/ilceler/${cityId}`, `districts:${cityId}`);
    } catch (error) {
        state.districts = [{
            IlceAdi: state.selected.districtName || DEFAULT_LOCATION.districtName,
            IlceID: state.selected.districtId || DEFAULT_LOCATION.districtId
        }];
        showToast('İlçe listesi çevrimdışı yedekle açıldı.');
    }
    state.districts.sort((a, b) => a.IlceAdi.localeCompare(b.IlceAdi, 'tr'));

    el.districtSelect.innerHTML = state.districts.map(district => (
        `<option value="${district.IlceID}">${escapeHtml(titleCase(district.IlceAdi))}</option>`
    )).join('');

    const fallback = state.districts.find(item => item.IlceID === selectedDistrictId)
        || state.districts.find(item => normalizeText(item.IlceAdi) === normalizeText(state.selected.cityName))
        || state.districts[0];

    if (fallback) {
        el.districtSelect.value = fallback.IlceID;
        state.selected.districtId = fallback.IlceID;
        state.selected.districtName = fallback.IlceAdi;
    }

    el.districtSelect.disabled = false;
}

async function restoreOrDefaultLocation() {
    const saved = readSavedLocation();
    const location = saved || DEFAULT_LOCATION;
    const city = state.cities.find(item => item.SehirID === location.cityId)
        || state.cities.find(item => normalizeText(item.SehirAdi) === normalizeText(location.cityName))
        || state.cities.find(item => item.SehirID === DEFAULT_LOCATION.cityId);

    if (!city) return;

    state.selected.cityId = city.SehirID;
    state.selected.cityName = city.SehirAdi;
    el.citySelect.value = city.SehirID;
    await loadDistricts(city.SehirID, location.districtId);
    state.coords = location.coords || DEFAULT_LOCATION.coords;
    if (!state.coords || typeof state.coords.lat !== 'number' || typeof state.coords.lon !== 'number' || isNaN(state.coords.lat) || isNaN(state.coords.lon)) {
        state.coords = { ...DEFAULT_LOCATION.coords };
    }
    state.selected.localityName = location.localityName || '';
    updateLocationSummary(saved ? 'Kayıtlı seçim' : 'Varsayılan seçim');
}

async function applyManualSelection() {
    setStatus('Konum hazırlanıyor');
    const coords = await getCoordsForSelection(state.selected.districtName, state.selected.cityName);
    state.coords = coords || getFallbackCoords(state.selected.cityName, state.selected.districtName);
    saveLocation();
    updateLocationSummary('Elle seçildi');
    updateAll();
}

async function useCurrentLocation() {
    if (!navigator.geolocation) {
        showToast('Tarayıcı konum özelliğini desteklemiyor. İl ve ilçe seçebilirsiniz.');
        return;
    }

    setStatus('Konum bekleniyor');
    navigator.geolocation.getCurrentPosition(
        async position => {
            state.coords = {
                lat: position.coords.latitude,
                lon: position.coords.longitude
            };
            await matchLocationToDistrict();
            saveLocation();
            updateLocationSummary('Canlı konum');
            updateAll();
        },
        () => {
            showToast('Konum izni verilmedi. İl ve ilçe seçimiyle vakitleri kullanabilirsiniz.');
            setStatus('Elle seçim hazır');
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 300000 }
    );
}

async function matchLocationToDistrict() {
    let reverse;
    try {
        reverse = await fetchJson(`${REVERSE_API}?latitude=${state.coords.lat}&longitude=${state.coords.lon}&localityLanguage=tr`);
    } catch (error) {
        showToast('Konum adı çevrimdışı alınamadı; son seçili il/ilçe kullanılıyor.');
        return;
    }
    const cityName = reverse.principalSubdivision || reverse.city || DEFAULT_LOCATION.cityName;
    const city = findByNormalized(state.cities, 'SehirAdi', cityName) || state.cities.find(item => item.SehirID === DEFAULT_LOCATION.cityId);

    if (!city) return;

    state.selected.cityId = city.SehirID;
    state.selected.cityName = city.SehirAdi;
    el.citySelect.value = city.SehirID;
    await loadDistricts(city.SehirID);

    const names = collectReverseNames(reverse);
    const district = state.districts.find(item => names.some(name => isCloseName(item.IlceAdi, name)))
        || state.districts.find(item => normalizeText(item.IlceAdi) === normalizeText(city.SehirAdi))
        || state.districts[0];

    if (district) {
        state.selected.districtId = district.IlceID;
        state.selected.districtName = district.IlceAdi;
        el.districtSelect.value = district.IlceID;
    }

    // Set locality name from reverse geocoding
    state.selected.localityName = reverse.locality || reverse.city || (district ? district.IlceAdi : '');
}

async function updateAll() {
    if (!state.selected.districtId) return;
    setStatus('Güncelleniyor');
    updateUserMarker();

    await Promise.allSettled([
        loadPrayerTimes(),
        loadWeather(),
        loadNearbyMosques()
    ]);

    renderQibla();
    updateLocationSummary('Güncel');
    setStatus('Güncel');
}

async function loadPrayerTimes() {
    try {
        state.prayerDays = await fetchJsonCached(`${PRAYER_API}/vakitler/${state.selected.districtId}`, `prayers:${state.selected.districtId}`);
    } catch (error) {
        showToast('Vakitler için çevrimdışı kayıt bulunamadı. İnternette bir kez güncelleyin.');
        return;
    }
    state.todayPrayer = pickPrayerDay(state.prayerDays);
    renderPrayerTimes();
    updateNextPrayer();
}

function pickPrayerDay(days) {
    const today = formatDateKey(new Date());
    return days.find(day => normalizeDateKey(day.MiladiTarihKisa) === today)
        || days.find(day => new Date(day.MiladiTarihUzunIso8601) >= startOfToday())
        || days[0];
}

function renderPrayerTimes() {
    if (!state.todayPrayer) {
        el.prayerGrid.innerHTML = '<div class="empty-state">Vakit bilgisi alınamadı.</div>';
        return;
    }

    el.prayerDate.textContent = `${state.todayPrayer.MiladiTarihUzun} · ${state.todayPrayer.HicriTarihUzun}`;
    el.prayerGrid.innerHTML = PRAYERS.map(([key, label]) => `
        <div class="prayer-time" data-prayer="${key}">
            <span>${label}</span>
            <strong>${state.todayPrayer[key] || '--:--'}</strong>
        </div>
    `).join('');
}

function updateNextPrayer() {
    if (!state.todayPrayer) return;

    const now = new Date();
    const prayerEntries = buildPrayerEntries(now, state.todayPrayer);
    let next = prayerEntries.find(item => item.date > now);

    if (!next) {
        const tomorrow = state.prayerDays.find(day => new Date(day.MiladiTarihUzunIso8601) > startOfToday());
        if (tomorrow) {
            next = buildPrayerEntries(addDays(now, 1), tomorrow)[0];
        }
    }

    state.nextPrayer = next || prayerEntries[0];
    el.nextPrayerName.textContent = state.nextPrayer.label;

    document.querySelectorAll('.prayer-time').forEach(card => {
        card.classList.toggle('active', card.dataset.prayer === state.nextPrayer.key);
    });

    updateCountdown();
}

function updateCountdown() {
    if (!state.nextPrayer) return;
    const diff = Math.max(0, state.nextPrayer.date.getTime() - Date.now());
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    el.countdown.textContent = [hours, minutes, seconds].map(value => String(value).padStart(2, '0')).join(':');
}

async function loadWeather() {
    const url = new URL(WEATHER_API);
    url.search = new URLSearchParams({
        latitude: state.coords.lat,
        longitude: state.coords.lon,
        hourly: 'temperature_2m,precipitation_probability,weather_code,wind_speed_10m',
        daily: 'temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max',
        forecast_hours: '4',
        forecast_days: '4',
        timezone: 'auto'
    }).toString();

    let weather;
    try {
        weather = await fetchJson(url.toString());
        writeDataCache(`weather:${formatCoord(state.coords.lat)}:${formatCoord(state.coords.lon)}`, weather);
        writeDataCache('weather:last', weather);
    } catch (error) {
        weather = readDataCache(`weather:${formatCoord(state.coords.lat)}:${formatCoord(state.coords.lon)}`) || readDataCache('weather:last');
        if (!weather) {
            el.headerWeather.innerHTML = '<span class="weather-error">Hava bekleniyor...</span>';
            return;
        }
        showToast('Hava durumu son kayıtla gösteriliyor.');
    }

    const hours = weather.hourly.time.slice(0, 3).map((time, index) => ({
        time,
        temp: weather.hourly.temperature_2m[index],
        rain: weather.hourly.precipitation_probability[index],
        code: weather.hourly.weather_code[index],
        wind: weather.hourly.wind_speed_10m[index]
    }));

    const days = [];
    if (weather.daily) {
        for (let i = 1; i <= 3; i++) {
            if (weather.daily.time[i]) {
                days.push({
                    time: weather.daily.time[i],
                    tempMax: weather.daily.temperature_2m_max[i],
                    tempMin: weather.daily.temperature_2m_min[i],
                    rain: weather.daily.precipitation_probability_max ? weather.daily.precipitation_probability_max[i] : 0,
                    code: weather.daily.weather_code[i]
                });
            }
        }
    }

    // Render 6 slots: 3 hourly first, then 3 daily
    const hourlySlotsHtml = hours.map(hour => `
        <div class="weather-slot" aria-label="Saat ${formatHour(hour.time)}: ${weatherLabel(hour.code)}, ${Math.round(hour.temp)} derece">
            <span class="weather-slot-icon">${weatherIcon(hour.code)}</span>
            <span class="weather-slot-temp">${Math.round(hour.temp)}°</span>
            <span class="weather-slot-label">${formatHour(hour.time)}</span>
        </div>
    `).join('');

    const dailySlotsHtml = days.map(day => `
        <div class="weather-slot" aria-label="${formatDayName(day.time)}: ${weatherLabel(day.code)}, en yüksek ${Math.round(day.tempMax)} derece">
            <span class="weather-slot-icon">${weatherIcon(day.code)}</span>
            <span class="weather-slot-temp">${Math.round(day.tempMax)}°</span>
            <span class="weather-slot-label">${formatDayShort(day.time)}</span>
        </div>
    `).join('');

    el.headerWeather.innerHTML = hourlySlotsHtml + dailySlotsHtml;
}

async function loadNearbyMosques() {
    el.turkeySearchBtn.disabled = false;
    el.nearbySearchBtn.disabled = false;
    state.markerLayer.clearLayers();
    updateUserMarker();

    const localMosques = getLocalMosques(state.coords, 10);
    state.nearestMosques = localMosques;
    renderMosques();
    renderMosqueMarkers();

    // Adaptive expanding radius search
    let radius = 2000;
    try {
        let osmMosques = await fetchOsmMosques(state.coords, radius);
        if (osmMosques.length < 5) {
            radius = 5000;
            osmMosques = await fetchOsmMosques(state.coords, radius);
        }
        if (osmMosques.length < 5) {
            radius = 10000;
            osmMosques = await fetchOsmMosques(state.coords, radius);
        }

        const merged = mergeMosques(osmMosques, localMosques).slice(0, 15);
        if (merged.length > 0) {
            state.markerLayer.clearLayers();
            state.nearestMosques = merged;
            renderMosques();
            renderMosqueMarkers();
        }
    } catch (error) {
        showToast('OpenStreetMap yakın cami araması gecikti; yerel cami listesi gösteriliyor.');
    }
}

async function searchTurkeyMosques() {
    const searchText = el.turkeySearchInput.value.trim();
    const label = searchText || 'cami ve mescit';

    el.turkeySearchBtn.disabled = true;
    el.nearbySearchBtn.disabled = true;
    el.mosqueSummary.textContent = `Türkiye genelinde "${label}" aranıyor...`;
    el.mosqueList.innerHTML = '<div class="empty-state">Türkiye geneli OSM araması yapılıyor. Büyük sorgularda sonuçlar limitli gelir.</div>';

    try {
        const results = await fetchTurkeyMosques(searchText);
        state.markerLayer.clearLayers();
        state.nearestMosques = mergeMosques(results, []).slice(0, 250);
        renderMosques();
        renderMosqueMarkers();
        el.mosqueSummary.textContent = state.nearestMosques.length > 0
            ? `Türkiye araması: ${state.nearestMosques.length} kayıt gösteriliyor`
            : 'Türkiye aramasında sonuç bulunamadı.';
    } catch (error) {
        const fallback = getTurkeyLocalMosques(searchText, 250);
        if (fallback.length > 0) {
            state.markerLayer.clearLayers();
            state.nearestMosques = fallback;
            renderMosques();
            renderMosqueMarkers();
            el.mosqueSummary.textContent = `Türkiye araması: yerel listeden ${fallback.length} kayıt gösteriliyor`;
            showToast('OSM Türkiye sorgusu gecikti; yerel Türkiye cami listesi gösteriliyor.');
        } else {
            showToast('Türkiye geneli arama zaman aşımına uğradı. Bir cami/ilçe adı yazarak daraltın.');
            el.mosqueList.innerHTML = '<div class="empty-state">Arama çok geniş kaldı. Örneğin “Kocatepe”, “Mimar Sinan” veya “Üsküdar mescit” yazın.</div>';
        }
    } finally {
        el.turkeySearchBtn.disabled = false;
        el.nearbySearchBtn.disabled = false;
    }
}

async function fetchTurkeyMosques(searchText) {
    const regex = searchText
        ? overpassRegex(searchText)
        : 'cami|camii|mescit|mescid|mescidi|masjid|mosque';
    const textFilter = searchText ? `["name"~"${regex}",i]` : '';
    const nameFilter = `["name"~"${regex}",i]`;
    const limit = searchText ? 180 : 250;
    const query = `[out:json][timeout:24];area["ISO3166-1"="TR"][admin_level=2]->.turkey;(node${textFilter}["amenity"="place_of_worship"]["religion"="muslim"](area.turkey);way${textFilter}["amenity"="place_of_worship"]["religion"="muslim"](area.turkey);relation${textFilter}["amenity"="place_of_worship"]["religion"="muslim"](area.turkey);node${textFilter}["building"="mosque"](area.turkey);way${textFilter}["building"="mosque"](area.turkey);relation${textFilter}["building"="mosque"](area.turkey);node${nameFilter}(area.turkey);way${nameFilter}(area.turkey);relation${nameFilter}(area.turkey););out center tags ${limit};`;

    for (const endpoint of OVERPASS_ENDPOINTS) {
        try {
            const response = await fetchWithTimeout(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
                body: new URLSearchParams({ data: query })
            }, 22000);
            if (!response.ok) continue;
            const data = await response.json();
            return data.elements
                .map(item => normalizeOsmMosque(item, state.coords))
                .filter(Boolean)
                .sort((a, b) => a.distance - b.distance);
        } catch (error) {
            continue;
        }
    }

    throw new Error('Turkey search failed');
}

async function fetchOsmMosques(coords, radiusMeters) {
    const query = `[out:json][timeout:14];(node["amenity"="place_of_worship"]["religion"="muslim"](around:${radiusMeters},${coords.lat},${coords.lon});way["amenity"="place_of_worship"]["religion"="muslim"](around:${radiusMeters},${coords.lat},${coords.lon});relation["amenity"="place_of_worship"]["religion"="muslim"](around:${radiusMeters},${coords.lat},${coords.lon});node["building"="mosque"](around:${radiusMeters},${coords.lat},${coords.lon});way["building"="mosque"](around:${radiusMeters},${coords.lat},${coords.lon});relation["building"="mosque"](around:${radiusMeters},${coords.lat},${coords.lon});node["name"~"cami|camii|mescit|mescid|mescidi|masjid|mosque",i](around:${radiusMeters},${coords.lat},${coords.lon});way["name"~"cami|camii|mescit|mescid|mescidi|masjid|mosque",i](around:${radiusMeters},${coords.lat},${coords.lon});relation["name"~"cami|camii|mescit|mescid|mescidi|masjid|mosque",i](around:${radiusMeters},${coords.lat},${coords.lon}););out center tags 28;`;

    for (const endpoint of OVERPASS_ENDPOINTS) {
        try {
            const body = new URLSearchParams({ data: query });
            const response = await fetchWithTimeout(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
                body
            }, 8000);
            if (!response.ok) continue;
            const data = await response.json();
            return data.elements
                .map(item => normalizeOsmMosque(item, coords))
                .filter(Boolean)
                .sort((a, b) => a.distance - b.distance);
        } catch (error) {
            continue;
        }
    }

    return [];
}

function normalizeOsmMosque(item, origin) {
    const lat = item.lat || item.center?.lat;
    const lon = item.lon || item.center?.lon;
    if (!lat || !lon) return null;

    return {
        id: `osm-${item.type}-${item.id}`,
        name: item.tags?.name || 'İsimsiz cami',
        source: 'OpenStreetMap',
        lat,
        lon,
        distance: distanceMeters(origin.lat, origin.lon, lat, lon)
    };
}

function getLocalMosques(coords, limit) {
    const localData = typeof mosqueData !== 'undefined' && Array.isArray(mosqueData) ? mosqueData : [];
    if (localData.length === 0) return [];
    return localData
        .map(item => ({
            id: `local-${item.id}`,
            name: item.name,
            source: `${titleCase(item.city)} / ${titleCase(item.district)}`,
            lat: item.lat,
            lon: item.lng,
            distance: distanceMeters(coords.lat, coords.lon, item.lat, item.lng)
        }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, limit);
}

function getTurkeyLocalMosques(searchText, limit) {
    const localData = typeof mosqueData !== 'undefined' && Array.isArray(mosqueData) ? mosqueData : [];
    const query = normalizeText(searchText);
    return localData
        .filter(item => !query || [item.name, item.city, item.district, item.description].some(value => normalizeText(value).includes(query)))
        .map(item => ({
            id: `local-${item.id}`,
            name: item.name,
            source: `${titleCase(item.city)} / ${titleCase(item.district)}`,
            lat: item.lat,
            lon: item.lng,
            distance: distanceMeters(state.coords.lat, state.coords.lon, item.lat, item.lng)
        }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, limit);
}

function mergeMosques(primary, fallback) {
    const merged = [];

    [...fallback, ...primary].sort((a, b) => a.distance - b.distance).forEach(item => {
        const duplicate = merged.find(existing => isSameMosque(existing, item));
        if (!duplicate) {
            merged.push(item);
            return;
        }

        const preferred = preferMosqueRecord(duplicate, item);
        Object.assign(duplicate, {
            ...preferred,
            distance: Math.min(duplicate.distance, item.distance),
            source: mergeSources(duplicate.source, item.source)
        });
    });

    return merged.sort((a, b) => a.distance - b.distance);
}

function isSameMosque(left, right) {
    const distance = distanceMeters(left.lat, left.lon, right.lat, right.lon);
    if (distance <= 25) return true;
    if (distance > 100) return false;
    return areMosqueNamesClose(left.name, right.name);
}

function preferMosqueRecord(left, right) {
    const leftLocal = left.source !== 'OpenStreetMap';
    const rightLocal = right.source !== 'OpenStreetMap';

    if (leftLocal && !rightLocal) return left;
    if (rightLocal && !leftLocal) return right;
    return String(right.name).length > String(left.name).length ? right : left;
}

function mergeSources(left, right) {
    if (left === right) return left;
    if (left === 'OpenStreetMap') return right;
    if (right === 'OpenStreetMap') return left;
    return left;
}

function areMosqueNamesClose(left, right) {
    const a = normalizeMosqueName(left);
    const b = normalizeMosqueName(right);
    if (!a || !b) return false;
    return a === b || a.includes(b) || b.includes(a);
}

function normalizeMosqueName(value) {
    return normalizeText(value)
        .replace(/camii|cami|mescidi|mescit|masjid|mosque/g, '')
        .replace(/buyuk|kucuk|yeni|eski/g, '');
}

function renderMosques() {
    if (state.nearestMosques.length === 0) {
        el.mosqueSummary.textContent = 'Yakın cami bulunamadı.';
        el.nearestRouteBtn.setAttribute('aria-disabled', 'true');
        el.mosqueList.innerHTML = '<div class="empty-state">Bu konum için yakın cami bulunamadı. Google Maps aramasıyla devam edebilirsiniz.</div>';
        return;
    }

    const nearest = state.nearestMosques[0];
    el.mosqueSummary.textContent = `En yakın: ${nearest.name} · ${formatDistance(nearest.distance)}`;
    el.nearestRouteBtn.href = directionsUrl(nearest);
    el.nearestRouteBtn.setAttribute('aria-disabled', 'false');

    el.mosqueList.innerHTML = state.nearestMosques.map(mosque => `
        <article class="mosque-item">
            <h3>${escapeHtml(mosque.name)}</h3>
            <p>${escapeHtml(mosque.source)} · ${formatDistance(mosque.distance)}</p>
            <div class="mosque-actions">
                <a class="mini-link" href="${directionsUrl(mosque)}" target="_blank" rel="noopener noreferrer">Rota</a>
                <a class="mini-link secondary" href="${mapsSearchUrl(mosque)}" target="_blank" rel="noopener noreferrer">Google Maps</a>
            </div>
        </article>
    `).join('');
}

function renderMosqueMarkers() {
    const bounds = [[state.coords.lat, state.coords.lon]];

    state.nearestMosques.forEach(mosque => {
        const marker = L.marker([mosque.lat, mosque.lon], {
            icon: L.divIcon({
                className: 'mosque-map-marker',
                html: '<span style="display:grid;place-items:center;width:30px;height:30px;border-radius:50%;background:#176b5b;color:#fff;border:2px solid #fff;box-shadow:0 4px 14px rgba(0,0,0,.24);font-weight:900;font-size:18px;">☾</span>',
                iconSize: [30, 30],
                iconAnchor: [15, 15]
            })
        }).bindPopup(`<h3>${escapeHtml(mosque.name)}</h3><p>${formatDistance(mosque.distance)}</p>`);
        marker.addTo(state.markerLayer);
        bounds.push([mosque.lat, mosque.lon]);
    });

    if (bounds.length > 1) {
        state.map.fitBounds(bounds, { padding: [34, 34], maxZoom: 16 });
    }
}

function setActiveTab(tab) {
    state.activeTab = tab;
    if (tab === 'camiler' && location.hash !== '#camiler') history.replaceState(null, '', '#camiler');
    if (tab === 'qibla' && location.hash !== '#qiblaPanel') history.replaceState(null, '', '#qiblaPanel');
    if (tab === 'vakit' && location.hash) history.replaceState(null, '', location.pathname + location.search);
    el.tabButtons.forEach(button => button.classList.toggle('active', button.dataset.tab === tab));
    el.tabPanels.forEach(panel => {
        panel.hidden = panel.dataset.tabPanel !== tab;
    });

    if (tab === 'camiler') {
        setTimeout(() => state.map.invalidateSize(), 0);
    }

    if (tab === 'qibla') {
        renderQibla();
        setTimeout(() => state.qiblaMap?.invalidateSize(), 0);
    }
}

function applyInitialTab() {
    if (location.hash === '#camiler') setActiveTab('camiler');
    if (location.hash === '#qiblaPanel') setActiveTab('qibla');
}

function initQiblaMap() {
    if (state.qiblaMap) return;

    state.qiblaMap = L.map('qiblaMap', {
        center: [state.coords.lat, state.coords.lon],
        zoom: 18,
        minZoom: 2,
        maxZoom: 19,
        dragging: false,
        scrollWheelZoom: true,
        touchZoom: true,
        zoomControl: false
    });

    const satelliteTile = L.tileLayer(SATELLITE_TILE_URL, {
        maxZoom: 19,
        attribution: '&copy; Esri World Imagery'
    });

    satelliteTile.addTo(state.qiblaMap);
    setQiblaRotation(0);
}

function renderQibla() {
    if (!el.qiblaPanel || el.qiblaPanel.hidden) return;
    initQiblaMap();

    const origin = [state.coords.lat, state.coords.lon];
    const kaaba = [KAABA.lat, KAABA.lon];
    const bearing = qiblaBearing(state.coords.lat, state.coords.lon);
    const distance = distanceMeters(state.coords.lat, state.coords.lon, KAABA.lat, KAABA.lon);

    if (state.qiblaLine) {
        state.qiblaLine.setLatLngs([origin, kaaba]);
    } else {
        state.qiblaLine = L.polyline([origin, kaaba], {
            color: '#dfb126',
            weight: 5,
            opacity: 0.9,
            dashArray: '12 8'
        }).addTo(state.qiblaMap);
    }

    if (state.qiblaOriginMarker) {
        state.qiblaOriginMarker.setLatLng(origin);
    } else {
        state.qiblaOriginMarker = L.marker(origin, {
            icon: L.divIcon({
                className: 'qibla-user-marker',
                html: '<span style="display:grid;place-items:center;width:34px;height:34px;border-radius:50%;background:#8b5cf6;color:#fff;border:3px solid #fff;box-shadow:0 4px 16px rgba(139,92,246,0.4);font-weight:900;">•</span>',
                iconSize: [34, 34],
                iconAnchor: [17, 17]
            })
        }).bindPopup('Bulunan konum').addTo(state.qiblaMap);
    }

    if (state.kaabaMarker) {
        state.kaabaMarker.setLatLng(kaaba);
    } else {
        state.kaabaMarker = L.marker(kaaba, {
            icon: L.divIcon({
                className: 'kaaba-marker',
                html: '<span style="display:grid;place-items:center;width:34px;height:34px;border-radius:50%;background:#111;color:#fff;border:3px solid #c66a2d;box-shadow:0 4px 16px rgba(0,0,0,.28);font-weight:900;">☾</span>',
                iconSize: [34, 34],
                iconAnchor: [17, 17]
            })
        }).bindPopup('Kâbe merkezi').addTo(state.qiblaMap);
    }

    const zoomLevel = state.qiblaMap.getZoom() || 18;
    state.qiblaMap.setView(origin, zoomLevel);
    el.qiblaSummary.textContent = `${formatCoord(state.coords.lat)}, ${formatCoord(state.coords.lon)} noktasından Kâbe yönüne hat çizildi.`;
    el.qiblaBearing.textContent = `${Math.round(bearing)}°`;
    el.qiblaDistance.textContent = `${formatDistance(distance)} uzaklık`;
    
    // Call setQiblaRotation to apply rotation, counter-rotations, and alignment computations
    setQiblaRotation(state.qiblaRotation || 0);
}

function updateUserMarker() {
    if (!state.map) return;

    if (state.userMarker) {
        state.userMarker.setLatLng([state.coords.lat, state.coords.lon]);
    } else {
        state.userMarker = L.marker([state.coords.lat, state.coords.lon], {
            icon: L.divIcon({
                className: 'user-map-marker',
                html: '<span style="display:grid;place-items:center;width:34px;height:34px;border-radius:50%;background:#c66a2d;color:#fff;border:3px solid #fff;box-shadow:0 4px 16px rgba(0,0,0,.28);font-weight:900;">•</span>',
                iconSize: [34, 34],
                iconAnchor: [17, 17]
            })
        }).bindPopup('Seçili konum').addTo(state.map);
    }

    state.map.setView([state.coords.lat, state.coords.lon], Math.max(state.map.getZoom(), 13));
}

async function getCoordsForSelection(districtName, cityName) {
    const query = `${titleCase(districtName)}, ${titleCase(cityName)}, Türkiye`;
    const url = new URL(GEOCODE_API);
    url.search = new URLSearchParams({
        name: query,
        count: '1',
        language: 'tr',
        format: 'json'
    }).toString();

    try {
        const data = await fetchJson(url.toString());
        const first = data.results?.[0];
        if (first) return { lat: first.latitude, lon: first.longitude };
    } catch (error) {
        return null;
    }

    return null;
}

function getFallbackCoords(cityName, districtName) {
    const localData = typeof mosqueData !== 'undefined' && Array.isArray(mosqueData) ? mosqueData : [];
    const local = localData.length > 0
        ? localData.find(item => isCloseName(item.city, cityName) && isCloseName(item.district, districtName))
            || localData.find(item => isCloseName(item.city, cityName))
        : null;

    if (local) return { lat: local.lat, lon: local.lng };
    return { ...DEFAULT_LOCATION.coords };
}

function buildPrayerEntries(date, day) {
    const base = new Date(day.MiladiTarihUzunIso8601 || date);
    return PRAYERS.map(([key, label]) => ({
        key,
        label,
        date: parseTimeOnDate(base, day[key])
    }));
}

function parseTimeOnDate(date, timeText) {
    const [hour, minute] = String(timeText || '00:00').split(':').map(Number);
    const parsed = new Date(date);
    parsed.setHours(hour || 0, minute || 0, 0, 0);
    return parsed;
}

function startClock() {
    const tick = () => {
        const now = new Date();
        el.currentClock.textContent = new Intl.DateTimeFormat('tr-TR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        }).format(now);

        const dayName = new Intl.DateTimeFormat('tr-TR', { weekday: 'long' }).format(now);
        el.topbarDate.textContent = `${dayName}, ${now.getDate()}.${now.getMonth() + 1}.${now.getFullYear()}`;

        updateCountdown();
        if (state.nextPrayer && state.nextPrayer.date <= new Date()) {
            updateNextPrayer();
        }
    };
    tick();
    setInterval(tick, 1000);
}

async function installPwa() {
    if (!state.deferredInstallPrompt) return;
    state.deferredInstallPrompt.prompt();
    await state.deferredInstallPrompt.userChoice;
    state.deferredInstallPrompt = null;
    el.installBtn.hidden = true;
}

async function refreshApp() {
    if (!navigator.onLine) {
        showToast('Çevrimdışıyken cache temizlenmez. İnternet gelince güncelleyin.');
        return;
    }

    el.appRefreshBtn.classList.add('spinning');
    try {
        if ('caches' in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map(key => caches.delete(key)));
        }
        const registration = await navigator.serviceWorker?.getRegistration?.();
        await registration?.update?.();
    } finally {
        window.location.reload();
    }
}

async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    try {
        await navigator.serviceWorker.register('sw.js');
    } catch (error) {
        console.warn('Service worker kaydedilemedi', error);
    }
}

async function fetchJson(url, options = {}) {
    const response = await fetch(url, options);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
}

async function fetchJsonCached(url, cacheKey, options = {}) {
    try {
        const data = await fetchJson(url, options);
        writeDataCache(cacheKey, data);
        return data;
    } catch (error) {
        const cached = readDataCache(cacheKey);
        if (cached) return cached;
        throw error;
    }
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

function readSavedLocation() {
    try {
        return JSON.parse(localStorage.getItem('vakit-location'));
    } catch (error) {
        return null;
    }
}

function readDataCache(key) {
    try {
        const entry = JSON.parse(localStorage.getItem(`${DATA_CACHE_PREFIX}${key}`));
        return entry?.data || null;
    } catch (error) {
        return null;
    }
}

function writeDataCache(key, data) {
    try {
        localStorage.setItem(`${DATA_CACHE_PREFIX}${key}`, JSON.stringify({
            savedAt: Date.now(),
            data
        }));
    } catch (error) {
        console.warn('Veri önbelleğe yazılamadı', error);
    }
}

function saveLocation() {
    localStorage.setItem('vakit-location', JSON.stringify({
        cityId: state.selected.cityId,
        districtId: state.selected.districtId,
        cityName: state.selected.cityName,
        districtName: state.selected.districtName,
        coords: state.coords,
        localityName: state.selected.localityName || ''
    }));
}

function updateLocationSummary(prefix) {
    el.locationSummary.textContent = `${prefix}: ${titleCase(state.selected.cityName)} / ${titleCase(state.selected.districtName)}`;
    const rawLoc = state.selected.localityName || state.selected.districtName || state.selected.cityName || 'Konum Bilinmiyor';
    el.topbarLocation.textContent = titleCase(rawLoc);
}

function setStatus(text) {
    el.syncStatus.textContent = text;
}

function showToast(message) {
    el.toast.textContent = message;
    el.toast.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => el.toast.classList.remove('show'), 4200);
}

function collectReverseNames(reverse) {
    const adminNames = reverse.localityInfo?.administrative?.map(item => item.name) || [];
    return [
        reverse.city,
        reverse.locality,
        reverse.principalSubdivision,
        ...adminNames
    ].filter(Boolean);
}

function findByNormalized(list, key, value) {
    return list.find(item => isCloseName(item[key], value));
}

function isCloseName(left, right) {
    const a = normalizeText(left);
    const b = normalizeText(right);
    return a === b || a.includes(b) || b.includes(a);
}

function normalizeText(value) {
    return String(value || '')
        .toLocaleLowerCase('tr-TR')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/ı/g, 'i')
        .replace(/[^a-z0-9]/g, '');
}

function titleCase(value) {
    return String(value || '')
        .toLocaleLowerCase('tr-TR')
        .replace(/(^|\s|\/|-)(\p{L})/gu, (_, sep, char) => sep + char.toLocaleUpperCase('tr-TR'));
}

function formatDateKey(date) {
    return new Intl.DateTimeFormat('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    }).format(date).replace(/\//g, '.');
}

function normalizeDateKey(value) {
    return String(value || '').replace(/\//g, '.');
}

function startOfToday() {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
}

function addDays(date, days) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
}

function formatHour(value) {
    return new Intl.DateTimeFormat('tr-TR', {
        hour: '2-digit',
        minute: '2-digit'
    }).format(new Date(value));
}

function formatDayName(value) {
    const date = new Date(value);
    return new Intl.DateTimeFormat('tr-TR', { weekday: 'long' }).format(date);
}

function formatDayShort(value) {
    const date = new Date(value);
    return new Intl.DateTimeFormat('tr-TR', { weekday: 'short' }).format(date);
}

function formatCoord(value) {
    return Number(value).toFixed(3);
}

function weatherLabel(code) {
    const labels = {
        0: 'Açık',
        1: 'Az bulutlu',
        2: 'Parçalı bulutlu',
        3: 'Kapalı',
        45: 'Sis',
        48: 'Kırağılı sis',
        51: 'Çiseleme',
        53: 'Çiseleme',
        55: 'Yoğun çiseleme',
        61: 'Yağmur',
        63: 'Yağmur',
        65: 'Kuvvetli yağmur',
        71: 'Kar',
        73: 'Kar',
        75: 'Yoğun kar',
        80: 'Sağanak',
        81: 'Sağanak',
        82: 'Kuvvetli sağanak',
        95: 'Gök gürültülü'
    };
    return labels[code] || 'Değişken';
}

function weatherIcon(code) {
    if (code === 0) return '☀️';
    if ([1, 2].includes(code)) return '⛅';
    if (code === 3) return '☁️';
    if ([45, 48].includes(code)) return '🌫️';
    if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return '🌧️';
    if ([71, 73, 75].includes(code)) return '❄️';
    if (code === 95) return '⛈️';
    return '🌤️';
}

function distanceMeters(lat1, lon1, lat2, lon2) {
    const radius = 6371000;
    const phi1 = toRad(lat1);
    const phi2 = toRad(lat2);
    const deltaPhi = toRad(lat2 - lat1);
    const deltaLambda = toRad(lon2 - lon1);
    const a = Math.sin(deltaPhi / 2) ** 2
        + Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
    return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(value) {
    return Number(value) * Math.PI / 180;
}

function toDeg(value) {
    return Number(value) * 180 / Math.PI;
}

function qiblaBearing(lat, lon) {
    const phi1 = toRad(lat);
    const phi2 = toRad(KAABA.lat);
    const deltaLambda = toRad(KAABA.lon - lon);
    const y = Math.sin(deltaLambda);
    const x = Math.cos(phi1) * Math.tan(phi2) - Math.sin(phi1) * Math.cos(deltaLambda);
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function formatDistance(meters) {
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
}

function directionsUrl(mosque) {
    const origin = `${state.coords.lat},${state.coords.lon}`;
    const destination = `${mosque.lat},${mosque.lon}`;
    return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=walking`;
}

function mapsSearchUrl(mosque) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${mosque.name} ${mosque.lat},${mosque.lon}`)}`;
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    }[char]));
}

function overpassRegex(value) {
    return String(value || '')
        .trim()
        .replace(/[\\^$.*+?()[\]{}|]/g, '\\$&')
        .replace(/\s+/g, '.*');
}

// New premium helper functions
async function scanCurrentMapArea() {
    if (!state.map) return;
    const btn = el.mapScanBtn;
    if (!btn) return;

    btn.disabled = true;
    const originalText = btn.innerHTML;
    btn.innerHTML = '⏳ Taranıyor...';
    showToast('Harita alanı cami ve mescitler için taranıyor...');

    try {
        const bounds = state.map.getBounds();
        const bbox = `${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()}`;
        const query = `[out:json][timeout:15];(node["amenity"="place_of_worship"]["religion"="muslim"](${bbox});way["amenity"="place_of_worship"]["religion"="muslim"](${bbox});relation["amenity"="place_of_worship"]["religion"="muslim"](${bbox});node["building"="mosque"](${bbox});way["building"="mosque"](${bbox});relation["building"="mosque"](${bbox});node["name"~"cami|camii|mescit|mescid|mescidi|masjid|mosque",i](${bbox});way["name"~"cami|camii|mescit|mescid|mescidi|masjid|mosque",i](${bbox});relation["name"~"cami|camii|mescit|mescid|mescidi|masjid|mosque",i](${bbox}););out center tags 80;`;

        let scanResults = [];
        for (const endpoint of OVERPASS_ENDPOINTS) {
            try {
                const body = new URLSearchParams({ data: query });
                const response = await fetchWithTimeout(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
                    body
                }, 10000);
                if (!response.ok) continue;
                const data = await response.json();
                scanResults = data.elements
                    .map(item => normalizeOsmMosque(item, state.coords))
                    .filter(Boolean);
                break;
            } catch (err) {
                continue;
            }
        }

        const localMosques = getLocalMosques(state.coords, 10);
        const merged = mergeMosques(scanResults, localMosques);
        
        if (merged.length > 0) {
            state.markerLayer.clearLayers();
            state.nearestMosques = merged;
            renderMosques();
            renderMosqueMarkers();
            showToast(`Tarama tamamlandı! Bu bölgede ${scanResults.length} cami/mescit bulundu.`);
        } else {
            showToast('Bu harita alanında cami veya mescit bulunamadı.');
        }
    } catch (error) {
        showToast('Canlı harita taraması başarısız oldu.');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

function setQiblaRotation(deg) {
    state.qiblaRotation = deg;
    const qiblaMapEl = document.getElementById('qiblaMap');
    if (qiblaMapEl) {
        qiblaMapEl.style.transform = `rotate(${deg}deg)`;
        
        // Counter-rotate markers inside qiblaMapEl so they stay upright and readable
        const markers = qiblaMapEl.querySelectorAll('.kaaba-marker span, .qibla-user-marker span');
        markers.forEach(marker => {
            marker.style.transform = `rotate(${-deg}deg)`;
        });
        
        // Counter-rotate popup bubbles inside qiblaMapEl
        const popups = qiblaMapEl.querySelectorAll('.leaflet-popup');
        popups.forEach(popup => {
            popup.style.transform = `rotate(${-deg}deg)`;
            popup.style.transformOrigin = 'bottom center';
        });
    }
    
    // Rotate qiblaDirectionOverlay & counter-rotate N/E/S/W labels
    const overlay = document.getElementById('qiblaDirectionOverlay');
    if (overlay) {
        overlay.style.transform = `rotate(${deg}deg)`;
        const labels = overlay.querySelectorAll('.qibla-dir-label');
        labels.forEach(label => {
            label.style.transform = `translate(-50%, -50%) rotate(${-deg}deg)`;
        });
    }

    // Rotate compass rose & counter-rotate N/E/S/W labels inside it
    if (el.compassRose) {
        el.compassRose.style.transform = `rotate(${deg}deg)`;
        const roseLabels = el.compassRose.querySelectorAll('.compass-label');
        roseLabels.forEach(label => {
            const isNS = label.classList.contains('dir-n') || label.classList.contains('dir-s');
            const baseTranslate = isNS ? 'translateX(-50%)' : 'translateY(-50%)';
            label.style.transform = `${baseTranslate} rotate(${-deg}deg)`;
        });
    }

    // Align Qibla compass arrow and compute turns/guidance
    const bearing = qiblaBearing(state.coords.lat, state.coords.lon);
    const relativeAngle = (bearing + deg) % 360;
    if (el.qiblaArrow) {
        el.qiblaArrow.style.transform = `rotate(${relativeAngle}deg)`;
    }

    // Guidance and haptic feedback
    const diff = (relativeAngle + 180) % 360 - 180; // normalized to -180 to 180
    const isAligned = Math.abs(diff) <= 5; // Perfect alignment window (+- 5 degrees)

    if (el.qiblaCompassDial) {
        el.qiblaCompassDial.classList.toggle('aligned', isAligned);
    }
    if (el.qiblaArrow) {
        el.qiblaArrow.classList.toggle('aligned', isAligned);
    }

    if (el.qiblaBearing) {
        if (isAligned) {
            el.qiblaBearing.innerHTML = `<span style="color:var(--accent); font-size:1.4rem; letter-spacing:0.5px;">✓ HİZALANDI</span><br><span style="font-size:1.1rem; color:var(--muted); font-weight:700;">${Math.round(bearing)}°</span>`;
            
            // Haptic tactile click (only triggers once when entering alignment range)
            if (!state.hasVibrated) {
                if (navigator.vibrate) {
                    navigator.vibrate(60);
                }
                state.hasVibrated = true;
            }
        } else {
            state.hasVibrated = false;
            const turnDir = diff > 0 ? 'Sağa' : 'Sola';
            const turnVal = Math.round(Math.abs(diff));
            el.qiblaBearing.innerHTML = `${Math.round(bearing)}°<br><span style="font-size:0.9rem; color:var(--danger); font-weight:700; display:inline-block; margin-top:2px;">${turnDir} ${turnVal}° dönün</span>`;
        }
    }
}

// Auto Compass Sensor Controls (Compass Mode)
function toggleAutoCompass() {
    if (state.compassActive) {
        stopAutoCompass();
        showToast('Pusula modu kapatıldı.');
    } else {
        startAutoCompass();
    }
}

function startAutoCompass() {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        // iOS requires permission request
        DeviceOrientationEvent.requestPermission()
            .then(permissionState => {
                if (permissionState === 'granted') {
                    startCompassListener();
                } else {
                    showToast('Pusula izni verilmedi.');
                }
            })
            .catch(() => {
                showToast('Sensör erişim hatası.');
            });
    } else {
        // Android / desktop default
        startCompassListener();
    }
}

function startCompassListener() {
    window.addEventListener('deviceorientation', handleOrientation, true);
    state.compassActive = true;
    state.lastHeading = null;
    if (el.autoCompassBtn) {
        el.autoCompassBtn.classList.add('active');
        el.autoCompassBtn.innerHTML = '🧭 Pusula Açık';
    }
    showToast('Pusula aktif! Cihazınızı çevirin.');
}

function stopAutoCompass() {
    window.removeEventListener('deviceorientation', handleOrientation, true);
    state.compassActive = false;
    state.lastHeading = null;
    if (el.autoCompassBtn) {
        el.autoCompassBtn.classList.remove('active');
        el.autoCompassBtn.innerHTML = '🧭 Pusula Modu';
    }
}

function handleOrientation(event) {
    if (!state.compassActive) return;

    let heading = null;
    // webkitCompassHeading is the most accurate sensor on iOS
    if (event.webkitCompassHeading !== undefined) {
        heading = event.webkitCompassHeading;
    } else if (event.alpha !== null) {
        // alpha on Android is counter-clockwise, convert to clockwise heading
        heading = (360 - event.alpha) % 360;
    }

    if (heading !== null) {
        // Smooth the heading changes using simple low-pass filter (25% interpolation)
        if (state.lastHeading === null) {
            state.lastHeading = heading;
        } else {
            let diff = heading - state.lastHeading;
            // Handle 359 -> 0 wrap-around
            if (diff > 180) diff -= 360;
            if (diff < -180) diff += 360;
            state.lastHeading += diff * 0.25;
            state.lastHeading = (state.lastHeading + 360) % 360;
        }

        // Calculate map/compass rotation (North at 360 - Heading)
        const rotation = (360 - state.lastHeading) % 360;
        if (el.qiblaMapRotation) {
            el.qiblaMapRotation.value = Math.round(rotation);
        }
        setQiblaRotation(rotation);
    }
}

function initTheme() {
    const savedTheme = localStorage.getItem('vakit-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeToggleIcon(savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('vakit-theme', newTheme);
    updateThemeToggleIcon(newTheme);
    
    // Dynamically update map tile URLs
    const newUrl = getStreetTileUrl();
    if (state.streetTile) {
        state.streetTile.setUrl(newUrl);
    }
    if (state.qiblaStreetTile) {
        state.qiblaStreetTile.setUrl(newUrl);
    }
}

function updateThemeToggleIcon(theme) {
    if (!el.themeToggleBtn) return;
    el.themeToggleBtn.textContent = theme === 'light' ? '🌙' : '☀️';
    el.themeToggleBtn.title = theme === 'light' ? 'Koyu Temaya Geç' : 'Açık Temaya Geç';
}

function getStreetTileUrl() {
    const theme = localStorage.getItem('vakit-theme') || 'dark';
    return theme === 'light'
        ? 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
}
