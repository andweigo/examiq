import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {LayoutChangeEvent, Pressable, StyleSheet, Text, View} from 'react-native';
import {useIsFocused, useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {
  BackHeader,
  FlashIcon,
  LiveCameraPreview,
  LiveCornerBox,
  PillButton,
  ScreenLayout,
  SegmentedControl,
} from '@components/index';
import {
  BUBBLE_CHOICES,
  OMR_SENSITIVITY_PROFILES,
  PAPER_SIZE_MAP,
} from '@constants/omr';
import {PaperSize} from '@core/types/common';
import {NativeOmrAnalysisResult} from '@engines/omr/NativeOmrEngine';
import {
  useExams,
  useProfileSettings,
  useRoster,
  useScanning,
  useServices,
  useToast,
} from '@hooks/index';
import {RootRoute, RootStackParamList} from '@navigation/routes';
import {Colors} from '@theme/colors';
import {Radii} from '@theme/spacing';

type CaptureMode = 'manual' | 'auto';

interface SheetMismatchTarget {
  readonly examId: string;
  readonly examLabel: string;
  readonly studentId: string;
  readonly studentName: string;
  readonly paperSize: PaperSize;
  readonly itemCount: number;
  readonly rawImageUri: string;
}

export const PaperScannerScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const isFocused = useIsFocused();
  const {selectedExam, exams, answerKey, alignmentOverlay, service: examService} =
    useExams();
  const {students} = useRoster();
  const {settings, service: profileService} = useProfileSettings();
  const {flashOn, activeStudentId, service: scanningService} = useScanning();
  const {omrEngine, qrCodec} = useServices();
  const {showToast} = useToast();

  const [liveMarkerCount, setLiveMarkerCount] = useState(0);
  const [liveCorners, setLiveCorners] = useState<LiveCornerBox[]>([]);
  const [frameSize, setFrameSize] = useState({width: 0, height: 0});
  const [capturing, setCapturing] = useState(false);
  const [errorFlash, setErrorFlash] = useState(false);
  const [mismatchTarget, setMismatchTarget] =
    useState<SheetMismatchTarget | null>(null);
  const [stencilVisible, setStencilVisible] = useState(true);

  const autoSnapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flagRetryRef = useRef(false);

  const triggerErrorToast = useCallback(
    (shortMessage: string) => {
      showToast(shortMessage);
      setErrorFlash(true);
      if (errorFlashTimerRef.current) {
        clearTimeout(errorFlashTimerRef.current);
      }
      errorFlashTimerRef.current = setTimeout(() => {
        setErrorFlash(false);
      }, 1800);
    },
    [showToast],
  );

  useEffect(() => {
    return () => {
      if (errorFlashTimerRef.current) {
        clearTimeout(errorFlashTimerRef.current);
      }
    };
  }, []);

  const captureMode: CaptureMode = settings.autoCapture ? 'auto' : 'manual';
  const activeStudent = students.find(s => s.id === activeStudentId) ??
    students[0] ?? {
      id: 'UNASSIGNED',
      name: 'No student yet',
      section: selectedExam.section,
      score: 0,
      total: selectedExam.items,
      status: 'Pending',
    };
  const paperSpec = PAPER_SIZE_MAP[selectedExam.paperSize ?? 'A4'];

  const totalItems = Math.max(1, selectedExam.items);
  const rowsPerCol = Math.max(1, Math.ceil(totalItems / 2));

  // Build exact 2-column stencil rows pre-filled with the exam's generated Answer Key
  const stencilRows = useMemo(() => {
    const visibleRowCount = Math.min(rowsPerCol, 25);
    return Array.from({length: visibleRowCount}, (_, idx) => {
      const leftNum = idx + 1;
      const rightNum = idx + 1 + rowsPerCol <= totalItems ? idx + 1 + rowsPerCol : null;
      return {
        leftNum,
        leftKey: answerKey[leftNum - 1] ?? 'A',
        rightNum,
        rightKey: rightNum ? answerKey[rightNum - 1] ?? 'A' : null,
      };
    });
  }, [rowsPerCol, totalItems, answerKey]);

  const stencilMetrics = useMemo(() => {
    const rows = stencilRows.length;
    if (rows <= 8) {
      return {dotSize: 22, fontSize: 9.5, numSize: 10};
    }
    if (rows <= 12) {
      return {dotSize: 19, fontSize: 8.5, numSize: 9};
    }
    if (rows <= 16) {
      return {dotSize: 16, fontSize: 7.5, numSize: 8.5};
    }
    return {dotSize: 13.5, fontSize: 6.5, numSize: 7.5};
  }, [stencilRows.length]);

  const cornerFoundMap = useMemo(() => {
    const map: Record<string, boolean> = {
      TL: false,
      TR: false,
      BL: false,
      BR: false,
    };
    liveCorners.forEach(c => {
      if (c.found && c.slot in map) {
        map[c.slot] = true;
      }
    });
    return map;
  }, [liveCorners]);

  const handleFrameLayout = (e: LayoutChangeEvent) => {
    const {width, height} = e.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setFrameSize({width, height});
    }
  };

  const handleCaptureModeChange = (mode: CaptureMode) => {
    const nextAuto = mode === 'auto';
    profileService.setAutoCapture(nextAuto);
    showToast(nextAuto ? 'Auto capture on' : 'Manual capture on');
  };

  const proceedToAlignment = useCallback(
    (
      rawImageUri: string,
      analysis?: NativeOmrAnalysisResult,
      overrideStudentId?: string,
    ) => {
      if (analysis) {
        scanningService.applyNativeOmrAnalysis(analysis);
      } else {
        scanningService.setCapturedRawImage(null);
      }
      setMismatchTarget(null);
      navigation.navigate(RootRoute.Alignment, {
        scanId: `scan-${overrideStudentId ?? activeStudent.id}`,
        rawImageUri,
      });
    },
    [scanningService, navigation, activeStudent.id],
  );

  const handleSwitchAndReanalyze = async (target: SheetMismatchTarget) => {
    setCapturing(true);
    setMismatchTarget(null);
    try {
      examService.selectExam(target.examId);
      examService.setExamPaperSize(target.examId, target.paperSize);
      scanningService.setActiveSession(target.studentId, target.examId);

      const targetKey = examService.getAnswerKey(target.examId);
      const rechecked = await omrEngine.alignAndAnalyze({
        rawImageUri: target.rawImageUri,
        paperSize: target.paperSize,
        itemCount: targetKey.length,
        sensitivity: settings.omrSensitivity,
        flagDoubleShade: settings.flagDoubleShade,
        answerKey: targetKey,
      });
      if (rechecked) {
        showToast(`Switched to ${target.studentName}`);
        proceedToAlignment(target.rawImageUri, rechecked, target.studentId);
      }
    } catch {
      triggerErrorToast('Re-check failed');
    } finally {
      setCapturing(false);
    }
  };

  const handleCaptureAndAlign = useCallback(async () => {
    if (capturing) {
      return;
    }
    if (!selectedExam.id || !activeStudent.id || activeStudent.id === 'UNASSIGNED') {
      triggerErrorToast('Scan student QR first');
      navigation.navigate(RootRoute.QrScanner);
      return;
    }
    if (autoSnapTimerRef.current) {
      clearTimeout(autoSnapTimerRef.current);
      autoSnapTimerRef.current = null;
    }
    setMismatchTarget(null);
    setCapturing(true);
    try {
      const capturedUri = await omrEngine.capturePhoto();
      if (capturedUri) {
        scanningService.setCapturedRawImage(capturedUri);
        const analysis = await omrEngine.alignAndAnalyze({
          rawImageUri: capturedUri,
          paperSize: selectedExam.paperSize,
          itemCount: selectedExam.items,
          sensitivity: settings.omrSensitivity,
          flagDoubleShade: settings.flagDoubleShade,
          answerKey,
        });
        if (analysis) {
          if (analysis.sheetValid === false) {
            const toastMap: Record<string, string> = {
              NOT_EXAMIQ_SHEET: 'Not an ExamIQ sheet',
              UPSIDE_DOWN: 'Sheet is upside down',
              NO_MARKERS: 'Align all 4 corners',
              POOR_ALIGNMENT: 'Hold phone flat above sheet',
              LOW_LIGHT: 'Too dark — turn on Flash',
              BLURRY: 'Blurry — hold steady',
            };
            triggerErrorToast(
              toastMap[analysis.errorCode ?? ''] ?? 'Scan failed — retry',
            );
            return;
          }

          // Cross-check on-sheet verified QR checksum, exam, student, and paper layout
          if (analysis.detectedQrPayload) {
            try {
              const decoded = qrCodec.decode(analysis.detectedQrPayload);
              const matchedExam = exams.find(e => e.id === decoded.examId);
              const matchedStudent = students.find(
                s => s.id === decoded.studentId,
              );

              if (!matchedExam || !matchedStudent) {
                triggerErrorToast('Sheet not in local DB');
                return;
              }

              const wrongSession =
                matchedExam.id !== selectedExam.id ||
                matchedStudent.id !== activeStudent.id ||
                (decoded.paperSize &&
                  decoded.paperSize !== selectedExam.paperSize);

              if (wrongSession) {
                setMismatchTarget({
                  examId: matchedExam.id,
                  examLabel: `${matchedExam.subject} · ${matchedExam.term}`,
                  studentId: matchedStudent.id,
                  studentName: matchedStudent.name,
                  paperSize: decoded.paperSize ?? matchedExam.paperSize,
                  itemCount: decoded.itemCount ?? matchedExam.items,
                  rawImageUri: capturedUri,
                });
                return;
              }
            } catch {
              triggerErrorToast('Invalid sheet QR');
              return;
            }
          }

          // Sensitivity-based quality gate: reject captures where too many items are unreadable
          const sensitivityProfile =
            OMR_SENSITIVITY_PROFILES[settings.omrSensitivity];
          const flaggedShare =
            analysis.flaggedCount / Math.max(1, analysis.total);
          if (
            flaggedShare > sensitivityProfile.maxFlaggedShare &&
            !flagRetryRef.current
          ) {
            flagRetryRef.current = true;
            const spilled = analysis.overShadedCount ?? 0;
            const halfShaded = analysis.halfShadedCount ?? 0;
            triggerErrorToast(
              spilled > 0 && spilled >= halfShaded
                ? 'Too much ink spill — retake'
                : halfShaded > 0
                ? 'Many half-shaded marks — retake'
                : 'Many unclear items — retake',
            );
            return;
          }
          flagRetryRef.current = false;
          if (analysis.flaggedCount > 0) {
            showToast(
              `${analysis.flaggedCount} item${
                analysis.flaggedCount === 1 ? '' : 's'
              } need review`,
            );
          }

          proceedToAlignment(capturedUri, analysis);
          return;
        }
      } else if (omrEngine.isNativeAvailable()) {
        triggerErrorToast('Camera starting — retry');
        return;
      }
    } catch {
      if (omrEngine.isNativeAvailable()) {
        triggerErrorToast('Capture failed — retry');
        return;
      }
      showToast('Simulated alignment');
    } finally {
      setCapturing(false);
    }

    proceedToAlignment('local://captured-sheet-01.jpg');
  }, [
    capturing,
    omrEngine,
    qrCodec,
    exams,
    students,
    scanningService,
    selectedExam.id,
    selectedExam.paperSize,
    selectedExam.items,
    activeStudent.id,
    settings.omrSensitivity,
    settings.flagDoubleShade,
    answerKey,
    proceedToAlignment,
    triggerErrorToast,
    navigation,
    showToast,
  ]);

  // Honor Manual vs Auto capture mode
  useEffect(() => {
    if (
      !isFocused ||
      captureMode !== 'auto' ||
      capturing ||
      mismatchTarget !== null ||
      errorFlash ||
      !omrEngine.isNativeAvailable()
    ) {
      if (autoSnapTimerRef.current) {
        clearTimeout(autoSnapTimerRef.current);
        autoSnapTimerRef.current = null;
      }
      return;
    }
    if (liveMarkerCount >= 4 && !autoSnapTimerRef.current) {
      autoSnapTimerRef.current = setTimeout(() => {
        autoSnapTimerRef.current = null;
        handleCaptureAndAlign();
      }, 950);
    } else if (liveMarkerCount < 4 && autoSnapTimerRef.current) {
      clearTimeout(autoSnapTimerRef.current);
      autoSnapTimerRef.current = null;
    }
    return () => {
      if (autoSnapTimerRef.current) {
        clearTimeout(autoSnapTimerRef.current);
        autoSnapTimerRef.current = null;
      }
    };
  }, [
    isFocused,
    captureMode,
    liveMarkerCount,
    capturing,
    mismatchTarget,
    errorFlash,
    omrEngine,
    handleCaptureAndAlign,
  ]);

  const handleMarkersStatus = useCallback(
    (count: number, _ready: boolean, corners?: LiveCornerBox[]) => {
      setLiveMarkerCount(count);
      if (corners) {
        setLiveCorners(corners);
      }
    },
    [],
  );

  const overlayTag = `${selectedExam.paperSize} · ${selectedExam.items} items · ${
    OMR_SENSITIVITY_PROFILES[settings.omrSensitivity].label
  }`;

  return (
    <ScreenLayout dark scrollable={false}>
      <View style={styles.container}>
        <BackHeader
          dark
          onBack={() => navigation.navigate(RootRoute.QrScanner)}
          center={
            <View style={styles.centerHeader}>
              <Text style={styles.headerTitle}>Paper scanner</Text>
              <Text style={styles.headerSub} numberOfLines={1}>
                {activeStudent.name} · {activeStudent.id}
              </Text>
            </View>
          }
          right={
            <Pressable
              onPress={() => {
                const on = scanningService.toggleFlash();
                showToast(on ? 'Flash on' : 'Flash off');
              }}
              style={[
                styles.flashBtn,
                flashOn && {backgroundColor: Colors.lime},
              ]}>
              <FlashIcon
                size={16}
                color={flashOn ? Colors.inkPrimary : Colors.surfaceWhite}
              />
            </Pressable>
          }
        />

        {/* Immediate Manual vs Auto Capture Mode Toggle */}
        <SegmentedControl<CaptureMode>
          dark
          compact
          value={captureMode}
          onChange={handleCaptureModeChange}
          options={[
            {label: 'Manual capture', value: 'manual'},
            {label: 'Auto capture', value: 'auto'},
          ]}
          style={styles.modeToggle}
        />

        {/* Full-Width Live CameraX + Live Corner Boxes + Full-Frame Filled Answer Key Stencil */}
        <View
          style={[
            styles.captureFrame,
            errorFlash && styles.captureFrameError,
          ]}
          onLayout={handleFrameLayout}>
          <LiveCameraPreview
            mode="paper"
            torchEnabled={flashOn}
            active={isFocused}
            onMarkersStatus={handleMarkersStatus}
            style={styles.cameraLayer}
          />

          {/* Real-Time Detected Corner Highlight Boxes */}
          {frameSize.width > 0 && frameSize.height > 0 ? (
            <View style={styles.liveBoxLayer} pointerEvents="none">
              {liveCorners
                .filter(c => c.found)
                .map(c => {
                  const boxW = Math.max(20, c.w * frameSize.width + 8);
                  const boxH = Math.max(20, c.h * frameSize.height + 8);
                  const left = Math.max(
                    4,
                    Math.min(
                      frameSize.width - boxW - 4,
                      c.x * frameSize.width - boxW / 2,
                    ),
                  );
                  const top = Math.max(
                    4,
                    Math.min(
                      frameSize.height - boxH - 4,
                      c.y * frameSize.height - boxH / 2,
                    ),
                  );
                  return (
                    <View
                      key={c.slot}
                      style={[
                        styles.detectedCornerBox,
                        {left, top, width: boxW, height: boxH},
                      ]}
                    />
                  );
                })}
            </View>
          ) : null}

          <View style={styles.overlayLayer} pointerEvents="box-none">
            {/* Top 2 Corner Registration Targets + Answer Key Overlay Toggle */}
            <View style={styles.cornerRow}>
              <View
                style={[
                  styles.bracket,
                  styles.bracketTL,
                  cornerFoundMap.TL && styles.bracketLocked,
                ]}>
                <View
                  style={[
                    styles.cornerTargetDot,
                    cornerFoundMap.TL && styles.cornerTargetLocked,
                  ]}
                />
              </View>
              <Pressable
                onPress={() => setStencilVisible(prev => !prev)}
                style={styles.overlayBadge}>
                <Text style={styles.overlayBadgeText}>
                  {overlayTag} · Key {stencilVisible ? 'ON' : 'OFF'}
                </Text>
              </Pressable>
              <View
                style={[
                  styles.bracket,
                  styles.bracketTR,
                  cornerFoundMap.TR && styles.bracketLocked,
                ]}>
                <View
                  style={[
                    styles.cornerTargetDot,
                    cornerFoundMap.TR && styles.cornerTargetLocked,
                  ]}
                />
              </View>
            </View>

            {/* Full-Frame Filled Answer Key Stencil Matching Printed Sheet Proportions */}
            <View style={styles.centerStage} pointerEvents="box-none">
              {stencilVisible ? (
                <View pointerEvents="none" style={styles.answerKeyStencil}>
                  <View style={styles.stencilHeader}>
                    <View style={styles.stencilHeaderInfo}>
                      <Text style={styles.stencilTitle} numberOfLines={1}>
                        ANSWER KEY · {selectedExam.subject}
                      </Text>
                      <Text style={styles.stencilSub} numberOfLines={1}>
                        Align printed bubbles to lime key dots
                      </Text>
                    </View>
                    <View style={styles.ghostQrBox}>
                      <Text style={styles.ghostLabel}>QR</Text>
                    </View>
                  </View>

                  <View style={styles.stencilColumns}>
                    <View style={styles.stencilCol}>
                      {stencilRows.map(row => (
                        <View
                          key={`sl-${row.leftNum}`}
                          style={styles.stencilRow}>
                          <Text
                            style={[
                              styles.stencilNum,
                              {fontSize: stencilMetrics.numSize},
                            ]}>
                            {row.leftNum}
                          </Text>
                          <View style={styles.stencilDots}>
                            {BUBBLE_CHOICES.map(letter => {
                              const isKey = row.leftKey === letter;
                              return (
                                <View
                                  key={letter}
                                  style={[
                                    styles.stencilDot,
                                    {
                                      width: stencilMetrics.dotSize,
                                      height: stencilMetrics.dotSize,
                                      borderRadius: stencilMetrics.dotSize / 2,
                                    },
                                    isKey && styles.stencilDotKey,
                                  ]}>
                                  <Text
                                    style={[
                                      styles.stencilLetter,
                                      {fontSize: stencilMetrics.fontSize},
                                      isKey && styles.stencilLetterKey,
                                    ]}>
                                    {letter}
                                  </Text>
                                </View>
                              );
                            })}
                          </View>
                        </View>
                      ))}
                    </View>

                    <View style={styles.stencilColDivider} />

                    <View style={styles.stencilCol}>
                      {stencilRows.map(row => (
                        <View
                          key={`sr-${row.leftNum}`}
                          style={styles.stencilRow}>
                          <Text
                            style={[
                              styles.stencilNum,
                              {fontSize: stencilMetrics.numSize},
                            ]}>
                            {row.rightNum ?? ''}
                          </Text>
                          {row.rightNum ? (
                            <View style={styles.stencilDots}>
                              {BUBBLE_CHOICES.map(letter => {
                                const isKey = row.rightKey === letter;
                                return (
                                  <View
                                    key={letter}
                                    style={[
                                      styles.stencilDot,
                                      {
                                        width: stencilMetrics.dotSize,
                                        height: stencilMetrics.dotSize,
                                        borderRadius:
                                          stencilMetrics.dotSize / 2,
                                      },
                                      isKey && styles.stencilDotKey,
                                    ]}>
                                    <Text
                                      style={[
                                        styles.stencilLetter,
                                        {fontSize: stencilMetrics.fontSize},
                                        isKey && styles.stencilLetterKey,
                                      ]}>
                                      {letter}
                                    </Text>
                                  </View>
                                );
                              })}
                            </View>
                          ) : (
                            <View style={styles.stencilDots} />
                          )}
                        </View>
                      ))}
                    </View>
                  </View>

                  {rowsPerCol > 25 ? (
                    <Text style={styles.stencilOverflow}>
                      All {totalItems} items checked on capture
                    </Text>
                  ) : null}
                </View>
              ) : null}

              {mismatchTarget ? (
                <View style={styles.mismatchStrip}>
                  <Text style={styles.mismatchText} numberOfLines={1}>
                    Sheet belongs to {mismatchTarget.studentName}
                  </Text>
                  <Pressable
                    onPress={() => handleSwitchAndReanalyze(mismatchTarget)}
                    style={styles.mismatchSwitchBtn}>
                    <Text style={styles.mismatchSwitchText}>Switch</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setMismatchTarget(null)}
                    hitSlop={8}>
                    <Text style={styles.mismatchDismiss}>×</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>

            {/* Bottom 2 Corner Registration Targets + Compact Lock Status Pill */}
            <View style={styles.cornerRow} pointerEvents="none">
              <View
                style={[
                  styles.bracket,
                  styles.bracketBL,
                  cornerFoundMap.BL && styles.bracketLocked,
                ]}>
                <View
                  style={[
                    styles.cornerTargetDot,
                    cornerFoundMap.BL && styles.cornerTargetLocked,
                  ]}
                />
              </View>

              <View style={styles.lockPill}>
                <Text style={styles.lockTitle}>
                  {liveMarkerCount}/4 corners ·{' '}
                  {captureMode === 'auto'
                    ? liveMarkerCount >= 4
                      ? 'Capturing...'
                      : `Auto (${paperSpec.code})`
                    : liveMarkerCount >= 4
                      ? 'Ready'
                      : `Manual (${paperSpec.code})`}
                </Text>
              </View>

              <View
                style={[
                  styles.bracket,
                  styles.bracketBR,
                  cornerFoundMap.BR && styles.bracketLocked,
                ]}>
                <View
                  style={[
                    styles.cornerTargetDot,
                    cornerFoundMap.BR && styles.cornerTargetLocked,
                  ]}
                />
              </View>
            </View>
          </View>
        </View>

        {/* Bottom Progress & Capture Button */}
        <View>
          <View style={styles.stepTrack}>
            <View style={styles.stepDotActive} />
            <View style={styles.stepLineActive} />
            <View style={styles.stepDotActive} />
            <View style={styles.stepLineMuted} />
            <View style={styles.stepDotIdle} />
          </View>

          <PillButton
            label={
              capturing
                ? 'Checking shading...'
                : captureMode === 'auto'
                ? 'Capture now (Auto active)'
                : 'Capture & align paper'
            }
            variant="lime"
            onPress={handleCaptureAndAlign}
          />
        </View>
      </View>
    </ScreenLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 16,
  },
  centerHeader: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.surfaceWhite,
    textAlign: 'center',
  },
  headerSub: {
    fontSize: 10,
    color: Colors.inkOnDarkMuted,
    marginTop: 2,
    textAlign: 'center',
  },
  flashBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surfaceDarkElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeToggle: {
    marginBottom: 8,
  },
  captureFrame: {
    flex: 1,
    marginHorizontal: -12,
    marginBottom: 10,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: Colors.lime,
    backgroundColor: '#181818',
    overflow: 'hidden',
    position: 'relative',
  },
  captureFrameError: {
    borderColor: Colors.coral,
  },
  cameraLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  liveBoxLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  detectedCornerBox: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: Colors.lime,
    backgroundColor: 'rgba(198,244,83,0.22)',
    borderRadius: 6,
  },
  overlayLayer: {
    flex: 1,
    padding: 10,
    justifyContent: 'space-between',
  },
  cornerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  overlayBadge: {
    backgroundColor: 'rgba(17,17,17,0.78)',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: Radii.pill,
  },
  overlayBadgeText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: Colors.lime,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  bracket: {
    width: 24,
    height: 24,
    borderColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bracketLocked: {
    borderColor: Colors.lime,
  },
  cornerTargetDot: {
    width: 7,
    height: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  cornerTargetLocked: {
    borderColor: Colors.lime,
    backgroundColor: Colors.lime,
  },
  bracketTL: {
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 6,
  },
  bracketTR: {
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 6,
  },
  bracketBL: {
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 6,
  },
  bracketBR: {
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 6,
  },
  centerStage: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'stretch',
    paddingVertical: 6,
    gap: 6,
  },
  answerKeyStencil: {
    width: '100%',
    flex: 1,
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: 'rgba(17,17,17,0.16)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(198,244,83,0.42)',
  },
  stencilHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.16)',
  },
  stencilHeaderInfo: {
    flex: 1,
    gap: 2,
  },
  stencilTitle: {
    fontSize: 10.5,
    fontWeight: '700',
    color: Colors.lime,
    letterSpacing: 0.4,
  },
  stencilSub: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.82)',
  },
  ghostQrBox: {
    width: 48,
    height: 48,
    borderRadius: 8,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(17,17,17,0.28)',
  },
  ghostLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.lime,
    textAlign: 'center',
  },
  stencilColumns: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  stencilCol: {
    flex: 1,
    justifyContent: 'space-between',
  },
  stencilColDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  stencilRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stencilNum: {
    width: 16,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.88)',
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  stencilDots: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stencilDot: {
    borderWidth: 1.2,
    borderColor: 'rgba(255,255,255,0.42)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(17,17,17,0.18)',
  },
  stencilDotKey: {
    backgroundColor: 'rgba(198,244,83,0.82)',
    borderColor: Colors.lime,
  },
  stencilLetter: {
    fontWeight: '600',
    color: 'rgba(255,255,255,0.75)',
  },
  stencilLetterKey: {
    color: Colors.inkPrimary,
    fontWeight: '800',
  },
  stencilOverflow: {
    fontSize: 8.5,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
  },
  lockPill: {
    backgroundColor: 'rgba(17,17,17,0.78)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radii.pill,
  },
  lockTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.lime,
    textAlign: 'center',
  },
  mismatchStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(17,17,17,0.9)',
    borderRadius: Radii.pill,
    borderWidth: 1,
    borderColor: Colors.lime,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  mismatchText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    color: Colors.surfaceWhite,
  },
  mismatchSwitchBtn: {
    backgroundColor: Colors.lime,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radii.pill,
  },
  mismatchSwitchText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.inkPrimary,
  },
  mismatchDismiss: {
    fontSize: 16,
    color: Colors.inkOnDarkMuted,
    paddingHorizontal: 2,
  },
  stepTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  stepDotActive: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.lime,
  },
  stepDotIdle: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#666666',
  },
  stepLineActive: {
    flex: 1,
    height: 1.5,
    backgroundColor: Colors.lime,
    marginHorizontal: 4,
  },
  stepLineMuted: {
    flex: 1,
    height: 1.5,
    backgroundColor: '#333333',
    marginHorizontal: 4,
  },
});
