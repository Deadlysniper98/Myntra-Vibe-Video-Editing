import React, { useRef } from "react";
import { Pressable, Text, View } from "react-native";
import { CustomMotionView, type CustomMotionViewRef } from "../src";
import buttonPress from "./button-press.motion.json";

// Minimal Expo/React Native usage. The developer never touches visual math — they
// drop the JSON in and drive its inputs. Mirrors the integration sketch in the brief.
export default function App() {
  const motionRef = useRef<CustomMotionViewRef>(null);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 24 }}>
      <CustomMotionView
        ref={motionRef}
        source={buttonPress as never}
        style={{ width: 300, height: 300 }}
      />

      {/* Hold to drive the `isPressed` boolean the .motion state machine listens for. */}
      <Pressable
        onPressIn={() => motionRef.current?.setInput("isPressed", true)}
        onPressOut={() => motionRef.current?.setInput("isPressed", false)}
        style={{ paddingHorizontal: 28, paddingVertical: 12, backgroundColor: "#AE33FF", borderRadius: 12 }}
      >
        <Text style={{ color: "white", fontWeight: "700" }}>Hold me</Text>
      </Pressable>
    </View>
  );
}
