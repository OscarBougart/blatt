import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { TypeSizeProvider } from './context/TypeSizeContext';
import { useDefinitionRetry } from './hooks/useDefinitionRetry';
import Shell from './components/Shell';
import HomePage from './pages/HomePage';
import ReaderPage from './pages/ReaderPage';
import WordsPage from './pages/WordsPage';
import ReviewPage from './pages/ReviewPage';
import ImportPage from './pages/ImportPage';
import StatsPage from './pages/StatsPage';
import SettingsPage from './pages/SettingsPage';
import NotFoundPage from './pages/NotFoundPage';

export default function App() {
  useDefinitionRetry();

  return (
    <ThemeProvider>
      <TypeSizeProvider>
        <BrowserRouter>
          <Routes>
            {/* The reader sits outside the shell: no chrome while reading. */}
            <Route path="/read/:docId" element={<ReaderPage />} />

            <Route element={<Shell />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/words" element={<WordsPage />} />
              <Route path="/review" element={<ReviewPage />} />
              <Route path="/import" element={<ImportPage />} />
              <Route path="/stats" element={<StatsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </TypeSizeProvider>
    </ThemeProvider>
  );
}
