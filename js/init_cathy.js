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
        setupCityMarkerLayer();
        await loadSurveyData();
        // addLegend();
    } catch (error) {
        console.error('Error loading map data:', error);
    }
});

// Animated pulsing dot used to mark the city of the story currently shown
// in the slideshow. Adapted from the MapLibre "animated icon" example:
// https://maplibre.org/maplibre-gl-js/docs/examples/add-an-animated-icon-to-the-map/
const pulsingDot = {
    width: 100,
    height: 100,
    data: new Uint8Array(100 * 100 * 4),

    onAdd: function () {
        const canvas = document.createElement('canvas');
        canvas.width = this.width;
        canvas.height = this.height;
        this.context = canvas.getContext('2d');
    },

    render: function () {
        const duration = 1000;
        const t = (performance.now() % duration) / duration;

        const radius = (this.width / 2) * 0.3;
        const outerRadius = (this.width / 2) * 0.7 * t + radius;
        const context = this.context;

        context.clearRect(0, 0, this.width, this.height);
        context.beginPath();
        context.arc(this.width / 2, this.height / 2, outerRadius, 0, Math.PI * 2);
        context.fillStyle = `rgba(254, 203, 0, ${1 - t})`;
        context.fill();

        context.beginPath();
        context.arc(this.width / 2, this.height / 2, radius, 0, Math.PI * 2);
        context.fillStyle = '#0056d8';
        context.strokeStyle = 'white';
        context.lineWidth = 2 + 4 * (1 - t);
        context.fill();
        context.stroke();

        this.data = context.getImageData(0, 0, this.width, this.height).data;

        map.triggerRepaint();

        return true;
    }
};

function setupCityMarkerLayer() {
    map.addImage('pulsing-dot', pulsingDot, {pixelRatio: 2});
    map.addSource('city-marker', {
        type: 'geojson',
        data: {type: 'FeatureCollection', features: []}
    });
    map.addLayer({
        id: 'city-marker-layer',
        type: 'symbol',
        source: 'city-marker',
        layout: {
            'icon-image': 'pulsing-dot',
            'icon-allow-overlap': true
        }
    });
}

function updateCityMarker(entry) {
    const source = map.getSource('city-marker');
    if (!source) return;
    if (!entry || !isFinite(entry.longitude) || !isFinite(entry.latitude)) {
        source.setData({type: 'FeatureCollection', features: []});
        return;
    }
    source.setData({
        type: 'FeatureCollection',
        features: [{
            type: 'Feature',
            geometry: {type: 'Point', coordinates: [entry.longitude, entry.latitude]},
            properties: {title: entry.title || ''}
        }]
    });
    map.panTo([entry.longitude, entry.latitude], {duration: 800});
}

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

function normalizeKey(key) {
    return String(key || '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
}

function getFieldValue(row, preferredKeys, fallbackPattern) {
    if (!row) return '';

    for (const key of preferredKeys) {
        const value = row[key];
        if (value !== undefined && value !== null && String(value).trim() !== '') {
            return String(value).trim();
        }
    }

    if (!fallbackPattern) return '';
    for (const [key, value] of Object.entries(row)) {
        if (!fallbackPattern.test(normalizeKey(key))) continue;
        if (value !== undefined && value !== null && String(value).trim() !== '') {
            return String(value).trim();
        }
    }
    return '';
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
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
        if (count > 0) {
            const html = `<strong>${props.name}</strong><div style="font-size:13px;margin-top:4px;">${count} response${count===1?'':'s'} — Yes: ${yes} • No: ${no}<div style="margin-top:6px;font-weight:600;">${cat}</div></div>`;
            hoverPopup.setLngLat(e.lngLat).setHTML(html).addTo(map);
        }
    });
    map.on('mouseleave', 'states-fill', () => {
        map.getCanvas().style.cursor = '';
        map.setFilter('states-highlight', ['==', 'name', '']);
        hoverPopup.remove();
    });
    map.on('click', 'states-fill', (e) => {
        const stateName = e.features[0].properties.name;
        const group = stateGroups[stateName];
        if (group && group.entries.length > 0) {
            map.setFilter('states-highlight', ['==', 'name', stateName]);
            showStateDetails(stateName, group, createInfoPanel());
        } else {
            // No survey data for this state — fall back to the overall summary.
            map.setFilter('states-highlight', ['==', 'name', '']);
            showStateDetails('All responses', getAggregateGroup(), createInfoPanel());
        }
    });

    map.on('click', (e) => {
        const features = map.queryRenderedFeatures(e.point, {layers: ['states-fill', 'states-outline']});
        if (!features.length) {
            // Clicked somewhere with no survey data at all — show the overall summary.
            map.setFilter('states-highlight', ['==', 'name', '']);
            showStateDetails('All responses', getAggregateGroup(), createInfoPanel());
        }
    });
}

