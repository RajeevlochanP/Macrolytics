import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const navLinks = [
    { path: '/', label: 'Dashboard' },
    { path: '/meals', label: 'Meals' },
    { path: '/upload', label: 'Upload' },
    { path: '/chat', label: 'Assistant' },
  ];

  return (
    <div>
      <header style={{ borderBottom: '1px solid var(--border)', padding: '10px 20px', background: 'var(--bg)' }}>
        <div className="container flex justify-between items-center" style={{ padding: 0 }}>
          <div className="flex items-center gap-4">
            <h1 style={{ margin: 0, fontSize: '18px' }} className="mono">Macrolytics</h1>
            <nav className="flex gap-4" style={{ marginLeft: '20px' }}>
              {navLinks.map((link) => (
                <Link 
                  key={link.path} 
                  to={link.path}
                  style={{ 
                    fontWeight: location.pathname === link.path ? 'bold' : 'normal',
                    color: location.pathname === link.path ? 'var(--text)' : 'var(--text-muted)'
                  }}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="mono" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {user?.email}
            </span>
            <button onClick={logout}>Logout</button>
          </div>
        </div>
      </header>
      
      <main className="container">
        <Outlet />
      </main>
    </div>
  );
}
