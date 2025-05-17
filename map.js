import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';
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
