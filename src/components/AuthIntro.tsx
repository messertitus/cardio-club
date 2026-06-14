import { useEffect, useRef } from "react";
import { Animated, Easing, Image, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useTheme } from "../context/ThemeContext";

const symbolLogo = require("../../assets/mcc-logo-white-symbol-transparent.png");
const blackSymbolLogo = require("../../assets/mcc-logo-black-symbol-transparent.png");

type AuthIntroProps = {
  onDone: () => void;
  memberCount?: number | null;
};

export function AuthIntro({ onDone, memberCount }: AuthIntroProps) {
  const { width } = useWindowDimensions();
  const { mode, theme } = useTheme();
  const settle = useRef(new Animated.Value(0)).current;
  const mark = useRef(new Animated.Value(0)).current;
  const didFinish = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  // Run the intro exactly once on mount. On mobile, re-renders from dimension /
  // safe-area / keyboard changes must NEVER restart the sequence mid-zoom — that
  // is what made the logo freeze and the menu fade in too early. Ordering stays
  // logo zoom (settle) → wordmark fade (mark) → onDone (reveal the menu).
  useEffect(() => {
    const intro = Animated.sequence([
      Animated.delay(160),
      Animated.timing(settle, { toValue: 1, duration: 920, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      Animated.timing(mark, { toValue: 1, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
    ]);
    intro.start(({ finished }) => {
      if (!finished || didFinish.current) return;
      didFinish.current = true;
      onDoneRef.current();
    });
    return () => intro.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const compact = width < 390;
  const stageWidth = compact ? 214 : 286;
  const symbolHeight = stageWidth * 0.66;
  const hasMemberCount = typeof memberCount === "number";
  // The member count lives INSIDE the wordmark, right under the line. The
  // with-count height is sized TIGHT to the actual content (MESSERS + CARDIO
  // CLUB + bar + count) so there is no slack below the count — otherwise that
  // slack pushes the title ("Willkommen zurück.") far away. The no-count height
  // keeps the original breathing room.
  const wordmarkHeight = hasMemberCount ? (compact ? 76 : 85) : (compact ? 66 : 82);
  const stageHeight = symbolHeight + wordmarkHeight + (hasMemberCount ? 2 : 14);
  const introScale = compact ? 2.05 : 2.2;
  const logoScale = settle.interpolate({ inputRange: [0, 1], outputRange: [introScale, 1] });
  const logoTranslateY = settle.interpolate({ inputRange: [0, 1], outputRange: [compact ? 54 : 74, 0] });
  const logoOpacity = settle.interpolate({ inputRange: [0, 0.1, 1], outputRange: [0, 1, 1] });
  const lineWidth = mark.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });
  // Fade the member count in WITH the wordmark, but only to a subtle 0.6.
  const memberCountOpacity = mark.interpolate({ inputRange: [0, 1], outputRange: [0, 0.6] });

  return (
    <View style={[styles.slot, { height: stageHeight }]}>
      <Animated.View
        style={[
          styles.logoStage,
          {
            opacity: logoOpacity,
            width: stageWidth,
            height: stageHeight,
            transform: [{ translateY: logoTranslateY }, { scale: logoScale }],
          },
        ]}
      >
        <Image source={mode === "light" ? blackSymbolLogo : symbolLogo} resizeMode="contain" style={[styles.symbol, { height: symbolHeight, width: stageWidth }]} />

        <Animated.View
          style={[
            styles.wordmark,
            {
              width: stageWidth,
              height: wordmarkHeight,
              opacity: mark,
              transform: [{ translateY: mark.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
            },
          ]}
        >
          <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.wordmarkTop, { color: theme.text }, compact && styles.wordmarkTopCompact]}>
            MESSERS
          </Text>
          <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.wordmarkBottom, { color: theme.text }, compact && styles.wordmarkBottomCompact]}>
            CARDIO CLUB
          </Text>
          <Animated.View style={[styles.logoLineTrack, { opacity: mark, width: stageWidth * 0.44 }]}>
            <Animated.View style={[styles.logoLineFill, { backgroundColor: theme.text, width: lineWidth }]} />
          </Animated.View>

          {hasMemberCount ? (
            <Animated.Text style={[styles.memberCount, { color: theme.muted, opacity: memberCountOpacity }]} numberOfLines={1}>
              {memberCount} {memberCount === 1 ? "Mitglied" : "Mitglieder"} aktuell
            </Animated.Text>
          ) : null}
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    alignItems: "center",
    justifyContent: "flex-start",
    overflow: "visible",
    width: "100%",
  },
  logoStage: {
    alignItems: "center",
  },
  symbol: {
    marginBottom: -10,
  },
  wordmark: {
    alignItems: "center",
    justifyContent: "flex-start",
    marginTop: -4,
  },
  wordmarkTop: {
    width: "100%",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 10,
    lineHeight: 18,
    textAlign: "center",
  },
  wordmarkTopCompact: {
    fontSize: 13,
    letterSpacing: 8,
    lineHeight: 16,
  },
  wordmarkBottom: {
    width: "100%",
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: 3,
    lineHeight: 38,
    textAlign: "center",
  },
  wordmarkBottomCompact: {
    fontSize: 29,
    letterSpacing: 2,
    lineHeight: 33,
  },
  logoLineTrack: {
    alignItems: "center",
    borderRadius: 999,
    height: 4,
    marginTop: 4,
    overflow: "hidden",
  },
  logoLineFill: {
    borderRadius: 999,
    height: "100%",
  },
  memberCount: {
    marginTop: 8,
    fontSize: 11,
    lineHeight: 13,
    fontWeight: "700",
    letterSpacing: 2,
    textAlign: "center",
    textTransform: "uppercase",
  },
});
