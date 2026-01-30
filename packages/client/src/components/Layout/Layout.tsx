import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect, type ReactNode } from 'react';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const isGamePage = location.pathname.startsWith('/game/');
  const [isLandscapeMobile, setIsLandscapeMobile] = useState(() => {
    const isMobile = window.innerWidth <= 768;
    return isMobile && window.innerWidth > window.innerHeight;
  });

  // Detect landscape mobile for scroll handling
  useEffect(() => {
    const checkOrientation = () => {
      const isMobile = window.innerWidth <= 768;
      const isPortrait = window.innerHeight > window.innerWidth;
      setIsLandscapeMobile(isMobile && !isPortrait);
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  // Allow scroll in landscape mobile on game pages
  const dynamicLayoutStyle: React.CSSProperties = {
    ...layoutStyle,
    ...(isLandscapeMobile &&
      isGamePage && {
        overflow: 'auto',
        height: 'auto',
        minHeight: '100vh',
      }),
  };

  const dynamicMainStyle: React.CSSProperties = {
    ...mainStyle,
    ...(isLandscapeMobile &&
      isGamePage && {
        flex: 'none',
        minHeight: '80vw', // Board needs square-ish space
      }),
  };

  return (
    <div style={dynamicLayoutStyle}>
      <header style={headerStyle}>
        <Link to="/" style={logoStyle}>
          Jarls
        </Link>
        <nav style={navStyle}>
          {isGamePage ? (
            // Minimal nav during gameplay
            <Link to="/" style={navLinkStyle}>
              Leave Game
            </Link>
          ) : (
            // Full nav in lobby
            <>
              <Link to="/lobby/create" style={navLinkStyle}>
                Create
              </Link>
              <Link to="/lobby/games" style={navLinkStyle}>
                Browse
              </Link>
            </>
          )}
        </nav>
      </header>

      <main style={dynamicMainStyle}>{children}</main>

      <footer style={footerStyle}>
        {isGamePage ? (
          <span style={footerTextStyle}>Press ? for help</span>
        ) : (
          <span style={footerTextStyle}>Jarls — A Viking Strategy Game</span>
        )}
      </footer>
    </div>
  );
}

const layoutStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100vh',
  overflow: 'hidden',
  backgroundColor: '#0d1117',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '12px 20px',
  borderBottom: '1px solid #21262d',
  flexShrink: 0,
};

const logoStyle: React.CSSProperties = {
  color: '#ffd700',
  fontSize: '20px',
  fontWeight: 'bold',
  fontFamily: 'monospace',
  textDecoration: 'none',
};

const navStyle: React.CSSProperties = {
  display: 'flex',
  gap: '16px',
  alignItems: 'center',
};

const navLinkStyle: React.CSSProperties = {
  color: '#8b949e',
  fontSize: '14px',
  fontFamily: 'monospace',
  textDecoration: 'none',
};

const mainStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
};

const footerStyle: React.CSSProperties = {
  padding: '8px 20px',
  borderTop: '1px solid #21262d',
  textAlign: 'center',
  flexShrink: 0,
};

const footerTextStyle: React.CSSProperties = {
  color: '#484f58',
  fontSize: '12px',
  fontFamily: 'monospace',
};
