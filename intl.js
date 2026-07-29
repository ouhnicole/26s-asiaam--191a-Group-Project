// Map and data visualization for testimonies by state
const mapOptions = { centerLngLat: [-98.5795, 39.8283], startingZoomLevel: 3 };

const map = new maplibregl.Map({
<<<<<<< HEAD
    container: 'map', // container ID
    style: 'https://api.maptiler.com/maps/019f8898-9cac-7f48-9d2a-5166d13bc591/style.json?key=domjvUPbX2qSlWXv88Xn', // Your style URL
    center: mapOptions.centerLngLat, // Starting position [lng, lat]
    zoom: mapOptions.startingZoomLevel // Starting zoom level
=======
    container: 'map',
    style: 'https://api.maptiler.com/maps/streets-v2-light/style.json?key=wsyYBQjqRwKnNsZrtci1',
    center: mapOptions.centerLngLat,
    zoom: mapOptions.startingZoomLevel
>>>>>>> 20c0b10 (messaged)
});
window.appMap = map;

const dataUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSycjDzRSIYoOrKh64s8viGDhLLU_Mgz82rkvO2YoEqqwScfeVXyno8y0Ghryh7GkNuhcmqOyj5jgYf/pub?output=csv';

const stateNameToAbbrev = {
    alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA', colorado: 'CO',
    connecticut: 'CT', delaware: 'DE', 'district of columbia': 'DC', florida: 'FL', georgia: 'GA',
    hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA', kansas: 'KS', kentucky: 'KY',
    louisiana: 'LA', maine: 'ME', maryland: 'MD', massachusetts: 'MA', michigan: 'MI', minnesota: 'MN',
    mississippi: 'MS', missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH',
    'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND',
    ohio: 'OH', oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
    'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT', virginia: 'VA',
    washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY'
};

function getStateAbbrevFromCityState(text) {
    if (!text) return 'Unknown';
    const m = text.match(/,\s*([A-Za-z]{2})\b/);
    if (m) return m[1].toUpperCase();
    const lower = text.trim().toLowerCase();
    for (const name in stateNameToAbbrev) if (lower.endsWith(name)) return stateNameToAbbrev[name];
    return 'Unknown';
}

function findField(fields, querySubstr) {
    for (const f of fields) if (f.toLowerCase().includes(querySubstr.toLowerCase())) return f;
    return null;
}

let parsedRows = [];
let pointFeatures = [];
let stateAggregates = {};
let statePolygons = null;

function pointInPolygon(point, vs) {
    const x = point[0], y = point[1];
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        const xi = vs[i][0], yi = vs[i][1];
        const xj = vs[j][0], yj = vs[j][1];
        const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

function lookupStateByLatLng(lat, lng) {
    if (!statePolygons) return 'Unknown';
    for (const feature of statePolygons.features) {
        const geom = feature.geometry;
        if (!geom) continue;
        const name = feature.properties && feature.properties.name ? feature.properties.name.toLowerCase() : '';
        const abbr = feature.properties && feature.properties.abbr ? feature.properties.abbr : (stateNameToAbbrev[name] || 'Unknown');
        if (geom.type === 'Polygon') {
            if (pointInPolygon([lng, lat], geom.coordinates[0])) return abbr;
        } else if (geom.type === 'MultiPolygon') {
            for (const polygon of geom.coordinates) {
                if (pointInPolygon([lng, lat], polygon[0])) return abbr;
            }
        }
    }
    return 'Unknown';
}

function rebuildStateAggregates() {
    stateAggregates = {};
    pointFeatures = [];
    parsedRows.forEach((norm) => {
        const state = norm.state || 'Unknown';
        if (!stateAggregates[state]) stateAggregates[state] = { count: 0, resourcesYes: 0, resourcesNo: 0, samples: [] };
        stateAggregates[state].count += 1;
        if (norm.resourcesAnswer && norm.resourcesAnswer.toLowerCase().startsWith('y')) stateAggregates[state].resourcesYes += 1;
        if (norm.resourcesAnswer && norm.resourcesAnswer.toLowerCase().startsWith('n')) stateAggregates[state].resourcesNo += 1;
        if (stateAggregates[state].samples.length < 3) stateAggregates[state].samples.push({ who: norm.whoAffected, cityState: norm.cityState, why: norm.why, lat: norm.lat, lng: norm.lng });
        if (norm.lat !== null && norm.lng !== null) {
            pointFeatures.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [norm.lng, norm.lat] }, properties: Object.assign({}, norm) });
        }
    });
}

