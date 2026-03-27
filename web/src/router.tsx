import React from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import * as api from './lib/api'
import { Shell } from './ui/Shell'
import { LoginPage } from './views/LoginPage'
import { RequestAccessPage } from './views/RequestAccessPage'
import { PublicQuickRequestPage } from './views/PublicQuickRequestPage'
import { PublicQuickRequestSuccessPage } from './views/PublicQuickRequestSuccessPage'
import { BoardPage } from './views/BoardPage'
import { TicketPage } from './views/TicketPage'
import { CreateTicketPage } from './views/CreateTicketPage'
import { EmployeesPage } from './views/EmployeesPage'
import { LocationsPage } from './views/LocationsPage'
import { AnalyticsPage } from './views/AnalyticsPage'
import { SettingsPage } from './views/SettingsPage'
import { ProblemCategoriesPage } from './views/ProblemCategoriesPage'
import { SpecializationsPage } from './views/SpecializationsPage'
import { CompanyPage } from './views/CompanyPage'
import { TechnicianPage } from './views/TechnicianPage'
import { CompaniesPage } from './views/CompaniesPage'
import { ServiceContractsPage } from './views/ServiceContractsPage'
import { MapPage } from './pages/MapPage'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = api.getToken()
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

export function AppRoutes() {
  const home = api.getHomeRoute()

  return (
    <Routes>
      <Route path="/" element={<Navigate to={api.getToken() ? home : '/login'} replace />} />
      <Route path="/login" element={api.getToken() ? <Navigate to={home} replace /> : <LoginPage />} />
      <Route path="/request-access" element={api.getToken() ? <Navigate to={home} replace /> : <RequestAccessPage />} />
      <Route path="/register" element={<Navigate to="/request-access" replace />} />
      <Route path="/r/:token" element={<PublicQuickRequestPage />} />
      <Route path="/r/:token/success" element={<PublicQuickRequestSuccessPage />} />

      <Route
        path="/"
        element={
          <RequireAuth>
            <Shell />
          </RequireAuth>
        }
      >
        <Route path="board" element={<BoardPage />} />
        <Route path="companies" element={<CompaniesPage />} />
        <Route path="service-contracts" element={<ServiceContractsPage />} />
        <Route path="tickets/new" element={<CreateTicketPage />} />
        <Route path="tickets/:id" element={<TicketPage />} />
        <Route path="locations" element={<LocationsPage />} />
        <Route path="employees" element={<EmployeesPage />} />
        <Route path="specializations" element={<SpecializationsPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="company" element={<CompanyPage />} />
        <Route path="technician" element={<TechnicianPage />} />
        <Route path="map" element={<MapPage />} />
        <Route path="problem-categories" element={<ProblemCategoriesPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}