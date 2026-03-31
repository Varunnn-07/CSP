import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './router/router';
import { initSessionTimeout } from './utils/auth';

export default function App() {
  useEffect(() => {
    initSessionTimeout();
  }, []);

  return <RouterProvider router={router} />;
}
