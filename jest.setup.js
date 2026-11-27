const mockSafeAreaContext = require('react-native-safe-area-context/jest/mock').default;
jest.mock('react-native-safe-area-context', () => mockSafeAreaContext);

jest.mock('react-native-svg', () => {
  const React = require('react');
  const {View} = require('react-native');
  const MockSvg = props => React.createElement(View, props, props.children);
  return {
    __esModule: true,
    default: MockSvg,
    Svg: MockSvg,
    Path: MockSvg,
    Circle: MockSvg,
    Rect: MockSvg,
    Line: MockSvg,
    Polygon: MockSvg,
    Defs: MockSvg,
    LinearGradient: MockSvg,
    Stop: MockSvg,
  };
});

jest.mock('react-native-screens', () => {
  const React = require('react');
  const {View} = require('react-native');
  return {
    enableScreens: jest.fn(),
    compatibilityFlags: {},
    featureFlags: {experiment: {}},
    ScreenContainer: ({children}) => React.createElement(View, null, children),
    Screen: ({children}) => React.createElement(View, null, children),
    NativeScreen: ({children}) => React.createElement(View, null, children),
    NativeScreenContainer: ({children}) =>
      React.createElement(View, null, children),
    ScreenStack: ({children}) => React.createElement(View, null, children),
    ScreenStackItem: ({children}) => React.createElement(View, null, children),
    ScreenStackHeaderConfig: () => null,
    ScreenStackHeaderCenterView: () => null,
    ScreenStackHeaderLeftView: () => null,
    ScreenStackHeaderRightView: () => null,
    ScreenStackHeaderBackButtonImage: () => null,
    ScreenStackHeaderSearchBarView: () => null,
    SearchBar: () => null,
    FullWindowOverlay: ({children}) =>
      React.createElement(View, null, children),
  };
});
