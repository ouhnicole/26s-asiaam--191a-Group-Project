// declare variables
let mapOptions = {'centerLngLat': [-98.5795, 39.8283],'startingZoomLevel':4};
const dataUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSycjDzRSIYoOrKh64s8viGDhLLU_Mgz82rkvO2YoEqqwScfeVXyno8y0Ghryh7GkNuhcmqOyj5jgYf/pub?output=csv";
const statesGeojsonUrl = 'https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json';
const STATE_NAME_MAP = {
    'AL': 'Alabama','AK': 'Alaska','AZ': 'Arizona','AR': 'Arkansas','CA': 'California','CO': 'Colorado','CT': 'Connecticut','DE': 'Delaware','FL': 'Florida','GA': 'Georgia','HI': 'Hawaii','ID': 'Idaho','IL': 'Illinois','IN': 'Indiana','IA': 'Iowa','KS': 'Kansas','KY': 'Kentucky','LA': 'Louisiana','ME': 'Maine','MD': 'Maryland','MA': 'Massachusetts','MI': 'Michigan','MN': 'Minnesota','MS': 'Mississippi','MO': 'Missouri','MT': 'Montana','NE': 'Nebraska','NV': 'Nevada','NH': 'New Hampshire','NJ': 'New Jersey','NM': 'New Mexico','NY': 'New York','NC': 'North Carolina','ND': 'North Dakota','OH': 'Ohio','OK': 'Oklahoma','OR': 'Oregon','PA': 'Pennsylvania','RI': 'Rhode Island','SC': 'South Carolina','SD': 'South Dakota','TN': 'Tennessee','TX': 'Texas','UT': 'Utah','VT': 'Vermont','VA': 'Virginia','WA': 'Washington','WV': 'West Virginia','WI': 'Wisconsin','WY': 'Wyoming','DC': 'District of Columbia'
};

let stateGroups = {};
let statesGeojson = null;

const map = new maplibregl.Map({
    container: 'map',
    style: 'https://api.maptiler.com/maps/019f8898-9cac-7f48-9d2a-5166d13bc591/style.json?key=domjvUPbX2qSlWXv88Xn',
    center: mapOptions.centerLngLat,
    zoom: mapOptions.startingZoomLevel
});

map.on('load', async function() {
    try {
        const response = await fetch(statesGeojsonUrl);
        statesGeojson = await response.json();
        addStateLayers(statesGeojson);
        await loadSurveyData();
        addLegend();
    } catch (error) {
        console.error('Error loading map data:', error);
    }
});

function normalizeState(location) {
    if (!location || typeof location !== 'string') return 'Unknown';
    const parts = location.split(',').map(p => p.trim()).filter(Boolean);
    let stateValue = parts.length > 1 ? parts[parts.length - 1] : parts[0];
    if (!stateValue) return 'Unknown';
    const upper = stateValue.toUpperCase();
    if (STATE_NAME_MAP[upper]) return STATE_NAME_MAP[upper];
    const matching = Object.values(STATE_NAME_MAP).find(name => name.toUpperCase() === upper);
    if (matching) return matching;
    return 'Unknown';
}

