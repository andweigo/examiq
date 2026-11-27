import React from 'react';
import {Image, StyleSheet, Text, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {
  BackHeader,
  PillButton,
  ScreenLayout,
  SegmentedControl,
} from '@components/index';
import {
  useExams,
  useProfileSettings,
  useRoster,
  useScanning,
} from '@hooks/index';
import {RootRoute, RootStackParamList} from '@navigation/routes';
import {Colors} from '@theme/colors';

const SAMPLE_ROWS = [1, 2, 3, 4, 5, 6, 7, 8];

export const AlignmentScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {selectedExam} = useExams();
  const {students} = useRoster();
  const {settings} = useProfileSettings();
  const {
    alignmentView,
    activeStudentId,
    rawImageUri,
    alignedImageUri,
    markersDetected,
    rotationAngleDeg,
    lightingStatus,
    service: scanningService,
  } = useScanning();

  const activeStudent = students.find(s => s.id === activeStudentId) ??
    students[0] ?? {
      id: 'UNASSIGNED',
      name: 'No student yet',
      section: selectedExam.section,
      score: 0,
      total: selectedExam.items,
      status: 'Pending',
    };
  const isAligned = alignmentView === 'aligned';
  const activePhotoUri = isAligned ? alignedImageUri : rawImageUri;

  return (
    <ScreenLayout dark scrollable={false}>
      <View style={styles.container}>
        <BackHeader
          dark
          onBack={() =>
            navigation.navigate(RootRoute.PaperScanner, {
              assignmentId: `${selectedExam.id}-${activeStudent.id}`,
              examId: selectedExam.id,
              studentId: activeStudent.id,
            })
          }
          center={
            <View style={styles.centerHeader}>
              <Text style={styles.headerTitle}>OpenCV alignment</Text>
              <Text style={styles.headerSub}>Perspective &amp; template warp</Text>
            </View>
          }
          right={
            <Text style={styles.markerBadge}>{markersDetected}/4</Text>
          }
        />

        <SegmentedControl
          dark
          compact
          value={alignmentView}
          onChange={v => scanningService.setAlignmentView(v)}
          options={[
            {label: `Raw scan (${rotationAngleDeg}°)`, value: 'raw'},
            {label: 'Aligned (0.0°)', value: 'aligned'},
          ]}
        />

        {/* Real Warped Photo vs Vector Sheet Preview */}
        <View style={styles.previewStage}>
          {activePhotoUri ? (
            <Image
              source={{uri: activePhotoUri}}
              resizeMode="contain"
              style={[
                styles.realPhotoPreview,
                {borderColor: isAligned ? Colors.lime : Colors.coral},
              ]}
            />
          ) : (
            <View
              style={[
                styles.sheetPreview,
                {
                  borderColor: isAligned ? Colors.lime : Colors.coral,
                  transform: isAligned
                    ? [{rotate: '0deg'}, {scale: 1}]
                    : [{rotate: '-4.5deg'}, {skewX: '3deg'}, {scale: 0.94}],
                },
              ]}>
              <View style={styles.sheetTopCorners}>
                <View style={styles.markerSquare} />
                <Text style={styles.templateLockText}>
                  {isAligned ? 'TEMPLATE LOCKED' : 'SKEW DETECTED'}
                </Text>
                <View style={styles.markerSquare} />
              </View>

              <Text style={styles.sheetStudentLine}>
                {activeStudent.name} · {activeStudent.id}
              </Text>

              <View style={styles.bubbleGrid}>
                {SAMPLE_ROWS.map((num, rowIdx) => (
                  <View key={num} style={styles.bubbleRow}>
                    <Text style={styles.rowNum}>{num}.</Text>
                    <View style={styles.dotsRow}>
                      {[0, 1, 2, 3].map(cIdx => {
                        const filled = rowIdx % 4 === cIdx;
                        return (
                          <View
                            key={cIdx}
                            style={[
                              styles.miniBubble,
                              {
                                borderColor: isAligned
                                  ? Colors.purpleDeep
                                  : Colors.inkPrimary,
                                backgroundColor: filled
                                  ? Colors.inkPrimary
                                  : 'transparent',
                              },
                            ]}
                          />
                        );
                      })}
                    </View>
                  </View>
                ))}
              </View>

              <View style={styles.sheetBottomCorners}>
                <View style={styles.markerSquare} />
                <Text style={styles.mappedHint}>
                  {selectedExam.items} bubbles mapped
                </Text>
                <View style={styles.markerSquare} />
              </View>
            </View>
          )}
        </View>

        {/* Diagnostics Table */}
        <View style={styles.diagnostics}>
          <View style={styles.diagRow}>
            <Text style={styles.diagLabel}>Corner markers (TL, TR, BL, BR)</Text>
            <Text style={styles.diagGood}>
              {markersDetected === 4 ? 'Detected' : `${markersDetected} / 4`}
            </Text>
          </View>
          <View style={styles.diagRow}>
            <Text style={styles.diagLabel}>Rotation &amp; perspective warp</Text>
            <Text style={styles.diagWhite}>{rotationAngleDeg}° → 0.0°</Text>
          </View>
          <View style={[styles.diagRow, styles.diagLast]}>
            <Text style={styles.diagLabel}>Lighting &amp; sharpness check</Text>
            <Text style={styles.diagGood}>{lightingStatus}</Text>
          </View>
        </View>

        {/* Bottom Actions */}
        <View style={styles.bottomActions}>
          <PillButton
            label="Retake"
            variant="darkSurface"
            style={styles.flex}
            onPress={() =>
              navigation.navigate(RootRoute.PaperScanner, {
                assignmentId: `${selectedExam.id}-${activeStudent.id}`,
                examId: selectedExam.id,
                studentId: activeStudent.id,
              })
            }
          />
          <PillButton
            label="Run OMR check"
            variant="lime"
            style={styles.flex}
            onPress={() => {
              scanningService.runOfflineOmrEvaluation(
                settings.omrSensitivity,
                settings.flagDoubleShade,
              );
              navigation.navigate(RootRoute.AutoCheck, {
                scanId: `scan-${activeStudent.id}`,
              });
            }}
          />
        </View>
      </View>
    </ScreenLayout>
  );
};

