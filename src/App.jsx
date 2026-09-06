import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import ViewerPage from './pages/ViewerPage';
import AdminPage from './pages/AdminPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<ViewerPage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
