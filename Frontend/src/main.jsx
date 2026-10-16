import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ClerkProvider } from '@clerk/clerk-react';
import './index.css';
import App from './App.jsx';
import { CurrentUserProvider } from './context/CurrentUserContext.jsx';
import { SocketProvider } from './context/SocketContext.jsx';
import { NotificationsProvider } from './context/NotificationsContext.jsx';

export const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error('Missing Publishable Key');
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <BrowserRouter>
        <CurrentUserProvider>
          <SocketProvider>
            <NotificationsProvider>
              <App />
            </NotificationsProvider>
          </SocketProvider>
        </CurrentUserProvider>
      </BrowserRouter>
    </ClerkProvider>
  </StrictMode>
);
