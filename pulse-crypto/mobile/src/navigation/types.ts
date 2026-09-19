/**
 * Navigation types.
 *
 * The global `RootParamList` declaration is what makes `useNavigation()`
 * typed without every call site restating the param list.
 */

export type TabParamList = {
  Terminal: { pair?: string } | undefined;
  Markets: undefined;
  Telemetry: undefined;
  Settings: undefined;
};

/**
 * The tab navigator is mounted directly under the container - there is no
 * enclosing stack, so these are the only routes that exist. Declaring a
 * wrapper route here would typecheck and then fail at runtime, because
 * React Navigation resolves names against the mounted tree, not this type.
 */
declare global {
   
  namespace ReactNavigation {
     
    interface RootParamList extends TabParamList {}
  }
}
