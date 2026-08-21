import { Route, Routes } from 'react-router';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { StacksPage } from './pages/StacksPage';
import { StackPage } from './pages/StackPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/stacks" element={<StacksPage />} />
      <Route path="/stacks/:slug" element={<StackPage />} />
    </Routes>
  );
}
