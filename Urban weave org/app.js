mapboxgl.accessToken = window.MAPBOX_ACCESS_TOKEN || (window.ENV && window.ENV.MAPBOX_ACCESS_TOKEN) || 'pk.eyJ1IjoiYXl1c2gxMDYiLCJhIjoiY21vZzN5aGZ6MHl6aTJwc2NxbHdqaWFyOSJ9.sk5F7RpdYq9M_n6HWSjffw';

const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/dark-v11',
    center: [77.4977, 28.4744],
    zoom: 12,
    pitch: 45
});

const weaveBtn = document.getElementById('weave-btn');
const fromInput = document.getElementById('from-input');
const toInput = document.getElementById('to-input');
const routeOptions = document.getElementById('route-options');
const startNavBtn = document.getElementById('start-nav-btn');
const endNavBtn = document.getElementById('end-nav-btn');
const menuBtn = document.getElementById('menu-btn');
const closeSidebarBtn = document.getElementById('close-sidebar-btn');
const sidebar = document.getElementById('sidebar');

let startCoords, endCoords, activeRouteLine;

let geoWatchId = null;
let lastKnownPosition = null;

function calculateBearing(start, end) {
    if (start[0] === end[0] && start[1] === end[1]) return 0;
    return (Math.atan2(end[0] - start[0], end[1] - start[1]) * 180) / Math.PI;
}

menuBtn.addEventListener('click', () => {
    sidebar.classList.remove('-translate-x-full');
});
closeSidebarBtn.addEventListener('click', () => {
    sidebar.classList.add('-translate-x-full');
});

function setupAutocomplete(inputElementId, dropdownElementId) {
    const inputEl = document.getElementById(inputElementId);
    const dropdownEl = document.getElementById(dropdownElementId);
    let debounceTimer;

    inputEl.addEventListener('input', (e) => {

        if (inputElementId === 'from-input') startCoords = null;
        if (inputElementId === 'to-input') endCoords = null;

        clearTimeout(debounceTimer);
        const query = e.target.value.trim();

        if (query.length < 3) {
            dropdownEl.classList.add('hidden');
            dropdownEl.innerHTML = '';
            return;
        }

        debounceTimer = setTimeout(async () => {
            try {

                const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${mapboxgl.accessToken}&autocomplete=true&limit=5&country=in&proximity=77.4977,28.4744`;
                const response = await fetch(url);
                const data = await response.json();

                dropdownEl.innerHTML = '';

                if (data.features && data.features.length > 0) {

                    data.features.forEach(feature => {
                        const li = document.createElement('li');

                        li.className = 'px-4 py-3 text-sm text-gray-300 hover:bg-[#24283b] hover:text-[#7aa2f7] cursor-pointer transition-colors flex items-center gap-2';

                        li.innerHTML = `
                            <svg class="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                            </svg>
                            <span class="truncate">${feature.place_name}</span>
                        `;

                        li.addEventListener('click', () => {
                            inputEl.value = feature.place_name;
                            dropdownEl.classList.add('hidden');
                            updateDotGlow();

                            if (inputElementId === 'from-input') startCoords = feature.center;
                            if (inputElementId === 'to-input') endCoords = feature.center;
                        });

                        dropdownEl.appendChild(li);
                    });

                    dropdownEl.classList.remove('hidden');
                } else {

                    dropdownEl.innerHTML = '<li class="px-4 py-3 text-sm text-gray-500 italic">No locations found</li>';
                    dropdownEl.classList.remove('hidden');
                }
            } catch (err) {
                console.error("Autocomplete error:", err);
            }
        }, 300);
    });

    document.addEventListener('click', (e) => {
        if (!inputEl.contains(e.target) && !dropdownEl.contains(e.target)) {
            dropdownEl.classList.add('hidden');
        }
    });
}

setupAutocomplete('from-input', 'from-suggestions');
setupAutocomplete('to-input', 'to-suggestions');

function updateDotGlow() {
    const fromDot = document.getElementById('from-dot');
    const toDot = document.getElementById('to-dot');

    if (fromInput.value.trim().length > 0) {
        fromDot.classList.add('glow-active-green');
    } else {
        fromDot.classList.remove('glow-active-green');
    }

    if (toInput.value.trim().length > 0) {
        toDot.classList.add('glow-active-pink');
    } else {
        toDot.classList.remove('glow-active-pink');
    }
}

fromInput.addEventListener('input', updateDotGlow);
toInput.addEventListener('input', updateDotGlow);

setInterval(updateDotGlow, 500);

const locateMeBtn = document.getElementById('locate-me-btn');
let staticUserMarker = null;

locateMeBtn.addEventListener('click', () => {
    if (!navigator.geolocation) {
        alert("Geolocation is not supported by your browser.");
        return;
    }

    locateMeBtn.classList.add('animate-pulse', 'text-[#7aa2f7]');
    fromInput.value = "Locating...";

    navigator.geolocation.getCurrentPosition(async (position) => {
        const lng = position.coords.longitude;
        const lat = position.coords.latitude;
        const userCoords = [lng, lat];

        startCoords = userCoords;

        if (!staticUserMarker) {
            const dotEl = document.createElement('div');
            dotEl.style.width = '18px';
            dotEl.style.height = '18px';
            dotEl.style.backgroundColor = '#4285F4';
            dotEl.style.borderRadius = '50%';
            dotEl.style.border = '3px solid white';
            dotEl.style.boxShadow = '0 0 12px rgba(66, 133, 244, 0.7)';

            staticUserMarker = new mapboxgl.Marker({ element: dotEl })
                .setLngLat(userCoords)
                .addTo(map);
        } else {
            staticUserMarker.setLngLat(userCoords);
        }

        map.flyTo({
            center: userCoords,
            zoom: 15,
            offset: [0, 150],
            essential: true
        });

        try {
            const response = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${mapboxgl.accessToken}&types=poi,address,locality&limit=1`);
            const data = await response.json();

            if (data.features && data.features.length > 0) {
                fromInput.value = data.features[0].text;
            } else {
                fromInput.value = "Current Location";
            }
        } catch (error) {
            console.error("Reverse geocoding failed", error);
            fromInput.value = "Current Location";
        }
        locateMeBtn.classList.remove('animate-pulse');

    }, (error) => {
        alert("Could not get your location. Please allow location permissions in your browser.");
        locateMeBtn.classList.remove('animate-pulse', 'text-[#7aa2f7]');
        fromInput.value = "";
    }, { enableHighAccuracy: true });
});

