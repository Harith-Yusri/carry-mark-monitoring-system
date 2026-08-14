import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { DarkModeProvider } from "../context/DarkModeContext";
import { AuthProvider } from "../context/AuthContext";
import { LandingPage } from "../pages/LandingPage";
import { PortalLayout } from "../layouts/PortalLayout";
import { LecturerLogin } from "../features/lecturer/LecturerLogin";
import { AdminLogin } from "../features/admin/AdminLogin";
import { LecturerWebPortal } from "../features/lecturer/LecturerWebPortal";
import { AdminWebPortal } from "../features/admin/AdminWebPortal";
import { ProtectedRoute } from "../components/ProtectedRoute";

function MainApp() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/lecturer/login" element={<LecturerLogin />} />
        <Route path="/admin/login" element={<AdminLogin />} />

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
