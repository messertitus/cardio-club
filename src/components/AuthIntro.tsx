import { useEffect, useRef } from "react";
import { Animated, Easing, Image, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useTheme } from "../context/ThemeContext";

const symbolLogo = require("../../assets/mcc-logo-white-symbol-transparent.png");

type AuthIntroProps = {
  onDone: () => void;
};

export function AuthIntro({ onDone }: AuthIntroProps) {
  const { width } = useWindowDimensions();
  const { mode, theme } = useTheme();
  const settle = useRef(new Animated.Value(0)).current;
  const mark = useRef(new Animated.Value(0)).current;
  const didFinish = useRef(false);

  useEffect(() => {
    Animated.sequence([
      Animated.delay(160),
      Animated.timing(settle, { toValue: 1, duration: 920, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      Animated.timing(mark, { toValue: 1, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
    ]).start(() => {
      if (didFinish.current) return;
      didFinish.current = true;
      onDone();
    });
  }, [mark, onDone, settle]);

  const compact = width < 390;
  const stageWidth = compact ? 214 : 286;
  const symbolHeight = stageWidth * 0.66;
  const wordmarkHeight = compact ? 66 : 82;
  const stageHeight = symbolHeight + wordmarkHeight + 14;
  const introScale = compact ? 2.05 : 2.2;
  const logoScale = settle.interpolate({ inputRange: [0, 1], outputRange: [introScale, 1] });
  const logoTranslateY = settle.interpolate({ inputRange: [0, 1], outputRange: [compact ? 54 : 74, 0] });
  const logoOpacity = settle.interpolate({ inputRange: [0, 0.1, 1], outputRange: [0, 1, 1] });
  const lineWidth = mark.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });

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
        <Image source={symbolLogo} resizeMode="contain" style={[styles.symbol, { height: symbolHeight, tintColor: mode === "light" ? "#05070b" : theme.text, width: stageWidth }]} />

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
          <View style={[styles.logoLineTrack, { backgroundColor: theme.border, width: stageWidth * 0.44 }]}>
            <Animated.View style={[styles.logoLineFill, { backgroundColor: theme.text, width: lineWidth }]} />
          </View>
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
});
