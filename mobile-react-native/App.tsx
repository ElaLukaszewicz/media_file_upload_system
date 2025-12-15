import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { UploadItem, UploadState } from "../shared/uploadState";

type Screen = "dashboard" | "uploads" | "history";

const stubUploadState: UploadState = {
  overallPercent: 20,
  items: [
    {
      file: {
        id: "a",
        name: "field-notes.jpg",
        size: 840_000,
        type: "image/jpeg",
      },
      status: "uploading",
      progress: { uploadedBytes: 420_000, totalBytes: 840_000, percent: 50 },
      retries: 0,
    },
    {
      file: {
        id: "b",
        name: "intro.mp4",
        size: 5_000_000,
        type: "video/mp4",
      },
      status: "queued",
      progress: { uploadedBytes: 0, totalBytes: 5_000_000, percent: 0 },
      retries: 0,
    },
  ],
};

function UploadRow({ item }: { item: UploadItem }) {
  return (
    <View style={styles.uploadCard}>
      <View style={styles.uploadHeader}>
        <View>
          <Text style={styles.uploadName}>{item.file.name}</Text>
          <Text style={styles.muted}>
            {Math.round(item.file.size / 1024)} KB • {item.file.type}
          </Text>
        </View>
        <Text style={styles.status}>{item.status}</Text>
      </View>
      <View style={styles.progress}>
        <View
          style={[styles.progressFill, { width: `${item.progress.percent}%` }]}
        />
      </View>
      <Text style={styles.muted}>
        Uploaded {item.progress.uploadedBytes} of {item.progress.totalBytes} bytes
      </Text>
    </View>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionDescription}>{description}</Text>
      {children}
    </View>
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [uploadState] = useState<UploadState>(stubUploadState);

  const highlighted = useMemo(
    () => uploadState.items.slice(0, 1),
    [uploadState.items],
  );

  const renderScreen = () => {
    switch (screen) {
      case "dashboard":
        return (
          <Section
            title="Overview"
            description="Quick glance at active uploads."
          >
            <View style={styles.card}>
              <Text style={styles.muted}>Overall progress</Text>
              <View style={styles.progress}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${uploadState.overallPercent}%` },
                  ]}
                />
              </View>
              <Text style={styles.percentText}>{uploadState.overallPercent}%</Text>
            </View>
            <FlatList
              data={highlighted}
              keyExtractor={(item) => item.file.id}
              renderItem={({ item }) => <UploadRow item={item} />}
              ListEmptyComponent={<Text style={styles.muted}>No uploads yet.</Text>}
            />
          </Section>
        );
      case "uploads":
        return (
          <Section
            title="Upload manager"
            description="Manage current queue. API wiring will be added later."
          >
            <View style={styles.actions}>
              <Pressable style={styles.ghostButton}>
                <Text>Select files</Text>
              </Pressable>
              <Pressable style={styles.ghostButton}>
                <Text>Clear completed</Text>
              </Pressable>
            </View>
            <FlatList
              data={uploadState.items}
              keyExtractor={(item) => item.file.id}
              renderItem={({ item }) => <UploadRow item={item} />}
            />
          </Section>
        );
      case "history":
        return (
          <Section
            title="History"
            description="Recent uploads will appear when persistence is connected."
          >
            <Text style={styles.muted}>
              Shell is ready for history data.
            </Text>
          </Section>
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>Media upload system</Text>
          <Text style={styles.heading}>Mobile client shell</Text>
        </View>
        <View style={styles.nav}>
          {(["dashboard", "uploads", "history"] as Screen[]).map((value) => (
            <Pressable
              key={value}
              style={[
                styles.navItem,
                screen === value ? styles.navItemActive : null,
              ]}
              onPress={() => setScreen(value)}
            >
              <Text style={styles.navText}>{value}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      {renderScreen()}
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
    padding: 16,
  },
  header: {
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 12,
    borderColor: "#e2e8f0",
    borderWidth: 1,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  eyebrow: {
    color: "#64748b",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  heading: {
    fontSize: 18,
    fontWeight: "600",
  },
  nav: {
    flexDirection: "row",
    gap: 8,
  },
  navItem: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#fff",
  },
  navItemActive: {
    borderColor: "#2563eb",
    backgroundColor: "#eff6ff",
  },
  navText: {
    textTransform: "capitalize",
  },
  section: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 12,
    gap: 8,
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  sectionDescription: {
    color: "#64748b",
    marginBottom: 4,
  },
  card: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  percentText: {
    fontWeight: "600",
    marginTop: 6,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 4,
  },
  ghostButton: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#fff",
  },
  uploadCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    backgroundColor: "#fff",
  },
  uploadHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  uploadName: {
    fontWeight: "600",
    fontSize: 15,
  },
  status: {
    textTransform: "capitalize",
  },
  muted: {
    color: "#475569",
    marginTop: 4,
  },
  progress: {
    height: 8,
    backgroundColor: "#e2e8f0",
    borderRadius: 999,
    marginTop: 8,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#2563eb",
  },
});
