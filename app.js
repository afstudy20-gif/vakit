// Register Service Worker instantly for fast PWA/PWABuilder compliance
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js?v=39')
        .then(reg => console.log('SW registered successfully:', reg.scope))
        .catch(err => console.warn('SW registration failed:', err));
}

const PRAYER_API = 'https://ezanvakti.emushaf.net';
const COUNTRY_ID = '2';
const DIYANET_PROXY = '/diyanet/';
const DIYANET_FALLBACK_PROXY = 'https://corsproxy.io/?url=';
const WEATHER_API = 'https://api.open-meteo.com/v1/forecast';
const GEOCODE_API = 'https://geocoding-api.open-meteo.com/v1/search';
const REVERSE_API = 'https://api.bigdatacloud.net/data/reverse-geocode-client';
const OVERPASS_ENDPOINTS = [
    'https://overpass-api.de/api/interpreter',
    'https://lz4.overpass-api.de/api/interpreter',
    'https://z.overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.private.coffee/api/interpreter'
];

const KAABA = { lat: 21.422487, lon: 39.826206 };
const DATA_CACHE_PREFIX = 'vakit-data:';

const STREET_TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const SATELLITE_TILE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const NEARBY_LOCAL_LIMIT = 100;
const NEARBY_RESULT_LIMIT = 300;
const NEARBY_SEARCH_MAX_RADIUS = 3000;
const TURKEY_SEARCH_RESULT_LIMIT = 500;
const MAP_SCAN_RESULT_LIMIT = 500;
const OSM_MOSQUE_NAME_REGEX = 'cami|camii|mescit|mescid|mescidi|masjid|mosque';
const OSM_MOSQUE_FILTERS = [
    '["amenity"="place_of_worship"]["religion"="muslim"]',
    '["building"="mosque"]',
    '["amenity"="place_of_worship"]["name"~"{{regex}}",i]',
    '["name"~"{{regex}}",i]["religion"="muslim"]',
    '["name"~"{{regex}}",i]["amenity"="place_of_worship"]'
];

