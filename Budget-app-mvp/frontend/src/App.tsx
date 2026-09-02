import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { PeriodProvider } from './context/PeriodContext';
import Header from './components/Header';
import NavBar from './components/NavBar';
import Dashboard from './pages/Dashboard';
import AddExpense from './pages/AddExpense';
import Transactions from './pages/Transactions';
import Setup from './pages/Setup';

export default function App() {
  return (
    <PeriodProvider>
      <BrowserRouter>
        <Header />
        <main>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/add" element={<AddExpense />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/settings" element={<Setup />} />
          </Routes>
        </main>
        <NavBar />
      </BrowserRouter>
    </PeriodProvider>
  );
}
