import React, {useMemo, useState} from 'react';
import {Image, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {
  FilterPills,
  FormModal,
  MinimalField,
  OwlMascot,
  PillButton,
  ScreenLayout,
  SearchIcon,
} from '@components/index';
import {BUBBLE_CHOICES, OMR_SENSITIVITY_PROFILES} from '@constants/omr';
import {BubbleChoice, OmrSensitivity} from '@core/types/common';
import {OmrFlagReason, ReviewTileView} from '@data/database/SeedData';
import {
  useExams,
  useProfileSettings,
  useResponsive,
  useRoster,
  useScanning,
  useServices,
  useToast,
} from '@hooks/index';
import {RootRoute, RootStackParamList} from '@navigation/routes';
import {Colors} from '@theme/colors';
import {Radii} from '@theme/spacing';

function getFlagReasonCopy(reason?: OmrFlagReason): {
  badge: string;
  note: string;
} | null {
  switch (reason) {
    case 'half_shaded':
      return {
        badge: 'Half-shaded bubble',
        note: 'Only part of the circle was filled. Real OMR sheets require full shading.',
      };
    case 'over_shaded':
      return {
        badge: 'Over-shaded (ink spill)',
        note: 'Shading spilled outside the bubble border. Verify the student’s intended choice.',
      };
    case 'double_shaded':
      return {
        badge: 'Multiple bubbles shaded',
        note: 'More than one bubble was marked on this item.',
      };
    case 'blank':
      return {
        badge: 'Blank / faint mark',
        note: 'No full shading met the active darkness threshold.',
      };
    default:
      return null;
  }
}

function getSensitivityThresholdMeta(sensitivity: OmrSensitivity): {
  label: string;
  thresholdPct: number;
  bleedPct: number;
} {
  const profile = OMR_SENSITIVITY_PROFILES[sensitivity];
  return {
    label: profile.label,
    thresholdPct: Math.round(profile.minShadedRatio * 100),
    bleedPct: Math.round(profile.maxBleedRatio * 100),
  };
}

function getTileColors(type: ReviewTileView['type']): {
  bg: string;
  text: string;
} {
  switch (type) {
    case 'correct':
      return {bg: Colors.reviewCorrectBg, text: Colors.reviewCorrectInk};
    case 'wrong':
      return {bg: Colors.reviewWrongBg, text: Colors.reviewWrongInk};
    case 'flagged':
      return {bg: Colors.reviewConflictBg, text: Colors.reviewConflictInk};
    case 'blank':
      return {bg: '#25262B', text: Colors.surfaceWhite};
  }
}

function formatTileDisplay(tile: ReviewTileView): {
  studentMark: string;
  subCaption: string;
} {
  if (tile.type === 'correct') {
    return {
      studentMark: tile.detected || tile.key,
      subCaption: 'Correct',
    };
  }
  if (tile.type === 'wrong') {
    const cleanMark = tile.detected.replace(/\s*\(.*?\)/g, '').trim() || 'Blank';
    return {
      studentMark: cleanMark,
      subCaption: `Key: ${tile.key}`,
    };
  }
  if (tile.type === 'blank') {
    return {
      studentMark: 'Blank',
      subCaption: `Key: ${tile.key}`,
    };
  }
  const cleanMark = tile.detected.replace(/\s*\(.*?\)/g, '').trim() || 'Check';
  const reasonTag =
    tile.flagReason === 'half_shaded'
      ? 'Half'
      : tile.flagReason === 'over_shaded'
      ? 'Spill'
      : tile.flagReason === 'double_shaded'
      ? 'Double'
      : 'Check';
  return {
    studentMark: cleanMark,
    subCaption: reasonTag,
  };
}

export const ReviewScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const container = useServices();
  const {selectedExam, essayQuestions, essayMaxPoints} = useExams();
  const {students, service: rosterService} = useRoster();
  const {settings} = useProfileSettings();
  const {effectiveContentWidth, gridColumns} = useResponsive();
  const {
    activeStudentId,
    alignedImageUri,
    reviewTiles,
    service: scanningService,
  } = useScanning();
  const {showToast} = useToast();

  const [selectedTileIdx, setSelectedTileIdx] = useState<number | null>(null);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [essayModalOpen, setEssayModalOpen] = useState(false);
  const [essayScoreDraft, setEssayScoreDraft] = useState('');
  const [essayMaxDraft, setEssayMaxDraft] = useState('');
  const [essayNoteDraft, setEssayNoteDraft] = useState('');

  const sensitivityMeta = getSensitivityThresholdMeta(settings.omrSensitivity);

  const student = students.find(s => s.id === activeStudentId) ??
    students[0] ?? {
      id: 'UNASSIGNED',
      name: 'No student yet',
      section: selectedExam.section,
      score: 0,
      total: selectedExam.items,
      status: 'Pending',
    };
  const editingTile =
    selectedTileIdx !== null ? reviewTiles[selectedTileIdx] : null;
  const hasFlaggedItems = reviewTiles.some(
    t => t.type === 'blank' || t.type === 'flagged',
  );

  const tileCounts = useMemo(() => {
    let correct = 0;
    let wrong = 0;
    let flagged = 0;
    let blank = 0;
    for (const t of reviewTiles) {
      if (t.type === 'correct') {
        correct += 1;
      } else if (t.type === 'wrong') {
        wrong += 1;
      } else if (t.type === 'blank') {
        blank += 1;
      } else {
        flagged += 1;
      }
    }
    return {correct, wrong, flagged, blank};
  }, [reviewTiles]);

  const tileGap = 8;
  const tileWidth = Math.max(
    64,
    Math.floor(
      (effectiveContentWidth - tileGap * (gridColumns - 1)) / gridColumns,
    ),
  );

  const effectiveManualMax = Math.max(essayMaxPoints, student.manualMax ?? 0);
  const effectiveManualScore = student.manualScore ?? 0;
  const combinedEarned = student.score + effectiveManualScore;
  const combinedTotal = student.total + effectiveManualMax;

  const openEssayModal = () => {
    const defaultMax = effectiveManualMax > 0 ? effectiveManualMax : 10;
    setEssayMaxDraft(String(defaultMax));
    setEssayScoreDraft(String(student.manualScore ?? 0));
    setEssayNoteDraft(student.manualNote ?? '');
    setEssayModalOpen(true);
  };

  const handleSaveEssayScore = () => {
    const maxPts = Math.max(1, parseInt(essayMaxDraft, 10) || effectiveManualMax || 10);
    const earnedPts = Math.max(
      0,
      Math.min(maxPts, parseInt(essayScoreDraft, 10) || 0),
    );
    rosterService.setStudentManualScore(
      student.id,
      earnedPts,
      maxPts,
      essayNoteDraft,
    );
    void container.flushNow();
    setEssayModalOpen(false);
    showToast(`Essay score: ${earnedPts}/${maxPts}`);
  };

  const handleApplyChoice = (choice: BubbleChoice | 'blank') => {
    if (selectedTileIdx === null) {
      return;
    }
    const {tile, delta} = scanningService.setReviewTileChoice(
      selectedTileIdx,
      choice,
    );
    setSelectedTileIdx(null);
    const deltaLabel =
      delta > 0 ? ` (+${delta})` : delta < 0 ? ` (${delta})` : '';
    showToast(
      `#${tile.num} set to ${choice === 'blank' ? 'Blank' : choice}${deltaLabel}`,
    );
  };

  return (
    <ScreenLayout scrollable={false}>
      <View style={styles.container}>
        <ScrollView
          style={styles.flex}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollBody}>
          {/* Scanned Paper Preview Container */}
          <Pressable
            onPress={() => setZoomOpen(true)}
            style={styles.paperPreviewBox}>
            {alignedImageUri ? (
              <Image
                source={{uri: alignedImageUri}}
                resizeMode="cover"
                style={styles.scannedThumb}
              />
            ) : (
              <Text style={styles.previewLabel}>
                Scanned paper · Tap to inspect
              </Text>
            )}
            <Pressable
              onPress={() => {
                if (navigation.canGoBack()) {
                  navigation.goBack();
                } else {
                  navigation.navigate(RootRoute.Alignment, {
                    scanId: `scan-${student.id}`,
                    rawImageUri: 'local://captured-sheet-01.jpg',
                  });
                }
              }}
              style={[styles.floatingCircle, styles.leftFloat]}>
              <Text style={styles.backChevron}>‹</Text>
            </Pressable>

            <Pressable
              onPress={() => setZoomOpen(true)}
              style={[styles.floatingCircle, styles.rightFloat]}>
              <SearchIcon size={16} color={Colors.inkPrimary} />
            </Pressable>
          </Pressable>

          <View style={styles.studentHeaderRow}>
            <View style={styles.flex}>
              <Text style={styles.examMeta}>
                {selectedExam.subject} · {selectedExam.term}
              </Text>
              <Text style={styles.scoreTitle}>
                {student.name} {combinedEarned}{' '}
                <Text style={styles.scoreDenom}>/ {combinedTotal}</Text>
              </Text>
              {effectiveManualMax > 0 ? (
                <Text style={styles.splitScoreMeta}>
                  OMR {student.score}/{student.total} + Essay{' '}
                  {effectiveManualScore}/{effectiveManualMax}
                </Text>
              ) : null}
            </View>
            <OwlMascot
              pose={hasFlaggedItems ? 'reviewing' : 'checked'}
              size={58}
            />
          </View>

          <View style={styles.badgeRow}>
            <View style={styles.metaPill}>
              <Text style={styles.metaPillText}>{student.id}</Text>
            </View>
            <View style={styles.metaPill}>
              <Text style={styles.metaPillText}>{student.section}</Text>
            </View>
          </View>

          {/* Compact 4-State Legend Strip */}
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, {backgroundColor: Colors.reviewCorrectBg}]} />
              <Text style={styles.legendText}>{tileCounts.correct} Correct</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, {backgroundColor: Colors.reviewWrongBg}]} />
              <Text style={styles.legendText}>{tileCounts.wrong} Wrong</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, {backgroundColor: Colors.reviewConflictBg}]} />
              <Text style={styles.legendText}>{tileCounts.flagged} Flagged</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, {backgroundColor: '#25262B'}]} />
              <Text style={styles.legendText}>{tileCounts.blank} Blank</Text>
            </View>
          </View>

          {/* Responsive Arrow-Free Answer Tile Grid */}
          <View style={styles.tileGrid}>
            {reviewTiles.map((tile, idx) => {
              const palette = getTileColors(tile.type);
              const view = formatTileDisplay(tile);
              return (
                <Pressable
                  key={tile.num}
                  onPress={() => setSelectedTileIdx(idx)}
                  style={({pressed}) => [
                    styles.tile,
                    {backgroundColor: palette.bg, width: tileWidth},
                    pressed && styles.tilePressed,
                  ]}>
                  <Text style={[styles.tileNum, {color: palette.text}]}>
                    #{tile.num}
                  </Text>
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    style={[styles.tileMark, {color: palette.text}]}>
                    {view.studentMark}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={[styles.tileSub, {color: palette.text}]}>
                    {view.subCaption}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Part II: Manual Essay Assessment Section */}
          <View style={styles.essaySection}>
            <View style={styles.essayHeaderRow}>
              <View style={styles.flex}>
                <Text style={styles.essayKicker}>
                  PART II · TEACHER ASSESSMENT
                </Text>
                <Text style={styles.essayTitle}>
                  {effectiveManualMax > 0
                    ? `Essay score: ${effectiveManualScore} / ${effectiveManualMax} pts`
                    : 'Add essay / manual points'}
                </Text>
                <Text style={styles.essaySub}>
                  {essayQuestions.length > 0
                    ? `${essayQuestions.length} essay prompt${
                        essayQuestions.length === 1 ? '' : 's'
                      } · Graded manually (kept separate from OMR)`
                    : 'Optional manual points added to the student’s combined grade'}
                </Text>
              </View>
              <Pressable onPress={openEssayModal} style={styles.essayActionPill}>
                <Text style={styles.essayActionText}>
                  {effectiveManualMax > 0 ? 'Grade' : '+ Add'}
                </Text>
              </Pressable>
            </View>
            {student.manualNote ? (
              <Text style={styles.essayNotePreview}>
                Remark: {student.manualNote}
              </Text>
            ) : null}
          </View>
        </ScrollView>

        {/* Bottom Actions (with Fast Batch Confirm & Scan Next) */}
        <View style={styles.bottomStack}>
          <View style={styles.bottomActions}>
            <PillButton
              label="Rescan"
              variant="muted"
              style={styles.flex}
              onPress={() =>
                navigation.navigate(RootRoute.PaperScanner, {
                  assignmentId: `${selectedExam.id}-${student.id}`,
                  examId: selectedExam.id,
                  studentId: student.id,
                })
              }
            />
            <PillButton
              label="Save"
              variant="outline"
              style={styles.flex}
              onPress={() => {
                scanningService.confirmActiveScan();
                void container.flushNow();
                showToast(`Saved (${combinedEarned}/${combinedTotal})`);
                navigation.navigate(RootRoute.ScanHistory);
              }}
            />
          </View>
          <PillButton
            label="Confirm & scan next →"
            variant="dark"
            onPress={() => {
              scanningService.confirmActiveScan();
              void container.flushNow();
              scanningService.cycleNextScanCandidate();
              showToast('Saved · Scan next QR');
              navigation.navigate(RootRoute.QrScanner, {
                examId: selectedExam.id,
              });
            }}
          />
        </View>
      </View>

      {/* Manual Verification Override Modal */}
      <FormModal
        visible={editingTile !== null}
        title={editingTile ? `Verify Item #${editingTile.num}` : 'Verify item'}
        subtitle={
          editingTile
            ? `Detected: ${editingTile.detected} · Answer key: ${editingTile.key}`
            : undefined
        }
        onClose={() => setSelectedTileIdx(null)}>
        {editingTile && getFlagReasonCopy(editingTile.flagReason) ? (
          <View style={styles.flagReasonCard}>
            <Text style={styles.flagReasonBadge}>
              {getFlagReasonCopy(editingTile.flagReason)!.badge}
            </Text>
            <Text style={styles.flagReasonNote}>
              {getFlagReasonCopy(editingTile.flagReason)!.note}
            </Text>
          </View>
        ) : null}

        {editingTile?.fillRatios ? (
          <View style={styles.calibrationCard}>
            <View style={styles.calibrationHeader}>
              <Text style={styles.calibrationHeading}>
                OMR SHADING FILL
              </Text>
              <View style={styles.thresholdBadge}>
                <Text style={styles.thresholdBadgeText}>
                  {sensitivityMeta.label} ≥{sensitivityMeta.thresholdPct}%
                </Text>
              </View>
            </View>

            {BUBBLE_CHOICES.map(letter => {
              const rawRatio = editingTile.fillRatios?.[letter] ?? 0;
              const pct = Math.max(0, Math.min(100, Math.round(rawRatio * 100)));
              const bleedPct = Math.max(
                0,
                Math.min(
                  100,
                  Math.round((editingTile.bleedRatios?.[letter] ?? 0) * 100),
                ),
              );
              const isShaded = pct >= sensitivityMeta.thresholdPct;
              const isKey = letter === editingTile.key;
              const barColor = !isShaded
                ? '#D2D2CA'
                : editingTile.type === 'flagged'
                  ? Colors.purpleDeep
                  : isKey
                    ? Colors.limeDeep
                    : Colors.coralDeep;

              return (
                <View key={letter} style={styles.meterRow}>
                  <View
                    style={[
                      styles.meterLetterChip,
                      isKey && styles.meterLetterChipKey,
                    ]}>
                    <Text
                      style={[
                        styles.meterLetterText,
                        isKey && styles.meterLetterTextKey,
                      ]}>
                      {letter}
                    </Text>
                  </View>

                  <View style={styles.meterTrack}>
                    <View
                      style={[
                        styles.meterFill,
                        {width: `${pct}%`, backgroundColor: barColor},
                      ]}
                    />
                    <View
                      style={[
                        styles.meterCutoffLine,
                        {left: `${sensitivityMeta.thresholdPct}%`},
                      ]}
                    />
                  </View>

                  {bleedPct >= sensitivityMeta.bleedPct ? (
                    <Text style={styles.bleedTag}>Spill {bleedPct}%</Text>
                  ) : null}

                  <Text
                    style={[
                      styles.meterPctText,
                      isShaded && styles.meterPctTextStrong,
                    ]}>
                    {pct}%
                  </Text>
                </View>
              );
            })}

            <View style={styles.calibrationFooter}>
              <Text style={styles.calibrationHint}>
                Vertical marker shows the active shade cutoff.
              </Text>
              <Pressable
                onPress={() => {
                  setSelectedTileIdx(null);
                  navigation.navigate(RootRoute.Settings);
                }}>
                <Text style={styles.tuneLink}>Tune ›</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <Text style={styles.modalPrompt}>
          Select the student&apos;s actual shaded choice:
        </Text>
        <FilterPills<BubbleChoice | 'blank'>
          value={
            editingTile && BUBBLE_CHOICES.includes(editingTile.detected as BubbleChoice)
              ? (editingTile.detected as BubbleChoice)
              : 'blank'
          }
          onChange={handleApplyChoice}
          options={[
            ...BUBBLE_CHOICES.map(c => ({
              label: c === editingTile?.key ? `${c} (Key)` : c,
              value: c as BubbleChoice | 'blank',
            })),
            {label: 'Blank', value: 'blank'},
          ]}
        />
        {editingTile && editingTile.type !== 'correct' ? (
          <PillButton
            label={`Accept answer key (${editingTile.key})`}
            variant="lime"
            onPress={() => handleApplyChoice(editingTile.key)}
          />
        ) : null}
      </FormModal>

      {/* Manual Essay / Teacher Assessment Modal */}
      <FormModal
        visible={essayModalOpen}
        title="Essay / manual score"
        subtitle={`${student.name} · OMR stays ${student.score}/${student.total}`}
        onClose={() => setEssayModalOpen(false)}
        footer={
          <View style={styles.bottomActions}>
            <PillButton
              label="Cancel"
              variant="muted"
              style={styles.flex}
              onPress={() => setEssayModalOpen(false)}
            />
            <PillButton
              label="Save score"
              variant="dark"
              style={styles.flex}
              onPress={handleSaveEssayScore}
            />
          </View>
        }>
        {essayQuestions.length > 0 ? (
          <View style={styles.essayPromptList}>
            {essayQuestions.map((eq, idx) => (
              <Text key={eq.num} style={styles.essayPromptItem}>
                {idx + 1}. {eq.text} ({eq.maxPoints ?? 10} pts)
              </Text>
            ))}
          </View>
        ) : null}

        <View style={styles.essayInputsRow}>
          <MinimalField
            variant="soft"
            label="Earned points"
            value={essayScoreDraft}
            onChangeText={setEssayScoreDraft}
            keyboardType="number-pad"
            placeholder="0"
            containerStyle={styles.flex}
          />
          <MinimalField
            variant="soft"
            label="Max points"
            value={essayMaxDraft}
            onChangeText={setEssayMaxDraft}
            keyboardType="number-pad"
            placeholder="10"
            containerStyle={styles.flex}
          />
        </View>

        <MinimalField
          variant="soft"
          label="Teacher remark (optional)"
          value={essayNoteDraft}
          onChangeText={setEssayNoteDraft}
          placeholder="e.g. Clear argument, neat solution"
        />
      </FormModal>

      {/* Zoomed Scanned Sheet Modal */}
      <FormModal
        visible={zoomOpen}
        title={`${student.name} · Aligned Scan`}
        subtitle={`${selectedExam.subject} · ${selectedExam.term} · 0.0° rectified`}
        onClose={() => setZoomOpen(false)}>
        {alignedImageUri ? (
          <Image
            source={{uri: alignedImageUri}}
            resizeMode="contain"
            style={styles.zoomPhoto}
          />
        ) : null}
        <View style={styles.zoomCard}>
          {reviewTiles.map(tile => (
            <View key={tile.num} style={styles.zoomRow}>
              <Text style={styles.zoomItemNum}>Item {tile.num}</Text>
              <View style={styles.zoomBubbles}>
                {BUBBLE_CHOICES.map(letter => {
                  const detectedTokens =
                    tile.type === 'blank'
                      ? []
                      : tile.detected
                          .split(/\s*\+\s*/)
                          .map(part => part.replace(/\s*\(.*?\)/g, '').trim());
                  const shaded = detectedTokens.includes(letter);
                  const isKey = tile.key === letter;
                  return (
                    <View
                      key={letter}
                      style={[
                        styles.zoomBubble,
                        shaded && styles.zoomBubbleShaded,
                        isKey && styles.zoomBubbleKey,
                      ]}>
                      <Text
                        style={[
                          styles.zoomBubbleText,
                          shaded && styles.zoomBubbleTextShaded,
                        ]}>
                        {letter}
                      </Text>
                    </View>
                  );
                })}
              </View>
              <Text style={styles.zoomStatus}>{tile.label}</Text>
            </View>
          ))}
        </View>
      </FormModal>
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
  paperPreviewBox: {
    height: 176,
    borderRadius: 26,
    backgroundColor: '#E5E5E0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    position: 'relative',
    overflow: 'hidden',
  },
  scrollBody: {
    paddingBottom: 12,
  },
  scannedThumb: {
    width: '100%',
    height: '100%',
  },
  zoomPhoto: {
    width: '100%',
    height: 280,
    borderRadius: 16,
    backgroundColor: Colors.surfaceWhite,
  },
  floatingCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceWhite,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    top: 14,
  },
  leftFloat: {
    left: 14,
  },
  rightFloat: {
    right: 14,
  },
  backChevron: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.inkPrimary,
    marginTop: -2,
  },
  previewLabel: {
    fontSize: 12,
    color: Colors.inkMuted,
  },
  studentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  examMeta: {
    fontSize: 12,
    color: Colors.inkMuted,
  },
  scoreTitle: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: Colors.inkPrimary,
    marginTop: 2,
  },
  scoreDenom: {
    fontWeight: '400',
    color: Colors.inkMuted,
  },
  splitScoreMeta: {
    fontSize: 11.5,
    fontWeight: '600',
    color: Colors.purpleDeep,
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    marginBottom: 14,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.inkSecondary,
  },
  metaPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radii.pill,
    backgroundColor: Colors.surfaceWhite,
    borderWidth: 1,
    borderColor: Colors.hairlineLight,
  },
  metaPillText: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.inkPrimary,
  },
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tile: {
    minHeight: 78,
    borderRadius: 16,
    paddingHorizontal: 9,
    paddingVertical: 9,
    justifyContent: 'space-between',
  },
  tilePressed: {
    opacity: 0.85,
    transform: [{scale: 0.97}],
  },
  tileNum: {
    fontSize: 10,
    fontWeight: '600',
    opacity: 0.78,
  },
  tileMark: {
    fontSize: 19,
    fontWeight: '800',
    textAlign: 'center',
    marginVertical: 1,
  },
  tileSub: {
    fontSize: 9.5,
    fontWeight: '700',
    textAlign: 'center',
    opacity: 0.82,
  },
  essaySection: {
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.hairlineLight,
    gap: 6,
  },
  essayHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  essayKicker: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.7,
    color: Colors.purpleDeep,
  },
  essayTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.inkPrimary,
    marginTop: 2,
  },
  essaySub: {
    fontSize: 11,
    color: Colors.inkMuted,
    marginTop: 2,
  },
  essayActionPill: {
    backgroundColor: Colors.inkPrimary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radii.pill,
  },
  essayActionText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: Colors.lime,
  },
  essayNotePreview: {
    fontSize: 11.5,
    color: Colors.inkSecondary,
    fontStyle: 'italic',
  },
  essayPromptList: {
    gap: 6,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairlineLight,
  },
  essayPromptItem: {
    fontSize: 12,
    lineHeight: 17,
    color: Colors.inkPrimary,
  },
  essayInputsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  bottomStack: {
    gap: 8,
    paddingTop: 12,
  },
  bottomActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalPrompt: {
    fontSize: 12,
    color: Colors.inkMuted,
  },
  flagReasonCard: {
    backgroundColor: Colors.purpleSoft,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
  },
  flagReasonBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.purpleDeep,
  },
  flagReasonNote: {
    fontSize: 11,
    lineHeight: 15,
    color: Colors.inkSecondary,
  },
  bleedTag: {
    fontSize: 9.5,
    fontWeight: '700',
    color: Colors.coralDeep,
  },
  calibrationCard: {
    backgroundColor: Colors.canvasLight,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.hairlineLight,
    padding: 12,
    gap: 8,
  },
  calibrationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  calibrationHeading: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.7,
    color: Colors.inkMuted,
  },
  thresholdBadge: {
    backgroundColor: Colors.surfaceWhite,
    borderWidth: 1,
    borderColor: Colors.hairlineLight,
    borderRadius: Radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  thresholdBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.inkPrimary,
  },
  meterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  meterLetterChip: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.surfaceWhite,
    borderWidth: 1,
    borderColor: Colors.hairlineLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meterLetterChipKey: {
    backgroundColor: Colors.lime,
    borderColor: Colors.limeDeep,
  },
  meterLetterText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.inkPrimary,
  },
  meterLetterTextKey: {
    color: Colors.inkPrimary,
  },
  meterTrack: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.surfaceWhite,
    borderWidth: 1,
    borderColor: Colors.hairlineLight,
    overflow: 'hidden',
    position: 'relative',
  },
  meterFill: {
    height: '100%',
    borderRadius: 4,
  },
  meterCutoffLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1.5,
    backgroundColor: Colors.inkPrimary,
    opacity: 0.55,
  },
  meterPctText: {
    width: 36,
    textAlign: 'right',
    fontSize: 11,
    fontWeight: '600',
    color: Colors.inkMuted,
    fontVariant: ['tabular-nums'],
  },
  meterPctTextStrong: {
    fontWeight: '700',
    color: Colors.inkPrimary,
  },
  calibrationFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  calibrationHint: {
    fontSize: 10,
    color: Colors.inkMuted,
    flex: 1,
  },
  tuneLink: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.inkPrimary,
    paddingLeft: 8,
  },
  zoomCard: {
    backgroundColor: Colors.surfaceWhite,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.hairlineLight,
    padding: 14,
    gap: 10,
  },
  zoomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  zoomItemNum: {
    width: 52,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.inkPrimary,
  },
  zoomBubbles: {
    flexDirection: 'row',
    gap: 8,
  },
  zoomBubble: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.inkPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomBubbleShaded: {
    backgroundColor: Colors.inkPrimary,
  },
  zoomBubbleKey: {
    borderColor: Colors.limeDeep,
  },
  zoomBubbleText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.inkPrimary,
  },
  zoomBubbleTextShaded: {
    color: Colors.surfaceWhite,
  },
  zoomStatus: {
    width: 54,
    textAlign: 'right',
    fontSize: 11,
    fontWeight: '700',
    color: Colors.inkMuted,
  },
});
