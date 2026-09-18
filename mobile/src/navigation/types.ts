/**
 * Navigation types.
 *
 * The global `RootParamList` declaration is what makes `useNavigation()`
 * typed without every call site restating the param list.
 */

import { NavigatorScreenParams } from "@react-navigation/native";

export type TabParamList = {
  Terminal: { pair?: string } | undefined;
  Markets: undefined;
  Telemetry: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList>;
};

declare global {
   
  namespace ReactNavigation {
     
    interface RootParamList extends RootStackParamList {}
  }
}
