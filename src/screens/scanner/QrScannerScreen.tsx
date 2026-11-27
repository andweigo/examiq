import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Animated, Pressable, StyleSheet, Text, View} from 'react-native';
import {useIsFocused, useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {
  FlashIcon,
  LiveCameraPreview,
  NotchedCard,
  OwlMascot,
  PillButton,
  ScreenLayout,
} from '@components/index';
import {PaperSize} from '@core/types/common';
import {
  useExams,
  useRoster,
  useScanning,
  useServices,
  useToast,
} from '@hooks/index';
import {RootRoute, RootStackParamList} from '@navigation/routes';
import {Colors} from '@theme/colors';
import {Radii} from '@theme/spacing';

interface QrSyncTarget {
  readonly examId: string;
  readonly paperSize?: PaperSize;
  readonly itemCount?: number;
  readonly summary: string;
}

interface VerifiedQrMatch {
  readonly studentId: string;
  readonly studentName: string;
  readonly studentSection: string;
  readonly examId: string;
  readonly examSubject: string;
  readonly examTerm: string;
  readonly paperSize: PaperSize;
  readonly itemCount: number;
}

export const QrScannerScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const isFocused = useIsFocused();
  const {exams, service: examService} = useExams();
  const {students} = useRoster();
  const {flashOn, service: scanningService} = useScanning();
  const {qrCodec} = useServices();
  const {showToast} = useToast();

  const [scannedMatch, setScannedMatch] = useState<VerifiedQrMatch | null>(null);
  const [syncTarget, setSyncTarget] = useState<QrSyncTarget | null>(null);
  const [errorFlash, setErrorFlash] = useState(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerShake = useCallback(() => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, {
        toValue: 10,
        duration: 55,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: -10,
        duration: 55,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 6,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: -6,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 0,
        duration: 45,
        useNativeDriver: true,
      }),
    ]).start();
  }, [shakeAnim]);

  const showErrorToast = useCallback(
    (shortMsg: string) => {
      showToast(shortMsg);
      setErrorFlash(true);
      triggerShake();
      if (errorTimerRef.current) {
        clearTimeout(errorTimerRef.current);
      }
      errorTimerRef.current = setTimeout(() => {
        setErrorFlash(false);
      }, 1800);
    },
    [showToast, triggerShake],
  );

  useEffect(() => {
    return () => {
      if (errorTimerRef.current) {
        clearTimeout(errorTimerRef.current);
      }
    };
  }, []);

  // Reset verified student every time the QR scanner gains focus so it waits for a fresh QR scan
  useEffect(() => {
    if (isFocused) {
      setScannedMatch(null);
      setSyncTarget(null);
      setErrorFlash(false);
    }
  }, [isFocused]);

  // Brief hint toast if no QR has been scanned after 8 seconds
  useEffect(() => {
    if (!isFocused || scannedMatch !== null) {
      return;
    }
    const timer = setTimeout(() => {
      showToast('Point camera at exam QR');
    }, 8000);
    return () => clearTimeout(timer);
  }, [isFocused, scannedMatch, showToast]);

  const handleQrDetected = useCallback(
    (rawValue: string) => {
      const trimmed = rawValue.trim();
      if (!trimmed.startsWith('EXAMIQ|')) {
        setScannedMatch(null);
        setSyncTarget(null);
        showErrorToast('Not an ExamIQ QR');
        return;
      }

      let decoded;
      try {
        decoded = qrCodec.decode(trimmed);
      } catch {
        setScannedMatch(null);
        setSyncTarget(null);
        showErrorToast('Unreadable ExamIQ QR');
        return;
      }

      const matchedExam = exams.find(e => e.id === decoded.examId);
      const matchedStudent = students.find(s => s.id === decoded.studentId);

      if (!matchedExam) {
        setScannedMatch(null);
        setSyncTarget(null);
        showErrorToast('Exam not on device');
        return;
      }
      if (!matchedStudent) {
        setScannedMatch(null);
        setSyncTarget(null);
        showErrorToast('Student not in roster');
        return;
      }

      examService.selectExam(matchedExam.id);
      scanningService.setActiveSession(matchedStudent.id, matchedExam.id);
      setErrorFlash(false);

      const resolvedMatch: VerifiedQrMatch = {
        studentId: matchedStudent.id,
        studentName: matchedStudent.name,
        studentSection: matchedStudent.section,
        examId: matchedExam.id,
        examSubject: matchedExam.subject,
        examTerm: matchedExam.term,
        paperSize: matchedExam.paperSize,
        itemCount: matchedExam.items,
      };
      setScannedMatch(resolvedMatch);

      const itemMismatch =
        typeof decoded.itemCount === 'number' &&
        decoded.itemCount > 0 &&
        decoded.itemCount !== matchedExam.items;
      const sizeMismatch =
        Boolean(decoded.paperSize) &&
        decoded.paperSize !== matchedExam.paperSize;

      if (itemMismatch || sizeMismatch) {
        setSyncTarget({
          examId: matchedExam.id,
          paperSize: decoded.paperSize,
          itemCount: decoded.itemCount,
          summary: `${decoded.paperSize ?? matchedExam.paperSize} · ${
            decoded.itemCount ?? matchedExam.items
          } items`,
        });
        return;
      }

      setSyncTarget(null);
      showToast(`Verified: ${matchedStudent.name}`);
    },
    [
      qrCodec,
      exams,
      students,
      examService,
      scanningService,
      showToast,
      showErrorToast,
    ],
  );

  const handleSyncToQr = () => {
    if (!syncTarget || !scannedMatch) {
      return;
    }
    const targetExam = exams.find(e => e.id === syncTarget.examId);
    if (syncTarget.paperSize) {
      examService.setExamPaperSize(syncTarget.examId, syncTarget.paperSize);
    }
    if (
      syncTarget.itemCount &&
      targetExam &&
      syncTarget.itemCount !== targetExam.items
    ) {
      examService.selectExam(syncTarget.examId);
      examService.adjustAnswerKeyLength(syncTarget.itemCount - targetExam.items);
    }
    setScannedMatch(prev =>
      prev
        ? {
            ...prev,
            paperSize: syncTarget.paperSize ?? prev.paperSize,
            itemCount: syncTarget.itemCount ?? prev.itemCount,
          }
        : null,
    );
    setSyncTarget(null);
    showToast('Synced to QR layout');
  };

  const handleRescanQr = () => {
    setScannedMatch(null);
    setSyncTarget(null);
    setErrorFlash(false);
    showToast('Scan next student QR');
  };

  const handleProceedToSheetScan = () => {
    if (!scannedMatch) {
      showErrorToast('Scan student QR first');
      return;
    }

    if (syncTarget) {
      showErrorToast('Sync exam to QR first');
      return;
    }

    examService.selectExam(scannedMatch.examId);
    scanningService.setActiveSession(
      scannedMatch.studentId,
      scannedMatch.examId,
    );
    navigation.navigate(RootRoute.PaperScanner, {
      assignmentId: `${scannedMatch.examId}-${scannedMatch.studentId}`,
      examId: scannedMatch.examId,
      studentId: scannedMatch.studentId,
    });
  };

  const qrVerified = scannedMatch !== null;
  const hasRosterReady = exams.length > 0 && students.length > 0;

  return (
    <ScreenLayout dark scrollable={false}>
      <View style={styles.container}>
        {/* Full-bleed Live CameraX Preview */}
        <View style={styles.cameraBackdrop} pointerEvents="box-none">
          <LiveCameraPreview
            mode="qr"
            torchEnabled={flashOn}
            active={isFocused}
            onQrDetected={handleQrDetected}
            style={styles.cameraFill}
          />
          <View style={styles.cameraScrim} pointerEvents="none" />
        </View>

        {/* Top Bar */}
        <View style={styles.topBar}>
          <Pressable
            onPress={() => {
              if (navigation.canGoBack()) {
                navigation.goBack();
              } else {
                navigation.navigate(RootRoute.Dashboard);
              }
            }}
            style={styles.circleBtnLight}>
            <Text style={styles.backChevron}>‹</Text>
          </Pressable>
          <View
            style={[
              styles.topCenterPill,
              qrVerified && styles.topCenterPillVerified,
            ]}>
            <Text
              style={[
                styles.topCenterText,
                qrVerified && styles.topCenterTextVerified,
              ]}>
              {qrVerified ? 'QR verified' : 'Live QR scanner'}
            </Text>
          </View>
          <Pressable
            onPress={() => {
              const on = scanningService.toggleFlash();
              showToast(on ? 'Flash on' : 'Flash off');
            }}
            style={[
              styles.circleBtnLight,
              flashOn && {backgroundColor: Colors.lime},
            ]}>
            <FlashIcon size={16} color={Colors.inkPrimary} />
          </Pressable>
        </View>

        {/* 100% Clear Transparent QR Target Window (Toast-only error feedback, no duplicate box) */}
        <Animated.View
          style={[
            styles.viewfinderArea,
            {transform: [{translateX: shakeAnim}]},
          ]}
          pointerEvents="box-none">
          <View style={styles.qrFrame} pointerEvents="none">
            <View style={styles.bracketRow}>
              <View
                style={[
                  styles.bracket,
                  styles.bTL,
                  errorFlash && styles.bracketError,
                ]}
              />
              <View
                style={[
                  styles.bracket,
                  styles.bTR,
                  errorFlash && styles.bracketError,
                ]}
              />
            </View>
            <View style={styles.centerCrosshair} />
            <View style={styles.bracketRow}>
              <View
                style={[
                  styles.bracket,
                  styles.bBL,
                  errorFlash && styles.bracketError,
                ]}
              />
              <View
                style={[
                  styles.bracket,
                  styles.bBR,
                  errorFlash && styles.bracketError,
                ]}
              />
            </View>
          </View>

          {syncTarget ? (
            <Pressable onPress={handleSyncToQr} style={styles.syncChip}>
              <Text style={styles.syncChipText}>
                Sync exam to QR ({syncTarget.summary})
              </Text>
            </Pressable>
          ) : (
            <View style={styles.scanHintRow}>
              <OwlMascot
                pose={qrVerified ? 'checked' : 'scanning'}
                size={32}
              />
              <Text style={styles.scanHint}>
                {qrVerified
                  ? 'Student verified · Tap below to scan sheet'
                  : 'Point at student QR · Tap to focus'}
              </Text>
            </View>
          )}
        </Animated.View>

        {/* Bottom Cyan Notched Card: Waits for QR before showing Student */}
        <NotchedCard
          backgroundColor={Colors.cyan}
          notchColor={Colors.canvasDark}>
          {scannedMatch ? (
            <View style={styles.foundHeaderRow}>
              <View style={styles.flex}>
                <Text style={styles.foundLabel}>
                  QR verified offline · Student found
                </Text>
                <Text style={styles.studentName} numberOfLines={1}>
                  {scannedMatch.studentName}
                </Text>
                <Text style={styles.studentSubMeta} numberOfLines={1}>
                  {scannedMatch.studentId} · {scannedMatch.studentSection}
                </Text>
                <Text style={styles.examMeta} numberOfLines={1}>
                  {scannedMatch.examSubject} · {scannedMatch.examTerm} ·{' '}
                  {scannedMatch.paperSize} ({scannedMatch.itemCount} items)
                </Text>
              </View>
              <Pressable onPress={handleRescanQr} style={styles.switchPill}>
                <Text style={styles.switchPillText}>Rescan</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.waitingWrap}>
              <Text style={styles.foundLabel}>Step 1 · Waiting for QR</Text>
              <Text style={styles.waitingTitle}>Scan student QR code</Text>
              <Text style={styles.examMeta}>
                {hasRosterReady
                  ? 'Align the QR printed on the student’s exam sheet. Student details appear once verified.'
                  : 'Create an exam and add students first, then scan a printed ExamIQ sheet QR.'}
              </Text>
            </View>
          )}

          {/* 3-Step Pipeline Indicator with Dead-Center "Capture" Label */}
          <View style={styles.stepperWrap}>
            <View style={styles.stepperDotsRow}>
              <View
                style={qrVerified ? styles.dotFilled : styles.dotActiveRing}
              />
              <View
                style={[styles.stepLine, qrVerified && styles.stepLineReady]}
              />
              <View style={styles.dotHollow} />
              <View style={styles.stepLine} />
              <View style={styles.dotHollow} />
            </View>
            <View style={styles.stepperLabelsRow}>
              <Text style={[styles.stepLabel, styles.stepLabelLeft]}>QR</Text>
              <Text style={[styles.stepLabel, styles.stepLabelCenter]}>
                Capture
              </Text>
              <Text style={[styles.stepLabel, styles.stepLabelRight]}>
                Check
              </Text>
            </View>
          </View>

          <PillButton
            label={
              qrVerified
                ? 'Next: Capture answer sheet →'
                : 'Capture answer sheet'
            }
            variant="dark"
            style={!qrVerified ? styles.lockedCaptureBtn : undefined}
            onPress={handleProceedToSheetScan}
          />
        </NotchedCard>
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
  cameraBackdrop: {
    position: 'absolute',
    top: 0,
    left: -20,
    right: -20,
    bottom: 0,
  },
  cameraFill: {
    flex: 1,
  },
  cameraScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(17,17,17,0.18)',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  topCenterPill: {
    backgroundColor: 'rgba(17,17,17,0.68)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radii.pill,
  },
  topCenterPillVerified: {
    backgroundColor: Colors.lime,
  },
  topCenterText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.surfaceWhite,
    textAlign: 'center',
  },
  topCenterTextVerified: {
    color: Colors.inkPrimary,
    fontWeight: '700',
  },
  circleBtnLight: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backChevron: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.inkPrimary,
    marginTop: -2,
  },
  viewfinderArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    zIndex: 2,
  },
  qrFrame: {
    width: 206,
    height: 206,
    padding: 12,
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
  },
  bracketRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  bracket: {
    width: 30,
    height: 30,
    borderColor: Colors.lime,
  },
  bracketError: {
    borderColor: Colors.coral,
  },
  bTL: {
    borderTopWidth: 3.5,
    borderLeftWidth: 3.5,
    borderTopLeftRadius: 12,
  },
  bTR: {
    borderTopWidth: 3.5,
    borderRightWidth: 3.5,
    borderTopRightRadius: 12,
  },
  bBL: {
    borderBottomWidth: 3.5,
    borderLeftWidth: 3.5,
    borderBottomLeftRadius: 12,
  },
  bBR: {
    borderBottomWidth: 3.5,
    borderRightWidth: 3.5,
    borderBottomRightRadius: 12,
  },
  centerCrosshair: {
    alignSelf: 'center',
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: 'rgba(198,244,83,0.75)',
  },
  scanHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(17,17,17,0.72)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: Radii.pill,
  },
  scanHint: {
    fontSize: 11,
    color: Colors.surfaceWhite,
    textAlign: 'center',
  },
  syncChip: {
    backgroundColor: Colors.lime,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radii.pill,
  },
  syncChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.inkPrimary,
  },
  foundHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  switchPill: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: Radii.pill,
    backgroundColor: 'rgba(17,17,17,0.16)',
  },
  switchPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.inkPrimary,
  },
  foundLabel: {
    fontSize: 12,
    color: Colors.surfaceWhite,
    opacity: 0.92,
  },
  waitingWrap: {
    gap: 2,
  },
  waitingTitle: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: Colors.surfaceWhite,
    marginTop: 2,
  },
  studentName: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: Colors.surfaceWhite,
    marginTop: 2,
  },
  studentSubMeta: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.inkPrimary,
    opacity: 0.78,
    marginTop: 2,
  },
  examMeta: {
    fontSize: 12,
    lineHeight: 17,
    color: Colors.surfaceWhite,
    opacity: 0.92,
    marginTop: 3,
  },
  stepperWrap: {
    marginVertical: 18,
  },
  stepperDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  dotFilled: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.inkPrimary,
  },
  dotActiveRing: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2.5,
    borderColor: Colors.inkPrimary,
    backgroundColor: Colors.surfaceWhite,
  },
  dotHollow: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Colors.inkPrimary,
  },
  stepLine: {
    flex: 1,
    height: 1.5,
    backgroundColor: 'rgba(17,17,17,0.3)',
    marginHorizontal: 4,
  },
  stepLineReady: {
    backgroundColor: Colors.inkPrimary,
  },
  lockedCaptureBtn: {
    opacity: 0.72,
  },
  stepperLabelsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  stepLabel: {
    flex: 1,
    fontSize: 11,
    fontWeight: '500',
    color: Colors.surfaceWhite,
  },
  stepLabelLeft: {
    textAlign: 'left',
  },
  stepLabelCenter: {
    textAlign: 'center',
  },
  stepLabelRight: {
    textAlign: 'right',
  },
});
