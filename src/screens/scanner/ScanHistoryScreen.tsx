import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {
  DisplayHeading,
  OwlMascot,
  PillButton,
  ScreenLayout,
} from '@components/index';
import {useScanning} from '@hooks/index';
import {RootRoute, RootStackParamList} from '@navigation/routes';
import {Colors} from '@theme/colors';

export const ScanHistoryScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {scanHistory, service: scanningService} = useScanning();

  return (
    <ScreenLayout dark activeTab="scan">
      <View style={styles.heroRow}>
        <DisplayHeading dark lightText="Scan" boldText="history" />
        <OwlMascot pose="scanning" size={68} />
      </View>

      <View style={styles.summaryRow}>
        <View>
          <Text style={styles.subLabel}>Offline · Local SQLite</Text>
          <Text style={styles.subCount}>
            {scanHistory.length} papers stored on device
          </Text>
        </View>
        <PillButton
          label="Backup now"
          variant="lime"
          compact
          onPress={() => navigation.navigate(RootRoute.BackupRestore)}
        />
      </View>

      <View>
        {scanHistory.length === 0 ? (
          <View style={styles.emptyState}>
            <OwlMascot pose="empty" size={96} />
            <Text style={styles.emptyTitle}>No scans yet</Text>
            <Text style={styles.emptySub}>
              Scanned answer sheets will appear here automatically.
            </Text>
          </View>
        ) : (
          scanHistory.map(item => (
            <Pressable
              key={item.id}
              onPress={() => {
                scanningService.setActiveSession(item.studentId, item.examId);
                navigation.navigate(RootRoute.Review, {scanId: item.id});
              }}
              style={({pressed}) => [styles.row, pressed && styles.rowPressed]}>
              <View>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.meta}>{item.meta}</Text>
              </View>
              <Text style={[styles.status, {color: item.color}]}>
                {item.status}
              </Text>
            </Pressable>
          ))
        )}
      </View>
    </ScreenLayout>
  );
};

const styles = StyleSheet.create({
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 22,
  },
  subLabel: {
    fontSize: 12,
    color: Colors.inkOnDarkMuted,
  },
  subCount: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.surfaceWhite,
    marginTop: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairlineDark,
  },
  rowPressed: {
    opacity: 0.78,
  },
  name: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.surfaceWhite,
  },
  meta: {
    fontSize: 12,
    color: Colors.inkSubtle,
    marginTop: 2,
  },
  status: {
    fontSize: 12,
    fontWeight: '700',
  },
  emptyState: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.surfaceWhite,
  },
  emptySub: {
    fontSize: 12,
    color: Colors.inkOnDarkMuted,
    textAlign: 'center',
  },
});
