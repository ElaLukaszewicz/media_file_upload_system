import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { UploadProvider } from './state/uploadContext';
import { UploadScreen } from './screens/UploadScreen';
import { HistoryScreen } from './screens/HistoryScreen';

type TabParamList = {
  Upload: undefined;
  History: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

const TAB_ICONS: Record<
  string,
  { focused: keyof typeof Ionicons.glyphMap; outline: keyof typeof Ionicons.glyphMap }
> = {
  Upload: { focused: 'cloud-upload', outline: 'cloud-upload-outline' },
  History: { focused: 'time', outline: 'time-outline' },
};

const DEFAULT_ICONS = { focused: 'help-outline' as const, outline: 'help-outline' as const };

export default function App() {
  return (
    <UploadProvider>
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={({ route }) => {
            const icons = TAB_ICONS[route.name] || DEFAULT_ICONS;

            return {
              headerShown: false,
              tabBarIcon: ({ focused, color, size }) => (
                <Ionicons
                  name={focused ? icons.focused : icons.outline}
                  size={size}
                  color={color}
                />
              ),
              tabBarActiveTintColor: '#007AFF',
              tabBarInactiveTintColor: '#8E8E93',
              tabBarStyle: {
                backgroundColor: '#FFFFFF',
                borderTopWidth: 1,
                borderTopColor: '#E5E5EA',
                height: 64,
              },
              tabBarLabelStyle: {
                fontSize: 12,
                fontWeight: '500',
              },
            };
          }}
        >
          <Tab.Screen name="Upload" component={UploadScreen} />
          <Tab.Screen name="History" component={HistoryScreen} />
        </Tab.Navigator>
        <StatusBar style="auto" />
      </NavigationContainer>
    </UploadProvider>
  );
}