map.on('load', () => {
    Papa.parse(dataUrl, {
        download: true,
        header: true,
        complete: function (results) {
            const fields = results.meta.fields || [];
            const resourcesField = findField(fields, 'Do you think ucla') || findField(fields, 'resources');

            const possibleCityKeys = [
                "Where's your hometown located? (City, State)",
                'Where is your hometown located? (City, State)',
                'Where is your hometown located?',
                'Where is your hometown located',
                'Hometown',
                'City, State'
            ];

            results.data.forEach((row) => {
                const cityStateText = possibleCityKeys.map((k) => row[k] || '').find((v) => v && v.toString().trim()) || '';
                const state = getStateAbbrevFromCityState(cityStateText);
                const lat = parseFloat(row.lat || row.Lat || row.latitude || '');
                const lng = parseFloat(row.lng || row.Lng || row.longitude || '');
                const resourcesAnswer = resourcesField ? row[resourcesField] || '' : '';
                const norm = {
                    timestamp: row.Timestamp || row.timestamp || '',
                    consent: row['Do you consent to participating in this anonymous survey about deportation and ICE enforcement?'] || row.Do || row.Consent || '',
                    whoAffected: row['Who was affected?'] || row['Who'] || '',
                    cityState: cityStateText,
                    lat: isFinite(lat) ? lat : null,
                    lng: isFinite(lng) ? lng : null,
                    resourcesAnswer: resourcesAnswer,
                    why: row['Why or why not?'] || row.Why || ''
                };
                norm.state = state;
                parsedRows.push(norm);
            });

            fetch('https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json')
                .then((r) => r.json())
                .then((statesGeo) => {
                    statePolygons = statesGeo;
                    statesGeo.features.forEach((f) => {
                        const name = f.properties && f.properties.name ? f.properties.name.toLowerCase() : '';
                        const abbr = stateNameToAbbrev[name] || 'Unknown';
                        f.properties.abbr = abbr;
                    });

                    parsedRows.forEach((norm) => {
                        if (norm.state === 'Unknown' && norm.lat !== null && norm.lng !== null) {
                            norm.state = lookupStateByLatLng(norm.lat, norm.lng);
                        }
                    });

                    rebuildStateAggregates();
                    statesGeo.features.forEach((f) => {
                        const abbr = f.properties.abbr || 'Unknown';
                        f.properties.count = stateAggregates[abbr] ? stateAggregates[abbr].count : 0;
                    });

                    if (map.getSource('states')) {
                        if (map.getLayer('states-fill')) map.removeLayer('states-fill');
                        if (map.getLayer('states-outline')) map.removeLayer('states-outline');
                        map.removeSource('states');
                    }
                    map.addSource('states', { type: 'geojson', data: statesGeo });
                    map.addLayer({
                        id: 'states-fill',
                        type: 'fill',
                        source: 'states',
                        paint: {
                            'fill-color': ['step', ['get', 'count'], '#f2f0f7', 1, '#cbc9e2', 5, '#9e9ac8', 10, '#6a51a3', 20, '#4a1486'],
                            'fill-opacity': 0.75
                        }
                    });
                    map.addLayer({
                        id: 'states-outline',
                        type: 'line',
                        source: 'states',
                        paint: { 'line-color': '#ffffff', 'line-width': 1 }
                    });

                    if (pointFeatures.length > 0) {
                        if (map.getSource('all-points')) map.removeSource('all-points');
                        if (map.getLayer('all-clusters')) map.removeLayer('all-clusters');
                        if (map.getLayer('all-cluster-count')) map.removeLayer('all-cluster-count');
                        if (map.getLayer('all-unclustered-point')) map.removeLayer('all-unclustered-point');

                        map.addSource('all-points', {
                            type: 'geojson',
                            data: { type: 'FeatureCollection', features: pointFeatures },
                            cluster: true,
                            clusterMaxZoom: 14,
                            clusterRadius: 50
                        });

                        map.addLayer({
                            id: 'all-clusters',
                            type: 'circle',
                            source: 'all-points',
                            filter: ['has', 'point_count'],
                            paint: {
                                'circle-color': '#f28cb1',
                                'circle-radius': ['step', ['get', 'point_count'], 18, 10, 24, 30, 30]
                            }
                        });
                        map.addLayer({
                            id: 'all-cluster-count',
                            type: 'symbol',
                            source: 'all-points',
                            filter: ['has', 'point_count'],
                            layout: { 'text-field': ['get', 'point_count'], 'text-size': 14 }
                        });

                        const pinSvg = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 64 64"><path fill="#f28cb1" d="M32 2C20.954 2 12 10.954 12 22c0 12.496 16.016 30.462 18.48 33.082a2 2 0 0 0 3.04 0C35.984 52.462 52 34.496 52 22 52 10.954 43.046 2 32 2zm0 30a8 8 0 1 1 0-16 8 8 0 0 1 0 16z"/><circle cx="32" cy="22" r="6" fill="#fff"/></svg>');
                        const pinImage = new Image();
                        pinImage.onload = () => {
                            if (!map.hasImage('pin')) map.addImage('pin', pinImage);
                            if (!map.getLayer('all-unclustered-point')) {
                                map.addLayer({
                                    id: 'all-unclustered-point',
                                    type: 'symbol',
                                    source: 'all-points',
                                    filter: ['!', ['has', 'point_count']],
                                    layout: {
                                        'icon-image': 'pin',
                                        'icon-size': 1.3,
                                        'icon-allow-overlap': true,
                                        'icon-ignore-placement': true,
                                        'icon-offset': [0, -14]
                                    }
                                });
                            }
                        };
                        pinImage.src = pinSvg;

                        map.on('click', 'all-unclustered-point', (e) => {
                            const f = e.features[0];
                            const props = f.properties || {};
                            const html = `<strong>${props.whoAffected || ''}</strong><div>${props.cityState || ''}</div><div>${props.why || ''}</div>`;
                            new maplibregl.Popup().setLngLat(f.geometry.coordinates).setHTML(html).addTo(map);
                        });

                        map.on('click', 'all-clusters', function (e) {
                            const features = map.queryRenderedFeatures(e.point, { layers: ['all-clusters'] });
                            const clusterId = features[0].properties.cluster_id;
                            map.getSource('all-points').getClusterExpansionZoom(clusterId, (err, zoom) => {
                                if (err) return;
                                map.easeTo({ center: features[0].geometry.coordinates, zoom: zoom });
                            });
                        });
                    }

                    const legend = document.getElementById('legend');
                    if (legend) {
                        legend.innerHTML = '<strong>Testimonies by state</strong><br/>' +
                            '<div><span style="background:#f2f0f7"></span> 0</div>' +
                            '<div><span style="background:#cbc9e2"></span> 1-4</div>' +
                            '<div><span style="background:#9e9ac8"></span> 5-9</div>' +
                            '<div><span style="background:#6a51a3"></span> 10-19</div>' +
                            '<div><span style="background:#4a1486"></span> 20+</div>';
                        legend.querySelectorAll('span').forEach((s) => {
                            s.style.display = 'inline-block';
                            s.style.width = '16px';
                            s.style.height = '12px';
                            s.style.marginRight = '6px';
                        });
                    }

                    map.on('click', 'states-fill', (e) => {
                        const feature = e.features[0];
                        const abbr = feature.properties.abbr || 'Unknown';
                        showStateDetails(abbr, feature);
                        zoomToStatePins(abbr, feature);
                    });

                    map.on('mouseenter', 'states-fill', () => {
                        map.getCanvas().style.cursor = 'pointer';
                    });
                    map.on('mouseleave', 'states-fill', () => {
                        map.getCanvas().style.cursor = '';
                    });
                });
        }
    });
});

