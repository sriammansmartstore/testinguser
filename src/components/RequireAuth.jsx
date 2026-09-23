import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

/**
 * RequireAuth - route wrapper that ensures the user is authenticated.
 * If auth state is still loading (undefined) it renders nothing/loader.
 * If not authenticated, redirects to /login preserving the intended location.
 */
const RequireAuth = ({ children }) => {
  const { user } = React.useContext(AuthContext) || {};
  const location = useLocation();

  // while auth initializing we may show nothing (or a spinner). AuthContext uses null as initial
  // value and will be null for unauthenticated; it's safe to treat undefined as loading
  if (user === undefined) return null;

  if (!user) {
    // redirect to login and preserve where the user wanted to go
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
};

export default RequireAuth;
