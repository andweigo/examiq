import {useMemo} from 'react';
import {useWindowDimensions} from 'react-native';

export interface ResponsiveMetrics {
  readonly width: number;
  readonly height: number;
  readonly isCompact: boolean;
  readonly isLargePhone: boolean;
  readonly isTablet: boolean;
  readonly horizontalPadding: number;
  readonly maxContentWidth: number;
  readonly effectiveContentWidth: number;
  readonly gridColumns: number;
  readonly scale: (base: number) => number;
}

/**
 * Responsive layout hook adapting ExamIQ cleanly across compact Android phones
 * (<360dp), standard phones (360-430dp), foldables, and tablets (600dp+).
 */
export function useResponsive(): ResponsiveMetrics {
  const {width, height} = useWindowDimensions();

  return useMemo(() => {
    const isCompact = width < 360;
    const isLargePhone = width >= 412 && width < 600;
    const isTablet = width >= 600;

    const horizontalPadding = isTablet ? 28 : isCompact ? 14 : 20;
    const maxContentWidth = isTablet ? 580 : width;
    const effectiveContentWidth = Math.min(width, maxContentWidth) - horizontalPadding * 2;
    const gridColumns = isTablet ? 6 : 4;

    const ratio = Math.max(0.86, Math.min(1.14, width / 390));
    const scale = (base: number) => Math.round(base * ratio);

    return {
      width,
      height,
      isCompact,
      isLargePhone,
      isTablet,
      horizontalPadding,
      maxContentWidth,
      effectiveContentWidth,
      gridColumns,
      scale,
    };
  }, [width, height]);
}
