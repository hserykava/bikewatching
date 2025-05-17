import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

console.log('Mapbox GL JS Loaded:', mapboxgl);
mapboxgl.accessToken = 'pk.eyJ1IjoiaHNlcnlrYXZhIiwiYSI6ImNtYXJvMTE3MTBkYzEyd29udjNxYzhvNjEifQ.ekPmWTBdoI9PhiAS5hkQRw';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v12',
  center: [-71.09415, 42.36027],
  zoom: 12,
  minZoom: 5,
  maxZoom: 18
});
const timeSlider = document.getElementById('timeSlider');
const selectedTime = document.getElementById('timeValue');
const anyTimeLabel = document.getElementById('anyTime');
let timeFilter = -1;

function formatTime(minutes) {
  const date = new Date(0, 0, 0, 0, minutes);
  return date.toLocaleString('en-US', { timeStyle: 'short' });
}

function updateTimeDisplay() {
  timeFilter = Number(timeSlider.value);

  if (timeFilter === -1) {
    selectedTime.textContent = '';
    anyTimeLabel.style.display = 'block';
  } else {
    selectedTime.textContent = formatTime(timeFilter);
    anyTimeLabel.style.display = 'none';
  }
}
let circles;

function getCoords(station) {
  const point = new mapboxgl.LngLat(+station.lon, +station.lat);
  const { x, y } = map.project(point);
  return { cx: x, cy: y };
}

map.on('load', async () => {
  map.addSource('boston_route', {
    type: 'geojson',
    data: 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson',
  });

  map.addLayer({
    id: 'bike-lanes',
    type: 'line',
    source: 'boston_route',
    paint: {
      'line-color': '#FFB6C1',
      'line-width': 5,
      'line-opacity': 0.6
    },
  });

  map.addSource('cambridge_route', {
    type: 'geojson',
    data: 'https://raw.githubusercontent.com/cambridgegis/cambridgegis_data/main/Recreation/Bike_Facilities/RECREATION_BikeFacilities.geojson',
  });

  map.addLayer({
    id: 'cambridge-bike-lanes',
    type: 'line',
    source: 'cambridge_route',
    paint: {
      'line-color': '#FFB6C1',
      'line-width': 5,
      'line-opacity': 0.6
    },
  });

  try {
    const [stationsJson, tripsCsv] = await Promise.all([
      d3.json('https://dsc106.com/labs/lab07/data/bluebikes-stations.json'),
      d3.csv('https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv')
    ]);

    let stations = stationsJson.data.stations;
    const trips = tripsCsv;

    const departures = d3.rollup(
      trips,
      v => v.length,
      d => d.start_station_id
    );

    const arrivals = d3.rollup(
      trips,
      v => v.length,
      d => d.end_station_id
    );

    stations = stations.map(station => {
      const id = station.short_name;
      station.arrivals = arrivals.get(id) ?? 0;
      station.departures = departures.get(id) ?? 0;
      station.totalTraffic = station.arrivals + station.departures;
      return station;
    });

    const radiusScale = d3.scaleSqrt()
      .domain([0, d3.max(stations, d => d.totalTraffic)])
      .range([0, 25]);

    const svg = d3.select('#map').select('svg');

    circles = svg
      .selectAll('circle')
      .data(stations)
      .enter()
      .append('circle')
      .attr('r', d => radiusScale(d.totalTraffic))
      .attr('fill', 'steelblue')
      .attr('stroke', 'white')
      .attr('stroke-width', 1)
      .attr('opacity', 0.6)
      .each(function (d) {
        d3.select(this)
          .append('title')
          .text(`${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`);
      });

    function updatePositions() {
      circles
        .attr('cx', d => getCoords(d).cx)
        .attr('cy', d => getCoords(d).cy);
    }

    updatePositions();
    map.on('move', updatePositions);
    map.on('zoom', updatePositions);
    map.on('resize', updatePositions);
    map.on('moveend', updatePositions);
    timeSlider.addEventListener('input', updateTimeDisplay);
    updateTimeDisplay();

  } catch (error) {
    console.error('Error loading data:', error);
  }
});
