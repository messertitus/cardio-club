import { createContext, useCallback, useContext, useMemo, useRef, type PropsWithChildren } from "react";
import { Animated, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";

// Drives the floating bottom navigation: it grows back to full size near the top
// or when scrolling up, and shrinks a touch while scrolling down — like the
// recent Instagram bottom bar. Screens with a scroll view feed their scroll
// events in; the shared scale value is consumed by every <BottomNav/>.

const FULL = 1;
const SHRUNK = 0.9;

type NavChromeValue = {
  scale: Animated.Value;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  reset: () => void;
};

const noop = () => {};
const NavChromeContext = createContext<NavChromeValue | null>(null);

export function NavChromeProvider({ children }: PropsWithChildren) {
  const scale = useRef(new Animated.Value(FULL)).current;
  const lastY = useRef(0);
  const target = useRef(FULL);

  const animateTo = useCallback(
    (to: number) => {
      if (target.current === to) return;
      target.current = to;
      Animated.spring(scale, { toValue: to, useNativeDriver: false, friction: 9, tension: 120 }).start();
    },
    [scale],
  );

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = event.nativeEvent.contentOffset.y;
      const delta = y - lastY.current;
      lastY.current = y;
      // Always full near the very top; otherwise react to scroll direction with a
      // small dead-zone so tiny jitters don't toggle the size.
      if (y <= 10) animateTo(FULL);
      else if (delta > 4) animateTo(SHRUNK);
      else if (delta < -4) animateTo(FULL);
    },
    [animateTo],
  );

  const reset = useCallback(() => {
    lastY.current = 0;
    animateTo(FULL);
  }, [animateTo]);

  const value = useMemo<NavChromeValue>(() => ({ scale, onScroll, reset }), [scale, onScroll, reset]);
  return <NavChromeContext.Provider value={value}>{children}</NavChromeContext.Provider>;
}

export function useNavChrome(): NavChromeValue {
  const context = useContext(NavChromeContext);
  // Fall back to inert values so a <BottomNav/> still renders without a provider.
  const fallbackScale = useRef(new Animated.Value(FULL)).current;
  return context ?? { scale: fallbackScale, onScroll: noop, reset: noop };
}
