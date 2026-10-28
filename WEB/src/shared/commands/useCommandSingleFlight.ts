import { useState, useSyncExternalStore } from 'react';
import { CommandSingleFlight } from './commandSingleFlight';

export function useCommandSingleFlight() {
  const [controller] = useState(() => new CommandSingleFlight());
  useSyncExternalStore(
    (listener) => controller.subscribe(listener),
    () => controller.pendingKeys().join('|'),
    () => '',
  );
  return controller;
}
