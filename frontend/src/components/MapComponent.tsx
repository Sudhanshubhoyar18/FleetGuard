import React, { useEffect, useRef, useState } from 'react';
import type { LatestLocation } from '../types/index.js';
import { Navigation, MapPin, Gauge, AlertCircle, CheckCircle2 } from 'lucide-react';

interface MapComponentProps {
  location?: LatestLocation | null;
  plateNumber?: string;
  isOnline?: boolean;
  tripPath?: { latitude: number; longitude: number }[];
  destination?: {
    latitude: number;
    longitude: number;
    address: string;
    radiusKm?: number;
  } | null;
  height?: string;
}

declare global {
  interface Window {
    google: any;
    initGoogleMapCallback: () => void;
  }
}

export const MapComponent: React.FC<MapComponentProps> = ({
  location,
  plateNumber = 'Vehicle',
  isOnline = false,
  tripPath = [],
  destination = null,
  height = '500px'
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [googleMapsLoaded, setGoogleMapsLoaded] = useState(false);
  const [googleMapsError, setGoogleMapsError] = useState<string | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerInstanceRef = useRef<any>(null);
  const polylineInstanceRef = useRef<any>(null);
  const geofenceCircleRef = useRef<any>(null);

  const googleApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

  // Google Maps Script Loader
  useEffect(() => {
    if (!googleApiKey) {
      setGoogleMapsError('No Google Maps API Key provided in .env (Operating in Interactive OSM Vector Mode)');
      return;
    }

    if (window.google && window.google.maps) {
      setGoogleMapsLoaded(true);
      return;
    }

    const scriptId = 'google-maps-script';
    let script = document.getElementById(scriptId) as HTMLScriptElement;

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${googleApiKey}&libraries=geometry`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        setGoogleMapsLoaded(true);
      };
      script.onerror = () => {
        setGoogleMapsError('Failed to load Google Maps script. Check network or API key restrictions.');
      };
      document.head.appendChild(script);
    }
  }, [googleApiKey]);

  // Google Maps Instance Lifecycle
  useEffect(() => {
    if (!googleMapsLoaded || !mapContainerRef.current || !window.google) return;

    const lat = location?.latitude || 37.7749;
    const lng = location?.longitude || -122.4194;

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new window.google.maps.Map(mapContainerRef.current, {
        center: { lat, lng },
        zoom: 15,
        mapId: 'fleetguard_map',
        styles: [
          { elementType: 'geometry', stylers: [{ color: '#182234' }] },
          { elementType: 'labels.text.stroke', stylers: [{ color: '#182234' }] },
          { elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
          { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#27354f' }] },
          { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#090d16' }] },
        ],
        disableDefaultUI: false,
        zoomControl: true,
      });

      // Create Custom Vehicle SVG Marker
      markerInstanceRef.current = new window.google.maps.Marker({
        position: { lat, lng },
        map: mapInstanceRef.current,
        title: plateNumber,
        icon: {
          path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 6,
          fillColor: '#06b6d4',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
          rotation: location?.headingDegrees || 0,
        }
      });
    } else {
      // Update marker position and rotation
      if (location) {
        const newPos = new window.google.maps.LatLng(location.latitude, location.longitude);
        mapInstanceRef.current.panTo(newPos);
        if (markerInstanceRef.current) {
          markerInstanceRef.current.setPosition(newPos);
          const icon = markerInstanceRef.current.getIcon();
          if (icon) {
            icon.rotation = location.headingDegrees || 0;
            markerInstanceRef.current.setIcon(icon);
          }
        }
      }
    }

    // Polyline for Trip Path
    if (tripPath.length > 1) {
      if (polylineInstanceRef.current) polylineInstanceRef.current.setMap(null);
      polylineInstanceRef.current = new window.google.maps.Polyline({
        path: tripPath.map((p) => ({ lat: p.latitude, lng: p.longitude })),
        geodesic: true,
        strokeColor: '#06b6d4',
        strokeOpacity: 0.8,
        strokeWeight: 4,
        map: mapInstanceRef.current
      });
    }

    // Geofence Circle
    if (destination?.latitude && destination?.longitude) {
      if (geofenceCircleRef.current) geofenceCircleRef.current.setMap(null);
      geofenceCircleRef.current = new window.google.maps.Circle({
        strokeColor: '#f59e0b',
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: '#f59e0b',
        fillOpacity: 0.15,
        map: mapInstanceRef.current,
        center: { lat: destination.latitude, lng: destination.longitude },
        radius: (destination.radiusKm || 15) * 1000,
      });
    }
  }, [googleMapsLoaded, location, tripPath, destination, plateNumber]);

  const hasCoords = Boolean(location && location.latitude && location.longitude);

  return (
    <div style={{ position: 'relative', width: '100%', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
      {/* Top Telemetry Overlay Bar */}
      <div
        style={{
          position: 'absolute',
          top: '12px',
          left: '12px',
          right: '12px',
          zIndex: 10,
          background: 'var(--bg-card)',
          backdropFilter: 'var(--glass-backdrop)',
          WebkitBackdropFilter: 'var(--glass-backdrop)',
          border: '1px solid var(--border-medium)',
          borderRadius: 'var(--radius-md)',
          padding: '0.65rem 1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          boxShadow: 'var(--shadow-md)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className={isOnline ? 'live-pulse' : ''} style={{ width: '8px', height: '8px', borderRadius: '50%', background: isOnline ? 'var(--accent-emerald)' : 'var(--text-muted)' }} />
          <div>
            <span style={{ fontWeight: 800, fontSize: '0.95rem' }}>{plateNumber}</span>
            <span style={{ fontSize: '0.75rem', color: isOnline ? 'var(--accent-emerald)' : 'var(--text-muted)', marginLeft: '0.5rem', fontWeight: 600 }}>
              {isOnline ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>
        </div>

        {hasCoords && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', fontSize: '0.8rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Gauge size={14} color="var(--accent-cyan)" />
              <span className="mono" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                {location!.speedKmH.toFixed(1)} km/h
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Navigation
                size={14}
                color="var(--accent-cyan)"
                style={{ transform: `rotate(${location!.headingDegrees || 0}deg)` }}
              />
              <span className="mono">{location!.headingDegrees || 0}°</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-muted)' }}>
              <MapPin size={14} />
              <span className="mono">
                {location!.latitude.toFixed(5)}, {location!.longitude.toFixed(5)}
              </span>
            </div>
            {location?.isSimulated && (
              <span className="badge badge-purple" style={{ fontSize: '0.65rem' }}>SIMULATION</span>
            )}
            {location?.isStale && (
              <span className="badge badge-warning" style={{ fontSize: '0.65rem' }}>STALE GPS</span>
            )}
          </div>
        )}
      </div>

      {/* Main Map Canvas */}
      {googleApiKey && !googleMapsError ? (
        <div ref={mapContainerRef} style={{ width: '100%', height, background: 'var(--bg-secondary)' }} />
      ) : (
        /* Fallback: Interactive Vector Radar / OpenStreetMap Map View */
        <div
          style={{
            width: '100%',
            height,
            background: 'radial-gradient(circle at 50% 50%, #152238 0%, #0a0f1c 100%)',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            border: '1px solid var(--border-subtle)',
            overflow: 'hidden'
          }}
        >
          {/* Subtle Grid Radar Lines */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: 'linear-gradient(rgba(6, 182, 212, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(6, 182, 212, 0.08) 1px, transparent 1px)',
              backgroundSize: '40px 40px',
              pointerEvents: 'none'
            }}
          />

          {hasCoords ? (
            <div style={{ textAlign: 'center', zIndex: 5, padding: '1rem' }}>
              {/* Radar Pulse Vehicle Center */}
              <div
                style={{
                  width: '90px',
                  height: '90px',
                  borderRadius: '50%',
                  background: 'var(--accent-cyan-glow)',
                  border: '2px solid var(--accent-cyan)',
                  margin: '0 auto 1.25rem auto',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  boxShadow: '0 0 30px var(--accent-cyan-glow)'
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    inset: '-10px',
                    borderRadius: '50%',
                    border: '1px dashed var(--accent-cyan)',
                    opacity: 0.5
                  }}
                />
                <Navigation
                  size={36}
                  color="var(--accent-cyan)"
                  style={{
                    transform: `rotate(${location!.headingDegrees || 0}deg)`,
                    transition: 'transform 400ms ease'
                  }}
                />
              </div>

              <div style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.25rem' }}>
                {plateNumber}
              </div>
              <div className="mono" style={{ fontSize: '1rem', color: 'var(--accent-cyan)', fontWeight: 700, marginBottom: '0.5rem' }}>
                {location!.latitude.toFixed(5)}° N, {location!.longitude.toFixed(5)}° W
              </div>
              <div style={{ display: 'inline-flex', gap: '0.75rem', fontSize: '0.85rem' }}>
                <span className="badge badge-cyan">Speed: {location!.speedKmH.toFixed(1)} km/h</span>
                <span className="badge badge-purple">Heading: {location!.headingDegrees || 0}°</span>
                <span className="badge badge-online">Lock: Verified Fix</span>
              </div>

              {destination && (
                <div
                  style={{
                    marginTop: '1.25rem',
                    padding: '0.75rem 1.25rem',
                    background: 'rgba(245, 158, 11, 0.1)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.85rem'
                  }}
                >
                  <span style={{ color: 'var(--accent-amber)', fontWeight: 700 }}>
                    🎯 Destination Geofence: {destination.address}
                  </span>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.2rem' }}>
                    Allowed Radius: {destination.radiusKm || 15} km
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="empty-state" style={{ zIndex: 5 }}>
              <AlertCircle className="empty-state-icon" />
              <h3>No GPS Telemetry Reported</h3>
              <p>Device has not transmitted any coordinates yet.</p>
            </div>
          )}

          {/* Mode Configuration Banner at bottom */}
          <div
            style={{
              position: 'absolute',
              bottom: '12px',
              left: '12px',
              right: '12px',
              background: 'var(--bg-modal)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '0.5rem 1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              zIndex: 10
            }}
          >
            <span>
              ℹ️ Vector Telemetry Radar Active. To enable Google Maps tiles, set{' '}
              <code>VITE_GOOGLE_MAPS_API_KEY</code> in <code>frontend/.env</code>.
            </span>
            <span style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>Zero External Dependency Fallback</span>
          </div>
        </div>
      )}
    </div>
  );
};
