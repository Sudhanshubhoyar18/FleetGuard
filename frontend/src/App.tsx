import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar.js';
import { Sidebar } from './components/Sidebar.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { LiveTrackingPage } from './pages/LiveTrackingPage.js';
import { VehiclesPage } from './pages/VehiclesPage.js';
import { VehicleDetailPage } from './pages/VehicleDetailPage.js';
import { DevicesPage } from './pages/DevicesPage.js';
import { TripsPage } from './pages/TripsPage.js';
import { RentalsPage } from './pages/RentalsPage.js';
import { AlertsPage } from './pages/AlertsPage.js';
import { HistoryPage } from './pages/HistoryPage.js';
import { ImmobilizerPage } from './pages/ImmobilizerPage.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { wsClient } from './services/websocket.js';

export const App: React.FC = () => {
  const [currentPath, setCurrentPath] = useState<string>('/');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);

  useEffect(() => {
    // Establish WebSocket connection on app startup
    wsClient.connect();

    return () => {
      wsClient.close();
    };
  }, []);

  const handleNavigate = (path: string, param?: string) => {
    setCurrentPath(path);
    if (param) {
      setSelectedVehicleId(param);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderCurrentPage = () => {
    if (currentPath === '/vehicle-detail' && selectedVehicleId) {
      return (
        <VehicleDetailPage
          vehicleId={selectedVehicleId}
          onBack={() => handleNavigate('/vehicles')}
          onNavigateToImmobilizer={() => handleNavigate('/immobilizer')}
        />
      );
    }

    switch (currentPath) {
      case '/':
        return <DashboardPage onNavigate={handleNavigate} />;
      case '/tracking':
        return <LiveTrackingPage />;
      case '/vehicles':
        return (
          <VehiclesPage
            onSelectVehicle={(id) => handleNavigate('/vehicle-detail', id)}
          />
        );
      case '/devices':
        return <DevicesPage />;
      case '/trips':
        return <TripsPage />;
      case '/rentals':
        return <RentalsPage />;
      case '/alerts':
        return <AlertsPage />;
      case '/history':
        return <HistoryPage />;
      case '/immobilizer':
        return <ImmobilizerPage />;
      case '/settings':
        return <SettingsPage />;
      default:
        return <DashboardPage onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className="app-container">
      <Sidebar currentPath={currentPath} onNavigate={handleNavigate} />
      <div className="main-content">
        <Navbar />
        <main>{renderCurrentPage()}</main>
      </div>
    </div>
  );
};

export default App;
