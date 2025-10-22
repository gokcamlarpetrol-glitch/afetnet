// Custom Navigation Types for React Navigation v7
// Fixes TypeScript errors with id property requirements

declare module '@react-navigation/native' {
  import { ReactNode } from 'react';
  
  export interface NavigationContainerProps {
    children: ReactNode;
    onStateChange?: (state: any) => void;
    initialState?: any;
    linking?: any;
    fallback?: ReactNode;
    theme?: any;
    documentTitle?: any;
    independent?: boolean;
  }
  
  export function NavigationContainer(props: NavigationContainerProps): JSX.Element;
}

declare module '@react-navigation/stack' {
  import { ReactNode } from 'react';
  
  export interface StackNavigationOptions {
    headerShown?: boolean;
    title?: string;
    headerTitle?: string | ((props: any) => ReactNode);
    headerLeft?: (props: any) => ReactNode;
    headerRight?: (props: any) => ReactNode;
    headerStyle?: any;
    headerTitleStyle?: any;
    headerTintColor?: string;
    headerBackTitle?: string;
    headerBackTitleVisible?: boolean;
    headerBackImage?: (props: any) => ReactNode;
    headerPressColorAndroid?: string;
    headerTransparent?: boolean;
    headerBackground?: (props: any) => ReactNode;
    headerShadowVisible?: boolean;
    headerBlurEffect?: 'none' | 'light' | 'dark' | 'regular' | 'prominent' | 'extraLight' | 'extraDark';
    gestureEnabled?: boolean;
    gestureDirection?: 'horizontal' | 'horizontal-inverted' | 'vertical' | 'vertical-inverted';
    gestureResponseDistance?: number | { horizontal?: number; vertical?: number };
    gestureVelocityImpact?: number;
    fullScreenGestureEnabled?: boolean;
    animationEnabled?: boolean;
    animationTypeForReplace?: 'push' | 'pop';
    presentation?: 'card' | 'modal' | 'transparentModal' | 'containedModal' | 'containedTransparentModal' | 'fullScreenModal' | 'formSheet';
    cardStyle?: any;
    cardStyleInterpolator?: (props: any) => any;
    cardStyleInterpolatorForModal?: (props: any) => any;
    headerStyleInterpolator?: (props: any) => any;
    cardOverlayEnabled?: boolean;
    cardOverlay?: (props: any) => ReactNode;
    cardShadowEnabled?: boolean;
    cardBackgroundColor?: string;
    freezeOnBlur?: boolean;
    detachPreviousScreen?: boolean;
  }
  
  export interface StackNavigatorProps {
    children: ReactNode;
    screenOptions?: StackNavigationOptions | ((props: any) => StackNavigationOptions);
    initialRouteName?: string;
    screenListeners?: any;
    detachInactiveScreens?: boolean;
    sceneContainerStyle?: any;
    keyboardHandlingEnabled?: boolean;
    mode?: 'card' | 'modal';
    headerMode?: 'float' | 'screen' | 'none';
    gestureEnabled?: boolean;
    gestureDirection?: 'horizontal' | 'horizontal-inverted' | 'vertical' | 'vertical-inverted';
    gestureResponseDistance?: number | { horizontal?: number; vertical?: number };
    gestureVelocityImpact?: number;
    fullScreenGestureEnabled?: boolean;
    animationEnabled?: boolean;
    animationTypeForReplace?: 'push' | 'pop';
    presentation?: 'card' | 'modal' | 'transparentModal' | 'containedModal' | 'containedTransparentModal' | 'fullScreenModal' | 'formSheet';
    cardStyle?: any;
    cardStyleInterpolator?: (props: any) => any;
    cardStyleInterpolatorForModal?: (props: any) => any;
    headerStyleInterpolator?: (props: any) => any;
    cardOverlayEnabled?: boolean;
    cardOverlay?: (props: any) => ReactNode;
    cardShadowEnabled?: boolean;
    cardBackgroundColor?: string;
    freezeOnBlur?: boolean;
    detachPreviousScreen?: boolean;
  }
  
