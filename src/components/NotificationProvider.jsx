import React, { createContext, useContext, useState, useCallback } from 'react';
import { Snackbar, Alert } from '@mui/material';

const NotificationContext = createContext(null);

export const useNotification = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }) => {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState('');
  const [severity, setSeverity] = useState('info');

  const notify = useCallback((message, sev = 'info', duration = 4000) => {
    setMsg(message);
    setSeverity(sev);
    setOpen(true);
    if (duration > 0) setTimeout(() => setOpen(false), duration);
  }, []);

  return (
    <NotificationContext.Provider value={{ notify }}>
      {children}
      <Snackbar
        open={open}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        onClose={() => setOpen(false)}
        sx={{ top: '64px' }}
      >
        <Alert severity={severity} variant="filled" sx={{ width: '100%' }}>{msg}</Alert>
      </Snackbar>
    </NotificationContext.Provider>
  );
};
