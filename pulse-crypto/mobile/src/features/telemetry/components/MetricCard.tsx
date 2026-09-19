/**
 * A labelled metric tile for the Telemetry screen.
 *
 * Values render in JetBrains Mono for the same reason everything else numeric
 * does: these update once a second and would otherwise reflow as digit widths
 * change.
 */

import { memo } from "react";
import { View } from "react-native";
import { Surface, Text, TextTone } from "@design-system";
import { styles } from "./MetricCard.styles";

export interface MetricCardProps {
  label: string;
  value: string;
  unit?: string;
  caption?: string;
  tone?: TextTone;
}

export const MetricCard = memo(
  ({ label, value, unit, caption, tone = "primary" }: MetricCardProps) => (
    <Surface level="elevated" padding="md" radius="md" style={styles.card}>
      <Text variant="label" tone="muted">
        {label}
      </Text>
      <View style={styles.valueRow}>
        <Text variant="numericLarge" tone={tone}>
          {value}
        </Text>
        {unit ? (
          <Text variant="label" tone="muted">
            {unit}
          </Text>
        ) : null}
      </View>
      {caption ? (
        <Text variant="caption" tone="muted">
          {caption}
        </Text>
      ) : null}
    </Surface>
  ),
);

MetricCard.displayName = "MetricCard";