const PRAYERS = [
    ['Imsak', 'İmsak'],
    ['Gunes', 'Güneş'],
    ['Ogle', 'Öğle'],
    ['Ikindi', 'İkindi'],
    ['Aksam', 'Akşam'],
    ['Yatsi', 'Yatsı']
];
const EID_PRAYER_OFFSET_MINUTES = 50;
const HIJRI_MONTH_NAMES = {
    1: 'muharrem',
    2: 'safer',
    3: 'rebiulevvel',
    4: 'rebiulahir',
    5: 'cemaziyelevvel',
    6: 'cemaziyelahir',
    7: 'recep',
    8: 'saban',
    9: 'ramazan',
    10: 'sevval',
    11: 'zilkade',
    12: 'zilhicce'
};

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
    eidDiyanet: null,
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
    el.eidPrayerInfo = document.getElementById('eidPrayerInfo');
    el.religiousDatesInfo = document.getElementById('religiousDatesInfo');
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
    el.syncPrayersBtn = document.getElementById('syncPrayersBtn');
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
    el.nearbySearchBtn.addEventListener('click', useCurrentLocation);
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
    if (el.syncPrayersBtn) {
        el.syncPrayersBtn.addEventListener('click', forceUpdatePrayerTimes);
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

    const googleStreets = L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: '&copy; Google Maps'
    });

    const googleHybrid = L.tileLayer('https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: '&copy; Google Maps'
    });

    const baseLayers = {
        "Google Harita (Sokak)": googleStreets,
        "Google Uydu (Hibrit)": googleHybrid,
        "Tema Haritası (Sokak)": state.streetTile,
        "Standart Uydu (Esri)": satelliteTile
    };

    googleStreets.addTo(state.map);
    L.control.layers(baseLayers, null, { position: 'topright' }).addTo(state.map);

    state.markerLayer = L.layerGroup().addTo(state.map);
    updateUserMarker();
    state.map.on('click', handleMapClick);
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
    const isSecure = window.isSecureContext || window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    if (!navigator.geolocation) {
        if (!isSecure) {
            showToast('Modern tarayıcılar (ve iOS) konum servislerini yalnızca güvenli (HTTPS) bağlantılarda destekler. Lütfen siteye HTTPS ile bağlandığınızdan emin olun.', 8000);
        } else {
            showToast('Tarayıcınız konum özelliğini desteklemiyor. İl ve ilçe seçerek devam edebilirsiniz.');
        }
        return;
    }

    setStatus('Konum bekleniyor');

    const handleGeoError = (error) => {
        console.error('Geolocation error:', error);
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

        let errMsg = 'Konum alınamadı. İl ve ilçe seçebilirsiniz.';
        if (error) {
            if (error.code === error.PERMISSION_DENIED) {
                if (isIOS) {
                    errMsg = 'iOS konum izni kapalı veya reddedildi. Adres çubuğundaki "Aa" simgesine tıklayıp "Web Sitesi Ayarları" -> "Konum" -> "İzin Ver" yapın ya da Ayarlar > Gizlilik ve Güvenlik > Konum Servisleri altından Safari/Tarayıcınıza ve siteye izin verildiğinden emin olun.';
                } else {
                    errMsg = 'Konum izni reddedildi. Tarayıcınızın adres çubuğundaki kilit simgesine dokunarak konum iznini sıfırlayabilirsiniz.';
                }
            } else if (error.code === error.POSITION_UNAVAILABLE) {
                errMsg = 'Konum bilgisi alınamadı (GPS kapalı veya sinyal zayıf). Lütfen konum servislerini açın.';
            } else if (error.code === error.TIMEOUT) {
                errMsg = 'Konum bulma zaman aşımına uğradı. Lütfen tekrar deneyin.';
            }
        }
        showToast(errMsg, 10000);
        setStatus('Elle seçim hazır');
    };

    const tryGeo = (highAccuracy = true) => {
        return new Promise((resolve, reject) => {
            let watchId = null;
            
            // Cold-start warm-up timeout for iOS Safari GPS hardware
            const timeoutId = setTimeout(() => {
                if (watchId !== null) {
                    navigator.geolocation.clearWatch(watchId);
                }
                reject({ code: 3, message: 'Timeout' });
            }, highAccuracy ? 14000 : 18000);

            watchId = navigator.geolocation.watchPosition(
                (position) => {
                    clearTimeout(timeoutId);
                    navigator.geolocation.clearWatch(watchId);
                    resolve(position);
                },
                (error) => {
                    clearTimeout(timeoutId);
                    navigator.geolocation.clearWatch(watchId);
                    reject(error);
                },
                {
                    enableHighAccuracy: highAccuracy,
                    timeout: highAccuracy ? 12000 : 15000,
                    maximumAge: 0 // Force fresh reading, bypass iOS stale cache
                }
            );
        });
    };

    try {
        const position = await tryGeo(true);
        state.coords = {
            lat: position.coords.latitude,
            lon: position.coords.longitude
        };
        await matchLocationToDistrict();
        saveLocation();
        updateLocationSummary('Canlı konum');
        await updateAll();
    } catch (error) {
        if (error && (error.code === error.POSITION_UNAVAILABLE || error.code === error.TIMEOUT)) {
            setStatus('Konum aranıyor (Düşük güç)');
            try {
                const position = await tryGeo(false);
                state.coords = {
                    lat: position.coords.latitude,
                    lon: position.coords.longitude
                };
                await matchLocationToDistrict();
                saveLocation();
                updateLocationSummary('Canlı konum');
                await updateAll();
            } catch (retryError) {
                handleGeoError(retryError);
            }
        } else {
            handleGeoError(error);
        }
    }
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
    refreshDiyanetEidPrayer();
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
        if (el.eidPrayerInfo) el.eidPrayerInfo.hidden = true;
        if (el.religiousDatesInfo) el.religiousDatesInfo.hidden = true;
        return;
    }

    el.prayerDate.textContent = `${state.todayPrayer.MiladiTarihUzun} · ${state.todayPrayer.HicriTarihUzun}`;
    el.prayerGrid.innerHTML = PRAYERS.map(([key, label]) => `
        <div class="prayer-time" data-prayer="${key}">
            <span>${label}</span>
            <strong>${state.todayPrayer[key] || '--:--'}</strong>
        </div>
    `).join('');
    renderEidPrayerInfo();
    renderReligiousDatesInfo();
}

