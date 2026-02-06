/**
 * AUTH NAVIGATOR - Authentication Flow Navigator
 * Contains all auth screens: Login, Register, ForgotPassword
 * ELITE: Ensures proper navigation between auth screens
 */

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

// Auth Screens
import { LoginScreen } from '../screens/auth/LoginScreen';
import { EmailRegisterScreen } from '../screens/auth/EmailRegisterScreen';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';

const Stack = createStackNavigator();

export default function AuthNavigator() {
    return (
        <Stack.Navigator
            id={undefined}
            initialRouteName="Login"
            screenOptions={{
                headerShown: false,
                cardStyle: { backgroundColor: '#000' },
            }}
        >
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="EmailRegister" component={EmailRegisterScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        </Stack.Navigator>
    );
}