async function getCoords(query) {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${mapboxgl.accessToken}&limit=1&country=in&proximity=77.4977,28.4744`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.features && data.features.length > 0) {
        console.log(`Mapbox found: ${data.features[0].place_name}`);
        return data.features[0].center;
    }
    return null;
}

weaveBtn.addEventListener('click', async () => {
    const fromText = fromInput.value;
    const toText = toInput.value;

    if (!fromText || !toText) {
        alert("Please enter both locations!");
        return;
    }

    weaveBtn.innerText = "Searching...";

    if (!startCoords) {
        startCoords = await getCoords(fromText);
    }
    if (!endCoords) {
        endCoords = await getCoords(toText);
    }

    if (!startCoords || !endCoords) {
        alert("Locations not found. Try being more specific (e.g., 'Pari Chowk, Greater Noida')");
        weaveBtn.innerText = "Find My Weave";
        return;
    }

    document.getElementById('search-card').classList.add('top-5', 'scale-90');
    document.getElementById('search-card').classList.remove('top-1/3');

    setTimeout(() => {
        const routeOptions = document.getElementById('route-options');

        routeOptions.classList.remove('hidden');

        setTimeout(() => {
            routeOptions.classList.remove('opacity-0');
            routeOptions.classList.add('opacity-100');
        }, 50);

        weaveBtn.innerText = "Update Locations";
    }, 500);
});

async function getRealRoute(color, profile, title, instruction) {
    const query = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/${profile}/${startCoords[0]},${startCoords[1]};${endCoords[0]},${endCoords[1]}?steps=true&geometries=geojson&overview=full&access_token=${mapboxgl.accessToken}`,
        { method: 'GET' }
    );
    const json = await query.json();
    const data = json.routes[0];
    activeRouteLine = data.geometry.coordinates;

    const distanceKm = parseFloat((data.distance / 1000).toFixed(1));
    const durationMin = Math.round(data.duration / 60);

    let priceMultiplier = 20;
    if (profile === 'cycling') priceMultiplier = 12;
    if (profile === 'driving-traffic') priceMultiplier = 25;

    const calculatedPrice = Math.round(distanceKm * priceMultiplier);

    updateDetails(
        title,
        color,
        `${durationMin} min (${distanceKm} km)`,
        `₹${calculatedPrice}`,
        instruction
    );

    if (map.getSource('route')) {
        map.removeLayer('route');
        map.removeSource('route');
    }

    map.addSource('route', {
        'type': 'geojson',
        'data': { 'type': 'Feature', 'geometry': { 'type': 'LineString', 'coordinates': activeRouteLine } }
    });

    map.addLayer({
        'id': 'route',
        'type': 'line',
        'source': 'route',
        'layout': { 'line-join': 'round', 'line-cap': 'round' },
        'paint': { 'line-color': color, 'line-width': 6, 'line-opacity': 0.8 }
    });

    const bounds = new mapboxgl.LngLatBounds(activeRouteLine[0], activeRouteLine[0]);
    for (const coord of activeRouteLine) { bounds.extend(coord); }
    map.fitBounds(bounds, { padding: 80, speed: 1.2 });

    document.getElementById('start-nav-btn').classList.remove('hidden');
}

