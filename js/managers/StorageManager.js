class StorageManager {
    static SAVE_KEY = 'dtech_floorplan_v2';

    static saveLocal(json) {
        try {
            localStorage.setItem(this.SAVE_KEY, json);
            return true;
        } catch (e) {
            console.error("Failed to save to local storage:", e);
            return false;
        }
    }

    static loadLocal() {
        return localStorage.getItem(this.SAVE_KEY);
    }

    static exportJSON(json, filename) {
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename.endsWith('.json') ? filename : `${filename}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
}
