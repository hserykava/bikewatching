import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

mapboxgl.accessToken = 'pk.eyJ1IjoiaHNlcnlrYXZhIiwiYSI6ImNtYXJvMTE3MTBkYzEyd29udjNxYzhvNjEifQ.ekPmWTBdoI9PhiAS5hkQRw';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v12',
  center: [-71.09415, 42.36027],
  zoom: 12,
  minZoom: 5,
  maxZoom: 18
});

let stations = [];
let trips = [];
let circles;
let radiusScale;

let timeFilter = -1;
let departuresByMinute = Array.from({ length: 1440 }, () => []);
let arrivalsByMinute = Array.from({ length: 1440 }, () => []);

const timeSlider = document.getElementById('timeSlider');
const selectedTime = document.getElementById('timeValue');
const anyTimeLabel = document.getElementById('anyTime');
const stationFlow = d3.scaleQuantize().domain([0, 1]).range([0, 0.5, 1]);

function formatTime(minutes) {
  const date = new Date(0, 0, 0, 0, minutes);
  return date.toLocaleTimeString('en-US', { timeStyle: 'short' });
}

function minutesSinceMidnight(date) {
  return date.getHours() * 60 + date.getMinutes();
}

function filterByMinute(tripsByMinute, minute) {
  if (minute === -1) return tripsByMinute.flat();

  let minMinute = (minute - 60 + 1440) % 1440;
  let maxMinute = (minute + 60) % 1440;

  if (minMinute > maxMinute) {
    return tripsByMinute.slice(minMinute).flat().concat(tripsByMinute.slice(0, maxMinute).flat());
  } else {
    return tripsByMinute.slice(minMinute, maxMinute).flat();
  }
}

function computeStationTraffic(stations, timeFilter = -1) {
  const filteredDepartures = filterByMinute(departuresByMinute, timeFilter);
  const filteredArrivals = filterByMinute(arrivalsByMinute, timeFilter);

  const departures = d3.rollup(
    filteredDepartures,
    v => v.length,
    d => d.start_station_id
  );
  const arrivals = d3.rollup(
    filteredArrivals,
    v => v.length,
    d => d.end_station_id
  );

  return stations.map(station => {
    const id = station.short_name;
    station.arrivals = arrivals.get(id) ?? 0;
    station.departures = departures.get(id) ?? 0;
    station.totalTraffic = station.arrivals + station.departures;
    return station;
  });
}

function getCoords(station) {
  const point = new mapboxgl.LngLat(+station.lon, +station.lat);
  const { x, y } = map.project(point);
  return { cx: x, cy: y };
}

function updatePositions() {
  circles
    .attr('cx', d => getCoords(d).cx)
    .attr('cy', d => getCoords(d).cy);
}

function updateScatterPlot(timeFilter) {
  const filteredStations = computeStationTraffic(stations, timeFilter);

  if (timeFilter === -1) {
    radiusScale.range([0, 25]);
  } else {
    radiusScale.range([3, 50]);
  }

  circles = d3.select('#map')
    .select('svg')
    .selectAll('circle')
    .data(filteredStations, d => d.short_name)
    .join(
      enter => enter.append('circle')
        .attr('stroke', 'white')
        .attr('stroke-width', 1)
        .attr('opacity', 0.6)
        .append('title'),
      update => update,
      exit => exit.remove()
    )
    .attr('r', d => radiusScale(d.totalTraffic))
    .style('--departure-ratio', d => {
      const ratio = d.totalTraffic === 0 ? 0.5 : d.departures / d.totalTraffic;
      return stationFlow(ratio);
    })
    .each(function (d) {
      let title = d3.select(this).select('title');
      if (title.empty()) {
        title = d3.select(this).append('title');
      }
      title.text(`${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`);
    });

  updatePositions();
}

function updateTimeDisplay() {
  timeFilter = +timeSlider.value;
  if (timeFilter === -1) {
    selectedTime.textContent = '';
    anyTimeLabel.style.display = 'block';
  } else {
    selectedTime.textContent = formatTime(timeFilter);
    anyTimeLabel.style.display = 'none';
  }
  updateScatterPlot(timeFilter);
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
    const [stationJson, tripCsv] = await Promise.all([
      d3.json('https://dsc106.com/labs/lab07/data/bluebikes-stations.json'),
      d3.csv('https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv', d => {
        d.started_at = new Date(d.started_at);
        d.ended_at = new Date(d.ended_at);

        const startMin = minutesSinceMidnight(d.started_at);
        const endMin = minutesSinceMidnight(d.ended_at);

        departuresByMinute[startMin].push(d);
        arrivalsByMinute[endMin].push(d);

        return d;
      })
    ]);

    stations = stationJson.data.stations;

    stations = computeStationTraffic(stations, timeFilter);

    radiusScale = d3.scaleSqrt()
      .domain([0, d3.max(stations, d => d.totalTraffic)])
      .range([0, 25]);

    const svg = d3.select('#map').select('svg');
    circles = svg
      .selectAll('circle')
      .data(stations, d => d.short_name)
      .enter()
      .append('circle')
      .attr('r', d => radiusScale(d.totalTraffic))
      .attr('stroke', 'white')
      .attr('stroke-width', 1)
      .attr('opacity', 0.6)
      .style('--departure-ratio', d => {
        const ratio = d.totalTraffic === 0 ? 0.5 : d.departures / d.totalTraffic;
        return stationFlow(ratio);
      })
      .each(function (d) {
        d3.select(this)
          .append('title')
          .text(`${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`);
      });

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