function pointInPolygon(point, polygon) {
    const [x, y] = point;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i][0], yi = polygon[i][1];
        const xj = polygon[j][0], yj = polygon[j][1];
        const intersect = ((yi > y) !== (yj > y)) &&
            (x < (xj - xi) * (y - yi) / (yj - yi + 0.000000001) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

function findStateForPoint(lon, lat) {
    if (!statesGeojson) return 'Unknown';
    for (const feature of statesGeojson.features) {
        const geometry = feature.geometry;
        if (geometry.type === 'Polygon') {
            if (pointInPolygon([lon, lat], geometry.coordinates[0])) return feature.properties.name;
        } else if (geometry.type === 'MultiPolygon') {
            for (const polygon of geometry.coordinates) {
                if (pointInPolygon([lon, lat], polygon[0])) return feature.properties.name;
            }
        }
    }
    return 'Unknown';
}

function addStateLayers(geojson) {
    map.addSource('states', {type: 'geojson', data: geojson});
    map.addLayer({
        id: 'states-fill',
        type: 'fill',
        source: 'states',
        paint: {
            'fill-color': [
                'match',
                    ['get', 'category'],
                    'All Yes', '#2e7d32',
                    'All No', '#d32f2f',
                    'Mixed', '#ffb300',
                    'No responses', '#f5f5f5',
                    /* default */ '#f5f5f5'
            ],
            'fill-opacity': 0.8
        }
    });
    map.addLayer({
        id: 'states-outline',
        type: 'line',
        source: 'states',
        paint: {
            'line-color': '#ffffff',
            'line-width': 1
        }
    });
    map.addLayer({
        id: 'states-highlight',
        type: 'line',
        source: 'states',
        paint: {
            'line-color': '#000000',
            'line-width': 2
        },
        filter: ['==', 'name', '']
    });

    const hoverPopup = new maplibregl.Popup({closeButton:false,closeOnClick:false});
    map.on('mousemove', 'states-fill', (e) => {
        map.getCanvas().style.cursor = 'pointer';
        if (!e.features || !e.features.length) return;
        const f = e.features[0];
        const props = f.properties || {};
        const yes = props.yes || 0;
        const no = props.no || 0;
        const count = props.count || 0;
        const cat = props.category || 'No responses';
        const html = `<strong>${props.name}</strong><div style="font-size:13px;margin-top:4px;">${count} response${count===1?'':'s'} — Yes: ${yes} • No: ${no}<div style="margin-top:6px;font-weight:600;">${cat}</div></div>`;
        hoverPopup.setLngLat(e.lngLat).setHTML(html).addTo(map);
    });
    map.on('mouseleave', 'states-fill', () => {
        map.getCanvas().style.cursor = '';
        map.setFilter('states-highlight', ['==', 'name', '']);
        hoverPopup.remove();
    });
    map.on('click', 'states-fill', (e) => {
        const stateName = e.features[0].properties.name;
        if (stateGroups[stateName]) {
            map.setFilter('states-highlight', ['==', 'name', stateName]);
            const info = createInfoPanel();
            showStateDetails(stateName, stateGroups[stateName], info);
        }
    });
}

function addLegend() {
    const mapContainer = document.getElementById('map');
    const legend = document.createElement('div');
    legend.id = 'map-legend';
    legend.style.position = 'absolute';
    legend.style.bottom = '16px';
    legend.style.left = '16px';
    legend.style.padding = '12px';
    legend.style.background = 'rgba(255,255,255,0.95)';
    legend.style.borderRadius = '10px';
    legend.style.fontSize = '13px';
    legend.style.lineHeight = '1.4';
    legend.style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)';
    legend.innerHTML = `
        <strong>Overview</strong>
        <div style="margin-top:8px;display:flex;flex-direction:column;gap:6px;">
            <span style="display:flex;align-items:center;gap:8px;"><span style="width:16px;height:16px;background:#2e7d32;border:1px solid #ccc;display:inline-block;"></span>All Yes</span>
            <span style="display:flex;align-items:center;gap:8px;"><span style="width:16px;height:16px;background:#ffb300;border:1px solid #ccc;display:inline-block;"></span>Mixed</span>
            <span style="display:flex;align-items:center;gap:8px;"><span style="width:16px;height:16px;background:#d32f2f;border:1px solid #ccc;display:inline-block;"></span>All No</span>
            <span style="display:flex;align-items:center;gap:8px;"><span style="width:16px;height:16px;background:#f5f5f5;border:1px solid #ccc;display:inline-block;"></span>No responses</span>
        </div>
        <div style="margin-top:6px;font-size:12px;color:#333;">Click a state to read stories.</div>
    `;
    mapContainer.appendChild(legend);
}

function createInfoPanel(){
    return document.getElementById('state-detail-overlay');
}

