import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { TypeSizeProvider } from './context/TypeSizeContext';
import { PaceProvider } from './context/PaceContext';
import { useDefinitionRetry } from './hooks/useDefinitionRetry';
import { usePersistentStorage } from './hooks/usePersistentStorage';
import { useSeed } from './hooks/useSeed';
import Shell from './components/Shell';
import HomePage from './pages/HomePage';
import ReaderPage from './pages/ReaderPage';
import WordsPage from './pages/WordsPage';
import WordDetailPage from './pages/WordDetailPage';
import ReviewPage from './pages/ReviewPage';
import ImportPage from './pages/ImportPage';
import StatsPage from './pages/StatsPage';
import SettingsPage from './pages/SettingsPage';
import PrivacyPage from './pages/PrivacyPage';
import NotFoundPage from './pages/NotFoundPage';

export default function App() {
  useDefinitionRetry();
  usePersistentStorage();
  useSeed();

  return (
    <ThemeProvider>
      <TypeSizeProvider>
        <PaceProvider>
          <BrowserRouter>
            <Routes>
              {/* The reader sits outside the shell: no chrome while reading. */}
              <Route path="/read/:docId" element={<ReaderPage />} />

              <Route element={<Shell />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/words" element={<WordsPage />} />
                <Route path="/words/:wordId" element={<WordDetailPage />} />
                <Route path="/review" element={<ReviewPage />} />
                <Route path="/import" element={<ImportPage />} />
                <Route path="/stats" element={<StatsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </PaceProvider>
      </TypeSizeProvider>
    </ThemeProvider>
  );
}
