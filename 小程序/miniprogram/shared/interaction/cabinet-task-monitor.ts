export function cabinetTaskTerminal(status: string) {
    return ['SUCCEEDED', 'FAILED_CONFIRMED', 'CANCELLED'].includes(status);
}

/** Observes one existing task. Never creates a task, queries the provider, or opens a door. */
export function createCabinetTaskMonitor<T extends { value: { task_id: string; status: string } }>(options: {
    taskId: string;
    read: (id: string) => { promise: Promise<T>; abort: () => void };
    active: () => boolean;
    update: (record: T, elapsed: number) => void;
    waiting: (elapsed: number, disconnected: boolean) => void;
    unavailable: (error: unknown) => void;
    expired: () => void;
    invalidated: () => void;
}) {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let abort: (() => void) | undefined;
    const started = Date.now();
    const deadline = setTimeout(() => {
        if (!current()) return;
        stop(); options.expired();
    }, 10 * 60_000);
    function stop() { stopped = true; clearTimeout(timer); clearTimeout(deadline); abort?.(); abort = undefined; }
    function current() {
        if (stopped) return false;
        if (options.active()) return true;
        stop(); options.invalidated(); return false;
    }
    async function read() {
        if (!current()) return;
        let disconnected = false;
        try {
            const request = options.read(options.taskId);
            abort = request.abort;
            const record = await request.promise;
            if (!current()) return;
            if (record.value.task_id !== options.taskId) {
                stop(); options.unavailable(new Error('柜机任务不匹配，请返回原订单核实')); return;
            }
            try { options.update(record, Date.now() - started); }
            catch (error) { stop(); options.unavailable(error); return; }
            if (cabinetTaskTerminal(record.value.status) || record.value.status === 'RESERVED') { stop(); return; }
        } catch (error) {
            if (!current()) return;
            const status = (error as { statusCode?: number })?.statusCode;
            if (status && status >= 400 && status < 500 && status !== 408 && status !== 429) {
                stop(); options.unavailable(error); return;
            }
            disconnected = true;
            options.waiting(Date.now() - started, true);
        } finally { abort = undefined; }
        if (current()) timer = setTimeout(() => { void read(); }, disconnected || Date.now() - started >= 60_000 ? 5_000 : 2_000);
    }
    return { start(delay = 0) { if (delay) timer = setTimeout(() => { void read(); }, delay); else void read(); }, stop };
}
