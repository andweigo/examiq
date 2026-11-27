import React from 'react';
import {Keyboard, Modal, Pressable, StyleSheet, Text, View} from 'react-native';
import {PillButton, PillButtonVariant} from '@components/common/PillButton';
import {Colors} from '@theme/colors';
import {Radii} from '@theme/spacing';

export type ConfirmDialogTone = 'info' | 'destructive';

export interface ConfirmDialogProps {
  visible: boolean;
  badge?: string;
  title: string;
  message: string;
  tone?: ConfirmDialogTone;
  cancelLabel?: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}

const TONE_META: Record<
  ConfirmDialogTone,
  {
    pillBg: string;
    dotColor: string;
    pillText: string;
    confirmVariant: PillButtonVariant;
    defaultBadge: string;
  }
> = {
  info: {
    pillBg: Colors.purpleSoft,
    dotColor: Colors.purpleDeep,
    pillText: Colors.purpleDeep,
    confirmVariant: 'dark',
    defaultBadge: 'Notice',
  },
  destructive: {
    pillBg: '#FDE8E0',
    dotColor: Colors.coralDeep,
    pillText: Colors.coralDeep,
    confirmVariant: 'coral',
    defaultBadge: 'Confirm',
  },
};

/**
 * Custom ExamIQ confirmation & notice dialog built on the app's warm
 * off-white, rounded-card, semantic-pill, and pill-button design system.
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  visible,
  badge,
  title,
  message,
  tone = 'info',
  cancelLabel = 'Cancel',
  confirmLabel,
  onCancel,
  onConfirm,
}) => {
  const palette = TONE_META[tone];
  const badgeText = badge ?? palette.defaultBadge;

  const handleDismiss = () => {
    Keyboard.dismiss();
    onCancel();
  };

  const handleConfirm = () => {
    Keyboard.dismiss();
    onConfirm();
  };

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="fade"
      onRequestClose={handleDismiss}>
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={handleDismiss}
          accessibilityLabel="Close dialog"
        />
        <View style={styles.card}>
          <View style={styles.topRow}>
            <View
              style={[styles.badgePill, {backgroundColor: palette.pillBg}]}>
              <View
                style={[styles.badgeDot, {backgroundColor: palette.dotColor}]}
              />
              <Text style={[styles.badgeText, {color: palette.pillText}]}>
                {badgeText}
              </Text>
            </View>
            <Pressable
              onPress={handleDismiss}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={10}
              style={styles.closeBtn}>
              <Text style={styles.closeGlyph}>×</Text>
            </Pressable>
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <View style={styles.actions}>
            <PillButton
              label={cancelLabel}
              variant="muted"
              style={styles.actionBtn}
              onPress={handleDismiss}
            />
            <PillButton
              label={confirmLabel}
              variant={palette.confirmVariant}
              style={styles.actionBtn}
              onPress={handleConfirm}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(17,17,17,0.56)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  card: {
    width: '100%',
    maxWidth: 356,
    backgroundColor: Colors.canvasLight,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: Colors.hairlineLight,
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 20,
    shadowColor: '#000000',
    shadowOffset: {width: 0, height: 14},
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 16,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radii.pill,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: Radii.pill,
    backgroundColor: Colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeGlyph: {
    fontSize: 19,
    fontWeight: '500',
    color: Colors.inkSecondary,
    lineHeight: 21,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.inkPrimary,
    letterSpacing: -0.4,
    lineHeight: 25,
  },
  message: {
    fontSize: 13.5,
    lineHeight: 20,
    color: Colors.inkSecondary,
    marginTop: 8,
    marginBottom: 22,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
  },
});
