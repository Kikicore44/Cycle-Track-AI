import { StrictMode, useEffect, useState } from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { AppProvider } from './AppContext.tsx';
import AdminApp from './admin/AdminApp.tsx';
import './index.css';

function Root() {
  const [isAdminPath, setIsAdminPath] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.location.pathname.startsWith('/admin');
  });

  useEffect(() => {
    const onPop = () => setIsAdminPath(window.location.pathname.startsWith('/admin'));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  if (isAdminPath) return <AdminApp />;

  return (
    <AppProvider>
      <App />
    </AppProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
