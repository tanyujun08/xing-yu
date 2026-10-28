import { createOperationScope, OperationDisposedError } from './operation-scope';
import { createNavigateOnce } from './navigate-once';
/** Local UI ownership only. A disposed view never cancels a server business operation. */
export function createRentalPageState<T>(scope = createOperationScope(), navigation = createNavigateOnce()) {
    return {
        scope, navigation, owner: '', epoch: 0,
        async run<TValue>(key: string, task: () => TValue | Promise<TValue>): Promise<TValue | undefined> {
            if (!this.visible || scope.disposed)
                return;
            try {
                return await scope.singleFlight(key, task);
            }
            catch (error) {
                if (error instanceof OperationDisposedError && scope.disposed)
                    return;
                throw error;
            }
        },
        visible: false, id: '', current: null as T | null, abort: undefined as (() => void) | undefined,
        show(owner: string) { this.visible = true; if (this.owner !== owner) {
            this.current = null;
            this.epoch++;
        } this.owner = owner; },
        capture(readOwner: () => string | null) {
            const epoch = this.epoch, owner = this.owner;
            return () => this.visible && !this.scope.disposed && this.epoch === epoch && this.owner === owner && (readOwner() ?? '') === owner;
        },
        hide() { this.visible = false; this.epoch++; this.abort?.(); this.scope.onHide(); },
        dispose() { this.hide(); this.scope.dispose(); this.navigation.dispose(); },
    };
}
