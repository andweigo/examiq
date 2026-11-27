import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {
  BackHeader,
  DisplayHeading,
  PillButton,
  ScreenLayout,
} from '@components/index';
import {POINT_WEIGHT_PRESETS} from '@constants/grading';
import {
  useExams,
  useProfileSettings,
  useResponsive,
  useServices,
  useToast,
} from '@hooks/index';
import {RootRoute, RootStackParamList} from '@navigation/routes';
import {Colors} from '@theme/colors';
import {Radii} from '@theme/spacing';

export const AnswerKeyScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const container = useServices();
  const {
    selectedExam,
    answerKey,
    pointsPerItem,
    totalConfiguredPoints,
    service,
  } = useExams();
  const {service: profileService} = useProfileSettings();
  const {effectiveContentWidth, gridColumns} = useResponsive();
  const {showToast} = useToast();
  const tileGap = 10;
  const tileWidth = Math.max(
    64,
    Math.floor(
      (effectiveContentWidth - tileGap * (gridColumns - 1)) / gridColumns,
    ),
  );

  const handleResizeKey = (delta: number) => {
    const hadSheets = service.hasGeneratedSheets(selectedExam.id);
    const next = service.adjustAnswerKeyLength(delta);
    void container.flushNow();
    showToast(`Key: ${next} items`);
    if (hadSheets) {
      profileService.pushAlert({
        title: `${selectedExam.subject} resized to ${next} items — reprint sheets`,
        detail:
          'Previously printed QR sheets have an older item count. Regenerate PDFs before scanning.',
        category: 'exam',
        targetRoute: 'ExamGenerator',
        targetExamId: selectedExam.id,
      });
    }
  };

  return (
    <ScreenLayout activeTab="exams">
      <BackHeader
        onBack={() =>
          navigation.navigate(RootRoute.ExamBuilder, {examId: selectedExam.id})
        }
        right={
          <Pressable
            onPress={() =>
              navigation.navigate(RootRoute.ExamGenerator, {
                examId: selectedExam.id,
              })
            }>
            <Text style={styles.linkPurple}>Generate →</Text>
          </Pressable>
        }
      />

      <DisplayHeading
        lightText="Answer"
        boldText="key"
        style={styles.heading}
      />
      <Text style={styles.subtitle}>
        {selectedExam.subject} · {selectedExam.term} · Tap any tile to cycle A–D
      </Text>

      {/* Points Per Item Selector */}
      <View style={styles.pointsRow}>
        <Text style={styles.pointsLabel}>Points per item</Text>
        <View style={styles.pointsGroup}>
          {POINT_WEIGHT_PRESETS.map(pt => {
            const active = pointsPerItem === pt;
            return (
              <Pressable
                key={pt}
                onPress={() => {
                  service.setPointsPerItem(pt);
                  void container.flushNow();
                }}
                style={[styles.ptPill, active && styles.ptPillActive]}>
                <Text
                  style={[
                    styles.ptPillText,
                    active ? styles.ptPillTextActive : styles.ptPillTextIdle,
                  ]}>
                  {pt} pt
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* 4-Column Flat Lime Tile Grid */}
      <View style={styles.tileGrid}>
        {answerKey.map((choice, idx) => (
          <Pressable
            key={idx}
            onPress={() => {
              service.cycleAnswerKeyTile(idx);
              void container.flushNow();
            }}
            style={({pressed}) => [
              styles.tile,
              {width: tileWidth},
              pressed && styles.tilePressed,
            ]}>
            <View style={styles.tileTopRow}>
              <Text style={styles.tileMeta}>{idx + 1}</Text>
              <Text style={styles.tileMeta}>{pointsPerItem}p</Text>
            </View>
            <Text style={styles.tileAnswer}>{choice}</Text>
          </Pressable>
        ))}
      </View>

      {/* Item count adjusters + Summary */}
      <View style={styles.summaryRow}>
        <View>
          <Text style={styles.summaryLabel}>Total configured</Text>
          <Text style={styles.summaryValue}>
            {answerKey.length} items · {totalConfiguredPoints} pts
          </Text>
        </View>

        <View style={styles.stepperGroup}>
          <Pressable
            onPress={() => handleResizeKey(-4)}
            style={styles.stepBtn}>
            <Text style={styles.stepBtnText}>−4</Text>
          </Pressable>
          <Pressable
            onPress={() => handleResizeKey(4)}
            style={styles.stepBtn}>
            <Text style={styles.stepBtnText}>+4</Text>
          </Pressable>
        </View>
      </View>

      <PillButton
        label="Save key & build alignment overlay"
        variant="dark"
        onPress={() =>
          navigation.navigate(RootRoute.GeneratingOverlay, {
            examId: selectedExam.id,
          })
        }
      />
    </ScreenLayout>
  );
};

const styles = StyleSheet.create({
  linkPurple: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.purpleDeep,
  },
  heading: {
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 12,
    color: Colors.inkMuted,
    marginBottom: 16,
  },
  pointsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  pointsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.inkPrimary,
  },
  pointsGroup: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceMuted,
    padding: 4,
    borderRadius: Radii.pill,
  },
  ptPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radii.pill,
  },
  ptPillActive: {
    backgroundColor: Colors.inkPrimary,
  },
  ptPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  ptPillTextActive: {
    color: Colors.surfaceWhite,
  },
  ptPillTextIdle: {
    color: Colors.inkSecondary,
  },
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 18,
  },
  tile: {
    width: '22.6%',
    backgroundColor: Colors.lime,
    borderRadius: 16,
    padding: 12,
  },
  tilePressed: {
    opacity: 0.85,
    transform: [{scale: 0.97}],
  },
  tileTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tileMeta: {
    fontSize: 10,
    color: Colors.inkPrimary,
    opacity: 0.72,
  },
  tileAnswer: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.inkPrimary,
    marginTop: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairlineLight,
    marginBottom: 16,
  },
  summaryLabel: {
    fontSize: 11,
    color: Colors.inkMuted,
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.inkPrimary,
    marginTop: 2,
  },
  stepperGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  stepBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radii.pill,
    backgroundColor: Colors.surfaceWhite,
    borderWidth: 1,
    borderColor: Colors.hairlineLight,
  },
  stepBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.inkPrimary,
  },
});
