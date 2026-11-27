import React from 'react';
import Svg, {Circle, Line, Path, Polygon, Rect} from 'react-native-svg';

export interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export const HomeIcon: React.FC<IconProps> = ({
  size = 18,
  color = '#FFFFFF',
  strokeWidth = 2,
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5.5v-6.5h-5V21H4a1 1 0 0 1-1-1z"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const ExamsIcon: React.FC<IconProps> = ({
  size = 18,
  color = '#FFFFFF',
  strokeWidth = 2,
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect
      x={5}
      y={3}
      width={14}
      height={18}
      rx={2}
      stroke={color}
      strokeWidth={strokeWidth}
    />
    <Line
      x1={9}
      y1={8}
      x2={15}
      y2={8}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
    />
    <Line
      x1={9}
      y1={12}
      x2={15}
      y2={12}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
    />
  </Svg>
);

export const ScanIcon: React.FC<IconProps> = ({
  size = 18,
  color = '#FFFFFF',
  strokeWidth = 2,
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M4 8V5a1 1 0 0 1 1-1h3M20 8V5a1 1 0 0 0-1-1h-3M4 16v3a1 1 0 0 0 1 1h3M20 16v3a1 1 0 0 1-1 1h-3"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Rect
      x={9}
      y={9}
      width={6}
      height={6}
      rx={1}
      stroke={color}
      strokeWidth={strokeWidth}
    />
  </Svg>
);

export const ResultsIcon: React.FC<IconProps> = ({
  size = 18,
  color = '#FFFFFF',
  strokeWidth = 2,
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Line
      x1={6}
      y1={19}
      x2={6}
      y2={13}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
    />
    <Line
      x1={12}
      y1={19}
      x2={12}
      y2={7}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
    />
    <Line
      x1={18}
      y1={19}
      x2={18}
      y2={11}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
    />
  </Svg>
);

export const ProfileIcon: React.FC<IconProps> = ({
  size = 18,
  color = '#FFFFFF',
  strokeWidth = 2,
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle
      cx={12}
      cy={8.5}
      r={3.5}
      stroke={color}
      strokeWidth={strokeWidth}
    />
    <Path
      d="M5.5 20a6.5 6.5 0 0 1 13 0"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
    />
  </Svg>
);

export const BellIcon: React.FC<IconProps> = ({
  size = 18,
  color = '#111111',
  strokeWidth = 1.8,
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 7h18s-3 0-3-7"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M13.73 21a2 2 0 0 1-3.46 0"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
    />
  </Svg>
);

export const CalendarIcon: React.FC<IconProps> = ({
  size = 14,
  color = '#111111',
  strokeWidth = 2,
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect
      x={3}
      y={4}
      width={18}
      height={18}
      rx={2}
      stroke={color}
      strokeWidth={strokeWidth}
    />
    <Line
      x1={16}
      y1={2}
      x2={16}
      y2={6}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
    />
    <Line
      x1={8}
      y1={2}
      x2={8}
      y2={6}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
    />
    <Line
      x1={3}
      y1={10}
      x2={21}
      y2={10}
      stroke={color}
      strokeWidth={strokeWidth}
    />
  </Svg>
);

export const FlashIcon: React.FC<IconProps> = ({
  size = 16,
  color = '#111111',
  strokeWidth = 2,
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Polygon
      points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const SearchIcon: React.FC<IconProps> = ({
  size = 16,
  color = '#111111',
  strokeWidth = 2,
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx={11} cy={11} r={7} stroke={color} strokeWidth={strokeWidth} />
    <Line
      x1={21}
      y1={21}
      x2={16.65}
      y2={16.65}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
    />
  </Svg>
);

export const MenuIcon: React.FC<IconProps> = ({
  size = 18,
  color = '#111111',
  strokeWidth = 2,
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Line
      x1={4}
      y1={7}
      x2={20}
      y2={7}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
    />
    <Line
      x1={4}
      y1={12}
      x2={16}
      y2={12}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
    />
    <Line
      x1={4}
      y1={17}
      x2={20}
      y2={17}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
    />
  </Svg>
);

export const EyeIcon: React.FC<IconProps> = ({
  size = 18,
  color = '#6E6E68',
  strokeWidth = 1.8,
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M2 12s3.8-6.5 10-6.5S22 12 22 12s-3.8 6.5-10 6.5S2 12 2 12z"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Circle cx={12} cy={12} r={3} stroke={color} strokeWidth={strokeWidth} />
  </Svg>
);

export const EyeOffIcon: React.FC<IconProps> = ({
  size = 18,
  color = '#6E6E68',
  strokeWidth = 1.8,
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M17.94 17.94A10.94 10.94 0 0 1 12 19.5c-6.2 0-10-7.5-10-7.5a19.7 19.7 0 0 1 5.06-5.94M9.9 4.74A10.6 10.6 0 0 1 12 4.5c6.2 0 10 7.5 10 7.5a19.7 19.7 0 0 1-3.16 4.19"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Line
      x1={3}
      y1={3}
      x2={21}
      y2={21}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
    />
  </Svg>
);

export const LogoutIcon: React.FC<IconProps> = ({
  size = 17,
  color = '#6E6E68',
  strokeWidth = 1.8,
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M16 17l5-5-5-5M21 12H9"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);
