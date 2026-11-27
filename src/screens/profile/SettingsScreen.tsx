import React, {useMemo, useState} from 'react';
import {Image, Pressable, StyleSheet, Text, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {AssetRegistry} from '@assets/index';
import {
  BackHeader,
  DisplayHeading,
  FormModal,
  ScreenLayout,
  SegmentedControl,
} from '@components/index';
import {DEFAULT_PASSING_PERCENTAGE} from '@constants/grading';
import {OMR_SENSITIVITY_PROFILES} from '@constants/omr';
import {
  PASSING_COMPUTATION_GUIDE,
  PRIVACY_POLICY_RA10173,
  SYSTEM_INFO,
  TERMS_OF_OFFLINE_USAGE,
} from '@constants/system';
import {OmrSensitivity} from '@core/types/common';
import {DeviceSettingsView} from '@data/database/SeedData';
import {
  useProfileSettings,
  useRoster,
  useScanning,
  useServices,
  useToast,
} from '@hooks/index';
import {RootRoute, RootStackParamList} from '@navigation/routes';
import {Colors} from '@theme/colors';
import {ScoreCalculator} from '@utils/ScoreCalculator';

type ToggleKey = keyof Omit<DeviceSettingsView, 'omrSensitivity'>;
type SystemModalKind = 'grading' | 'about' | 'privacy' | 'terms' | null;

const TOGGLE_ITEMS: ReadonlyArray<{
  key: ToggleKey;
  label: string;
  sub: string;
}> = [
  {
    key: 'autoCapture',
    label: 'Auto-capture aligned sheet',
    sub: 'Snap once 4/4 corner marks lock',
  },
  {
    key: 'flagDoubleShade',
    label: 'Flag double-shaded bubbles',
    sub: 'Require manual review on conflicts',
  },
  {
    key: 'autoLocalBackup',
    label: 'Weekly SQLite backup',
    sub: 'Remind to export copy to Downloads',
  },
  {
    key: 'lowScoreAlerts',
    label: 'Passing rate alerts',
    sub: `Notify when score dips below ${DEFAULT_PASSING_PERCENTAGE}%`,
  },
];

export const SettingsScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const container = useServices();
  const {teacher, backup, settings, service} = useProfileSettings();
  const {students} = useRoster();
  const {service: scanningService} = useScanning();
  const {showToast} = useToast();

  const [activeModal, setActiveModal] = useState<SystemModalKind>(null);

  const activeProfile = OMR_SENSITIVITY_PROFILES[settings.omrSensitivity];

  const liveSummary = useMemo(() => {
    if (students.length === 0) {
      return {
        isSample: true,
        summary: ScoreCalculator.summarizeClass([
          {earnedPoints: 45, maxPoints: 50},
          {earnedPoints: 30, maxPoints: 50},
          {earnedPoints: 40, maxPoints: 50},
          {earnedPoints: 50, maxPoints: 50},
        ]),
      };
    }
    return {
      isSample: false,
      summary: ScoreCalculator.summarizeClass(
        students.map(s => ({earnedPoints: s.score, maxPoints: s.total})),
      ),
    };
  }, [students]);

  const handleToggle = (key: ToggleKey) => {
    const nextEnabled = !settings[key];
    service.toggleSetting(key);
    if (key === 'flagDoubleShade') {
      const updated = scanningService.reapplyOmrSensitivity(
        settings.omrSensitivity,
        nextEnabled,
      );
      showToast(
        updated > 0
          ? `Updated ${updated} scanned item${updated === 1 ? '' : 's'}`
          : nextEnabled
            ? 'Double-shade flag on'
            : 'Double-shade flag off',
      );
    }
    void container.flushNow();
  };

  const handleSensitivityChange = (next: OmrSensitivity) => {
    service.setOmrSensitivity(next);
    const updated = scanningService.reapplyOmrSensitivity(
      next,
      settings.flagDoubleShade,
    );
    void container.flushNow();
    const label = OMR_SENSITIVITY_PROFILES[next].label;
    showToast(
      updated > 0
        ? `${label} · ${updated} item${updated === 1 ? '' : 's'} updated`
        : `${label} sensitivity saved`,
    );
  };

  const systemLinks: ReadonlyArray<{
    kind: Exclude<SystemModalKind, null>;
    label: string;
    meta: string;
  }> = [
    {
      kind: 'grading',
      label: 'Passing rate computation',
      meta: `${DEFAULT_PASSING_PERCENTAGE}% standard ›`,
    },
    {
      kind: 'about',
      label: 'System information',
      meta: `v${SYSTEM_INFO.version} · ${SYSTEM_INFO.developer} ›`,
    },
    {
      kind: 'privacy',
      label: 'Privacy & Data Privacy Act',
      meta: 'RA 10173 · Offline ›',
    },
    {
      kind: 'terms',
      label: 'Terms of offline usage',
      meta: 'Academic & local use ›',
    },
  ];

  return (
    <ScreenLayout activeTab="profile">
      <BackHeader onBack={() => navigation.navigate(RootRoute.Profile)} />

      <DisplayHeading
        lightText="System"
        boldText="settings"
        style={styles.heading}
      />

      {/* Scanner & Device Toggles */}
      <Text style={styles.sectionKicker}>SCANNER &amp; DEVICE</Text>
      <View style={styles.toggleGroup}>
        {TOGGLE_ITEMS.map(item => {
          const enabled = settings[item.key];
          return (
            <View key={item.key} style={styles.toggleRow}>
              <View style={styles.toggleText}>
                <Text style={styles.toggleLabel}>{item.label}</Text>
                <Text style={styles.toggleSub}>{item.sub}</Text>
              </View>

              <Pressable
                accessibilityRole="switch"
                accessibilityState={{checked: enabled}}
                onPress={() => handleToggle(item.key)}
                style={[
                  styles.switchTrack,
                  {
                    backgroundColor: enabled ? Colors.inkPrimary : '#D6D6D0',
                    alignItems: enabled ? 'flex-end' : 'flex-start',
                  },
                ]}>
                <View
                  style={[
                    styles.switchThumb,
                    {
                      backgroundColor: enabled
                        ? Colors.lime
                        : Colors.surfaceWhite,
                    },
                  ]}
                />
              </Pressable>
            </View>
          );
        })}
      </View>

      {/* Functional OMR Shading Sensitivity Control + Live Threshold Readout */}
      <View style={styles.sensitivitySection}>
        <View style={styles.sensitivityHeaderRow}>
          <Text style={styles.sensitivityTitle}>OMR shading sensitivity</Text>
        </View>

        <SegmentedControl<OmrSensitivity>
          compact
          value={settings.omrSensitivity}
          onChange={handleSensitivityChange}
          options={[
            {label: 'Strict', value: 'strict'},
            {label: 'Balanced', value: 'balanced'},
            {label: 'Lenient', value: 'lenient'},
          ]}
        />

        <View style={styles.profileReadout}>
          <View style={styles.metricsRow}>
            <View style={styles.metricCell}>
              <Text style={styles.metricLabel}>Min fill</Text>
              <Text style={styles.metricVal}>
                ≥{Math.round(activeProfile.minShadedRatio * 100)}%
              </Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricCell}>
              <Text style={styles.metricLabel}>Row contrast</Text>
              <Text style={styles.metricVal}>
                +{Math.round(activeProfile.rowDeltaRatio * 100)}%
              </Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricCell}>
              <Text style={styles.metricLabel}>Max ink spill</Text>
              <Text style={styles.metricVal}>
                ≤{Math.round(activeProfile.maxBleedRatio * 100)}%
              </Text>
            </View>
          </View>
          <Text style={styles.profileDesc}>{activeProfile.description}</Text>
        </View>
      </View>

      {/* System Information, Grading Computation, RA 10173 Privacy & Offline Terms */}
      <Text style={styles.sectionKicker}>SYSTEM, GRADING &amp; PRIVACY</Text>
      <View style={styles.systemLinksGroup}>
        {systemLinks.map(link => (
          <Pressable
            key={link.kind}
            onPress={() => setActiveModal(link.kind)}
            style={({pressed}) => [styles.linkRow, pressed && styles.pressed]}>
            <Text style={styles.linkLabel}>{link.label}</Text>
            <Text style={styles.linkMeta}>{link.meta}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.footerMeta}>
        <Text style={styles.footerPrimary}>
          {SYSTEM_INFO.appName} v{SYSTEM_INFO.version} · Developed by{' '}
          {SYSTEM_INFO.developer}
        </Text>
        <Text style={styles.footerSub}>
          100% Offline · Compliant with RA 10173 (Data Privacy Act)
        </Text>
      </View>

      {/* Modal 1: How Overall Passing Rate is Computed */}
      <FormModal
        visible={activeModal === 'grading'}
        title="Passing rate computation"
        subtitle={`How ExamIQ calculates individual and class ${DEFAULT_PASSING_PERCENTAGE}% passing metrics offline`}
        onClose={() => setActiveModal(null)}>
        <View style={styles.liveExampleCard}>
          <Text style={styles.exampleKicker}>
            {liveSummary.isSample
              ? 'WORKED EXAMPLE (4 STUDENTS · 50 ITEMS)'
              : `LIVE CLASS SUMMARY (${liveSummary.summary.totalStudents} STUDENTS)`}
          </Text>
          <View style={styles.exampleKpiRow}>
            <View style={styles.exampleKpi}>
              <Text style={styles.exampleNum}>
                {liveSummary.summary.passingRate}%
              </Text>
              <Text style={styles.exampleLbl}>
                Passing ({liveSummary.summary.passedCount}/
                {liveSummary.summary.totalStudents})
              </Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.exampleKpi}>
              <Text style={styles.exampleNum}>
                {liveSummary.summary.meanScore}
              </Text>
              <Text style={styles.exampleLbl}>Mean score</Text>
            </View>
          </View>
          <Text style={styles.exampleFormula}>
            ({liveSummary.summary.passedCount} passed ÷{' '}
            {liveSummary.summary.totalStudents} total) × 100 ={' '}
            {liveSummary.summary.passingRate}%
          </Text>
        </View>

        {PASSING_COMPUTATION_GUIDE.map(step => (
          <View key={step.title} style={styles.policyBlock}>
            <Text style={styles.policyHeading}>{step.title}</Text>
            <View style={styles.formulaChip}>
              <Text style={styles.formulaChipText}>{step.formula}</Text>
            </View>
            <Text style={styles.policyBody}>{step.explanation}</Text>
          </View>
        ))}
      </FormModal>

      {/* Modal 2: System Information & Developer */}
      <FormModal
        visible={activeModal === 'about'}
        title="System information"
        subtitle={SYSTEM_INFO.tagline}
        onClose={() => setActiveModal(null)}>
        <View style={styles.aboutHero}>
          <Image
            source={AssetRegistry.branding.appLogo}
            style={styles.aboutLogo}
          />
          <View style={styles.aboutHeroText}>
            <Text style={styles.aboutAppName}>{SYSTEM_INFO.appName}</Text>
            <Text style={styles.aboutVersion}>
              Version {SYSTEM_INFO.version} (Build {SYSTEM_INFO.buildNumber})
            </Text>
          </View>
        </View>

        <View style={styles.specList}>
          {[
            {label: 'Developer', value: SYSTEM_INFO.developer},
            {label: 'System version', value: `v${SYSTEM_INFO.version} (Build ${SYSTEM_INFO.buildNumber})`},
            {label: 'Application ID', value: SYSTEM_INFO.packageId},
            {label: 'Operation mode', value: SYSTEM_INFO.networkMode},
            {label: 'Architecture', value: SYSTEM_INFO.architecture},
            {label: 'OMR engine', value: SYSTEM_INFO.omrTemplate},
            {label: 'Paper formats', value: SYSTEM_INFO.paperSupport},
            {label: 'Local database', value: `examiq_offline.db (${backup.databaseSizeLabel})`},
            {label: 'Device storage ID', value: teacher.deviceId},
          ].map(spec => (
            <View key={spec.label} style={styles.specRow}>
              <Text style={styles.specLabel}>{spec.label}</Text>
              <Text style={styles.specValue}>{spec.value}</Text>
            </View>
          ))}
        </View>
      </FormModal>

      {/* Modal 3: Privacy Policy & Philippine Data Privacy Act (RA 10173) */}
      <FormModal
        visible={activeModal === 'privacy'}
        title="Data Privacy Act (RA 10173)"
        subtitle="Offline-only privacy notice & data subject rights"
        onClose={() => setActiveModal(null)}>
        {PRIVACY_POLICY_RA10173.map(section => (
          <View key={section.heading} style={styles.policyBlock}>
            <Text style={styles.policyHeading}>{section.heading}</Text>
            <Text style={styles.policyBody}>{section.body}</Text>
          </View>
        ))}
      </FormModal>

      {/* Modal 4: Terms of Offline Usage */}
      <FormModal
        visible={activeModal === 'terms'}
        title="Terms of offline usage"
        subtitle={`ExamIQ v${SYSTEM_INFO.version} · Developed by ${SYSTEM_INFO.developer}`}
        onClose={() => setActiveModal(null)}>
        {TERMS_OF_OFFLINE_USAGE.map(section => (
          <View key={section.heading} style={styles.policyBlock}>
            <Text style={styles.policyHeading}>{section.heading}</Text>
            <Text style={styles.policyBody}>{section.body}</Text>
          </View>
        ))}
      </FormModal>
    </ScreenLayout>
  );
};

