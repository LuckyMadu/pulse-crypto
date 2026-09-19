/**
 * Buy/sell pressure and spread (R18).
 *
 * Both meters are shown rather than one bar split in two, because the mockup
 * shows two and because the pair of numbers is easier to read aloud than a
 * single position. They always sum to 100 - see `computePressure` on the
 * gateway.
 */

import { memo } from "react";
import { View } from "react-native";
import { MeterBar, Surface, Text } from "@design-system";
import { formatPrice } from "@utils";
import { styles } from "./PressurePanel.styles";

export interface PressurePanelProps {
  buyPressure: number;
  sellPressure: number;
  spread: number;
  spreadPct: number;
  priceDecimals: number;
}

export const PressurePanel = memo(
  ({ buyPressure, sellPressure, spread, spreadPct, priceDecimals }: PressurePanelProps) => (
    <Surface level="elevated" padding="md" radius="md" style={styles.container}>
      <View style={styles.meters}>
        <View style={styles.meter}>
          <View style={styles.meterHeader}>
            <Text variant="label" tone="muted">
              Buy Pressure
            </Text>
            <Text variant="numericSmall" tone="up">
              {buyPressure.toFixed(1)}%
            </Text>
          </View>
          <MeterBar
            value={buyPressure}
            tone="up"
            accessibilityLabel={`Buy pressure ${buyPressure.toFixed(0)} percent`}
          />
        </View>

        <View style={styles.meter}>
          <View style={styles.meterHeader}>
            <Text variant="label" tone="muted">
              Sell Pressure
            </Text>
            <Text variant="numericSmall" tone="down">
              {sellPressure.toFixed(1)}%
            </Text>
          </View>
          <MeterBar
            value={sellPressure}
            tone="down"
            accessibilityLabel={`Sell pressure ${sellPressure.toFixed(0)} percent`}
          />
        </View>
      </View>

      <View style={styles.spreadRow}>
        <Text variant="label" tone="muted">
          Spread
        </Text>
        <Text variant="numericSmall" tone="secondary">
          {formatPrice(spread, priceDecimals)} ({spreadPct.toFixed(3)}%)
        </Text>
      </View>
    </Surface>
  ),
);

PressurePanel.displayName = "PressurePanel";