function renderEidPrayerInfo() {
    const eid = findVisibleEidPrayer();
    if (!el.eidPrayerInfo || !eid) {
        if (el.eidPrayerInfo) el.eidPrayerInfo.hidden = true;
        return;
    }

    const sourceLabel = eid.source === 'diyanet'
        ? 'Diyanet'
        : `Güneş +${EID_PRAYER_OFFSET_MINUTES} dk`;

    el.eidPrayerInfo.hidden = false;
    el.eidPrayerInfo.innerHTML = `
        <div>
            <span>Bayram namazı</span>
            <strong>${escapeHtml(eid.name)}</strong>
            <p>${escapeHtml(eid.dateLabel)} · ${escapeHtml(eid.hijriLabel)}</p>
        </div>
        <div class="eid-prayer-time">
            <strong>${eid.time}</strong>
            <span>${escapeHtml(sourceLabel)}</span>
        </div>
    `;
}

function findVisibleEidPrayer() {
    if (!Array.isArray(state.prayerDays) || state.prayerDays.length === 0) return null;
    const today = startOfToday();
    const eidDay = state.prayerDays.find(day => {
        const date = new Date(day.MiladiTarihUzunIso8601);
        return isEidPrayerDay(day) && date >= today;
    });
    if (!eidDay) return null;

    const dateKey = normalizeDateKey(eidDay.MiladiTarihKisa);
    const diyanet = state.eidDiyanet;
    const diyanetMatches = diyanet
        && diyanet.dateKey === dateKey
        && diyanet.districtId === state.selected.districtId;
    const diyanetTime = diyanetMatches ? diyanet.time : '';

    const sunrise = eidDay.Gunes || eidDay.GunesDogus;
    const fallbackTime = addMinutesToTime(sunrise, EID_PRAYER_OFFSET_MINUTES);
    const time = diyanetTime || fallbackTime;
    if (!time) return null;

    return {
        name: eidPrayerName(eidDay),
        time,
        source: diyanetTime ? 'diyanet' : 'sunrise',
        dateLabel: eidDay.MiladiTarihUzun || eidDay.MiladiTarihKisa || '',
        hijriLabel: eidDay.HicriTarihUzun || ''
    };
}

function isEidPrayerDay(day) {
    const hijri = normalizeText(day.HicriTarihUzun);
    return hijri.startsWith('1sevval') || hijri.startsWith('10zilhicce');
}

function eidPrayerName(day) {
    const hijri = normalizeText(day.HicriTarihUzun);
    if (hijri.startsWith('1sevval')) return 'Ramazan Bayramı Namazı';
    if (hijri.startsWith('10zilhicce')) return 'Kurban Bayramı Namazı';
    return 'Bayram Namazı';
}

