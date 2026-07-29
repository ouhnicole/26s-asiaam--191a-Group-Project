// declare variables
let mapOptions = {'centerLngLat': [-118.444,34.0709],'startingZoomLevel':5}

const map = new maplibregl.Map({
    container: 'map', // container ID
    style: 'https://api.maptiler.com/maps/019f8898-9cac-7f48-9d2a-5166d13bc591/style.json?key=domjvUPbX2qSlWXv88Xn', // Your style URL
    center: mapOptions.centerLngLat, // Starting position [lng, lat]
    zoom: mapOptions.startingZoomLevel // Starting zoom level
});
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
           processData(results)
        }
    });
});
//commit

// fetch('testimonies.geojson').then(
//     response => response.json()
// ).then(
//     data => {
//         map.addSource('places', {
//             'type': 'geojson',
//             'data': data
//         });
//         map.addLayer({
//             'id': 'places',
//             'type': 'circle',
//             'source': 'places',
//             'paint': {
//                 'circle-color': '#4264fb',
//                 'circle-radius': 6,
//                 'circle-stroke-width': 2,
//                 'circle-stroke-color': '#ffffff'
//             }
//         });
//     }
// );

// });

function processData(results){
    //console.log(results) //for debugging: this can help us see if the results are what we want
    console.log(results)
    results.data.forEach(feature => {
        if (feature.lng != 0){
            console.log(feature.lng) // for debugging: are we seeing each feature correctly?
            // assumes your geojson has a "title" and "message" attribute

            let longitude = feature.lng;
            let latitude = feature.lat;
            let title = feature["Where's your hometown located? (City, State)"];
            let opinion = feature['Do you think UCLA has provided enough resources for students having experienced deportations?'];
            addMarker(latitude,longitude,title,opinion);
        }

    });
};
<<<<<<< HEAD
function addMarker(latitude,longitude,title,opinion){
=======
/*
  Partner's modified addMarker function (commented out so changes are visible):

function addMarker(data){
>>>>>>> 20c0b10 (messaged)
    let popup_message;

    
    if (opinion == "Yes"){
        popup_message = `<h2>Student who thinks UCLA has provided enough resources</h2>`
    }
    else{
        popup_message = `<h2>Student who thinks UCLA has not provided enough resources</h2>`
    }
    new maplibregl.Marker()
        .setLngLat([longitude, latitude])
        .setPopup(new maplibregl.Popup()
            .setHTML(popup_message))
        .addTo(map)
    createButtons(latitude,longitude,opinion);
}

*/

// Restored addMarker signature expected by processData(feature)
function addMarker(latitude, longitude, title, message){
    const popup_message = `<h2>${title || ''}</h2><p>${message || ''}</p>`;
    new maplibregl.Marker()
        .setLngLat([longitude, latitude])
        .setPopup(new maplibregl.Popup().setHTML(popup_message))
        .addTo(map);
    createButtons(latitude, longitude, title || 'Location');
}
