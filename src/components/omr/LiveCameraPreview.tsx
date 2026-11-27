import React, {useEffect, useState} from 'react';
import {
  DeviceEventEmitter,
  PermissionsAndroid,
  Platform,
  Pressable,
  requireNativeComponent,
  StyleProp,
  StyleSheet,
  Text,
  UIManager,
  View,
  ViewStyle,
} from 'react-native';
import {Colors} from '@theme/colors';
import {Radii} from '@theme/spacing';

interface NativeCameraProps {
  mode: 'qr' | 'paper';
  torchEnabled: boolean;
  active: boolean;
  style?: StyleProp<ViewStyle>;
}

function detectNativeCameraView(): boolean {
  if (Platform.OS !== 'android') {
    return false;
  }
  try {
    if (
      typeof UIManager.hasViewManagerConfig === 'function' &&
      UIManager.hasViewManagerConfig('ExamIQCameraView')
    ) {
      return true;
    }
  } catch {
    // Fallback to getViewManagerConfig below
  }
  try {
    return Boolean(UIManager.getViewManagerConfig?.('ExamIQCameraView'));
  } catch {
    return false;
  }
}

const HAS_NATIVE_CAMERA = detectNativeCameraView();

const NativeExamIQCameraView = HAS_NATIVE_CAMERA
  ? requireNativeComponent<NativeCameraProps>('ExamIQCameraView')
  : null;

export interface LiveCornerBox {
  readonly slot: 'TL' | 'TR' | 'BL' | 'BR' | string;
  readonly found: boolean;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface LiveCameraPreviewProps {
  mode: 'qr' | 'paper';
  torchEnabled: boolean;
  active?: boolean;
  onQrDetected?: (rawValue: string) => void;
  onMarkersStatus?: (
    detectedCount: number,
    ready: boolean,
    corners?: LiveCornerBox[],
  ) => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * Live Android CameraX viewfinder with runtime CAMERA permission request,
 * offline ML Kit QR detection events, and live corner-mark tracking.
 * Unmounts the native camera view when inactive so QR & Paper screens never fight for hardware access.
 */
export const LiveCameraPreview: React.FC<LiveCameraPreviewProps> = ({
  mode,
  torchEnabled,
  active = true,
  onQrDetected,
  onMarkersStatus,
  style,
}) => {
  const [hasPermission, setHasPermission] = useState(false);

  const requestCameraPermission = async () => {
    if (Platform.OS !== 'android') {
      return;
    }
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        {
          title: 'ExamIQ Camera Access',
          message:
            'ExamIQ needs your camera to scan student QR codes and check printed OMR answer sheets offline.',
          buttonPositive: 'Allow',
          buttonNegative: 'Cancel',
        },
      );
      setHasPermission(granted === PermissionsAndroid.RESULTS.GRANTED);
    } catch {
      setHasPermission(false);
    }
  };

  useEffect(() => {
    if (!HAS_NATIVE_CAMERA) {
      return;
    }
    let mounted = true;
    PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA).then(ok => {
      if (!mounted) {
        return;
      }
      if (ok) {
        setHasPermission(true);
      } else {
        requestCameraPermission();
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!HAS_NATIVE_CAMERA || !hasPermission || !active) {
      return;
    }
    const qrSub = DeviceEventEmitter.addListener(
      'ExamIQ_OnQrDetected',
      (payload: {rawValue?: string}) => {
        if (payload?.rawValue && onQrDetected) {
          onQrDetected(payload.rawValue);
        }
      },
    );
    const markerSub = DeviceEventEmitter.addListener(
      'ExamIQ_OnMarkersStatus',
      (payload: {
        detectedCount?: number;
        ready?: boolean;
        corners?: LiveCornerBox[];
      }) => {
        if (onMarkersStatus && typeof payload?.detectedCount === 'number') {
          onMarkersStatus(
            payload.detectedCount,
            Boolean(payload.ready),
            Array.isArray(payload.corners) ? payload.corners : undefined,
          );
        }
      },
    );
    return () => {
      qrSub.remove();
      markerSub.remove();
    };
  }, [hasPermission, active, onQrDetected, onMarkersStatus]);

  if (!NativeExamIQCameraView) {
    return (
      <View style={[styles.permissionBox, style]}>
        <Text style={styles.permTitle}>Native camera module not installed</Text>
        <Text style={styles.permSub}>
          Reinstall the latest Android debug build (npm run android) to activate
          live CameraX scanning.
        </Text>
      </View>
    );
  }

  if (!hasPermission) {
    return (
      <View style={[styles.permissionBox, style]}>
        <Text style={styles.permTitle}>Camera permission required</Text>
        <Text style={styles.permSub}>
          Allow camera access to scan printed QR codes and check sheets offline.
        </Text>
        <Pressable onPress={requestCameraPermission} style={styles.permBtn}>
          <Text style={styles.permBtnText}>Enable camera</Text>
        </Pressable>
      </View>
    );
  }

  if (!active) {
    return <View style={[styles.inactiveBackdrop, style]} />;
  }

  return (
    <NativeExamIQCameraView
      mode={mode}
      torchEnabled={torchEnabled}
      active={active}
      style={style}
    />
  );
};

const styles = StyleSheet.create({
  inactiveBackdrop: {
    backgroundColor: '#111111',
  },
  permissionBox: {
    backgroundColor: '#181818',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 8,
  },
  permTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.surfaceWhite,
    textAlign: 'center',
  },
  permSub: {
    fontSize: 11,
    color: Colors.inkOnDarkMuted,
    textAlign: 'center',
    lineHeight: 16,
  },
  permBtn: {
    marginTop: 6,
    backgroundColor: Colors.lime,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radii.pill,
  },
  permBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.inkPrimary,
  },
});
