/**
 * @format
 */

// Must be the very first import in the app. react-native-gesture-handler
// installs a native event handler that has to be in place before any view is
// mounted; importing it later produces gestures that silently never fire.
import "react-native-gesture-handler";

import { AppRegistry } from "react-native";
import { name as appName } from "./app.json";
import { App } from "./src/app";

AppRegistry.registerComponent(appName, () => App);
