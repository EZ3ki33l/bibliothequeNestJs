import { Navigate, Route, Routes } from 'react-router';
import { AppLayout } from './pages/AppLayout';
import { AuthLayout } from './pages/AuthLayout';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { StacksPage } from './pages/StacksPage';
import { StackPage } from './pages/StackPage';
import { CategoryPage } from './pages/CategoryPage';
import { EntryPage } from './pages/EntryPage';
import { ExamPage } from './pages/ExamPage';
import { ReviewPage } from './pages/ReviewPage';
import { FavoritesPage } from './pages/FavoritesPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { AdminLayout } from './pages/admin/AdminLayout';
import { AdminPage } from './pages/admin/AdminPage';
import { AdminStacksPage } from './pages/admin/AdminStacksPage';
import { AdminStackNewPage } from './pages/admin/AdminStackNewPage';
import { AdminStackEditPage } from './pages/admin/AdminStackEditPage';
import { AdminCategoriesPage } from './pages/admin/AdminCategoriesPage';
import { AdminCategoryNewPage } from './pages/admin/AdminCategoryNewPage';
import { AdminCategoryEditPage } from './pages/admin/AdminCategoryEditPage';
import { AdminEntriesPage } from './pages/admin/AdminEntriesPage';
import { AdminEntryNewPage } from './pages/admin/AdminEntryNewPage';
import { AdminEntryEditPage } from './pages/admin/AdminEntryEditPage';
import { HowItWorksPage } from './pages/HowItWorksPage';
import { LegalNoticePage } from './pages/LegalNoticePage';
import { TermsPage } from './pages/TermsPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { ContactPage } from './pages/ContactPage';
import { SearchPage } from './pages/SearchPage';
import { NotesPage } from './pages/NotesPage';
import { AccountPage } from './pages/AccountPage';
import { PathsPage } from './pages/PathsPage';
import { PathPage } from './pages/PathPage';
import { AdminPathsPage } from './pages/admin/AdminPathsPage';
import { AdminPathNewPage } from './pages/admin/AdminPathNewPage';
import { AdminPathEditPage } from './pages/admin/AdminPathEditPage';

/**
 * Table des routes de l'application.
 *
 * Une `<Route>` sans `path` mais avec un `element` est une **route de mise en
 * page** : elle n'ajoute rien à l'URL, elle enveloppe ses enfants (qui
 * s'affichent à l'emplacement de son `<Outlet />`).
 *
 * - `AppLayout` entoure tout : barre latérale et cadre général ;
 * - `AuthLayout` centre les écrans de connexion et d'inscription ;
 * - `AdminLayout` vérifie les droits avant d'afficher quoi que ce soit
 *   d'administration — la garde est donc écrite une fois pour les dix routes
 *   `/admin/*`, sans risque d'en oublier une.
 *
 * `path="*"` (catch-all) doit rester **en dernier** : React Router prend la
 * première correspondance. Placé trop tôt, il masquerait le catalogue.
 */
export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/a-propos" element={<HowItWorksPage />} />
        <Route path="/fonctionnement" element={<Navigate to="/a-propos" replace />} />
        <Route path="/comment-ca-marche" element={<Navigate to="/a-propos" replace />} />
        <Route path="/mentions-legales" element={<LegalNoticePage />} />
        <Route path="/cgu" element={<TermsPage />} />
        <Route path="/confidentialite" element={<PrivacyPage />} />
        <Route path="/contact" element={<ContactPage />} />

        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/mot-de-passe-oublie" element={<ForgotPasswordPage />} />
          <Route path="/reinitialiser-mot-de-passe" element={<ResetPasswordPage />} />
        </Route>

        {/* Catalogue public */}
        <Route path="/stacks" element={<StacksPage />} />
        <Route path="/stacks/:slug" element={<StackPage />} />
        <Route path="/stacks/:stackSlug/:categorySlug" element={<CategoryPage />} />
        <Route path="/recherche" element={<SearchPage />} />
        <Route path="/entries/:slug" element={<EntryPage />} />
        <Route path="/parcours" element={<PathsPage />} />
        <Route path="/parcours/:slug" element={<PathPage />} />

        {/* Apprentissage (session requise, vérifiée par les pages) */}
        <Route path="/entries/:slug/exam" element={<ExamPage />} />
        <Route path="/review" element={<ReviewPage />} />
        <Route path="/favoris" element={<FavoritesPage />} />
        <Route path="/notes" element={<NotesPage />} />
        <Route path="/compte" element={<AccountPage />} />

        {/* Administration. `index` = l'URL du parent exactement, ici `/admin`. */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminPage />} />
          <Route path="stacks" element={<AdminStacksPage />} />
          <Route path="stacks/new" element={<AdminStackNewPage />} />
          <Route path="stacks/:id/edit" element={<AdminStackEditPage />} />
          <Route path="categories" element={<AdminCategoriesPage />} />
          <Route path="categories/new" element={<AdminCategoryNewPage />} />
          <Route path="categories/:id/edit" element={<AdminCategoryEditPage />} />
          <Route path="entries" element={<AdminEntriesPage />} />
          <Route path="entries/new" element={<AdminEntryNewPage />} />
          <Route path="entries/:id/edit" element={<AdminEntryEditPage />} />
          <Route path="parcours" element={<AdminPathsPage />} />
          <Route path="parcours/new" element={<AdminPathNewPage />} />
          <Route path="parcours/:id/edit" element={<AdminPathEditPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