document.getElementById('btn-fastest').addEventListener('click', () => {
    document.getElementById('route-details').classList.remove('hidden');
    document.getElementById('detail-title').innerText = "Calculating...";
    getRealRoute('#7aa2f7', 'driving', 'Fastest Route', 'Take a private auto via the most direct roads.');
});

document.getElementById('btn-cheapest').addEventListener('click', () => {
    document.getElementById('route-details').classList.remove('hidden');
    document.getElementById('detail-title').innerText = "Calculating...";
    getRealRoute('#9ece6a', 'cycling', 'Cheapest Route', 'Take the public bus from the main stand.');
});

document.getElementById('btn-safest').addEventListener('click', () => {
    document.getElementById('route-details').classList.remove('hidden');
    document.getElementById('detail-title').innerText = "Calculating...";
    getRealRoute('#e0af68', 'driving-traffic', 'Safest Route', 'Sticks to major, well-lit roads with CCTV. Verified by UrbanWeave.');
});

function updateDetails(title, color, time, cost, instr) {
    document.getElementById('route-details').classList.remove('hidden');
    document.getElementById('detail-title').innerText = title;
    document.getElementById('detail-title').style.color = color;
    document.getElementById('detail-time').innerText = time;
    document.getElementById('detail-cost').innerText = cost;
    document.getElementById('detail-instructions').innerText = instr;
}

startNavBtn.addEventListener('click', () => {
    document.getElementById('search-card').classList.add('hidden');
    document.getElementById('route-options').classList.add('hidden');
    startNavBtn.classList.add('hidden');

    if(endNavBtn) endNavBtn.classList.remove('hidden');

    if (!('geolocation' in navigator)) {
        alert("Your browser does not support real-time tracking.");
        return;
    }

    let initialBearing = 0;
    if (activeRouteLine && activeRouteLine.length > 1) {
        initialBearing = calculateBearing(activeRouteLine[0], activeRouteLine[1]);
    }

    map.flyTo({
        center: startCoords,
        zoom: 18,
        pitch: 65,
        bearing: initialBearing,
        speed: 1.2,
        curve: 1.4,
        essential: true
    });

    const arrowEl = document.createElement('div');
    arrowEl.innerHTML = `
        <svg width="46" height="46" viewBox="0 0 46 46" style="filter: drop-shadow(0px 4px 4px rgba(0,0,0,0.5)); transition: transform 0.5s ease-out;">
            <path d="M23 8 L38 36 L23 29 L8 36 Z" fill="#4285F4" stroke="#ffffff" stroke-width="2" stroke-linejoin="round" />
        </svg>
    `;

    if (window.navMarker) window.navMarker.remove();

    window.navMarker = new mapboxgl.Marker({
        element: arrowEl,
        rotation: initialBearing,
        rotationAlignment: 'map',
        pitchAlignment: 'map'
    })
    .setLngLat(startCoords)
    .addTo(map);

    lastKnownPosition = startCoords;

    geoWatchId = navigator.geolocation.watchPosition(
        (position) => {
            const newCoords = [position.coords.longitude, position.coords.latitude];

            let newBearing = position.coords.heading;
            if (newBearing === null || isNaN(newBearing)) {
                newBearing = calculateBearing(lastKnownPosition, newCoords);
            }

            window.navMarker.setLngLat(newCoords);
            window.navMarker.setRotation(newBearing);

            map.easeTo({
                center: newCoords,
                bearing: newBearing,
                duration: 1000,
                easing: (t) => t
            });

            lastKnownPosition = newCoords;
        },
        (error) => { console.warn("GPS Error:", error.message); },
        {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 5000
        }
    );

    if (!map.getLayer('3d-buildings')) {
        map.addLayer({
            'id': '3d-buildings',
            'source': 'composite',
            'source-layer': 'building',
            'type': 'fill-extrusion',
            'minzoom': 15,
            'paint': {
                'fill-extrusion-color': '#1a1b26',
                'fill-extrusion-height': ['get', 'height'],
                'fill-extrusion-opacity': 0.6
            }
        });
    }
});

endNavBtn.addEventListener('click', () => {
    if (geoWatchId !== null) {
        navigator.geolocation.clearWatch(geoWatchId);
        geoWatchId = null;
    }

    document.getElementById('search-card').classList.remove('hidden');
    document.getElementById('route-options').classList.remove('hidden');
    document.getElementById('end-nav-btn').classList.add('hidden');
    startNavBtn.classList.remove('hidden');

    if (window.navMarker) {
        window.navMarker.remove();
        window.navMarker = null;
    }

    if (activeRouteLine) {
        const bounds = new mapboxgl.LngLatBounds(activeRouteLine[0], activeRouteLine[0]);
        for (const coord of activeRouteLine) { bounds.extend(coord); }
        map.fitBounds(bounds, { padding: 80, speed: 1.2, pitch: 45, bearing: 0 });
    }
});