function addMinutesToTime(time, minutes) {
    const match = String(time || '').match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return '';
    const date = new Date();
    date.setHours(Number(match[1]), Number(match[2]) + minutes, 0, 0);
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function renderReligiousDatesInfo() {
    const dates = collectVisibleReligiousDates();
    if (!el.religiousDatesInfo || (dates.today.length === 0 && dates.upcoming.length === 0)) {
        if (el.religiousDatesInfo) el.religiousDatesInfo.hidden = true;
        return;
    }

    const todayHtml = dates.today.map(item => `
        <div class="religious-date-today">
            <span>Bugün</span>
            <strong>${escapeHtml(item.name)}</strong>
            <p>${escapeHtml(item.dateLabel)} · ${escapeHtml(item.hijriLabel)}</p>
        </div>
    `).join('');

    const upcomingHtml = dates.upcoming.length > 0 ? `
        <div class="religious-date-upcoming">
            ${dates.upcoming.map(item => `
                <div class="religious-date-row">
                    <div>
                        <strong>${escapeHtml(item.name)}</strong>
                        <span>${escapeHtml(item.dateLabel)} · ${escapeHtml(item.hijriLabel)}</span>
                    </div>
                    <em>${escapeHtml(item.relativeLabel)}</em>
                </div>
            `).join('')}
        </div>
    ` : '';

    el.religiousDatesInfo.hidden = false;
    el.religiousDatesInfo.innerHTML = `
        <div class="religious-dates-heading">Önemli dini tarihler</div>
        ${todayHtml}
        ${upcomingHtml}
    `;
}

function collectVisibleReligiousDates() {
    const result = { today: [], upcoming: [] };
    if (!Array.isArray(state.prayerDays) || state.prayerDays.length === 0) return result;

    const today = startOfToday();
    const todayKey = formatDateKey(today);
    const seen = new Set();

    state.prayerDays.forEach(day => {
        const event = religiousEventForDay(day);
        const date = new Date(day.MiladiTarihUzunIso8601);
        if (!event || isNaN(date) || date < today) return;

        const key = `${event.name}:${formatDateKey(date)}`;
        if (seen.has(key)) return;
        seen.add(key);

        const item = {
            name: event.name,
            dateLabel: day.MiladiTarihUzun || day.MiladiTarihKisa || '',
            hijriLabel: day.HicriTarihUzun || '',
            relativeLabel: relativeDayLabel(date)
        };

        if (formatDateKey(date) === todayKey) {
            result.today.push(item);
        } else if (result.upcoming.length < 5) {
            result.upcoming.push(item);
        }
    });

    return result;
}

function religiousEventForDay(day) {
    const hijri = parseHijriDate(day);
    if (!hijri) return null;

    if (hijri.month === 'muharrem' && hijri.day === 1) return { name: 'Hicri Yılbaşı' };
    if (hijri.month === 'muharrem' && hijri.day === 10) return { name: 'Aşure Günü' };
    if (hijri.month === 'rebiulevvel' && hijri.day === 12) return { name: 'Mevlid Kandili' };
    if (isRegaibKandili(day, hijri)) return { name: 'Regaib Kandili' };
    if (hijri.month === 'recep' && hijri.day === 27) return { name: 'Miraç Kandili' };
    if (hijri.month === 'saban' && hijri.day === 15) return { name: 'Berat Kandili' };
    if (hijri.month === 'ramazan' && hijri.day === 1) return { name: 'Ramazan Başlangıcı' };
    if (hijri.month === 'ramazan' && hijri.day === 27) return { name: 'Kadir Gecesi' };
    if (hijri.month === 'sevval' && hijri.day >= 1 && hijri.day <= 3) return { name: `Ramazan Bayramı ${hijri.day}. Günü` };
    if (hijri.month === 'zilhicce' && hijri.day === 9) return { name: 'Kurban Arifesi' };
    if (hijri.month === 'zilhicce' && hijri.day >= 10 && hijri.day <= 13) return { name: `Kurban Bayramı ${hijri.day - 9}. Günü` };
    return null;
}

function parseHijriDate(day) {
    const shortMatch = String(day.HicriTarihKisa || '').match(/^(\d{1,2})\.(\d{1,2})\./);
    if (shortMatch) {
        return {
            day: Number(shortMatch[1]),
            month: HIJRI_MONTH_NAMES[Number(shortMatch[2])] || ''
        };
    }

    const longText = String(day.HicriTarihUzun || '').trim();
    const longMatch = longText.match(/^(\d{1,2})\s+([^\d]+)/);
    if (!longMatch) return null;

    return {
        day: Number(longMatch[1]),
        month: normalizeText(longMatch[2])
    };
}

function isRegaibKandili(day, hijri) {
    const date = new Date(day.MiladiTarihUzunIso8601);
    return hijri.month === 'recep'
        && hijri.day <= 7
        && !isNaN(date)
        && date.getDay() === 4;
}

function relativeDayLabel(date) {
    const diffDays = Math.round((startOfDay(date).getTime() - startOfToday().getTime()) / 86400000);
    if (diffDays === 0) return 'Bugün';
    if (diffDays === 1) return 'Yarın';
    return `${diffDays} gün kaldı`;
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

    const localMosques = getLocalMosques(state.coords, NEARBY_LOCAL_LIMIT, NEARBY_SEARCH_MAX_RADIUS);
    state.nearestMosques = localMosques;
    renderMosques();
    renderMosqueMarkers();

    try {
        const osmMosques = await fetchOsmMosques(state.coords, NEARBY_SEARCH_MAX_RADIUS);

        const merged = mergeMosques(osmMosques, localMosques).slice(0, NEARBY_RESULT_LIMIT);
        if (merged.length > 0) {
            state.markerLayer.clearLayers();
            state.nearestMosques = merged;
            renderMosques();
            renderMosqueMarkers();
        }
    } catch (error) {
        showToast('Canlı yakın cami araması gecikti; yerel cami listesi gösteriliyor.');
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
        state.nearestMosques = mergeMosques(results, []).slice(0, TURKEY_SEARCH_RESULT_LIMIT);
        renderMosques();
        renderMosqueMarkers();
        el.mosqueSummary.textContent = state.nearestMosques.length > 0
            ? `Türkiye araması: ${state.nearestMosques.length} kayıt gösteriliyor`
            : 'Türkiye aramasında sonuç bulunamadı.';
    } catch (error) {
        const fallback = getTurkeyLocalMosques(searchText, TURKEY_SEARCH_RESULT_LIMIT);
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
    const limit = TURKEY_SEARCH_RESULT_LIMIT;
    const query = `[out:json][timeout:24];area["ISO3166-1"="TR"][admin_level=2]->.turkey;(nwr${textFilter}["amenity"="place_of_worship"]["religion"="muslim"](area.turkey);nwr${textFilter}["building"="mosque"](area.turkey);nwr${nameFilter}(area.turkey););out center tags ${limit};`;

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
    const scope = `(around:${radiusMeters},${coords.lat},${coords.lon})`;
    const query = `[out:json][timeout:14];(${buildOsmMosqueSelectors(scope)});out center tags ${NEARBY_RESULT_LIMIT};`;

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

function getLocalMosques(coords, limit, maxDistance = Infinity) {
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
        .filter(item => item.distance <= maxDistance)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, limit);
}

function getLocalMosquesInBounds(bounds, limit) {
    const localData = typeof mosqueData !== 'undefined' && Array.isArray(mosqueData) ? mosqueData : [];
    if (localData.length === 0 || !bounds) return [];
    return localData
        .filter(item => bounds.contains([item.lat, item.lng]))
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
    const leftPriority = mosqueSourcePriority(left);
    const rightPriority = mosqueSourcePriority(right);

    if (leftPriority > rightPriority) return left;
    if (rightPriority > leftPriority) return right;
    return String(right.name).length > String(left.name).length ? right : left;
}

function mosqueSourcePriority(item) {
    if (item.source === 'OpenStreetMap') return 1;
    return 2;
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
    const searchUrl = `https://www.google.com/maps/search/cami/@${state.coords.lat},${state.coords.lon},15z`;
    const embedUrl = googleMapsEmbedUrl();

    if (state.nearestMosques.length === 0) {
        el.mosqueSummary.textContent = 'Yakın cami bulunamadı.';
        el.nearestRouteBtn.setAttribute('aria-disabled', 'true');
        el.mosqueList.innerHTML = `
            <div class="empty-state">
                <p>Yerel listede ve OpenStreetMap'te yakın cami bulunamadı. Google Haritalar araması aşağıda gömülü olarak gösteriliyor.</p>
                <div class="google-maps-embed-wrapper">
                    <iframe src="${embedUrl}" title="Google Haritalar cami araması" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
                </div>
                <a class="google-maps-search-btn" href="${searchUrl}" target="_blank" rel="noopener noreferrer" style="margin-top: 12px;">
                    Google Haritalar'da Aç
                </a>
            </div>
        `;
        return;
    }

    const nearest = state.nearestMosques[0];
    el.mosqueSummary.textContent = `${formatDistance(NEARBY_SEARCH_MAX_RADIUS)} içinde ${state.nearestMosques.length} cami/mescit gösteriliyor · En yakın: ${nearest.name} · ${formatDistance(nearest.distance)}`;
    el.nearestRouteBtn.href = directionsUrl(nearest);
    el.nearestRouteBtn.setAttribute('aria-disabled', 'false');

    const mosqueCardsHtml = state.nearestMosques.map(mosque => `
        <article class="mosque-item">
            <h3>${escapeHtml(mosque.name)}</h3>
            <p>${escapeHtml(mosque.source)} · ${formatDistance(mosque.distance)}</p>
            <div class="mosque-actions">
                <a class="mini-link" href="${directionsUrl(mosque)}" target="_blank" rel="noopener noreferrer">Rota</a>
                <a class="mini-link secondary" href="${mapsSearchUrl(mosque)}" target="_blank" rel="noopener noreferrer">Google Maps</a>
            </div>
        </article>
    `).join('');

    const googleSearchCard = `
        <div class="google-maps-integration-card">
            <p>Google Haritalar yakın cami araması</p>
            <div class="google-maps-embed-wrapper">
                <iframe src="${embedUrl}" title="Google Haritalar cami araması" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
            </div>
            <a class="google-maps-search-btn" href="${searchUrl}" target="_blank" rel="noopener noreferrer">
                Google Haritalar'da Aç
            </a>
        </div>
    `;

    el.mosqueList.innerHTML = mosqueCardsHtml + googleSearchCard;
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

function syncMosqueMapView() {
    if (!state.map) return;
    state.map.invalidateSize();
    updateUserMarker();

    if (state.markerLayer && state.nearestMosques.length > 0) {
        state.markerLayer.clearLayers();
        renderMosqueMarkers();
        return;
    }

    state.map.setView([state.coords.lat, state.coords.lon], Math.max(state.map.getZoom(), 15));
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
        setTimeout(syncMosqueMapView, 0);
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

    const googleHybrid = L.tileLayer('https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: '&copy; Google Maps'
    });

    googleHybrid.addTo(state.qiblaMap);
    setQiblaRotation(0);
    state.qiblaMap.on('click', handleMapClick);
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
            draggable: true,
            icon: L.divIcon({
                className: 'qibla-user-marker',
                html: '<span style="display:grid;place-items:center;width:34px;height:34px;border-radius:50%;background:#06b6d4;color:#fff;border:3px solid #fff;box-shadow:0 4px 16px rgba(6,182,212,0.4);font-weight:900;">•</span>',
                iconSize: [34, 34],
                iconAnchor: [17, 17]
            })
        }).bindPopup('Bulunan konum').addTo(state.qiblaMap);
        
        state.qiblaOriginMarker.on('dragend', handleMarkerDrag);
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
            draggable: true,
            icon: L.divIcon({
                className: 'user-map-marker',
                html: '<span style="display:grid;place-items:center;width:34px;height:34px;border-radius:50%;background:#c66a2d;color:#fff;border:3px solid #fff;box-shadow:0 4px 16px rgba(0,0,0,.28);font-weight:900;">•</span>',
                iconSize: [34, 34],
                iconAnchor: [17, 17]
            })
        }).bindPopup('Seçili konum').addTo(state.map);
        
        state.userMarker.on('dragend', handleMarkerDrag);
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

