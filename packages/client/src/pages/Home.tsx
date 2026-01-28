import { Link } from 'react-router-dom';
import { VERSION } from '@jarls/shared';

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    background: '#1a1a2e',
    color: '#e0e0e0',
    fontFamily: 'monospace',
  },
  title: {
    fontSize: '3rem',
    color: '#ffd700',
    marginBottom: '0.5rem',
  },
  version: {
    fontSize: '0.8rem',
    color: '#666',
    marginBottom: '2rem',
  },
  nav: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1rem',
    width: '280px',
  },
  link: {
    display: 'block',
    padding: '1rem 2rem',
    background: '#16213e',
    color: '#ffd700',
    textAlign: 'center' as const,
    textDecoration: 'none',
    borderRadius: '8px',
    border: '1px solid #ffd70033',
    fontSize: '1.1rem',
    fontFamily: 'monospace',
    transition: 'background 0.2s',
  },
};

export default function Home() {
  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Jarls</h1>
      <p style={styles.version}>v{VERSION}</p>
      <nav style={styles.nav}>
        <Link to="/lobby/create" style={styles.link}>
          Create Game
        </Link>
        <Link to="/lobby/games" style={styles.link}>
          Join Game
        </Link>
      </nav>
    </div>
  );
}
