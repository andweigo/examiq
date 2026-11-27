import React, {useCallback, useEffect, useState} from 'react';
import {AppState, BackHandler, StyleSheet, View} from 'react-native';
import {
  createNavigationContainerRef,
  DefaultTheme,
  NavigationContainer,
} from '@react-navigation/native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {ToastBanner} from '@components/common/ToastBanner';
import {NavigationSidebar} from '@components/layout/NavigationSidebar';
import {ServicesProvider} from '@context/ServicesContext';
import {SidebarProvider, useSidebar} from '@context/SidebarContext';
import {useServices} from '@hooks/useServices';
import {RootNavigator} from '@navigation/RootNavigator';
import {RootRoute, RootStackParamList} from '@navigation/routes';
import {Colors} from '@theme/colors';

const navigationRef = createNavigationContainerRef<RootStackParamList>();

const ExamIQNavigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: Colors.canvasLight,
    card: Colors.surfaceWhite,
    text: Colors.inkPrimary,
    border: Colors.hairlineLight,
    primary: Colors.inkPrimary,
  },
};

const ExamIQShell: React.FC = () => {
  const container = useServices();
  const {isOpen: sidebarOpen, closeSidebar} = useSidebar();
  const {examService, rosterService, scanningService, profileSettingsService} =
    container;
  const [hydrated, setHydrated] = useState<boolean>(
    !container.persistenceEngine.isNativeAvailable(),
  );
  const [activeRouteName, setActiveRouteName] = useState<string>(
    profileSettingsService.getState().isRegistered
      ? RootRoute.Dashboard
      : profileSettingsService.getState().hasSavedProfile
      ? RootRoute.Registration
      : RootRoute.Onboarding,
  );

  useEffect(() => {
    let active = true;
    container.hydrateFromSqlite().finally(() => {
      if (!active) {
        return;
      }
      const pState = profileSettingsService.getState();
      setActiveRouteName(
        pState.isRegistered
          ? RootRoute.Dashboard
          : pState.hasSavedProfile
          ? RootRoute.Registration
          : RootRoute.Onboarding,
      );
      setHydrated(true);
    });
    return () => {
      active = false;
    };
  }, [container, profileSettingsService]);

  // System Android back gesture: close sidebar if open, otherwise return to previous screen in history
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (sidebarOpen) {
        closeSidebar();
        return true;
      }
      if (navigationRef.isReady() && navigationRef.canGoBack()) {
        navigationRef.goBack();
        return true;
      }
      return false;
    });
    return () => {
      sub.remove();
    };
  }, [sidebarOpen, closeSidebar]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', nextState => {
      if (nextState !== 'active') {
        void container.flushNow();
      }
    });
    return () => {
      sub.remove();
    };
  }, [container]);

  const syncRouteName = useCallback(() => {
    const current = navigationRef.getCurrentRoute();
    if (current?.name) {
      setActiveRouteName(current.name);
    }
  }, []);

  const handleSidebarNavigate = useCallback(
    (route: RootRoute) => {
      if (!navigationRef.isReady()) {
        return;
      }
      const exam = examService.getSelectedExam();
      const student = rosterService.getSelectedGeneratorStudent(exam.section);
      const assignmentId = `${exam.id}-${student.id}`;

      switch (route) {
        case RootRoute.ExamBuilder:
          navigationRef.navigate(RootRoute.ExamBuilder, {examId: exam.id});
          return;
        case RootRoute.AnswerKey:
          navigationRef.navigate(RootRoute.AnswerKey, {examId: exam.id});
          return;
        case RootRoute.GeneratingOverlay:
          navigationRef.navigate(RootRoute.GeneratingOverlay, {
            examId: exam.id,
          });
          return;
        case RootRoute.ExamGenerator:
          navigationRef.navigate(RootRoute.ExamGenerator, {examId: exam.id});
          return;
        case RootRoute.ExamPaper:
          navigationRef.navigate(RootRoute.ExamPaper, {
            examId: exam.id,
            studentId: student.id,
          });
          return;
        case RootRoute.PaperScanner:
          scanningService.setActiveSession(student.id, exam.id);
          navigationRef.navigate(RootRoute.PaperScanner, {
            assignmentId,
            examId: exam.id,
            studentId: student.id,
          });
          return;
        case RootRoute.Alignment:
          navigationRef.navigate(RootRoute.Alignment, {
            scanId: `scan-${student.id}`,
            rawImageUri: 'local://captured-sheet-01.jpg',
          });
          return;
        case RootRoute.AutoCheck:
          navigationRef.navigate(RootRoute.AutoCheck, {
            scanId: `scan-${student.id}`,
          });
          return;
        case RootRoute.Review:
          navigationRef.navigate(RootRoute.Review, {
            scanId: `scan-${student.id}`,
          });
          return;
        default:
          navigationRef.navigate(route as never);
      }
    },
    [examService, rosterService, scanningService],
  );

  const handleSidebarLogout = useCallback(async () => {
    await container.logoutTeacherSession();
    container.toastService.show('Logged out');
    if (navigationRef.isReady()) {
      navigationRef.reset({
        index: 0,
        routes: [{name: RootRoute.Registration}],
      });
    }
  }, [container]);

  if (!hydrated) {
    return <View style={styles.splashBackdrop} />;
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={ExamIQNavigationTheme}
      onReady={syncRouteName}
      onStateChange={syncRouteName}>
      <RootNavigator />
      <NavigationSidebar
        activeRouteName={activeRouteName}
        onNavigate={handleSidebarNavigate}
        onLogout={handleSidebarLogout}
      />
      <ToastBanner />
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  splashBackdrop: {
    flex: 1,
    backgroundColor: Colors.canvasLight,
  },
});

export const ExamIQApp: React.FC = () => {
  return (
    <SafeAreaProvider>
      <ServicesProvider>
        <SidebarProvider>
          <ExamIQShell />
        </SidebarProvider>
      </ServicesProvider>
    </SafeAreaProvider>
  );
};
