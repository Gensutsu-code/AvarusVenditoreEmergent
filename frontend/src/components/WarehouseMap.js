import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const DEFAULT_CENTER = [55.751, 37.618];
const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

const makePin = (color) => L.divIcon({
  className: '',
  html: `<div style="width:26px;height:26px;border-radius:50% 50% 50% 0;background:${color};transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)"></div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 26],
  popupAnchor: [0, -24],
});
const pin = makePin('#0d9488');
const pinActive = makePin('#f59e0b');

const round6 = (n) => Math.round(n * 1e6) / 1e6;
export const hasCoords = (w) => typeof w?.lat === 'number' && typeof w?.lng === 'number';

const Resizer = () => {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 250);
    return () => clearTimeout(t);
  }, [map]);
  return null;
};

const ClickHandler = ({ onPick }) => {
  useMapEvents({ click: (e) => onPick(round6(e.latlng.lat), round6(e.latlng.lng)) });
  return null;
};

// Admin: click on the map to set the warehouse point
export const LocationPicker = ({ lat, lng, onChange }) => {
  const has = typeof lat === 'number' && typeof lng === 'number';
  return (
    <div className="relative z-0 h-56 rounded-xl overflow-hidden border border-slate-200" data-testid="wh-location-picker">
      <MapContainer center={has ? [lat, lng] : DEFAULT_CENTER} zoom={has ? 13 : 4} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
        <TileLayer attribution={ATTR} url={TILE_URL} />
        <Resizer />
        <ClickHandler onPick={onChange} />
        {has && <Marker position={[lat, lng]} icon={pinActive} />}
      </MapContainer>
    </div>
  );
};

const FitBounds = ({ points, focus }) => {
  const map = useMap();
  const key = JSON.stringify(points);
  const fLat = focus?.[0];
  const fLng = focus?.[1];
  useEffect(() => {
    if (typeof fLat === 'number' && typeof fLng === 'number') { map.flyTo([fLat, fLng], 14, { duration: 0.6 }); return; }
    const pts = JSON.parse(key);
    if (!pts.length) return;
    if (pts.length === 1) map.setView(pts[0], 12);
    else map.fitBounds(pts, { padding: [40, 40] });
  }, [map, key, fLat, fLng]);
  return null;
};

// Client: all warehouses / pickup points on a map
export const WarehouseMap = ({ warehouses, activeId, onSelect }) => {
  const withCoords = (warehouses || []).filter(hasCoords);
  const points = withCoords.map((w) => [w.lat, w.lng]);
  const active = withCoords.find((w) => w.id === activeId);
  return (
    <div className="relative z-0 h-full w-full" data-testid="warehouses-map">
      <MapContainer center={DEFAULT_CENTER} zoom={4} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
        <TileLayer attribution={ATTR} url={TILE_URL} />
        <Resizer />
        <FitBounds points={points} focus={active ? [active.lat, active.lng] : null} />
        {withCoords.map((w) => (
          <Marker key={w.id} position={[w.lat, w.lng]} icon={w.id === activeId ? pinActive : pin} eventHandlers={{ click: () => onSelect && onSelect(w.id) }}>
            <Popup>
              <div className="text-sm">
                <b>{w.name}</b><br />
                <span>{w.region}</span>
                {w.address && <><br />{w.address}</>}
                {w.hours && <><br />{w.hours}</>}
                {w.phone && <><br />{w.phone}</>}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

export default WarehouseMap;