function showSurveySummary(){
    const overlay = document.getElementById('state-detail-overlay');
    const title = document.getElementById('state-detail-title');
    const summary = document.getElementById('state-detail-summary');
    const filterSelect = document.getElementById('state-filter');
    const slidesContainer = document.getElementById('state-detail-slides');
    const dotsContainer = document.getElementById('state-detail-dots');
    const countLabel = document.getElementById('state-slide-count');
    const prevButton = document.getElementById('prev-story');
    const nextButton = document.getElementById('next-story');

    if (!overlay || !slidesContainer || !title || !summary || !filterSelect || !countLabel) return;
    overlay.hidden = false;
    overlay.classList.add('open');

    const totalStates = Object.keys(stateGroups).length;
    const totalResponses = Object.values(stateGroups).reduce((sum, group) => sum + group.entries.length, 0);
    const yesCount = Object.values(stateGroups).reduce((sum, group) => sum + group.yes, 0);
    const noCount = Object.values(stateGroups).reduce((sum, group) => sum + group.no, 0);

    const yesPercent = totalResponses ? Math.round((yesCount / totalResponses) * 100) : 0;
    const noPercent = totalResponses ? Math.round((noCount / totalResponses) * 100) : 0;

    title.textContent = 'Survey summary';
    summary.textContent = `${totalResponses} survey responses came from ${totalStates} states. ${yesCount} answered “Yes” (${yesPercent}%) and ${noCount} answered “No” (${noPercent}%).`;
    filterSelect.innerHTML = '<option>All</option>';
    filterSelect.disabled = true;

    slidesContainer.innerHTML = `
        <div class="slick-slide">
            <div class="slide-card">
                <strong>Survey overview</strong>
                <p><strong>States with responses:</strong> ${totalStates}</p>
                <p><strong>Total survey responses:</strong> ${totalResponses}</p>
                <p><strong>Answered “Yes”:</strong> ${yesCount} (${yesPercent}%)</p>
                <p><strong>Answered “No”:</strong> ${noCount} (${noPercent}%)</p>
                <p style="margin-top:1rem;color:#555;">Click a state on the map to view that state&apos;s responses.</p>
            </div>
        </div>`;
    dotsContainer.innerHTML = '';
    countLabel.textContent = 'Summary';
    if (prevButton) prevButton.disabled = true;
    if (nextButton) nextButton.disabled = true;
}

function renderStateSummary(groups){
    const summaryPanel = document.getElementById('state-summary');
    summaryPanel.innerHTML = '<h2>Survey summary</h2><div id="summary-cards" class="summary-cards"></div>';
    const cardsContainer = document.getElementById('summary-cards');
    Object.entries(groups)
        .sort(([,a],[,b]) => b.entries.length - a.entries.length)
        .forEach(([state, group]) => {
            const card = document.createElement('div');
            card.className = 'card';
            card.style.cursor = 'pointer';
            card.style.minWidth = '220px';
            card.style.display = 'flex';
            card.style.flexDirection = 'column';
            card.style.gap = '6px';
            const total = (group.yes || 0) + (group.no || 0);
            let category = 'No responses';
            if (total > 0) {
                if (group.yes === total) category = 'All Yes';
                else if (group.no === total) category = 'All No';
                else category = 'Mixed';
            }
            card.innerHTML = `
                <strong>${state}</strong>
                <small>${group.entries.length} response${group.entries.length === 1 ? '' : 's'}</small>
                <small>${category}</small>
            `;
            card.addEventListener('click', function(){
                highlightState(state);
            });
            cardsContainer.appendChild(card);
        });
}

