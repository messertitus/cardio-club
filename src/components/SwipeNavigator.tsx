import { router, usePathname } from "expo-router";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { Animated, Easing, PanResponder, useWindowDimensions, View } from "react-native";

const MAIN_ROUTES = ["/", "/chat", "/members", "/menu"] as const;
const SWIPE_THRESHOLD = 64;

export function SwipeNavigator({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const currentIndex = MAIN_ROUTES.findIndex((route) => route === pathname);
  const tx = useRef(new Animated.Value(0)).current;
  const op = useRef(new Animated.Value(1)).current;
  const enterFrom = useRef(0);
  const navigating = useRef(false);

  // After navigation, the new screen slides in a touch from the swipe direction
  // and fades up — a crossfade, so the screen never blanks out mid-transition.
  useEffect(() => {
    navigating.current = false;
    if (enterFrom.current !== 0) {
      tx.setValue(enterFrom.current * width * 0.2);
      op.setValue(0);
      Animated.parallel([
        Animated.timing(tx, { toValue: 0, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(op, { toValue: 1, duration: 240, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]).start();
      enterFrom.current = 0;
    } else {
      tx.setValue(0);
      op.setValue(1);
    }
  }, [op, pathname, tx, width]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          !navigating.current && currentIndex >= 0 && Math.abs(gesture.dx) > 16 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.6,
        onPanResponderMove: (_, gesture) => {
          if (navigating.current || currentIndex < 0) return;
          const nextIndex = gesture.dx < 0 ? currentIndex + 1 : currentIndex - 1;
          const hasNext = Boolean(MAIN_ROUTES[nextIndex]);
          // Follow the finger (with rubber-band resistance at the ends) and dim a
          // little as it moves, so the gesture reads as a soft crossfade.
          const dx = hasNext ? gesture.dx : gesture.dx * 0.22;
          tx.setValue(dx);
          op.setValue(Math.max(0.55, 1 - Math.abs(dx) / (width * 1.6)));
        },
        onPanResponderRelease: (_, gesture) => {
          if (currentIndex < 0) return settleBack(tx, op);
          const goNext = gesture.dx < 0;
          const nextRoute = MAIN_ROUTES[goNext ? currentIndex + 1 : currentIndex - 1];
          const committed = Math.abs(gesture.dx) >= SWIPE_THRESHOLD || Math.abs(gesture.vx) > 0.35;
          if (committed && nextRoute) {
            navigating.current = true;
            enterFrom.current = goNext ? 1 : -1;
            // Fade the current screen out in place (no full slide-off → no blank),
            // then navigate; the new screen fades in via the effect above.
            Animated.parallel([
              Animated.timing(tx, { toValue: goNext ? -width * 0.2 : width * 0.2, duration: 160, easing: Easing.in(Easing.quad), useNativeDriver: true }),
              Animated.timing(op, { toValue: 0, duration: 150, easing: Easing.in(Easing.quad), useNativeDriver: true }),
            ]).start(({ finished }) => {
              if (finished) router.push(nextRoute);
            });
          } else {
            settleBack(tx, op);
          }
        },
        onPanResponderTerminate: () => settleBack(tx, op),
      }),
    [currentIndex, op, tx, width],
  );

  return (
    <View style={{ flex: 1, overflow: "hidden" }} {...panResponder.panHandlers}>
      <Animated.View style={{ flex: 1, opacity: op, transform: [{ translateX: tx }] }}>{children}</Animated.View>
    </View>
  );
}

function settleBack(tx: Animated.Value, op: Animated.Value) {
  Animated.parallel([
    Animated.spring(tx, { toValue: 0, useNativeDriver: true, damping: 26, stiffness: 240, mass: 0.7 }),
    Animated.timing(op, { toValue: 1, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: true }),
  ]).start();
}
