import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {useProfileSettings} from '@hooks/index';
import {RootRoute, RootStackParamList} from '@navigation/routes';
import {
  AlignmentScreen,
  AnswerKeyScreen,
  AutoCheckScreen,
  BackupRestoreScreen,
  ClassesScreen,
  DashboardScreen,
  DeviceAlertsScreen,
  ExamBuilderScreen,
  ExamGeneratorScreen,
  ExamPaperScreen,
  ExamsScreen,
  GeneratingOverlayScreen,
  OnboardingScreen,
  PaperScannerScreen,
  ProfileScreen,
  QrScannerScreen,
  RegistrationScreen,
  ReportsScreen,
  ResultsScreen,
  ReviewScreen,
  ScanHistoryScreen,
  SettingsScreen,
  StudentsScreen,
  SubjectsScreen,
} from '@screens/index';
import {Colors} from '@theme/colors';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator: React.FC = () => {
  const {isRegistered, hasSavedProfile} = useProfileSettings();

  // First launch (no saved accounts on this device) shows the 3-slide onboarding.
  const initialRoute = isRegistered
    ? RootRoute.Dashboard
    : hasSavedProfile
    ? RootRoute.Registration
    : RootRoute.Onboarding;

  return (
    <Stack.Navigator
      initialRouteName={initialRoute}
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
        animation: 'fade_from_bottom',
        contentStyle: {backgroundColor: Colors.canvasLight},
      }}>
      {/* Onboarding / Local Registration */}
      <Stack.Screen name={RootRoute.Onboarding} component={OnboardingScreen} />
      <Stack.Screen
        name={RootRoute.Registration}
        component={RegistrationScreen}
      />

      {/* Home Flow */}
      <Stack.Screen name={RootRoute.Dashboard} component={DashboardScreen} />
      <Stack.Screen
        name={RootRoute.DeviceAlerts}
        component={DeviceAlertsScreen}
      />

      {/* Exams Flow */}
      <Stack.Screen name={RootRoute.Exams} component={ExamsScreen} />
      <Stack.Screen
        name={RootRoute.ExamBuilder}
        component={ExamBuilderScreen}
      />
      <Stack.Screen name={RootRoute.AnswerKey} component={AnswerKeyScreen} />
      <Stack.Screen
        name={RootRoute.GeneratingOverlay}
        component={GeneratingOverlayScreen}
        options={{contentStyle: {backgroundColor: Colors.canvasDark}}}
      />
      <Stack.Screen
        name={RootRoute.ExamGenerator}
        component={ExamGeneratorScreen}
      />
      <Stack.Screen name={RootRoute.ExamPaper} component={ExamPaperScreen} />

      {/* Scan & OMR Flow (Dark Canvas) */}
      <Stack.Screen
        name={RootRoute.QrScanner}
        component={QrScannerScreen}
        options={{contentStyle: {backgroundColor: Colors.canvasDark}}}
      />
      <Stack.Screen
        name={RootRoute.PaperScanner}
        component={PaperScannerScreen}
        options={{contentStyle: {backgroundColor: Colors.canvasDark}}}
      />
      <Stack.Screen
        name={RootRoute.Alignment}
        component={AlignmentScreen}
        options={{contentStyle: {backgroundColor: Colors.canvasDark}}}
      />
      <Stack.Screen
        name={RootRoute.AutoCheck}
        component={AutoCheckScreen}
        options={{contentStyle: {backgroundColor: Colors.canvasDark}}}
      />
      <Stack.Screen name={RootRoute.Review} component={ReviewScreen} />
      <Stack.Screen
        name={RootRoute.ScanHistory}
        component={ScanHistoryScreen}
        options={{contentStyle: {backgroundColor: Colors.canvasDark}}}
      />

      {/* Results & Reports Flow */}
      <Stack.Screen name={RootRoute.Results} component={ResultsScreen} />
      <Stack.Screen name={RootRoute.Reports} component={ReportsScreen} />

      {/* Profile & Records Flow */}
      <Stack.Screen name={RootRoute.Students} component={StudentsScreen} />
      <Stack.Screen name={RootRoute.Classes} component={ClassesScreen} />
      <Stack.Screen name={RootRoute.Subjects} component={SubjectsScreen} />
      <Stack.Screen
        name={RootRoute.BackupRestore}
        component={BackupRestoreScreen}
      />
      <Stack.Screen name={RootRoute.Profile} component={ProfileScreen} />
      <Stack.Screen name={RootRoute.Settings} component={SettingsScreen} />
    </Stack.Navigator>
  );
};
