import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { UserProvider } from './context/UserContext.tsx';
import { AudioContextProvider } from './context/AudioContextProvider.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <UserProvider>
      <AudioContextProvider>
        <App />
      </AudioContextProvider>
    </UserProvider>
  </StrictMode>
);