async function fetchDiyanet(path) {
    const clean = String(path || '').replace(/^\/+/, '');
    const proxied = `${DIYANET_PROXY}${clean}`;
    try {
        const response = await fetch(proxied);
        if (response.ok) return response;
        throw new Error(`HTTP ${response.status}`);
    } catch (error) {
        const fallbackUrl = `${DIYANET_FALLBACK_PROXY}${encodeURIComponent(`https://namazvakitleri.diyanet.gov.tr/${clean}`)}`;
        const response = await fetch(fallbackUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response;
    }
}

async function fetchDiyanetJson(path, cacheKey) {
    try {
        const response = await fetchDiyanet(path);
        const data = await response.json();
        if (cacheKey) writeDataCache(cacheKey, data);
        return data;
    } catch (error) {
        if (cacheKey) {
            const cached = readDataCache(cacheKey);
            if (cached) return cached;
        }
        throw error;
    }
}

async function resolveDiyanetDistrict(cityName, districtName) {
    const cacheKey = `diyanet-id:${normalizeText(cityName)}:${normalizeText(districtName)}`;
    const cached = readDataCache(cacheKey);
    if (cached && cached.id && cached.url) return cached;

    const statePayload = await fetchDiyanetJson(
        'tr-TR/home/GetRegList?ChangeType=country&CountryId=2',
        'diyanet-states'
    );
    const stateList = statePayload?.StateList || [];
    const stateMatch = stateList.find(item => isCloseName(item.SehirAdi, cityName));
    if (!stateMatch) return null;

    const distPayload = await fetchDiyanetJson(
        `tr-TR/home/GetRegList?ChangeType=state&CountryId=2&StateId=${stateMatch.SehirID}`,
        `diyanet-districts:${stateMatch.SehirID}`
    );
    const distList = distPayload?.StateRegionList || [];
    const districtMatch = distList.find(item => isCloseName(item.IlceAdi, districtName))
        || distList.find(item => isCloseName(item.IlceAdi, cityName))
        || distList[0];
    if (!districtMatch) return null;

    const resolved = { id: districtMatch.IlceID, url: districtMatch.IlceUrl };
    writeDataCache(cacheKey, resolved);
    return resolved;
}

function parseDiyanetBayramTime(html) {
    const re = /<span>\s*(Kurban|Ramazan)\s+Bayram\s+Namaz\s+Vakti\s*<\/span>[\s\S]{0,400}?<span[^>]*class="bayram-info-value-top"[^>]*>\s*(\d{1,2}:\d{2})(?::\d{2})?\s*</i;
    const match = re.exec(html);
    if (!match) return null;
    return { type: match[1], time: match[2] };
}

async function fetchDiyanetBayram(districtUrl) {
    const cacheKey = `diyanet-bayram-html:${districtUrl}`;
    try {
        const response = await fetchDiyanet(districtUrl);
        const html = await response.text();
        writeDataCache(cacheKey, html);
        return parseDiyanetBayramTime(html);
    } catch (error) {
        const cached = readDataCache(cacheKey);
        if (cached) return parseDiyanetBayramTime(cached);
        return null;
    }
}

async function refreshDiyanetEidPrayer() {
    if (!Array.isArray(state.prayerDays) || state.prayerDays.length === 0) return;
    const today = startOfToday();
    const eidDay = state.prayerDays.find(day => {
        const date = new Date(day.MiladiTarihUzunIso8601);
        return isEidPrayerDay(day) && date >= today;
    });
    if (!eidDay) {
        state.eidDiyanet = null;
        return;
    }

    const districtId = state.selected.districtId;
    const dateKey = normalizeDateKey(eidDay.MiladiTarihKisa);
    if (state.eidDiyanet
        && state.eidDiyanet.districtId === districtId
        && state.eidDiyanet.dateKey === dateKey
        && state.eidDiyanet.time) {
        return;
    }

    try {
        const resolved = await resolveDiyanetDistrict(state.selected.cityName, state.selected.districtName);
        if (!resolved) return;
        const bayram = await fetchDiyanetBayram(resolved.url || `tr-TR/${resolved.id}`);
        if (!bayram || !bayram.time) return;
        state.eidDiyanet = {
            districtId,
            dateKey,
            time: bayram.time,
            type: bayram.type
        };
        renderEidPrayerInfo();
    } catch (error) {
        console.warn('Diyanet bayram saati alınamadı', error);
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

function startOfDay(value) {
    const date = new Date(value);
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

function googleMapsEmbedUrl() {
    const query = encodeURIComponent(`cami near ${state.coords.lat},${state.coords.lon}`);
    return `https://maps.google.com/maps?q=${query}&ll=${state.coords.lat},${state.coords.lon}&z=15&output=embed`;
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

function buildOsmMosqueSelectors(scope, regex = OSM_MOSQUE_NAME_REGEX) {
    const filters = OSM_MOSQUE_FILTERS.map(filter => filter.replace('{{regex}}', regex));
    return filters.map(filter => `nwr${filter}${scope};`).join('');
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
        const query = `[out:json][timeout:15];(${buildOsmMosqueSelectors(`(${bbox})`)});out center tags ${MAP_SCAN_RESULT_LIMIT};`;

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

        const localMosques = getLocalMosquesInBounds(bounds, MAP_SCAN_RESULT_LIMIT);
        const merged = mergeMosques(scanResults, localMosques).slice(0, MAP_SCAN_RESULT_LIMIT);
        
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

// Map Click and Marker Dragging Location Adjustment
async function handleLocationAdjust(lat, lon) {
    state.coords = { lat, lon };
    
    // Synchronously snap UI user markers and Qibla lines immediately for zero-lag visual feedback!
    updateUserMarker();
    renderQibla();
    
    setStatus('Konum ayarlanıyor');
    showToast('Konum haritadan güncelleniyor...');

    try {
        await matchLocationToDistrict();
        saveLocation();
        updateLocationSummary('Haritadan Seçildi');
        await updateAll();
        
        const locName = state.selected.localityName || state.selected.districtName || state.selected.cityName || 'Yeni Konum';
        showToast(`Konum başarıyla ayarlandı: ${titleCase(locName)}`);
    } catch (err) {
        showToast('Konum güncellenirken hata oluştu.');
        setStatus('Elle seçim hazır');
    }
}

function handleMarkerDrag(e) {
    let lat = e.target.getLatLng().lat;
    let lon = e.target.getLatLng().lng;
    
    // Correct rotated Qibla map marker drag coordinates due to CSS rotation distortion
    if (e.target._map === state.qiblaMap && state.qiblaRotation !== 0) {
        const qiblaMapEl = document.getElementById('qiblaMap');
        if (qiblaMapEl && e.originalEvent) {
            const rect = qiblaMapEl.getBoundingClientRect();
            const x = e.originalEvent.clientX - rect.left - rect.width / 2;
            const y = e.originalEvent.clientY - rect.top - rect.height / 2;
            
            const alpha = -state.qiblaRotation * Math.PI / 180;
            const rx = x * Math.cos(alpha) - y * Math.sin(alpha);
            const ry = x * Math.sin(alpha) + y * Math.cos(alpha);
            
            const targetX = rx + rect.width / 2;
            const targetY = ry + rect.height / 2;
            
            const corrected = state.qiblaMap.containerPointToLatLng([targetX, targetY]);
            lat = corrected.lat;
            lon = corrected.lng;
        }
    }
    
    handleLocationAdjust(lat, lon);
}

function handleMapClick(e) {
    // Avoid double triggering if user clicked a marker
    if (e.originalEvent?.defaultPrevented) return;
    
    let lat = e.latlng.lat;
    let lon = e.latlng.lng;
    
    // Correct rotated Qibla map click coordinates due to CSS rotation distortion
    if (e.target === state.qiblaMap && state.qiblaRotation !== 0) {
        const qiblaMapEl = document.getElementById('qiblaMap');
        if (qiblaMapEl) {
            const rect = qiblaMapEl.getBoundingClientRect();
            const x = e.originalEvent.clientX - rect.left - rect.width / 2;
            const y = e.originalEvent.clientY - rect.top - rect.height / 2;
            
            const alpha = -state.qiblaRotation * Math.PI / 180;
            const rx = x * Math.cos(alpha) - y * Math.sin(alpha);
            const ry = x * Math.sin(alpha) + y * Math.cos(alpha);
            
            const targetX = rx + rect.width / 2;
            const targetY = ry + rect.height / 2;
            
            const corrected = state.qiblaMap.containerPointToLatLng([targetX, targetY]);
            lat = corrected.lat;
            lon = corrected.lng;
        }
    }
    
    handleLocationAdjust(lat, lon);
}

// Force Update Prayer Times directly from Diyanet API
async function forceUpdatePrayerTimes() {
    const btn = el.syncPrayersBtn;
    if (!btn) return;

    btn.disabled = true;
    const originalText = btn.innerHTML;
    btn.innerHTML = '⏳ Güncelleniyor...';
    setStatus('Diyanet güncelleniyor');
    showToast("Namaz vakitleri Diyanet'ten canlı güncelleniyor...");

    try {
        const cacheKey = `prayers:${state.selected.districtId}`;
        const url = `${PRAYER_API}/vakitler/${state.selected.districtId}`;
        
        // Force fetch directly from Diyanet API
        const data = await fetchJson(url);
        
        // Write the fresh data back to the local cache
        writeDataCache(cacheKey, data);
        
        // Update the state and UI
        state.prayerDays = data;
        state.todayPrayer = pickPrayerDay(state.prayerDays);
        renderPrayerTimes();
        updateNextPrayer();
        
        showToast('Namaz vakitleri başarıyla güncellendi!');
    } catch (error) {
        console.error(error);
        showToast("Diyanet API bağlantı hatası. İnternetinizi kontrol edin.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
        setStatus('Güncel');
    }
}
