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

  let jsonData;
  try {
    const stationUrl = 'https://dsc106.com/labs/lab07/data/bluebikes-stations.json';
    const json = await d3.json(stationUrl);
    jsonData = json;
    const svg = d3.select('#map').select('svg');

    const stations = jsonData.data.stations;
    console.log('Stations Array:', stations);

    function getCoords(station) {
      const point = new mapboxgl.LngLat(+station.lon, +station.lat);
      const { x, y } = map.project(point);
      return { cx: x, cy: y };
    }

    const trafficUrl = 'https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv';
    const trips = await d3.csv(trafficUrl);

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

    const enrichedStations = stations.map(station => {
      const id = station.short_name;
      station.arrivals = arrivals.get(id) ?? 0;
      station.departures = departures.get(id) ?? 0;
      station.totalTraffic = station.arrivals + station.departures;
      return station;
    });

    console.log('Enriched Stations:', enrichedStations);
  } catch (error) {
    console.error('Error loading JSON or CSV:', error);
  }
});