function showStateDetails(abbr, feature) {
    const info = document.getElementById('info');
    const surveyHolder = document.getElementById('survey-holder');
    const agg = stateAggregates[abbr] || { count: 0, resourcesYes: 0, resourcesNo: 0, samples: [] };
    const pctYes = agg.count ? Math.round((100 * agg.resourcesYes) / agg.count) : 0;

    info.innerHTML = `<h3>${abbr}</h3><div>Responses: ${agg.count}</div><div>Resources Yes: ${agg.resourcesYes} (${pctYes}%)</div>`;

    if (agg.samples && agg.samples.length) {
        const list = document.createElement('div');
        list.innerHTML = '<strong>Sample testimonies</strong>';
        agg.samples.forEach((s) => {
            const item = document.createElement('div');
            item.className = 'sample';
            item.innerHTML = `<div><em>${s.who}</em> — ${s.cityState}</div><div>${s.why || ''}</div>`;
            list.appendChild(item);
        });
        info.appendChild(list);
    }

    if (surveyHolder) {
        surveyHolder.innerHTML = `<div class="survey-title">Share your experience for ${abbr}</div><iframe src="https://docs.google.com/forms/d/e/1FAIpQLScaFLlkRnyKGnaQxl3_EysLghpz6ydfYeeQfF9LGE_hYdlZbA/viewform?embedded=true" title="Survey Form"></iframe>`;
    }

    const statePoints = { type: 'FeatureCollection', features: pointFeatures.filter((f) => f.properties && f.properties.state === abbr) };

    const zoomButton = document.createElement('button');
    zoomButton.className = 'zoom-button';
    zoomButton.textContent = 'Zoom to pins';
    zoomButton.addEventListener('click', () => zoomToStatePins(abbr, feature));
    info.appendChild(zoomButton);

    if (map.getLayer('clusters')) map.removeLayer('clusters');
    if (map.getLayer('cluster-count')) map.removeLayer('cluster-count');
    if (map.getLayer('unclustered-point')) map.removeLayer('unclustered-point');
    if (map.getSource('state-points')) map.removeSource('state-points');

    if (statePoints.features.length === 0) return;

    map.addSource('state-points', { type: 'geojson', data: statePoints, cluster: true, clusterMaxZoom: 14, clusterRadius: 50 });
    map.addLayer({ id: 'clusters', type: 'circle', source: 'state-points', filter: ['has', 'point_count'], paint: { 'circle-color': '#f28cb1', 'circle-radius': ['step', ['get', 'point_count'], 15, 10, 20, 30, 25] } });
    map.addLayer({ id: 'cluster-count', type: 'symbol', source: 'state-points', filter: ['has', 'point_count'], layout: { 'text-field': ['get', 'point_count'], 'text-size': 12 } });
    map.addLayer({ id: 'unclustered-point', type: 'circle', source: 'state-points', filter: ['!', ['has', 'point_count']], paint: { 'circle-color': '#4264fb', 'circle-radius': 6, 'circle-stroke-width': 1, 'circle-stroke-color': '#fff' } });

    map.on('click', 'unclustered-point', (e) => {
        const f = e.features[0];
        const props = f.properties || {};
        const html = `<strong>${props.whoAffected || ''}</strong><div>${props.cityState || ''}</div><div>${props.why || ''}</div>`;
        new maplibregl.Popup().setLngLat(f.geometry.coordinates).setHTML(html).addTo(map);
    });

    map.on('click', 'clusters', function (e) {
        const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
        const clusterId = features[0].properties.cluster_id;
        map.getSource('state-points').getClusterExpansionZoom(clusterId, (err, zoom) => {
            if (err) return;
            map.easeTo({ center: features[0].geometry.coordinates, zoom: zoom });
        });
    });
}

function zoomToStatePins(abbr, stateFeature) {
    const features = pointFeatures.filter((f) => f.properties && f.properties.state === abbr);
    if (!features.length) return;

    if (features.length === 1) {
        const coord = features[0].geometry.coordinates;
        map.easeTo({ center: coord, zoom: 11, duration: 250 });
        return;
    }

    const bounds = features.reduce((bounds, feature, index) => {
        const coord = feature.geometry.coordinates;
        return index === 0 ? new maplibregl.LngLatBounds(coord, coord) : bounds.extend(coord);
    }, null);

    if (bounds) {
        map.fitBounds(bounds, { padding: 80, duration: 250, maxZoom: 11 });
    }
}


