import { Route, Routes } from 'react-router';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { StacksPage } from './pages/StacksPage';
import { StackPage } from './pages/StackPage';
import { CategoryPage } from './pages/CategoryPage';
import { EntryPage } from './pages/EntryPage';
import { AdminLayout } from './pages/admin/AdminLayout';
import { AdminPage } from './pages/admin/AdminPage';
import { AdminStacksPage } from './pages/admin/AdminStacksPage';
import { AdminStackNewPage } from './pages/admin/AdminStackNewPage';
import { AdminStackEditPage } from './pages/admin/AdminStackEditPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/stacks" element={<StacksPage />} />
      <Route path="/stacks/:slug" element={<StackPage />} />
      <Route path="/stacks/:stackSlug/:categorySlug" element={<CategoryPage />} />
      <Route path="/entries/:slug" element={<EntryPage />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminPage />} />
        <Route path="stacks" element={<AdminStacksPage />} />
        <Route path="stacks/new" element={<AdminStackNewPage />} />
        <Route path="stacks/:id/edit" element={<AdminStackEditPage />} />
      </Route>
    </Routes>
  );
}
