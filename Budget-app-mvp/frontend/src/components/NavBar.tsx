import { NavLink } from 'react-router-dom';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex flex-col items-center justify-center gap-0.5 flex-1 py-2 text-xs font-medium ${
    isActive ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'
  }`;

export default function NavBar() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 bg-white/95 dark:bg-gray-900/95 backdrop-blur border-t border-gray-200 dark:border-gray-800 flex md:hidden">
      <NavLink to="/" end className={linkClass}>
        <span className="text-lg">📊</span>
        Dashboard
      </NavLink>
      <NavLink to="/add" className={linkClass}>
        <span className="text-lg">➕</span>
        Add
      </NavLink>
      <NavLink to="/transactions" className={linkClass}>
        <span className="text-lg">🧾</span>
        History
      </NavLink>
      <NavLink to="/settings" className={linkClass}>
        <span className="text-lg">⚙️</span>
        Setup
      </NavLink>
    </nav>
  );
}