function showStateDetails(state, group, info){
    if (!info) return;
    info.hidden = false;
    info.style.opacity = '1';
    // build a slide deck for state responses
    const allEntries = group.entries.slice();
    const affectedTypes = Array.from(new Set(allEntries.map(e => (e.affected || 'Unknown').trim()))).sort();
    let filter = 'All';
    let index = 0;

    function getFiltered() {
        if (filter === 'All') return allEntries;
        return allEntries.filter(e => ((e.affected||'').trim()) === filter);
    }

    function buildSlides(list){
        if (list.length === 0) {
            return `<div class="slick-slide"><div class="slide-card"><p>No survey responses are available for this state.</p></div></div>`;
        }
        return list.map((entry) => `
            <div class="slick-slide">
                <div class="slide-card">
                    <strong>${entry.title || 'Unknown location'}</strong>
                    <p><strong>Who was affected?</strong> ${entry.affected || '—'}</p>
                    <p><strong>Response</strong> ${entry.opinion || '—'}</p>
                    <p><strong>Why or why not?</strong> ${entry.testimony || '—'}</p>
                </div>
            </div>
        `).join('');
    }

    function hasData(){
        return group && Array.isArray(group.entries) && group.entries.length > 0;
    }

    function renderDots(total){
        return Array.from({length: total}, (_, idx) => `
            <button type="button" class="slick-dot${idx === index ? ' active' : ''}" data-index="${idx}" aria-label="Go to story ${idx + 1}"></button>
        `).join('');
    }

    function updatePanel(){
        const list = getFiltered();
        const total = list.length;
        if (index >= total) index = Math.max(0, total - 1);

        const overlay = document.getElementById('state-detail-overlay');
        const title = document.getElementById('state-detail-title');
        const summary = document.getElementById('state-detail-summary');
        const filterSelect = document.getElementById('state-filter');
        const slidesContainer = document.getElementById('state-detail-slides');
        const prevButton = document.getElementById('prev-story');
        const nextButton = document.getElementById('next-story');
        const countLabel = document.getElementById('state-slide-count');
        const dotsContainer = document.getElementById('state-detail-dots');
        const closeButton = document.getElementById('close-map-overlay');

        if (overlay) {
            overlay.hidden = false;
            overlay.classList.add('open');
        }
        if (title) title.textContent = state;
        if (summary) summary.textContent = `${group.entries.length} total response${group.entries.length === 1 ? '' : 's'} — ${group.yes} Yes • ${group.no} No`;
        if (slidesContainer) slidesContainer.style.minHeight = '180px';
        if (slidesContainer) slidesContainer.innerHTML = buildSlides(list);
        if (dotsContainer) dotsContainer.innerHTML = total > 1 ? renderDots(total) : '';
        if (countLabel) countLabel.textContent = total > 0 ? `Story ${index + 1} of ${total}` : 'No stories available';

        if (prevButton) {
            prevButton.disabled = total <= 1;
            prevButton.onclick = () => { if (total > 0) { index = (index - 1 + total) % total; updatePanel(); } };
        }
        if (nextButton) {
            nextButton.disabled = total <= 1;
            nextButton.onclick = () => { if (total > 0) { index = (index + 1) % total; updatePanel(); } };
        }

        if (filterSelect) {
            filterSelect.innerHTML = '<option>All</option>' + affectedTypes.map(a => `<option>${a}</option>`).join('');
            filterSelect.value = filter;
            filterSelect.onchange = (e) => { filter = e.target.value; index = 0; updatePanel(); };
        }

        const track = slidesContainer;
        if (track) {
            track.style.transform = `translateX(-${index * 100}%)`;
        }

        if (dotsContainer) {
            dotsContainer.querySelectorAll('.slick-dot').forEach((button) => {
                button.onclick = () => {
                    index = Number(button.dataset.index);
                    updatePanel();
                };
            });
        }

        if (closeButton) {
            closeButton.onclick = () => {
                if (overlay) overlay.hidden = true;
            };
        }
    }

    updatePanel();
}

function highlightState(stateName) {
    if (!map.getLayer('states-highlight')) return;
    map.setFilter('states-highlight', ['==', 'name', stateName]);
    const bounds = new maplibregl.LngLatBounds();
    const stateFeature = statesGeojson.features.find(f => f.properties.name === stateName);
    if (stateFeature) {
        const coords = stateFeature.geometry.type === 'Polygon' ? stateFeature.geometry.coordinates : stateFeature.geometry.coordinates.flat(1);
        coords.forEach(ring => ring.forEach(coord => bounds.extend(coord)));
        if (!bounds.isEmpty()) {
            map.fitBounds(bounds, {padding: 40, maxZoom: 6});
        }
    }
}