const styles = StyleSheet.create({
  heading: {
    marginBottom: 18,
  },
  sectionKicker: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.9,
    color: Colors.inkSubtle,
    marginBottom: 4,
  },
  toggleGroup: {
    marginBottom: 22,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairlineLight,
  },
  toggleText: {
    flex: 1,
  },
  toggleLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.inkPrimary,
  },
  toggleSub: {
    fontSize: 11,
    color: Colors.inkMuted,
    marginTop: 2,
  },
  switchTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    padding: 2,
    justifyContent: 'center',
  },
  switchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  sensitivitySection: {
    marginBottom: 24,
  },
  sensitivityHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sensitivityTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.inkPrimary,
  },
  sensitivityBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.limeDeep,
  },
  profileReadout: {
    marginTop: 14,
    gap: 10,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricCell: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  metricLabel: {
    fontSize: 10,
    color: Colors.inkMuted,
  },
  metricVal: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.inkPrimary,
    fontVariant: ['tabular-nums'],
  },
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: Colors.hairlineLight,
  },
  profileDesc: {
    fontSize: 11,
    lineHeight: 16,
    color: Colors.inkMuted,
  },
  systemLinksGroup: {
    marginBottom: 22,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairlineLight,
  },
  linkLabel: {
    fontSize: 13.5,
    fontWeight: '600',
    color: Colors.inkPrimary,
  },
  linkMeta: {
    fontSize: 11.5,
    color: Colors.inkMuted,
  },
  pressed: {
    opacity: 0.72,
  },
  footerMeta: {
    alignItems: 'center',
    paddingVertical: 10,
    gap: 3,
  },
  footerPrimary: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.inkSecondary,
    textAlign: 'center',
  },
  footerSub: {
    fontSize: 10.5,
    color: Colors.inkSubtle,
    textAlign: 'center',
  },
  liveExampleCard: {
    gap: 10,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairlineLight,
  },
  exampleKicker: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.7,
    color: Colors.inkMuted,
  },
  exampleKpiRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  exampleKpi: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  exampleNum: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.inkPrimary,
  },
  exampleLbl: {
    fontSize: 11,
    color: Colors.inkMuted,
  },
  exampleFormula: {
    fontSize: 11.5,
    fontWeight: '600',
    color: Colors.purpleDeep,
    textAlign: 'center',
  },
  formulaChip: {
    paddingVertical: 2,
  },
  formulaChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.purpleDeep,
  },
  policyBlock: {
    gap: 6,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairlineLight,
  },
  policyHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.inkPrimary,
  },
  policyBody: {
    fontSize: 12,
    lineHeight: 18,
    color: Colors.inkSecondary,
  },
  aboutHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairlineLight,
  },
  aboutLogo: {
    width: 54,
    height: 54,
    borderRadius: 14,
  },
  aboutHeroText: {
    flex: 1,
  },
  aboutAppName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.inkPrimary,
  },
  aboutVersion: {
    fontSize: 12,
    color: Colors.inkMuted,
    marginTop: 2,
  },
  specList: {
    gap: 10,
  },
  specRow: {
    gap: 2,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairlineLight,
  },
  specLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.4,
    color: Colors.inkMuted,
    textTransform: 'uppercase',
  },
  specValue: {
    fontSize: 12.5,
    fontWeight: '600',
    color: Colors.inkPrimary,
    lineHeight: 17,
  },
});
