import { useWindowDimensions } from 'react-native';

export const BREAKPOINTS = {
  tablet: 768,
  desktop: 1024,
};

export function useResponsive() {
  const { width } = useWindowDimensions();

  const isMobile = width < BREAKPOINTS.tablet;
  const isTablet = width >= BREAKPOINTS.tablet && width < BREAKPOINTS.desktop;
  const isDesktop = width >= BREAKPOINTS.desktop;
  const isTabletOrDesktop = width >= BREAKPOINTS.tablet;

  return {
    width,
    isMobile,
    isTablet,
    isDesktop,
    isTabletOrDesktop,
  };
}