async function loadSurveyData() {
    return new Promise((resolve, reject) => {
        Papa.parse(dataUrl, {
            download: true,
            header: true,
            complete: function(results) {
                processData(results);
                resolve();
            },
            error: reject
        });
    });
}

function processData(results){
    const sample = results.data && results.data[0] ? results.data[0] : null;
    let latKey = null, lngKey = null;
    if (sample) {
        Object.keys(sample).forEach(k => {
            const key = k.toLowerCase().trim();
            if (!latKey && /(^|[^a-z])(lat|latitude)($|[^a-z])/.test(key)) latKey = k;
            if (!lngKey && /(lon|lng|long|longitude|longitud)/.test(key)) lngKey = k;
        });
    }
    latKey = latKey || 'lat';
    lngKey = lngKey || 'lng';

    results.data.forEach((feature, i) => {
        const rawLat = feature[latKey] || feature['lat'] || feature['latitude'] || feature['Latitude'];
        const rawLng = feature[lngKey] || feature['lng'] || feature['lon'] || feature['longitude'] || feature['Longitude'];
        const latitude = parseFloat(rawLat);
        const longitude = parseFloat(rawLng);
        if (!isFinite(latitude) || !isFinite(longitude)) {
            console.warn(`Skipping row ${i}: invalid coordinates lat='${rawLat}' lng='${rawLng}'`);
            return;
        }

        const title = feature["Where's your hometown located? (City, State)"] || feature['Hometown'] || feature['hometown'] || 'Unknown location';
        const opinion = feature['Do you think UCLA has provided enough resources for students having experienced deportations?'] || feature['Do you think UCLA has provided enough resources?'] || '';
        const testimony = feature['Why or why not?'] || feature['Why or why not'] || feature['Why or why not? (Please explain)'] || feature['Please explain'] || '';
        const affected = feature['Who was affected?'] || feature['Who was affected'] || '';
        let state = normalizeState(title);
        if (state === 'Unknown' && isFinite(latitude) && isFinite(longitude)) {
            const fallbackState = findStateForPoint(longitude, latitude);
            if (fallbackState !== 'Unknown') state = fallbackState;
        }

        if (!stateGroups[state]) {
            stateGroups[state] = {entries: [], yes: 0, no: 0};
        }
        stateGroups[state].entries.push({latitude, longitude, title, opinion, testimony, affected});
        if (opinion.toLowerCase() === 'yes') stateGroups[state].yes += 1;
        if (opinion.toLowerCase() === 'no') stateGroups[state].no += 1;
    });

    if (statesGeojson) {
        const updated = JSON.parse(JSON.stringify(statesGeojson));
        updated.features.forEach(feature => {
            const stateName = feature.properties.name;
            const group = stateGroups[stateName];
            const yes = group ? group.yes : 0;
            const no = group ? group.no : 0;
            const total = yes + no;
            feature.properties.count = group ? group.entries.length : 0;
            feature.properties.yes = yes;
            feature.properties.no = no;
            let category = 'No responses';
            if (total > 0) {
                if (yes === total) category = 'All Yes';
                else if (no === total) category = 'All No';
                else category = 'Mixed';
            }
            feature.properties.category = category;
        });
        map.getSource('states').setData(updated);
        fitMapToDataBounds(updated);
    }
    renderStateSummary(stateGroups);
    showSurveySummary();
}

function fitMapToDataBounds(geojson) {
    const bounds = new maplibregl.LngLatBounds();
    let hasState = false;
    geojson.features.forEach(feature => {
        if (feature.properties.count > 0) {
            hasState = true;
            const coords = feature.geometry.type === 'Polygon'
                ? feature.geometry.coordinates
                : feature.geometry.coordinates.flat(1);
            coords.forEach(ring => ring.forEach(coord => bounds.extend(coord)));
        }
    });
    if (hasState && !bounds.isEmpty()) {
        map.fitBounds(bounds, {padding: 40, maxZoom: 5});
    }
}