// Combines every state's responses into one group so clicks on empty states
// or areas without survey data can still show the overall Yes/No summary.
function getAggregateGroup() {
    const entries = [];
    let yes = 0, no = 0;
    let statesWithResponses = 0;
    Object.entries(stateGroups).forEach(([stateName, group]) => {
        entries.push(...group.entries);
        yes += group.yes;
        no += group.no;
        // 'Unknown' isn't an actual state, so it doesn't count toward the
        // "how many states have a response" tally.
        if (stateName !== 'Unknown' && group.entries.length > 0) statesWithResponses += 1;
    });
    return {entries, yes, no, statesWithResponses};
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

// Builds the summary shown when a state with no survey data (or empty map
// space) is clicked: a single stacked bar chart comparing Yes vs. No
// responses, plus how many total responses and states are represented.
// A stacked bar is used instead of a table of numbers because it lets you
// see the Yes/No balance for the whole dataset in one glance, without
// having to read and compare separate figures.
function buildAggregateSummaryHtml(group, total){
    const statesWithResponses = group.statesWithResponses || 0;
    const yesPct = total > 0 ? Math.round((group.yes / total) * 100) : 0;
    const noPct = total > 0 ? 100 - yesPct : 0;
    return `
        <div class="summary-question-card" style="width: 100%;">
            <span class="summary-question-icon" aria-hidden="true">&#10077;</span>
            <div>
                <span class="summary-question-label">Survey question</span>
                <p class="summary-question-text">Has UCLA supported Pilipinx students affected by ICE deportations?</p>
            </div>
        </div>
        <div class="summary-chart summary-chart-full" role="img" aria-label="${group.yes} yes responses (${yesPct}%) and ${group.no} no responses (${noPct}%) out of ${total} total">
            <div class="chart-bar">
                <span class="chart-segment yes" style="width:${yesPct}%"></span>
                <span class="chart-segment no" style="width:${noPct}%"></span>
            </div>
            <div class="chart-legend">
                <span class="legend-item"><span class="legend-dot yes"></span>Yes — ${group.yes} (${yesPct}%)</span>
                <span class="legend-item"><span class="legend-dot no"></span>No — ${group.no} (${noPct}%)</span>
            </div>
        </div>
        <div class="metric-grid summary-metric-grid">
            <div class="metric-card metric-total">
                <span class="metric-label">Total responses</span>
                <span class="metric-value">${total}</span>
            </div>
            <div class="metric-card metric-states">
                <span class="metric-label">States represented</span>
                <span class="metric-value">${statesWithResponses}</span>
            </div>
        </div>
        <div class="instructions-card">
            <h3>How to explore the map</h3>
            <ul>
                <li><strong>Click any state on the map</strong> to view anonymized stories from that community.</li>
                <li><strong>Use the filter</strong> to see responses by who was affected (parent, sibling, partner, friend, etc.).</li>
                <li><strong>Navigate stories</strong> with the arrow buttons on the sides of each story.</li>
                <li><strong>Click outside a state</strong> to return to this overview.</li>
            </ul>
        </div>
    `;
}

// Closes the state/survey panel so it collapses back into the map with no
// state selected. The panel slides out first, then is fully hidden once the
// transition finishes so it doesn't affect the map's layout while closing.
function closeOverlay(){
    const overlay = document.getElementById('state-detail-overlay');
    if (!overlay || overlay.hidden) return;
    closeReadMoreModal();
    map.setFilter('states-highlight', ['==', 'name', '']);
    updateCityMarker(null);
    overlay.classList.remove('open');
    overlay.classList.remove('is-aggregate-view');
    window.setTimeout(() => {
        if (!overlay.classList.contains('open')) overlay.hidden = true;
    }, 280);
}

function getReadMoreModalElements() {
    let backdrop = document.getElementById('readmore-backdrop');
    if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.id = 'readmore-backdrop';
        backdrop.hidden = true;
        document.body.appendChild(backdrop);
    }

    let modal = document.getElementById('readmore-modal');
    if (!modal) {
        modal = document.createElement('section');
        modal.id = 'readmore-modal';
        modal.hidden = true;
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.innerHTML = `
            <button type="button" id="readmore-close" aria-label="Close expanded testimony">&times;</button>
            <h3 id="readmore-title">Testimony</h3>
            <p id="readmore-meta"></p>
            <div id="readmore-body"></div>
        `;
        document.body.appendChild(modal);
    }

    if (!backdrop.dataset.bound) {
        backdrop.addEventListener('click', closeReadMoreModal);
        backdrop.dataset.bound = 'true';
    }
    const closeBtn = modal.querySelector('#readmore-close');
    if (closeBtn && !closeBtn.dataset.bound) {
        closeBtn.addEventListener('click', closeReadMoreModal);
        closeBtn.dataset.bound = 'true';
    }

    return {
        backdrop,
        modal,
        closeBtn,
        titleEl: modal.querySelector('#readmore-title'),
        metaEl: modal.querySelector('#readmore-meta'),
        bodyEl: modal.querySelector('#readmore-body')
    };
}

