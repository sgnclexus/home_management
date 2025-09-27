import { useEffect, useState } from 'react';

interface NoSSRProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Component that prevents server-side rendering of its children
 * Useful for components that use browser-only APIs
 */
export const NoSSR: React.FC<NoSSRProps> = ({ children, fallback = null }) => {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

export default NoSSR;