// declare variables
let mapOptions = {'centerLngLat': [-118.444,34.0709],'startingZoomLevel':5}

const map = new maplibregl.Map({
    container: 'map', // container ID
    style: 'https://api.maptiler.com/maps/streets-v2-light/style.json?key=wsyYBQjqRwKnNsZrtci1', // Your style URL
    center: mapOptions.centerLngLat, // Starting position [lng, lat]
    zoom: mapOptions.startingZoomLevel // Starting zoom level
});

function addMarker(lat,lng,title,message){
    let popup_message = `<h2>${title}</h2> <h3>${message}</h3>`
    new maplibregl.Marker()
        .setLngLat([lng, lat])
        .setPopup(new maplibregl.Popup()
            .setHTML(popup_message))
        .addTo(map)
    createButtons(lat,lng,title);
    return message
}

function createButtons(lat,lng,title){
    const newButton = document.createElement("button");
    newButton.id = "button"+title;
    newButton.innerHTML = title;
    newButton.setAttribute("lat",lat);
    newButton.setAttribute("lng",lng);
    newButton.addEventListener('click', function(){
        map.flyTo({
            center: [lng,lat],
        })
    })
    document.getElementById("contents").appendChild(newButton);
}

const dataUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSycjDzRSIYoOrKh64s8viGDhLLU_Mgz82rkvO2YoEqqwScfeVXyno8y0Ghryh7GkNuhcmqOyj5jgYf/pub?output=csv"

// When the map is fully loaded, start adding GeoJSON data
map.on('load', function() {
    Papa.parse(dataUrl, {
        download: true, // Tells PapaParse to fetch the CSV data from the URL
        header: true, // Assumes the first row of your CSV are column headers
        complete: function(results) {
            // Process the parsed data
           console.log(results)
        }
    });
//commit

fetch('testimonies.geojson').then(
    response => response.json()
).then(
    data => {
        map.addSource('places', {
            'type': 'geojson',
            'data': data
        });
        map.addLayer({
            'id': 'places',
            'type': 'circle',
            'source': 'places',
            'paint': {
                'circle-color': '#4264fb',
                'circle-radius': 6,
                'circle-stroke-width': 2,
                'circle-stroke-color': '#ffffff'
            }
        });
    }
);

});

function processData(results){
    //console.log(results) //for debugging: this can help us see if the results are what we want
    results.features.forEach(feature => {
        //console.log(feature) // for debugging: are we seeing each feature correctly?
        // assumes your geojson has a "title" and "message" attribute
        let coordinates = feature.geometry.coordinates;
        let longitude = coordinates[0];
        let latitude = coordinates[1];
        let title = feature.properties.title;
        let message = feature.properties.message;
        addMarker(latitude,longitude,title,message);
    });
};

document.addEventListener('DOMContentLoaded', function() {
    const surveyButton = document.getElementById('survey-toggle');
    const surveyPanel = document.getElementById('survey-panel');

    if (surveyButton && surveyPanel) {
        surveyButton.addEventListener('click', function() {
            const isOpen = surveyPanel.style.display === 'block';
            surveyPanel.style.display = isOpen ? 'none' : 'block';
            surveyButton.textContent = isOpen ? 'Open Survey' : 'Close Survey';
        });
    }
});