function closeReadMoreModal() {
    const backdrop = document.getElementById('readmore-backdrop');
    const modal = document.getElementById('readmore-modal');
    if (backdrop) backdrop.hidden = true;
    if (modal) modal.hidden = true;
    document.body.classList.remove('readmore-open');
}

function openReadMoreModal(entry) {
    const { backdrop, modal, closeBtn, titleEl, metaEl, bodyEl } = getReadMoreModalElements();
    const location = escapeHtml(entry.title || 'Unknown location');
    const affected = escapeHtml(entry.affected || 'No detail provided');
    const testimony = escapeHtml(entry.testimony || 'No additional comment.').replace(/\n/g, '<br>');

    if (titleEl) titleEl.textContent = 'Expanded testimony';
    if (metaEl) metaEl.innerHTML = `<strong>Location:</strong> ${location}<br><strong>Who was affected:</strong> ${affected}`;
    if (bodyEl) bodyEl.innerHTML = `<p>${testimony}</p>`;

    backdrop.hidden = false;
    modal.hidden = false;
    document.body.classList.add('readmore-open');
    if (closeBtn) closeBtn.focus();
}

let readMoreEscBound = false;
function ensureReadMoreEscBinding() {
    if (readMoreEscBound) return;
    readMoreEscBound = true;
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && document.body.classList.contains('readmore-open')) {
            closeReadMoreModal();
        }
    });
}

