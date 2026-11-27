import React, {useEffect, useRef} from 'react';
import {
  Animated,
  Easing,
  Image,
  ImageStyle,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import Svg, {Defs, LinearGradient, Path, Polygon, Stop} from 'react-native-svg';
import {AssetRegistry, OwlPose} from '@assets/index';
import {Colors} from '@theme/colors';

export interface OwlMascotProps {
  pose: OwlPose;
  size?: number;
  animated?: boolean;
  style?: StyleProp<ViewStyle | ImageStyle>;
}

/**
 * Renders one of the 6 untouched ExamIQ owl mascot PNGs with tailored
 * 60fps pose-specific animations and pixel-aligned visual accents.
 */
export const OwlMascot: React.FC<OwlMascotProps> = ({
  pose,
  size = 64,
  animated = true,
  style,
}) => {
  const primary = useRef(new Animated.Value(0)).current;
  const secondary = useRef(new Animated.Value(0)).current;
  const tertiary = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    primary.setValue(0);
    secondary.setValue(0);
    tertiary.setValue(0);

    if (!animated) {
      return;
    }

    const loops: Animated.CompositeAnimation[] = [];

    if (pose === 'writing') {
      // 01 · Welcome: Cheerful 2-beat pencil-wing wave + sparkle arcs
      const waveLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(primary, {
            toValue: 1,
            duration: 280,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(primary, {
            toValue: -0.7,
            duration: 260,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(primary, {
            toValue: 0.9,
            duration: 260,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(primary, {
            toValue: 0,
            duration: 320,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.delay(750),
        ]),
      );
      const sparkLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(secondary, {
            toValue: 1,
            duration: 420,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(secondary, {
            toValue: 0,
            duration: 520,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.delay(930),
        ]),
      );
      loops.push(waveLoop, sparkLoop);
    } else if (pose === 'scanning') {
      // 02 · Scanning: Hover + pulsing cyan optical beam sweep + blinking lime LED
      const hoverLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(primary, {
            toValue: 1,
            duration: 1100,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(primary, {
            toValue: 0,
            duration: 1100,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      );
      const beamLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(secondary, {
            toValue: 1,
            duration: 900,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(secondary, {
            toValue: 0,
            duration: 900,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      );
      const ledLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(tertiary, {
            toValue: 1,
            duration: 180,
            useNativeDriver: true,
          }),
          Animated.delay(240),
          Animated.timing(tertiary, {
            toValue: 0,
            duration: 180,
            useNativeDriver: true,
          }),
          Animated.delay(340),
        ]),
      );
      loops.push(hoverLoop, beamLoop, ledLoop);
    } else if (pose === 'grading') {
      // 03 · Auto-Checking: Rhythmic 3-beat OMR bubble marking cadence
      const markLoop = Animated.loop(
        Animated.sequence([
          // Row 1 tick
          Animated.timing(primary, {
            toValue: 1,
            duration: 190,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(primary, {
            toValue: 0,
            duration: 180,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          // Row 2 tick
          Animated.timing(primary, {
            toValue: 1,
            duration: 190,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(primary, {
            toValue: 0,
            duration: 180,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          // Row 3 tick
          Animated.timing(primary, {
            toValue: 1,
            duration: 190,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(primary, {
            toValue: 0,
            duration: 210,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.delay(360),
        ]),
      );
      // 0 -> 1 -> 2 -> 3 cycle synced to the 3 OMR rows (total 1500ms)
      const rowLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(secondary, {
            toValue: 1,
            duration: 370,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(secondary, {
            toValue: 2,
            duration: 370,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(secondary, {
            toValue: 3,
            duration: 400,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.delay(360),
          Animated.timing(secondary, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      );
      loops.push(markLoop, rowLoop);
    } else if (pose === 'reviewing') {
      // 04 · Manual Review: Magnifying-glass inspection sway + gently floating ?
      const inspectLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(primary, {
            toValue: 1,
            duration: 1150,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(primary, {
            toValue: -1,
            duration: 1350,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(primary, {
            toValue: 0,
            duration: 900,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      );
      const floatQLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(secondary, {
            toValue: 1,
            duration: 1050,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(secondary, {
            toValue: 0,
            duration: 1050,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      );
      loops.push(inspectLoop, floatQLoop);
    } else if (pose === 'checked') {
      // 05 · Celebrating: Joyful squash-and-stretch bounce, flapping wiggle, popping lime check halo
      const bounceLoop = Animated.loop(
        Animated.sequence([
          // Anticipation crouch
          Animated.timing(primary, {
            toValue: -0.35,
            duration: 150,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          // Joyful jump peak
          Animated.timing(primary, {
            toValue: 1,
            duration: 300,
            easing: Easing.out(Easing.back(1.4)),
            useNativeDriver: true,
          }),
          // Soft landing
          Animated.timing(primary, {
            toValue: -0.2,
            duration: 240,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(primary, {
            toValue: 0,
            duration: 180,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.delay(780),
        ]),
      );
      const flapLoop = Animated.loop(
        Animated.sequence([
          Animated.delay(140),
          Animated.timing(secondary, {
            toValue: 1,
            duration: 120,
            useNativeDriver: true,
          }),
          Animated.timing(secondary, {
            toValue: -1,
            duration: 130,
            useNativeDriver: true,
          }),
          Animated.timing(secondary, {
            toValue: 0.6,
            duration: 120,
            useNativeDriver: true,
          }),
          Animated.timing(secondary, {
            toValue: 0,
            duration: 140,
            useNativeDriver: true,
          }),
          Animated.delay(1000),
        ]),
      );
      const badgePopLoop = Animated.loop(
        Animated.sequence([
          Animated.delay(240),
          Animated.timing(tertiary, {
            toValue: 1,
            duration: 560,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.delay(850),
          Animated.timing(tertiary, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      );
      loops.push(bounceLoop, flapLoop, badgePopLoop);
    } else if (pose === 'empty') {
      // 06 · Empty State: Curious tilt/shrug with drifting empty-state dots
      const tiltLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(primary, {
            toValue: 1,
            duration: 1200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(primary, {
            toValue: -0.65,
            duration: 1300,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(primary, {
            toValue: 0,
            duration: 900,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      );
      const driftLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(secondary, {
            toValue: 1,
            duration: 2100,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(secondary, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      );
      const driftLoop2 = Animated.loop(
        Animated.sequence([
          Animated.delay(650),
          Animated.timing(tertiary, {
            toValue: 1,
            duration: 2100,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(tertiary, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      );
      loops.push(tiltLoop, driftLoop, driftLoop2);
    }

    loops.forEach(loop => loop.start());
    return () => {
      loops.forEach(loop => loop.stop());
    };
  }, [pose, animated, primary, secondary, tertiary]);

  // Pose-specific body transform
  const getBodyTransform = (): ViewStyle['transform'] => {
    if (!animated) {
      return [];
    }
    switch (pose) {
      case 'writing':
        return [
          {
            translateY: primary.interpolate({
              inputRange: [-1, 0, 1],
              outputRange: [size * 0.01, 0, -size * 0.032],
            }),
          },
          {
            rotate: primary.interpolate({
              inputRange: [-1, 0, 1],
              outputRange: ['-3.5deg', '0deg', '5.5deg'],
            }),
          },
          {
            scale: primary.interpolate({
              inputRange: [-1, 0, 1],
              outputRange: [0.99, 1, 1.025],
            }),
          },
        ];

      case 'scanning':
        return [
          {
            translateY: primary.interpolate({
              inputRange: [0, 1],
              outputRange: [0, -size * 0.022],
            }),
          },
        ];

      case 'grading':
        return [
          {
            translateX: primary.interpolate({
              inputRange: [0, 1],
              outputRange: [0, -size * 0.02],
            }),
          },
          {
            translateY: primary.interpolate({
              inputRange: [0, 1],
              outputRange: [0, size * 0.022],
            }),
          },
          {
            rotate: primary.interpolate({
              inputRange: [0, 1],
              outputRange: ['0deg', '-4.2deg'],
            }),
          },
        ];

      case 'reviewing':
        return [
          {
            translateX: primary.interpolate({
              inputRange: [-1, 0, 1],
              outputRange: [-size * 0.024, 0, size * 0.026],
            }),
          },
          {
            rotate: primary.interpolate({
              inputRange: [-1, 0, 1],
              outputRange: ['-3.2deg', '0deg', '3.8deg'],
            }),
          },
        ];

      case 'checked':
        return [
          {
            translateY: primary.interpolate({
              inputRange: [-0.35, 0, 1],
              outputRange: [size * 0.02, 0, -size * 0.075],
            }),
          },
          {
            scaleX: primary.interpolate({
              inputRange: [-0.35, 0, 1],
              outputRange: [1.05, 1, 0.96],
            }),
          },
          {
            scaleY: primary.interpolate({
              inputRange: [-0.35, 0, 1],
              outputRange: [0.94, 1, 1.05],
            }),
          },
          {
            rotate: secondary.interpolate({
              inputRange: [-1, 0, 1],
              outputRange: ['-4.2deg', '0deg', '4.2deg'],
            }),
          },
        ];

      case 'empty':
        return [
          {
            translateY: primary.interpolate({
              inputRange: [-0.65, 0, 1],
              outputRange: [0, 0, -size * 0.028],
            }),
          },
          {
            rotate: primary.interpolate({
              inputRange: [-0.65, 0, 1],
              outputRange: ['3.5deg', '0deg', '-5.5deg'],
            }),
          },
        ];
    }
  };

  // Pose-specific subtle overlays (only rendered at readable sizes >= 40px)
  const renderPoseAccents = () => {
    if (!animated || size < 40) {
      return null;
    }

    if (pose === 'writing') {
      // Subtle lime wave motion arcs near the raised pencil tip
      const arcSize = size * 0.24;
      return (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.accentAbs,
            {
              left: size * 0.78,
              top: size * 0.08,
              width: arcSize,
              height: arcSize,
              opacity: secondary.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0, 0.95, 0],
              }),
              transform: [
                {
                  scale: secondary.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.78, 1.15],
                  }),
                },
                {
                  translateX: secondary.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-size * 0.02, size * 0.03],
                  }),
                },
              ],
            },
          ]}>
          <Svg width={arcSize} height={arcSize} viewBox="0 0 24 24">
            <Path
              d="M6 16 C9 11, 13 9, 18 8"
              stroke={Colors.lime}
              strokeWidth={2.4}
              strokeLinecap="round"
              fill="none"
            />
            <Path
              d="M11 20 C14 16, 17 14, 21 13"
              stroke={Colors.limeDeep}
              strokeWidth={2}
              strokeLinecap="round"
              fill="none"
            />
          </Svg>
        </Animated.View>
      );
    }

    if (pose === 'scanning') {
      // Pulsing cyan optical beam + sweeping scanline + blinking lime scanner LED
      const ledSize = Math.max(4, size * 0.044);
      const ledGlow = ledSize * 2.4;
      return (
        <>
          {/* Cyan Optical Beam Trapezoid */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.accentAbs,
              {
                left: 0,
                top: 0,
                width: size,
                height: size,
                opacity: secondary.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0.18, 0.72, 0.18],
                }),
              },
            ]}>
            <Svg width={size} height={size} viewBox="0 0 100 100">
              <Defs>
                <LinearGradient id="scanBeam" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={Colors.cyan} stopOpacity="0.62" />
                  <Stop offset="1" stopColor={Colors.cyan} stopOpacity="0.02" />
                </LinearGradient>
              </Defs>
              <Polygon points="37,75 63,75 71,94 29,94" fill="url(#scanBeam)" />
            </Svg>
          </Animated.View>

          {/* Sweeping Cyan Optical Scanline */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.scanLine,
              {
                left: size * 0.34,
                width: size * 0.32,
                top: size * 0.76,
                height: Math.max(2, size * 0.024),
                opacity: secondary.interpolate({
                  inputRange: [0, 0.15, 0.85, 1],
                  outputRange: [0, 0.9, 0.9, 0],
                }),
                transform: [
                  {
                    translateY: secondary.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, size * 0.15],
                    }),
                  },
                ],
              },
            ]}
          />

          {/* Blinking Lime Scanner LED + Glow */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.ledGlow,
              {
                left: size * 0.591 - ledGlow / 2,
                top: size * 0.631 - ledGlow / 2,
                width: ledGlow,
                height: ledGlow,
                borderRadius: ledGlow / 2,
                opacity: tertiary.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.05, 0.65],
                }),
                transform: [
                  {
                    scale: tertiary.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.6, 1.3],
                    }),
                  },
                ],
              },
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.ledDot,
              {
                left: size * 0.591 - ledSize / 2,
                top: size * 0.631 - ledSize / 2,
                width: ledSize,
                height: ledSize,
                borderRadius: ledSize / 2,
                opacity: tertiary.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.15, 1],
                }),
              },
            ]}
          />
        </>
      );
    }

    if (pose === 'grading') {
      // Rhythmic 3-row OMR bubble glow synced with the pencil marking cadence
      const bubbleD = Math.max(5, size * 0.064);
      const rows = [
        {y: 0.69, color: Colors.lime, inRange: [0, 0.45, 0.95, 1.1]},
        {y: 0.75, color: Colors.lime, inRange: [0.95, 1.45, 1.95, 2.1]},
        {y: 0.808, color: Colors.coral, inRange: [1.95, 2.45, 2.95, 3.0]},
      ];
      return (
        <>
          {rows.map((r, idx) => (
            <Animated.View
              key={idx}
              pointerEvents="none"
              style={[
                styles.bubbleGlow,
                {
                  left: size * 0.348 - bubbleD / 2,
                  top: size * r.y - bubbleD / 2,
                  width: bubbleD,
                  height: bubbleD,
                  borderRadius: bubbleD / 2,
                  backgroundColor: r.color,
                  opacity: secondary.interpolate({
                    inputRange: r.inRange,
                    outputRange: [0, 0.85, 0.15, 0],
                    extrapolate: 'clamp',
                  }),
                  transform: [
                    {
                      scale: secondary.interpolate({
                        inputRange: r.inRange,
                        outputRange: [0.7, 1.45, 1.0, 0.7],
                        extrapolate: 'clamp',
                      }),
                    },
                  ],
                },
              ]}
            />
          ))}
        </>
      );
    }

    if (pose === 'reviewing') {
      // Floating ? coral aura + subtle magnifying glass lens shimmer
      const qHalo = Math.max(10, size * 0.15);
      const lensD = Math.max(8, size * 0.14);
      return (
        <>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.questionAura,
              {
                left: size * 0.865 - qHalo / 2,
                top: size * 0.23 - qHalo / 2,
                width: qHalo,
                height: qHalo,
                borderRadius: qHalo / 2,
                opacity: secondary.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0.14, 0.45, 0.14],
                }),
                transform: [
                  {
                    translateY: secondary.interpolate({
                      inputRange: [0, 1],
                      outputRange: [size * 0.015, -size * 0.045],
                    }),
                  },
                  {
                    scale: secondary.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.85, 1.18],
                    }),
                  },
                ],
              },
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.lensGlint,
              {
                left: size * 0.735 - lensD / 2,
                top: size * 0.57 - lensD / 2,
                width: lensD,
                height: lensD,
                borderRadius: lensD / 2,
                opacity: primary.interpolate({
                  inputRange: [-1, 0, 1],
                  outputRange: [0.12, 0.42, 0.12],
                }),
                transform: [
                  {
                    scale: primary.interpolate({
                      inputRange: [-1, 0, 1],
                      outputRange: [0.82, 1.08, 0.82],
                    }),
                  },
                ],
              },
            ]}
          />
        </>
      );
    }

    if (pose === 'checked') {
      // Popping lime check badge ripple + celebration sparkles
      const badgeRing = size * 0.21;
      const sparkD = Math.max(4, size * 0.045);
      return (
        <>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.checkRipple,
              {
                left: size * 0.815 - badgeRing / 2,
                top: size * 0.165 - badgeRing / 2,
                width: badgeRing,
                height: badgeRing,
                borderRadius: badgeRing / 2,
                opacity: tertiary.interpolate({
                  inputRange: [0, 0.25, 1],
                  outputRange: [0, 0.85, 0],
                }),
                transform: [
                  {
                    scale: tertiary.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.82, 1.42],
                    }),
                  },
                ],
              },
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.sparkleDot,
              {
                backgroundColor: Colors.lime,
                left: size * 0.14,
                top: size * 0.14,
                width: sparkD,
                height: sparkD,
                borderRadius: sparkD / 2,
                opacity: tertiary.interpolate({
                  inputRange: [0, 0.35, 1],
                  outputRange: [0, 0.9, 0],
                }),
                transform: [
                  {
                    translateY: tertiary.interpolate({
                      inputRange: [0, 1],
                      outputRange: [size * 0.04, -size * 0.06],
                    }),
                  },
                  {
                    scale: tertiary.interpolate({
                      inputRange: [0, 0.5, 1],
                      outputRange: [0.4, 1.15, 0.3],
                    }),
                  },
                ],
              },
            ]}
          />
        </>
      );
    }

    if (pose === 'empty') {
      // Drifting empty-state lime & lavender dots around top-left
      const dot1 = Math.max(4, size * 0.048);
      const dot2 = Math.max(5, size * 0.062);
      return (
        <>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.driftDot,
              {
                backgroundColor: Colors.lime,
                left: size * 0.09,
                top: size * 0.22,
                width: dot1,
                height: dot1,
                borderRadius: dot1 / 2,
                opacity: secondary.interpolate({
                  inputRange: [0, 0.25, 0.75, 1],
                  outputRange: [0, 0.88, 0.75, 0],
                }),
                transform: [
                  {
                    translateY: secondary.interpolate({
                      inputRange: [0, 1],
                      outputRange: [size * 0.04, -size * 0.1],
                    }),
                  },
                  {
                    translateX: secondary.interpolate({
                      inputRange: [0, 0.5, 1],
                      outputRange: [0, -size * 0.03, size * 0.015],
                    }),
                  },
                ],
              },
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.driftDot,
              {
                backgroundColor: '#C9C4FF',
                left: size * 0.145,
                top: size * 0.3,
                width: dot2,
                height: dot2,
                borderRadius: dot2 / 2,
                opacity: tertiary.interpolate({
                  inputRange: [0, 0.25, 0.75, 1],
                  outputRange: [0, 0.8, 0.65, 0],
                }),
                transform: [
                  {
                    translateY: tertiary.interpolate({
                      inputRange: [0, 1],
                      outputRange: [size * 0.03, -size * 0.09],
                    }),
                  },
                  {
                    translateX: tertiary.interpolate({
                      inputRange: [0, 0.5, 1],
                      outputRange: [0, size * 0.025, -size * 0.015],
                    }),
                  },
                ],
              },
            ]}
          />
        </>
      );
    }

    return null;
  };

  return (
    <View
      style={[styles.wrapper, {width: size, height: size}, style as ViewStyle]}
      accessibilityLabel={`ExamIQ mascot ${pose}`}>
      <Animated.View
        style={[
          styles.animatedBody,
          {width: size, height: size, transform: getBodyTransform()},
        ]}>
        <Image
          source={AssetRegistry.getMascot(pose)}
          resizeMode="contain"
          style={{width: size, height: size}}
        />
        {renderPoseAccents()}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  animatedBody: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accentAbs: {
    position: 'absolute',
  },
  scanLine: {
    position: 'absolute',
    borderRadius: 99,
    backgroundColor: Colors.cyan,
  },
  ledGlow: {
    position: 'absolute',
    backgroundColor: Colors.lime,
  },
  ledDot: {
    position: 'absolute',
    backgroundColor: Colors.lime,
  },
  bubbleGlow: {
    position: 'absolute',
  },
  questionAura: {
    position: 'absolute',
    backgroundColor: Colors.coral,
  },
  lensGlint: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.65)',
  },
  checkRipple: {
    position: 'absolute',
    borderWidth: 2.2,
    borderColor: Colors.lime,
  },
  sparkleDot: {
    position: 'absolute',
  },
  driftDot: {
    position: 'absolute',
  },
});
