import React, {useMemo} from 'react';
import {StyleSheet, View} from 'react-native';
import QRCode from 'qrcode';
import Svg, {Rect} from 'react-native-svg';
import {Colors} from '@theme/colors';

export interface QrMatrixSvgProps {
  seed: string;
  size?: number;
}

/**
 * Real offline ISO/IEC 18004 scannable QR code renderer using react-native-svg.
 * Readable by ExamIQ's live camera scanner and any standard QR reader.
 */
export const QrMatrixSvg: React.FC<QrMatrixSvgProps> = ({seed, size = 54}) => {
  const {modules, moduleCount} = useMemo(() => {
    const qr = QRCode.create(seed || 'EXAMIQ', {errorCorrectionLevel: 'M'});
    const count = qr.modules.size;
    const data = qr.modules.data;
    const cells: Array<{key: string; r: number; c: number}> = [];

    for (let r = 0; r < count; r += 1) {
      for (let c = 0; c < count; c += 1) {
        if (data[r * count + c]) {
          cells.push({key: `${r}-${c}`, r, c});
        }
      }
    }
    return {modules: cells, moduleCount: count};
  }, [seed]);

  const quietZone = 3;
  const viewSize = moduleCount + quietZone * 2;
  const innerSize = Math.max(16, size - 2);

  return (
    <View style={[styles.frame, {width: size, height: size}]}>
      <Svg
        width={innerSize}
        height={innerSize}
        viewBox={`0 0 ${viewSize} ${viewSize}`}>
        <Rect
          x={0}
          y={0}
          width={viewSize}
          height={viewSize}
          fill={Colors.surfaceWhite}
        />
        {modules.map(cell => (
          <Rect
            key={cell.key}
            x={cell.c + quietZone}
            y={cell.r + quietZone}
            width={1.03}
            height={1.03}
            fill={Colors.inkPrimary}
          />
        ))}
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  frame: {
    backgroundColor: Colors.surfaceWhite,
    borderWidth: 1,
    borderColor: Colors.inkPrimary,
    borderRadius: 10,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
