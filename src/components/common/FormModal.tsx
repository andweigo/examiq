import React, {PropsWithChildren, ReactNode} from 'react';
import {
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useKeyboardHeight} from '@hooks/useKeyboardHeight';
import {Colors} from '@theme/colors';
import {Radii} from '@theme/spacing';

export interface FormModalProps extends PropsWithChildren {
  visible: boolean;
  title: string;
  subtitle?: string;
  footer?: ReactNode;
  onClose: () => void;
}

/**
 * Minimalist ExamIQ bottom sheet modal with cross-platform keyboard avoidance
 * (works inside Android Dialog modals and iOS edge-to-edge layouts).
 */
export const FormModal: React.FC<FormModalProps> = ({
  visible,
  title,
  subtitle,
  footer,
  onClose,
  children,
}) => {
  const keyboardHeight = useKeyboardHeight();
  const insets = useSafeAreaInsets();
  const {height: windowHeight} = useWindowDimensions();

  const availableSheetMaxHeight = Math.max(
    260,
    windowHeight - keyboardHeight - insets.top - 28,
  );

  const handleClose = () => {
    Keyboard.dismiss();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="fade"
      onRequestClose={handleClose}>
      <View
        style={[
          styles.backdrop,
          {paddingBottom: keyboardHeight > 0 ? keyboardHeight : 0},
        ]}>
        <Pressable style={styles.dismissLayer} onPress={handleClose} />
        <View
          style={[
            styles.sheet,
            {
              maxHeight: availableSheetMaxHeight,
              paddingBottom:
                keyboardHeight > 0 ? 16 : Math.max(insets.bottom + 16, 24),
            },
          ]}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title}>{title}</Text>
              {subtitle ? (
                <Text style={styles.subtitle}>{subtitle}</Text>
              ) : null}
            </View>
            <Pressable
              onPress={handleClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={10}
              style={styles.closeBtn}>
              <Text style={styles.closeGlyph}>×</Text>
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            bounces={false}
            contentContainerStyle={styles.body}>
            {children}
          </ScrollView>

          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(17,17,17,0.54)',
    justifyContent: 'flex-end',
  },
  dismissLayer: {
    flex: 1,
  },
  sheet: {
    backgroundColor: Colors.canvasLight,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 10,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D6D6D0',
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 18,
    gap: 12,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 19,
    fontWeight: '700',
    color: Colors.inkPrimary,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 12,
    color: Colors.inkMuted,
    marginTop: 3,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeGlyph: {
    fontSize: 22,
    fontWeight: '400',
    color: Colors.inkMuted,
    lineHeight: 24,
  },
  body: {
    gap: 16,
    paddingBottom: 6,
  },
  footer: {
    paddingTop: 16,
  },
});
