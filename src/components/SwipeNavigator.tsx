import { router, usePathname } from "expo-router";
import { useMemo, type ReactNode } from "react";
import { PanResponder, View } from "react-native";

const MAIN_ROUTES = ["/", "/chat", "/members", "/menu"] as const;
const SWIPE_THRESHOLD = 92;

export function SwipeNavigator({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const currentIndex = MAIN_ROUTES.findIndex((route) => route === pathname);
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          currentIndex >= 0 && Math.abs(gesture.dx) > 18 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.7,
        onPanResponderRelease: (_, gesture) => {
          if (currentIndex < 0 || Math.abs(gesture.dx) < SWIPE_THRESHOLD) return;
          const nextIndex = gesture.dx < 0 ? currentIndex + 1 : currentIndex - 1;
          const nextRoute = MAIN_ROUTES[nextIndex];
          if (nextRoute) router.push(nextRoute);
        },
      }),
    [currentIndex],
  );

  return (
    <View style={{ flex: 1 }} {...panResponder.panHandlers}>
      {children}
    </View>
  );
}