const styles = StyleSheet.create({
  flex: {flex: 1},
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: 12,
    paddingBottom: 16,
  },
  centerHeader: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.surfaceWhite,
  },
  headerSub: {
    fontSize: 10,
    color: Colors.inkOnDarkMuted,
    marginTop: 2,
  },
  markerBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.lime,
  },
  previewStage: {
    flex: 1,
    marginVertical: 14,
    borderRadius: 22,
    backgroundColor: '#181818',
    borderWidth: 1,
    borderColor: Colors.surfaceDarkBorder,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    padding: 14,
  },
  realPhotoPreview: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    borderWidth: 2,
  },
  sheetPreview: {
    width: 220,
    backgroundColor: Colors.canvasLight,
    borderRadius: 12,
    borderWidth: 2,
    padding: 14,
  },
  sheetTopCorners: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  markerSquare: {
    width: 12,
    height: 12,
    backgroundColor: Colors.inkPrimary,
    borderWidth: 2,
    borderColor: Colors.lime,
  },
  templateLockText: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: Colors.inkMuted,
  },
  sheetStudentLine: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.inkPrimary,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.inkPrimary,
  },
  bubbleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 6,
    columnGap: 12,
    paddingVertical: 10,
  },
  bubbleRow: {
    width: '46%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowNum: {
    fontSize: 8,
    fontWeight: '600',
    color: Colors.inkMuted,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 2,
  },
  miniBubble: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
  },
  sheetBottomCorners: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#DCDCD6',
  },
  mappedHint: {
    fontSize: 8,
    color: Colors.inkMuted,
  },
  diagnostics: {
    marginBottom: 14,
  },
  diagRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairlineDark,
  },
  diagLast: {
    borderBottomWidth: 0,
  },
  diagLabel: {
    fontSize: 12,
    color: Colors.inkOnDarkMuted,
  },
  diagGood: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.lime,
  },
  diagWhite: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.surfaceWhite,
  },
  bottomActions: {
    flexDirection: 'row',
    gap: 10,
  },
});
