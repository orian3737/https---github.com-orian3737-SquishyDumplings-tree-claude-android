import Stack from 'expo-router/stack';

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      {/* No swipe back: the reveal has already saved the dumpling by the time it
          is on screen, so returning to naming would imply it could be redone. */}
      <Stack.Screen name="reveal" options={{ gestureEnabled: false }} />
    </Stack>
  );
}