function showStateDetails(state, group, info){
    if (!info) return;
    info.hidden = false;
    info.style.opacity = '1';
    // The aggregate ('All responses') view is shown when a state without
    // survey data (or empty map space) is clicked, and gets its own
    // chart-based summary instead of the single-state Yes/No badges.
    const isAggregateView = state === 'All responses';
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
        return list.map((entry, entryIndex) => `
            <div class="slick-slide">
                <div class="slide-card">
                    <div class="slide-section">
                        <span class="slide-label">Location</span>
                        <strong>${escapeHtml(entry.title || 'Unknown location')}</strong>
                    </div>
                    <div class="slide-section">
                        <span class="slide-label">Response</span>
                        <p>${escapeHtml(entry.opinion || 'No response provided.')}</p>
                    </div>
                    <div class="slide-section">
                        <span class="slide-label">Who was affected?</span>
                        <p>${escapeHtml(entry.affected || 'No detail provided.')}</p>
                    </div>
                    <div class="slide-section why-section">
                        <span class="slide-label">Why or why not?</span>
                        <p class="why-text">${escapeHtml(entry.testimony || 'No additional comment.')}</p>
                        ${(entry.testimony || '').trim().length > 180 ? `<button type="button" class="read-more-btn" data-entry-index="${entryIndex}">Read more</button>` : ''}
                    </div>
                </div>
            </div>
        `).join('');
    }

    function hasData(){
        return group && Array.isArray(group.entries) && group.entries.length > 0;
    }

    function updatePanel(){
        ensureReadMoreEscBinding();
        const list = getFiltered();
        const total = list.length;
        if (index >= total) index = Math.max(0, total - 1);
        updateCityMarker(total > 0 ? list[index] : null);

        const overlay = document.getElementById('state-detail-overlay');
        const title = document.getElementById('state-detail-title');
        const summary = document.getElementById('state-detail-summary');
        const filterSelect = document.getElementById('state-filter');
        const slidesContainer = document.getElementById('state-detail-slides');
        const prevButton = document.getElementById('prev-story');
        const nextButton = document.getElementById('next-story');
        const closeButton = document.getElementById('close-map-overlay');

        if (overlay) {
            overlay.hidden = false;
            overlay.classList.add('open');
            overlay.classList.toggle('is-aggregate-view', isAggregateView);
        }
        if (title) title.textContent = isAggregateView ? 'Overview: All Responses' : state;
        if (summary) {
            const total = group.yes + group.no;
            if (isAggregateView) {
                summary.innerHTML = buildAggregateSummaryHtml(group, total);
            } else {
                const yesPct = total > 0 ? Math.round((group.yes / total) * 100) : 0;
                const noPct = total > 0 ? 100 - yesPct : 0;
                summary.innerHTML = `
                    <div class="summary-question-card" style="width: 100%;">
                        <span class="summary-question-icon" aria-hidden="true">&#10077;</span>
                        <div>
                            <span class="summary-question-label">Survey question</span>
                            <p class="summary-question-text">Has UCLA supported Pilipinx students affected by ICE deportations?</p>
                        </div>
                    </div>
                    <div class="summary-chart" role="img" aria-label="${group.yes} yes responses (${yesPct}%) and ${group.no} no responses (${noPct}%) out of ${total} total">
                        <div class="chart-bar">
                            <span class="chart-segment yes" style="width:${yesPct}%"></span>
                            <span class="chart-segment no" style="width:${noPct}%"></span>
                        </div>
                        <div class="chart-legend">
                            <span class="legend-item"><span class="legend-dot yes"></span>Yes — ${group.yes} (${yesPct}%)</span>
                            <span class="legend-item"><span class="legend-dot no"></span>No — ${group.no} (${noPct}%)</span>
                        </div>
                    </div>
                `;
            }
        }
        if (slidesContainer) slidesContainer.style.minHeight = '180px';
        if (slidesContainer) slidesContainer.innerHTML = buildSlides(list);
        closeReadMoreModal();

        if (slidesContainer) {
            slidesContainer.querySelectorAll('.read-more-btn').forEach((button) => {
                button.onclick = () => {
                    const entryIndex = Number(button.dataset.entryIndex);
                    if (!Number.isInteger(entryIndex) || !list[entryIndex]) return;
                    openReadMoreModal(list[entryIndex]);
                };
            });
        }

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

        if (closeButton) {
            closeButton.onclick = () => {
                closeOverlay();
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

        const title = getFieldValue(
            feature,
            ["Where's your hometown located? (City, State)", 'Hometown', 'hometown'],
            /(hometown|citystate|location)/
        ) || 'Unknown location';
        const opinion = getFieldValue(
            feature,
            ['Do you think UCLA has provided enough resources for students having experienced deportations?', 'Do you think UCLA has provided enough resources?', 'Response', 'response'],
            /(providedenoughresources|enoughresources|resourcesforstudents|deportations)/
        );
        const testimony = getFieldValue(
            feature,
            ['Why or why not?', 'Why or why not', 'Why or why not? (Please explain)', 'Please explain'],
            /(whyorwhynot|pleaseexplain|explain|reasonwhy|because)/
        );
        const affected = getFieldValue(
            feature,
            ['Who was affected?', 'Who was affected'],
            /(whowasaffected|affected)/
        );
        const normalizedOpinion = opinion.toLowerCase().trim();
        let state = normalizeState(title);
        if (state === 'Unknown' && isFinite(latitude) && isFinite(longitude)) {
            const fallbackState = findStateForPoint(longitude, latitude);
            if (fallbackState !== 'Unknown') state = fallbackState;
        }

        if (!stateGroups[state]) {
            stateGroups[state] = {entries: [], yes: 0, no: 0};
        }
        stateGroups[state].entries.push({latitude, longitude, title, opinion, testimony, affected});
        if (normalizedOpinion === 'yes') stateGroups[state].yes += 1;
        if (normalizedOpinion === 'no') stateGroups[state].no += 1;
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
