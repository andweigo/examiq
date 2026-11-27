import React, {ComponentRef, useRef, useState} from 'react';
import {
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {AssetRegistry, OwlPose} from '@assets/index';
import {NotchedCard, OwlMascot, PillButton} from '@components/index';
import {RootRoute, RootStackParamList} from '@navigation/routes';
import {Colors} from '@theme/colors';

interface OnboardingSlide {
  readonly key: string;
  readonly color: string;
  readonly pose: OwlPose;
  readonly light: string;
  readonly bold: string;
  readonly body: string;
}

const SLIDES: readonly OnboardingSlide[] = [
  {
    key: 'print',
    color: Colors.purple,
    pose: 'writing',
    light: 'Print papers',
    bold: 'with unique QRs',
    body: 'Generate standardized bubble sheets for every student, completely offline.',
  },
  {
    key: 'scan',
    color: Colors.cyan,
    pose: 'scanning',
    light: 'Scan & align',
    bold: 'in one second',
    body: 'Detect 4 corner registration marks and straighten tilted papers on-device.',
  },
  {
    key: 'grade',
    color: Colors.lime,
    pose: 'grading',
    light: 'Check & grade',
    bold: 'without internet',
    body: 'Automatic OMR scoring with quick manual review for flagged answers.',
  },
];

export const OnboardingScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const {width, height} = useWindowDimensions();
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const [index, setIndex] = useState(0);

  const isLast = index === SLIDES.length - 1;
  const horizontalPad = width < 360 ? 16 : width >= 600 ? 48 : 22;
  const pageWidth = width;
  const heroHeight = Math.round(Math.min(320, Math.max(200, height * 0.35)));
  const mascotSize = Math.round(Math.min(196, Math.max(132, heroHeight * 0.64)));

  const finish = () => {
    navigation.replace(RootRoute.Registration);
  };

  const handleNext = () => {
    if (isLast) {
      finish();
      return;
    }
    const next = index + 1;
    scrollRef.current?.scrollTo({x: next * pageWidth, animated: true});
    setIndex(next);
  };

  const handleScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / pageWidth);
    setIndex(Math.max(0, Math.min(SLIDES.length - 1, next)));
  };

  return (
    <View
      style={[
        styles.root,
        {paddingTop: insets.top + 12, paddingBottom: Math.max(insets.bottom, 16) + 8},
      ]}>
      <View style={[styles.topBar, {paddingHorizontal: horizontalPad}]}>
        <Image
          source={AssetRegistry.branding.appLogo}
          style={styles.logo}
          resizeMode="contain"
        />
        {!isLast ? (
          <Pressable onPress={finish} hitSlop={12}>
            <Text style={styles.skip}>Skip</Text>
          </Pressable>
        ) : (
          <View />
        )}
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
        style={styles.pager}>
        {SLIDES.map(slide => (
          <View
            key={slide.key}
            style={[
              styles.page,
              {width: pageWidth, paddingHorizontal: horizontalPad},
            ]}>
            <NotchedCard
              backgroundColor={slide.color}
              style={[styles.heroCard, {height: heroHeight}]}>
              <View style={styles.heroInner}>
                <OwlMascot pose={slide.pose} size={mascotSize} />
              </View>
            </NotchedCard>

            <View style={styles.copy}>
              <Text style={styles.light}>{slide.light}</Text>
              <Text style={styles.bold}>{slide.bold}</Text>
              <Text style={styles.body}>{slide.body}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={[styles.footer, {paddingHorizontal: horizontalPad}]}>
        <View style={styles.dots}>
          {SLIDES.map((slide, i) => (
            <View
              key={slide.key}
              style={[styles.dot, i === index && styles.dotActive]}
            />
          ))}
        </View>
        <PillButton
          label={isLast ? 'Get started' : 'Next'}
          variant="dark"
          onPress={handleNext}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.canvasLight,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 44,
  },
  logo: {
    width: 38,
    height: 38,
    borderRadius: 11,
  },
  skip: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.inkMuted,
  },
  pager: {
    flex: 1,
  },
  page: {
    flex: 1,
    justifyContent: 'center',
    gap: 28,
  },
  heroCard: {
    height: 300,
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: 0,
    justifyContent: 'center',
  },
  heroInner: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  copy: {
    gap: 2,
  },
  light: {
    fontSize: 27,
    fontWeight: '400',
    letterSpacing: -0.6,
    color: Colors.inkPrimary,
  },
  bold: {
    fontSize: 27,
    fontWeight: '700',
    letterSpacing: -0.6,
    color: Colors.inkPrimary,
  },
  body: {
    fontSize: 13,
    lineHeight: 19,
    color: Colors.inkMuted,
    marginTop: 10,
    maxWidth: 300,
  },
  footer: {
    gap: 18,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#D6D6D0',
  },
  dotActive: {
    width: 28,
    backgroundColor: Colors.inkPrimary,
  },
});
