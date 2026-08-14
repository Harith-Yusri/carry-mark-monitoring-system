import React from "react";
import { Navigate } from "react-router";
import { useAuth } from "../context/AuthContext";
import { Role } from "../types";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRole: Role;
}

export function ProtectedRoute({ children, allowedRole }: ProtectedRouteProps) {
  const { user } = useAuth();

  if (!user) {
    // Not logged in
    return <Navigate to={`/${allowedRole}/login`} replace />;
  }

  if (user.role !== allowedRole) {
    // Logged in but wrong role (e.g. lecturer trying to access admin)
    // Redirect them to their own dashboard
    return <Navigate to={`/${user.role}/dashboard`} replace />;
  }

  return <>{children}</>;
}
