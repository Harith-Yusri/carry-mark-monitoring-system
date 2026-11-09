import { LoadingState } from "../components/StaffDataState";
import React, { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { DarkModeProvider } from "../context/DarkModeContext";
import { AuthProvider } from "../context/AuthContext";
import { WebLogin } from "../features/auth/WebLogin";
import { ProtectedRoute } from "../components/ProtectedRoute";

const PortalLayout = lazy(() => import("../layouts/PortalLayout").then((module) => ({ default: module.PortalLayout })));
const WebRegister = lazy(() => import("../features/auth/WebRegister").then((module) => ({ default: module.WebRegister })));
const LecturerWebPortal = lazy(() => import("../features/lecturer/LecturerWebPortal").then((module) => ({ default: module.LecturerWebPortal })));
const AdminWebPortal = lazy(() => import("../features/admin/AdminWebPortal").then((module) => ({ default: module.AdminWebPortal })));

function RouteFallback() {
  return (
    <div role="status" aria-live="polite" style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <LoadingState label="Loading CAMS…" />
    </div>
  );
}

function MainApp() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<WebLogin />} />
          <Route path="/register" element={<WebRegister />} />
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="/lecturer/login" element={<Navigate to="/" replace />} />
          <Route path="/admin/login" element={<Navigate to="/" replace />} />

          {/* Protected Lecturer Routes */}
          <Route
            path="/lecturer"
            element={
              <ProtectedRoute allowedRole="lecturer">
                <PortalLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/lecturer/dashboard" replace />} />
            <Route path="dashboard" element={<LecturerWebPortal />} />
          </Route>

          {/* Protected Admin Routes */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRole="admin">
                <PortalLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<AdminWebPortal />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <DarkModeProvider>
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </DarkModeProvider>
  );
}
