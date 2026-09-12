class StorageManager {
    static SAVE_KEY = 'dtech_floorplan_v2';

    static saveLocal(json, floorLevel = 0) {
        const key = `${this.SAVE_KEY}_floor_${floorLevel}`;
        try {
            localStorage.setItem(key, json);
            return true;
        } catch (e) {
            console.error("Failed to save to local storage:", e);
            return false;
        }
    }

    static loadLocal(floorLevel = 0) {
        const key = `${this.SAVE_KEY}_floor_${floorLevel}`;
        return localStorage.getItem(key);
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
