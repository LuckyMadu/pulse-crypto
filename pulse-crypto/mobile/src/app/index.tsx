/**
 * The provider nest.
 *
 * Order is load-bearing:
 *
 *   GestureHandlerRootView  - must be the outermost native view
 *   SafeAreaProvider        - the app bar reads insets during first layout
 *   Redux Provider          - RTK Query hooks need the store
 *   MarketStreamProvider    - opens the socket; depends on nothing above but
 *                             must wrap every screen that reads the stream
 *
 * The stream provider deliberately sits *inside* Redux rather than beside it,
 * so there is one obvious answer to "where does the socket live" - even though
 * the two do not currently talk to each other.
 */

import { StatusBar } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Provider } from "react-redux";
import { colors } from "@design-system";
import { RootNavigator } from "@navigation";
import { MarketStreamProvider } from "@realtime";
import { store } from "@store";
import { styles } from "./index.styles";

export const App = () => (
  <GestureHandlerRootView style={styles.root}>
    <SafeAreaProvider>
      <Provider store={store}>
        <MarketStreamProvider>
          <StatusBar barStyle="light-content" backgroundColor={colors.bg.topbar} />
          <RootNavigator />
        </MarketStreamProvider>
      </Provider>
    </SafeAreaProvider>
  </GestureHandlerRootView>
);
