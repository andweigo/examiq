import React, {useMemo, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {
  BackHeader,
  DisplayHeading,
  OwlMascot,
  ScreenLayout,
  SegmentedControl,
} from '@components/index';
import {AlertCategory, DeviceAlertView} from '@data/database/SeedData';
import {
  useExams,
  useProfileSettings,
  useRoster,
  useScanning,
  useToast,
} from '@hooks/index';
import {RootRoute, RootStackParamList} from '@navigation/routes';
import {Colors} from '@theme/colors';

type AlertFilter = 'all' | 'unread';

function categoryColor(category?: AlertCategory): string {
  switch (category) {
    case 'scan':
      return Colors.purple;
    case 'score':
      return Colors.coral;
    case 'exam':
      return Colors.lime;
    case 'roster':
      return Colors.cyan;
    case 'security':
      return Colors.coralDeep;
    default:
      return Colors.inkPrimary;
  }
}

export const DeviceAlertsScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {alerts, unreadAlertCount, service} = useProfileSettings();
  const {selectedExam, service: examService} = useExams();
  const {selectedGeneratorStudent} = useRoster(selectedExam.section);
  const {service: scanningService} = useScanning();
  const {showToast} = useToast();

  const [filter, setFilter] = useState<AlertFilter>('all');

  const visibleAlerts = useMemo(
    () => (filter === 'unread' ? alerts.filter(a => a.unread) : alerts),
    [alerts, filter],
  );
  const hasReadAlerts = alerts.some(a => !a.unread);

  const handleOpenAlert = (alert: DeviceAlertView) => {
    service.markAlertRead(alert.id);
    if (alert.targetExamId) {
      examService.selectExam(alert.targetExamId);
    }
    if (alert.targetStudentId) {
      scanningService.setActiveSession(
        alert.targetStudentId,
        alert.targetExamId ?? selectedExam.id,
      );
    }

    const examId = alert.targetExamId ?? selectedExam.id;
    const studentId = alert.targetStudentId ?? selectedGeneratorStudent.id;

    switch (alert.targetRoute) {
      case RootRoute.Review:
        navigation.navigate(RootRoute.Review, {scanId: `scan-${studentId}`});
        return;
      case RootRoute.Results:
        navigation.navigate(RootRoute.Results, {examId});
        return;
      case RootRoute.Reports:
        navigation.navigate(RootRoute.Reports, {examId});
        return;
      case RootRoute.ExamPaper:
        if (examId) {
          navigation.navigate(RootRoute.ExamPaper, {examId, studentId});
        }
        return;
      case RootRoute.ExamGenerator:
        if (examId) {
          navigation.navigate(RootRoute.ExamGenerator, {examId});
        }
        return;
      case RootRoute.Students:
        navigation.navigate(RootRoute.Students);
        return;
      case RootRoute.BackupRestore:
        navigation.navigate(RootRoute.BackupRestore);
        return;
      case RootRoute.Profile:
        navigation.navigate(RootRoute.Profile);
        return;
      default:
        return;
    }
  };

  return (
    <ScreenLayout activeTab="home">
      <BackHeader
        onBack={() => navigation.navigate(RootRoute.Dashboard)}
        right={
          <View style={styles.headerActions}>
            {unreadAlertCount > 0 ? (
              <Pressable
                onPress={() => {
                  service.markAllAlertsRead();
                  showToast('Marked all read');
                }}>
                <Text style={styles.markRead}>Mark read</Text>
              </Pressable>
            ) : null}
            {hasReadAlerts ? (
              <Pressable
                onPress={() => {
                  service.clearReadAlerts();
                  showToast('Cleared read alerts');
                }}>
                <Text style={styles.clearRead}>Clear read</Text>
              </Pressable>
            ) : null}
          </View>
        }
      />

      <DisplayHeading
        lightText="Device"
        boldText="alerts"
        style={styles.heading}
      />

      <SegmentedControl<AlertFilter>
        compact
        value={filter}
        onChange={setFilter}
        options={[
          {label: 'All', value: 'all'},
          {label: 'Unread', value: 'unread'},
        ]}
        style={styles.filterBar}
      />

      {visibleAlerts.length === 0 ? (
        <View style={styles.emptyState}>
          <OwlMascot pose="empty" size={96} />
          <Text style={styles.emptyTitle}>
            {filter === 'unread' ? 'All caught up' : 'No alerts yet'}
          </Text>
          <Text style={styles.emptySub}>
            Scanning conflicts, low passing rates, roster imports, and backup
            reminders appear here automatically.
          </Text>
        </View>
      ) : (
        <View>
          {visibleAlerts.map(alert => (
            <Pressable
              key={alert.id}
              onPress={() => handleOpenAlert(alert)}
              style={({pressed}) => [styles.row, pressed && styles.pressed]}>
              <View
                style={[
                  styles.catDot,
                  {backgroundColor: categoryColor(alert.category)},
                ]}
              />
              <View style={styles.rowText}>
                <View style={styles.titleRow}>
                  <Text
                    style={[styles.title, !alert.unread && styles.titleRead]}
                    numberOfLines={2}>
                    {alert.title}
                  </Text>
                  {alert.unread ? <View style={styles.unreadDot} /> : null}
                </View>
                {alert.detail ? (
                  <Text style={styles.detail} numberOfLines={2}>
                    {alert.detail}
                  </Text>
                ) : null}
                <View style={styles.metaRow}>
                  <Text style={styles.time}>{alert.time}</Text>
                  {alert.targetRoute ? (
                    <Text style={styles.openLink}>Open ›</Text>
                  ) : null}
                </View>
              </View>

              <Pressable
                onPress={() => service.dismissAlert(alert.id)}
                hitSlop={10}
                accessibilityLabel="Dismiss alert"
                style={styles.dismissBtn}>
                <Text style={styles.dismissText}>×</Text>
              </Pressable>
            </Pressable>
          ))}
        </View>
      )}
    </ScreenLayout>
  );
};

const styles = StyleSheet.create({
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  markRead: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.purpleDeep,
  },
  clearRead: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.inkMuted,
  },
  heading: {
    marginBottom: 14,
  },
  filterBar: {
    marginBottom: 16,
  },
  emptyState: {
    paddingVertical: 44,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.inkPrimary,
  },
  emptySub: {
    fontSize: 12,
    lineHeight: 17,
    color: Colors.inkMuted,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairlineLight,
  },
  pressed: {
    opacity: 0.72,
  },
  catDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    marginTop: 5,
  },
  rowText: {
    flex: 1,
    gap: 3,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: Colors.inkPrimary,
  },
  titleRead: {
    fontWeight: '500',
    color: Colors.inkSecondary,
  },
  detail: {
    fontSize: 11,
    lineHeight: 15,
    color: Colors.inkMuted,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 2,
  },
  time: {
    fontSize: 11,
    color: Colors.inkSubtle,
  },
  openLink: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.purpleDeep,
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.coral,
  },
  dismissBtn: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  dismissText: {
    fontSize: 18,
    lineHeight: 18,
    color: Colors.inkSubtle,
  },
});