  export function createStackNavigator(): {
    Navigator: React.ComponentType<StackNavigatorProps>;
    Screen: React.ComponentType<any>;
    Group: React.ComponentType<any>;
  };
}

declare module '@react-navigation/bottom-tabs' {
  import { ReactNode } from 'react';
  
  export interface BottomTabNavigationOptions {
    title?: string;
    tabBarLabel?: string | ((props: any) => ReactNode);
    tabBarIcon?: (props: any) => ReactNode;
    tabBarBadge?: string | number | boolean;
    tabBarBadgeStyle?: any;
    tabBarButton?: (props: any) => ReactNode;
    tabBarAccessibilityLabel?: string;
    tabBarTestID?: string;
    tabBarStyle?: any;
    tabBarItemStyle?: any;
    tabBarLabelStyle?: any;
    tabBarIconStyle?: any;
    tabBarActiveTintColor?: string;
    tabBarInactiveTintColor?: string;
    tabBarActiveBackgroundColor?: string;
    tabBarInactiveBackgroundColor?: string;
    tabBarShowLabel?: boolean;
    tabBarShowIcon?: boolean;
    tabBarAllowFontScaling?: boolean;
    tabBarHideOnKeyboard?: boolean;
    tabBarVisibilityAnimationConfig?: any;
    tabBarAnimationEnabled?: boolean;
    tabBarGap?: number;
    tabBarPosition?: 'top' | 'bottom';
    tabBarBackground?: (props: any) => ReactNode;
    tabBarIndicator?: (props: any) => ReactNode;
    tabBarIndicatorStyle?: any;
    tabBarIndicatorContainerStyle?: any;
    tabBarContentContainerStyle?: any;
    tabBarStyle?: any;
    lazy?: boolean;
    unmountOnBlur?: boolean;
    freezeOnBlur?: boolean;
    sceneContainerStyle?: any;
    screenListeners?: any;
    detachInactiveScreens?: boolean;
    backBehavior?: 'initialRoute' | 'firstRoute' | 'order' | 'history' | 'none';
    safeAreaInsets?: any;
    sceneStyle?: any;
    tabBarHideOnKeyboard?: boolean;
    tabBarVisibilityAnimationConfig?: any;
    tabBarAnimationEnabled?: boolean;
    tabBarGap?: number;
    tabBarPosition?: 'top' | 'bottom';
    tabBarBackground?: (props: any) => ReactNode;
    tabBarIndicator?: (props: any) => ReactNode;
    tabBarIndicatorStyle?: any;
    tabBarIndicatorContainerStyle?: any;
    tabBarContentContainerStyle?: any;
  }
  
  export interface BottomTabNavigatorProps {
    children: ReactNode;
    screenOptions?: BottomTabNavigationOptions | ((props: any) => BottomTabNavigationOptions);
    initialRouteName?: string;
    screenListeners?: any;
    detachInactiveScreens?: boolean;
    sceneContainerStyle?: any;
    backBehavior?: 'initialRoute' | 'firstRoute' | 'order' | 'history' | 'none';
    safeAreaInsets?: any;
    sceneStyle?: any;
    tabBarHideOnKeyboard?: boolean;
    tabBarVisibilityAnimationConfig?: any;
    tabBarAnimationEnabled?: boolean;
    tabBarGap?: number;
    tabBarPosition?: 'top' | 'bottom';
    tabBarBackground?: (props: any) => ReactNode;
    tabBarIndicator?: (props: any) => ReactNode;
    tabBarIndicatorStyle?: any;
    tabBarIndicatorContainerStyle?: any;
    tabBarContentContainerStyle?: any;
  }
  
  export function createBottomTabNavigator(): {
    Navigator: React.ComponentType<BottomTabNavigatorProps>;
    Screen: React.ComponentType<any>;
    Group: React.ComponentType<any>;
  };
}
