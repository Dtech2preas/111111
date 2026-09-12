class HistoryEngine extends EventEmitter {
    constructor() {
        super();
        this.history = [];
        this.historyIndex = -1;
    }

    saveState(state) {
        // If we are not at the end of history, truncate the future
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }

        this.history.push(JSON.parse(JSON.stringify(state)));
        this.historyIndex++;
        this.emitStateChange();
    }

    undo() {
        if (this.canUndo()) {
            this.historyIndex--;
            this.emitStateChange();
            return JSON.parse(JSON.stringify(this.history[this.historyIndex]));
        }
        return null;
    }

    redo() {
        if (this.canRedo()) {
            this.historyIndex++;
            this.emitStateChange();
            return JSON.parse(JSON.stringify(this.history[this.historyIndex]));
        }
        return null;
    }

    canUndo() {
        return this.historyIndex > 0;
    }

    canRedo() {
        return this.historyIndex < this.history.length - 1;
    }

    clear() {
        this.history = [];
        this.historyIndex = -1;
        this.emitStateChange();
    }

    emitStateChange() {
        this.emit('history_changed', {
            canUndo: this.canUndo(),
            canRedo: this.canRedo()
        });
    }
}
